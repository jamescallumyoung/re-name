// MOCK: a stand-in for the re-name server (design doc, section 8). It answers the
// same RPC commands with real `Response` objects: statuses, ETags and error bodies.
// Its state survives a reload (in sessionStorage), as the real server's would,
// while the webapp's draft Job doesn't.

import type {
  AnalysedFile,
  ApplyResult,
  DraftJob,
  FileNode,
  FolderNode,
  Job,
  Match,
  MediaType,
  Options,
  Preview,
  Queue,
  RpcErrorBody,
  RpcMethod,
  ServerEvent,
} from '@re-name/protocol';
import { QUEUE_COMMANDS } from '@re-name/protocol';
import { CATALOGUE, findTitle, sizeOf, SOURCE_FILES, SOURCE_NAME, TARGET_FILES, TARGET_NAME } from './data.ts';
import { nameQueue, type QueuedDraft } from './naming.ts';
import { isVideo, parseName } from './parse.ts';

const STORAGE_KEY = 're-name.poc.mock-server';
const DRAFT_ID = '__draft';

/** Things the POC controls panel can change. */
export interface MockControls {
  latency: 'fast' | 'normal' | 'slow';
  /** Stop the next apply with an error at this file (1-based), or never. */
  failApplyAt: number | null;
  /** Make the next apply's check against the disk fail. */
  diskChanged: boolean;
  /** Pretend another tab holds the session (applies on the next claim). */
  otherTab: boolean;
  /** Pretend re-name was started with --dry-run (applies on the next claim). */
  dryRun: boolean;
}

interface State {
  options: Options;
  jobs: QueuedDraft[];
  targetFiles: string[];
  /** Source paths moved into the target by an apply. */
  moved: string[];
  nextJob: number;
  version: number;
  controls: MockControls;
}

const initialState = (): State => ({
  options: { flavour: 'plex', includeEpisodeName: true },
  jobs: [],
  targetFiles: [...TARGET_FILES],
  moved: [],
  nextJob: 1,
  version: 1,
  controls: { latency: 'normal', failApplyAt: null, diskChanged: false, otherTab: false, dryRun: false },
});

class HttpError extends Error {
  constructor(readonly status: number, readonly body: RpcErrorBody) {
    super(body.message);
  }
}

const fail = (status: number, error: string, message: string, details?: string[]): never => {
  throw new HttpError(status, details ? { error, message, details } : { error, message });
};

/** A minimal `EventSource` stand-in: `message` events carrying JSON. */
export class MockEventSource extends EventTarget {
  readyState = 0;
  constructor(private readonly onClose: (source: MockEventSource) => void) {
    super();
    setTimeout(() => {
      this.readyState = 1;
      this.dispatchEvent(new Event('open'));
    }, 30);
  }
  send(event: ServerEvent): void {
    if (this.readyState === 1) this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) }));
  }
  close(): void {
    this.readyState = 2;
    this.onClose(this);
  }
}

export class MockServer {
  private state: State;
  private readonly streams = new Set<MockEventSource>();
  private applying = false;

  constructor(private readonly storage: Storage | null = globalThis.sessionStorage ?? null) {
    this.state = this.load();
    setInterval(() => this.broadcast({ type: 'heartbeat' }), 5000);
  }

  // ---------- controls (the POC panel) ----------

  get controls(): MockControls {
    return { ...this.state.controls };
  }

  setControls(change: Partial<MockControls>): void {
    this.state.controls = { ...this.state.controls, ...change };
    this.save();
  }

  reset(): void {
    this.state = initialState();
    this.save();
  }

  /** Pushes an event as if the server sent it: Ctrl-C, or another tab taking over. */
  push(event: ServerEvent): void {
    this.broadcast(event);
  }

  // ---------- transport ----------

  /** A `fetch` for `/rpc/<method>`; anything else is a 404. */
  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(new URL(String(input instanceof Request ? input.url : input), location.href), init);
    const method = new URL(request.url).pathname.replace(/^\/rpc\//, '') as RpcMethod;
    const params = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    await this.delay(method);
    try {
      if (QUEUE_COMMANDS.includes(method)) {
        const ifMatch = request.headers.get('if-match');
        if (ifMatch === null) fail(428, 'precondition-required', 'This command needs the Queue’s ETag.');
        if (ifMatch !== this.etag) fail(412, 'stale-queue', 'The Queue changed since you last saw it.');
      }
      const body = this.handle(method, params);
      const headers = new Headers({ 'content-type': 'application/json', etag: this.etag });
      if (body === null) return new Response(null, { status: 204, headers });
      return new Response(JSON.stringify(body), { status: method === 'queue.apply' ? 202 : 200, headers });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      return new Response(JSON.stringify(error.body), {
        status: error.status,
        headers: { 'content-type': 'application/json', etag: this.etag },
      });
    }
  };

