// The RPC commands (design doc §8.3; spec R). One handler per command in the
// `Rpc` contract. `session.*` and the ETag check live in the HTTP layer.

import type { AnalysedFile, DraftJob, MediaType, Options, Preview, RpcErrorBody, RpcMethod } from '@re-name/protocol';
import { parsePath } from './naming/parse.ts';
import type { State } from './state.ts';
import { TmdbError } from './tmdb.ts';
import { buildTree, checkPath } from './tree.ts';

export class HttpError extends Error {
  constructor(readonly status: number, readonly body: RpcErrorBody) {
    super(body.message);
  }
}

const fail = (status: number, error: string, message: string, details?: string[]): never => {
  throw new HttpError(status, details ? { error, message, details } : { error, message });
};

// deno-lint-ignore no-explicit-any
type Params = any;
export type Handler = (params: Params) => Promise<unknown>;

/** Turns TMDB failures into HTTP ones (spec T1.8). */
async function fromTmdb<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof TmdbError) {
      fail(error.status, error.status === 404 ? 'not-found' : 'tmdb-unreachable', error.message);
    }
    throw error;
  }
}

const isType = (v: unknown): v is MediaType => v === 'movie' || v === 'tv';
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0);

/** Checks a draft's shape, so later code can trust it. */
function checkDraft(d: Params): DraftJob {
  const ok = d && isType(d.type) && Number.isInteger(d.tmdbId) && Array.isArray(d.files) &&
    d.files.every((f: Params) =>
      f && typeof f.path === 'string' && isNumOrNull(f.season) && isNumOrNull(f.episode) &&
      Array.isArray(f.tags) &&
      f.tags.every((t: Params) =>
        t && typeof t.source === 'string' && (t.value === null || typeof t.value === 'string')
      ) &&
      Array.isArray(f.groups) && f.groups.every((g: unknown) => typeof g === 'string')
    );
  if (!ok) fail(422, 'invalid-draft', 'The draft Job isn’t in the expected shape.');
  return d as DraftJob;
}

/**
 * Spec R6.1: each path names an available video file, or one in `forJobId`'s Job.
 * With `strict` off (for suggestions), skipped and queued files are allowed.
 */
function analyse(state: State, paths: unknown, strict: boolean, forJobId: string | null = null): AnalysedFile[] {
  if (!Array.isArray(paths)) fail(422, 'invalid-files', '"files" must be a list of paths.');
  const queued = state.queued(forJobId);
  return (paths as unknown[]).map((path) => {
    const [ok, file] = checkPath(path, state.scan);
    if (!ok) return fail(422, 'file-not-found', file);
    if (strict && file.skip) fail(422, 'file-skipped', `${file.path} can’t be renamed (${file.skip}).`);
    if (strict && queued.has(file.path)) fail(422, 'file-queued', `${file.path} is already in a Job.`);
    const p = parsePath(file.path, state.run.rules);
    return {
      path: file.path,
      parsedTitle: p.title,
      parsedYear: p.year,
      season: p.season,
      episode: p.episode,
      tags: p.tags,
      groups: p.groups,
    };
  });
}

/** Names `draft` in the Queue, last or in place of `replacesJobId` (spec R6.2). */
async function preview(state: State, draft: DraftJob, replacesJobId: string | null): Promise<Preview> {
  await fromTmdb(() => state.details(draft.type, draft.tmdbId)).catch((error) => {
    if (error instanceof HttpError && error.status === 404) {
      fail(422, 'unknown-title', 'The matched TMDB title wasn’t found.');
    }
    throw error;
  });
  const DRAFT = '__draft';
  const jobs = state.jobs.map((j) => (j.id === replacesJobId ? { id: DRAFT, draft } : j));
  if (!jobs.some((j) => j.id === DRAFT)) jobs.push({ id: DRAFT, draft });
  return (await state.name(jobs)).get(DRAFT) as Preview;
}

/** Spec R7.2, R7.3. */
async function putJob(state: State, draftIn: unknown, replacesJobId: string | null) {
  const draft = checkDraft(draftIn);
  if (draft.files.length === 0) fail(422, 'invalid-draft', 'A Job needs at least one file.');
  const queued = state.queued(replacesJobId);
  const clash = draft.files.map((f) => f.path).filter((p) => queued.has(p));
  if (clash.length) fail(409, 'files-already-queued', 'Some files are already in another Job.', clash);
  analyse(state, draft.files.map((f) => f.path), true, replacesJobId);
  const p = await preview(state, draft, replacesJobId);
  if (!p.ok) {
    fail(
      422,
      'invalid-draft',
      'Some files can’t be named.',
      p.files.filter((f) => f.error).map((f) => `${f.path}: ${f.error}`),
    );
  }
  if (replacesJobId) state.jobs = state.jobs.map((j) => (j.id === replacesJobId ? { id: j.id, draft } : j));
  else state.jobs.push({ id: state.newJobId(), draft });
  state.version++;
  return state.queue();
}

const findJob = (state: State, jobId: unknown) => {
  if (!state.jobs.some((j) => j.id === jobId)) fail(404, 'job-not-found', 'That Job isn’t in the Queue.');
};

/** The handlers, except `session.*`. `apply` starts the apply (spec R7.5, A1). */
export function handlers(state: State, apply: () => Promise<void>): Partial<Record<RpcMethod, Handler>> {
  return {
    'options.get': () => Promise.resolve(state.options),
    'options.set': async (p: Partial<Options>) => {
      if (p.flavour !== 'plex' && p.flavour !== 'jellyfin' && p.flavour !== 'emby') {
        fail(422, 'invalid-options', 'The media server must be plex, jellyfin or emby.');
      }
      state.options = { flavour: p.flavour as Options['flavour'], includeEpisodeName: p.includeEpisodeName !== false };
      state.optionsChosen = true;
      state.version++;
      return { options: state.options, queue: await state.queue() };
    },
    'tree.get': async () => {
      await state.rescan();
      return { root: buildTree(state.session().sourceName, state.scan, state.queued()) };
    },
    'tmdb.getSuggestions': (p) => fromTmdb(() => state.run.tmdb.suggest(analyse(state, p.files, false))),
    'tmdb.search': (p) =>
      fromTmdb(() => state.run.tmdb.search(String(p.query ?? ''), isType(p.type) ? p.type : undefined)),
    'tmdb.getDetails': (p) => {
      if (!isType(p.type) || !Number.isInteger(p.tmdbId)) fail(422, 'invalid-title', 'Give a type and a TMDB ID.');
      return fromTmdb(() => state.details(p.type, p.tmdbId));
    },
    'job.analyseFiles': (p) => Promise.resolve(analyse(state, p.files, true, p.forJobId ?? null)),
    'job.getPreview': (p) => preview(state, checkDraft(p.draft), p.replacesJobId ?? null),
    'queue.get': () => state.queue(),
    'queue.addJob': (p) => putJob(state, p.draft, null),
    'queue.replaceJob': (p) => {
      findJob(state, p.jobId);
      return putJob(state, p.draft, p.jobId);
    },
    'queue.removeJob': (p) => {
      findJob(state, p.jobId);
      state.jobs = state.jobs.filter((j) => j.id !== p.jobId);
      state.version++;
      return state.queue();
    },
    'queue.apply': async () => {
      if (state.jobs.length === 0) fail(422, 'queue-empty', 'The Queue is empty.');
      if (state.applying) fail(409, 'already-applying', 'The Queue is already being applied.');
      await apply();
      return { started: true };
    },
  };
}