  openEvents = (): MockEventSource => {
    const source = new MockEventSource((s) => this.streams.delete(s));
    this.streams.add(source);
    return source;
  };

  private broadcast(event: ServerEvent): void {
    for (const s of this.streams) s.send(event);
  }

  private get etag(): string {
    return `"q-${this.state.version}"`;
  }

  private delay(method: RpcMethod): Promise<void> {
    const scale = { fast: 0.2, normal: 1, slow: 4 }[this.state.controls.latency];
    const base = method.startsWith('tmdb.') ? 350 : 60;
    return new Promise((resolve) => setTimeout(resolve, (base + Math.random() * base) * scale));
  }

  // ---------- commands ----------

  // deno-lint-ignore no-explicit-any
  private handle(method: RpcMethod, p: any): unknown {
    const s = this.state;
    switch (method) {
      case 'session.claim':
        if (s.controls.otherTab) fail(409, 'session-held', 're-name is already open in another tab.');
        return {
          session: { sourceName: SOURCE_NAME, targetName: TARGET_NAME, dryRun: s.controls.dryRun },
          options: s.options,
          queue: this.queue(),
        };
      case 'session.end':
        return null;
      case 'options.get':
        return s.options;
      case 'options.set':
        if (!['plex', 'jellyfin', 'emby'].includes(p.flavour)) fail(422, 'invalid-options', 'Unknown flavour.');
        s.options = { flavour: p.flavour, includeEpisodeName: Boolean(p.includeEpisodeName) };
        this.bump();
        return { options: s.options, queue: this.queue() };
      case 'tree.get':
        return { root: this.tree() };
      case 'tmdb.getSuggestions':
        return this.suggest(this.analyse(p.files ?? [], false));
      case 'tmdb.search':
        return this.search(String(p.query ?? ''), p.type);
      case 'tmdb.getDetails': {
        const details = findTitle(p.type, p.tmdbId);
        if (!details) fail(404, 'not-found', 'TMDB has no such title.');
        return details;
      }
      case 'job.analyseFiles':
        return this.analyse(p.files ?? [], true, p.forJobId ?? null);
      case 'job.getPreview':
        return this.preview(p.draft, p.replacesJobId);
      case 'queue.get':
        return this.queue();
      case 'queue.addJob':
        return this.addJob(p.draft, null);
      case 'queue.replaceJob':
        if (!s.jobs.some((j) => j.id === p.jobId)) fail(404, 'job-not-found', 'That Job isn’t in the Queue.');
        return this.addJob(p.draft, p.jobId);
      case 'queue.removeJob':
        if (!s.jobs.some((j) => j.id === p.jobId)) fail(404, 'job-not-found', 'That Job isn’t in the Queue.');
        s.jobs = s.jobs.filter((j) => j.id !== p.jobId);
        this.bump();
        return this.queue();
      case 'queue.apply':
        return this.apply();
      default:
        return fail(404, 'unknown-command', `There's no command called ${method}.`);
    }
  }

  private queue(): Queue {
    const previews = nameQueue(this.state.jobs, this.state.options, this.state.targetFiles);
    const jobs: Job[] = this.state.jobs.map(({ id, draft }) => {
      const d = findTitle(draft.type, draft.tmdbId);
      const match: Match = d
        ? { type: d.type, tmdbId: d.tmdbId, title: d.title, year: d.year, posterUrl: d.posterUrl }
        : { type: draft.type, tmdbId: draft.tmdbId, title: 'Unknown', year: 0, posterUrl: null };
      return { id, draft, match, preview: previews.get(id) as Preview };
    });
    return { jobs };
  }

  private bump(): void {
    this.state.version++;
    this.save();
  }

  private queuedPaths(exceptJob: string | null = null): Map<string, string> {
    const map = new Map<string, string>();
    for (const job of this.state.jobs) {
      if (job.id !== exceptJob) { for (const f of job.draft.files) map.set(f.path, job.id); }
    }
    return map;
  }

  private sourceFiles(): string[] {
    const moved = new Set(this.state.moved);
    return SOURCE_FILES.filter((p) => !p.startsWith(`${TARGET_NAME}/`) && !moved.has(p) && isVideo(p));
  }

  private tree(): FolderNode {
    const queued = this.queuedPaths();
    const root: FolderNode = { kind: 'folder', name: SOURCE_NAME, path: '', children: [] };
    for (const path of this.sourceFiles()) {
      const parts = path.split('/');
      let folder = root;
      for (const [i, name] of parts.slice(0, -1).entries()) {
        const folderPath = parts.slice(0, i + 1).join('/');
        let next = folder.children.find((c): c is FolderNode => c.kind === 'folder' && c.path === folderPath);
        if (!next) {
          next = { kind: 'folder', name, path: folderPath, children: [] };
          folder.children.push(next);
        }
        folder = next;
      }
      const name = parts[parts.length - 1] ?? path;
      const parsed = parseName(name, parts.slice(0, -1).some((f) => /^sample$/i.test(f)));
      const jobId = queued.get(path);
      const file: FileNode = {
        kind: 'file',
        name,
        path,
        size: sizeOf(path),
        status: parsed.skip
          ? { state: 'skipped', reason: parsed.skip }
          : jobId
          ? { state: 'queued', jobId }
          : { state: 'available' },
      };
      folder.children.push(file);
    }
    const sort = (f: FolderNode) => {
      f.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
      f.children.forEach((c) => c.kind === 'folder' && sort(c));
    };
    sort(root);
    return root;
  }

  private analyse(paths: string[], strict: boolean, exceptJob: string | null = null): AnalysedFile[] {
    const available = new Set(this.sourceFiles());
    const queued = this.queuedPaths(exceptJob);
    return paths.map((path) => {
      const name = path.slice(path.lastIndexOf('/') + 1);
      const parsed = parseName(name, /(^|\/)sample\//i.test(path));
      if (strict && !available.has(path)) fail(422, 'file-not-found', `${path} isn’t in the source.`);
      if (strict && parsed.skip) fail(422, 'file-skipped', `${name} can’t be renamed (${parsed.skip}).`);
      if (strict && queued.has(path)) fail(422, 'file-queued', `${name} is already in a Job.`);
      return {
        path,
        parsedTitle: parsed.title,
        parsedYear: parsed.year,
        season: parsed.season,
        episode: parsed.episode,
        tags: parsed.tags,
        groups: parsed.groups,
      };
    });
  }

  private suggest(files: AnalysedFile[]): Match[] {
    const counts = new Map<string, { title: string; year: number | null; tv: boolean; n: number }>();
    for (const f of files) {
      const key = `${f.parsedTitle.toLowerCase()}|${f.parsedYear ?? ''}`;
      const entry = counts.get(key) ?? { title: f.parsedTitle, year: f.parsedYear, tv: f.episode !== null, n: 0 };
      entry.n++;
      counts.set(key, entry);
    }
    const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    if (!best) return [];
    const words = tokens(best.title);
    return CATALOGUE.map((d) => {
      const t = tokens(d.title);
      const overlap = words.filter((w) => t.includes(w)).length / Math.max(words.length, t.length, 1);
      const score = overlap * 10 + (best.year === d.year ? 3 : 0) + ((d.type === 'tv') === best.tv ? 2 : 0);
      return { d, score };
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ d }) => ({ type: d.type, tmdbId: d.tmdbId, title: d.title, year: d.year, posterUrl: d.posterUrl }));
  }

  private search(query: string, type?: MediaType): Match[] {
    const words = tokens(query);
    if (words.length === 0) return [];
    return CATALOGUE.filter((d) =>
      (!type || d.type === type) && words.every((w) => tokens(d.title).some((t) => t.startsWith(w)))
    )
      .map((d) => ({ type: d.type, tmdbId: d.tmdbId, title: d.title, year: d.year, posterUrl: d.posterUrl }));
  }

  private withDraft(draft: DraftJob, replacesJobId: string | null): QueuedDraft[] {
    const jobs = this.state.jobs.map((j) => (j.id === replacesJobId ? { id: DRAFT_ID, draft } : j));
    if (!replacesJobId || !jobs.some((j) => j.id === DRAFT_ID)) jobs.push({ id: DRAFT_ID, draft });
    return jobs;
  }

  private preview(draft: DraftJob, replacesJobId: string | null = null): Preview {
    if (!findTitle(draft.type, draft.tmdbId)) fail(422, 'unknown-title', 'The matched title wasn’t found.');
    return nameQueue(this.withDraft(draft, replacesJobId), this.state.options, this.state.targetFiles).get(
      DRAFT_ID,
    ) as Preview;
  }

  private addJob(draft: DraftJob, replacesJobId: string | null): Queue {
    const s = this.state;
    if (!draft?.files?.length) fail(422, 'invalid-draft', 'A Job needs at least one file.');
    const clash = draft.files.filter((f) => this.queuedPaths(replacesJobId).has(f.path)).map((f) => f.path);
    if (clash.length) fail(409, 'files-already-queued', 'Some files are already in another Job.', clash);
    this.analyse(draft.files.map((f) => f.path), true, replacesJobId);
    const preview = this.preview(draft, replacesJobId);
    if (!preview.ok) {
      const errors = preview.files.filter((f) => f.error).map((f) => `${f.path}: ${f.error}`);
      fail(422, 'invalid-draft', 'Some files can’t be named.', errors);
    }
    if (replacesJobId) s.jobs = s.jobs.map((j) => (j.id === replacesJobId ? { id: j.id, draft } : j));
    else s.jobs.push({ id: `job-${s.nextJob++}`, draft });
    this.bump();
    return this.queue();
  }

  // ---------- applying ----------

  private apply(): { started: true } {
    const s = this.state;
    if (this.applying) fail(409, 'already-applying', 'The Queue is already being applied.');
    if (s.jobs.length === 0) fail(422, 'queue-empty', 'The Queue is empty.');
    if (s.controls.diskChanged) {
      s.controls.diskChanged = false;
      this.save();
      const changed = s.jobs.flatMap((j) => j.draft.files.map((f) => f.path)).slice(0, 2);
      fail(422, 'disk-changed', 'Files changed on disk since they were read. Nothing was moved.', changed);
    }
    this.applying = true;
    void this.runApply();
    return { started: true };
  }

  private async runApply(): Promise<void> {
    const s = this.state;
    const dryRun = s.controls.dryRun;
    const previews = this.queue().jobs;
    const steps = previews.flatMap((job) =>
      job.preview.files.map((f) => ({ jobId: job.id, path: f.path, newPath: f.newPath ?? '' }))
    );
    const failAt = s.controls.failApplyAt;
    s.controls.failApplyAt = null;
    const done = new Set<string>();
    let error: ApplyResult['error'] = null;
    for (const [index, step] of steps.entries()) {
      this.broadcast({ type: 'apply-progress', progress: { ...step, index, total: steps.length } });
      await new Promise((r) => setTimeout(r, { fast: 60, normal: 280, slow: 900 }[s.controls.latency]));
      if (failAt === index + 1) {
        error = { path: step.path, message: 'Permission denied (EACCES) while moving the file.' };
        break;
      }
      done.add(step.path);
      if (!dryRun) {
        s.moved.push(step.path);
        s.targetFiles.push(step.newPath);
      }
    }
    if (!dryRun) {
      // Finished Jobs leave the Queue; a half-applied Job keeps only its unmoved files.
      s.jobs = s.jobs
        .map((j) => ({ ...j, draft: { ...j.draft, files: j.draft.files.filter((f) => !done.has(f.path)) } }))
        .filter((j) => j.draft.files.length > 0);
      this.bump();
    }
    this.applying = false;
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    this.broadcast({
      type: 'apply-done',
      result: {
        dryRun,
        moved: done.size,
        total: steps.length,
        error,
        logPath: `~/Library/Application Support/re-name/logs/apply-${stamp}.json`,
        queue: this.queue(),
        etag: this.etag,
      },
    });
  }

  // ---------- persistence ----------

  private load(): State {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) return { ...initialState(), ...JSON.parse(raw) };
    } catch {
      // A broken or blocked store starts afresh.
    }
    return initialState();
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignored: the mock just won't survive a reload.
    }
  }
}

const tokens = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
