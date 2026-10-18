import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { FolderNode, Queue, TreeNode } from '@re-name/protocol';
import { type Handler, handlers, HttpError } from '../rpc.ts';
import { BLADE_RUNNER, draftOf, DUNE, makeWorld, SEVERANCE_S01, type World } from './helpers.ts';

let world: World;
let rpc: Record<string, Handler>;
let applied = 0;
beforeEach(async () => {
  world = await makeWorld();
  applied = 0;
  rpc = handlers(world.state, () => {
    applied++;
    return Promise.resolve();
  }) as Record<string, Handler>;
});
afterEach(() => world.cleanup());

const call = (method: string, params: unknown = {}) => rpc[method]!(params);
async function failure(method: string, params: unknown): Promise<[number, string, string[] | undefined]> {
  try {
    await call(method, params);
  } catch (error) {
    if (error instanceof HttpError) return [error.status, error.body.error, error.body.details];
    throw error;
  }
  throw new Error(`${method} didn't fail`);
}

describe('options', () => {
  it('starts with the configured flavour and episode names on (R3.1)', async () => {
    expect(await call('options.get')).toEqual({ flavour: 'plex', includeEpisodeName: true });
  });

  it('sets the options, marks them chosen, and renames the Queue (R3.2)', async () => {
    await call('queue.addJob', { draft: draftOf('movie', 335984, BLADE_RUNNER) });
    const before = world.state.version;
    const r = await call('options.set', { flavour: 'jellyfin', includeEpisodeName: false }) as { queue: Queue };
    expect(world.state.session().optionsChosen).toBe(true);
    expect(world.state.version).toBe(before + 1);
    expect(r.queue.jobs[0]?.preview.files[0]?.newPath).toContain('[tmdbid-335984]');
    expect(await failure('options.set', { flavour: 'kodi' })).toEqual([422, 'invalid-options', undefined]);
  });
});

describe('tree.get', () => {
  it('scans again and returns the tree, with queued files marked (R4.1)', async () => {
    await call('queue.addJob', { draft: draftOf('movie', 693134, DUNE) });
    await Deno.writeTextFile(`${world.source}/New.Movie.2020.mkv`, 'x');
    const { root } = await call('tree.get') as { root: FolderNode };
    const files = (n: TreeNode): TreeNode[] => (n.kind === 'file' ? [n] : n.children.flatMap(files));
    const byPath = new Map(files(root).map((f) => [f.path, f]));
    expect(byPath.has('New.Movie.2020.mkv')).toBe(true);
    expect(byPath.get(DUNE[0]!)).toMatchObject({ status: { state: 'queued', jobId: 'job-1' } });
    expect([...byPath.keys()].some((p) => p.startsWith('processed/'))).toBe(false);
  });
});

describe('tmdb commands', () => {
  it('suggests from the files, searches, and gets details (R5.1)', async () => {
    const s = await call('tmdb.getSuggestions', { files: SEVERANCE_S01 }) as { title: string }[];
    expect(s[0]?.title).toBe('Severance');
    expect(await call('tmdb.search', { query: '' })).toEqual([]);
    expect(await call('tmdb.getDetails', { type: 'movie', tmdbId: 329865 })).toMatchObject({ title: 'Arrival' });
    expect((await failure('tmdb.getDetails', { type: 'movie', tmdbId: 1 }))[0]).toBe(404);
  });
});

describe('job.analyseFiles', () => {
  it('parses each file (R6.1)', async () => {
    const [a] = await call('job.analyseFiles', { files: [SEVERANCE_S01[0]] }) as { season: number; groups: string[] }[];
    expect([a?.season, a?.groups]).toEqual([1, ['NTb']]);
  });

  it('refuses unknown, skipped and queued files, except those of the Job being edited (R6.1)', async () => {
    expect((await failure('job.analyseFiles', { files: ['nope.mkv'] }))[0]).toBe(422);
    expect((await failure('job.analyseFiles', { files: ['notes.txt'] }))[0]).toBe(422);
    const sample =
      'Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR/Sample/blade.runner.2049.sample.mkv';
    expect(await failure('job.analyseFiles', { files: [sample] })).toEqual([422, 'file-skipped', undefined]);
    await call('queue.addJob', { draft: draftOf('movie', 693134, DUNE) });
    expect(await failure('job.analyseFiles', { files: DUNE })).toEqual([422, 'file-queued', undefined]);
    expect((await call('job.analyseFiles', { files: DUNE, forJobId: 'job-1' }) as unknown[]).length).toBe(2);
  });
});

describe('job.getPreview', () => {
  it('names the draft after the Queue, or in place of the Job it replaces (R6.2)', async () => {
    await call('queue.addJob', { draft: draftOf('movie', 335984, BLADE_RUNNER) });
    const again = await call('job.getPreview', { draft: draftOf('movie', 335984, BLADE_RUNNER) }) as {
      files: { dup: number }[];
    };
    // The target already holds this name (fixture), and job-1 takes DUP-1.
    expect(again.files[0]?.dup).toBe(2);
    const replacing = await call('job.getPreview', {
      draft: draftOf('movie', 335984, BLADE_RUNNER),
      replacesJobId: 'job-1',
    }) as { files: { dup: number }[] };
    expect(replacing.files[0]?.dup).toBe(1);
  });

  it('refuses an unknown title or a malformed draft (R6.2)', async () => {
    expect((await failure('job.getPreview', { draft: draftOf('movie', 1, DUNE) }))[1]).toBe('unknown-title');
    expect((await failure('job.getPreview', { draft: { type: 'film' } }))[1]).toBe('invalid-draft');
  });
});

describe('the Queue', () => {
  it('adds a Job with a new ID, and refuses files already queued (R7.2)', async () => {
    const q = await call('queue.addJob', { draft: draftOf('tv', 95396, SEVERANCE_S01) }) as Queue;
    expect(q.jobs.map((j) => [j.id, j.match.title, j.preview.ok])).toEqual([['job-1', 'Severance', true]]);
    const clash = await failure('queue.addJob', { draft: draftOf('tv', 95396, SEVERANCE_S01.slice(0, 2)) });
    expect(clash).toEqual([409, 'files-already-queued', SEVERANCE_S01.slice(0, 2)]);
    expect((await failure('queue.addJob', { draft: draftOf('tv', 95396, []) }))[1]).toBe('invalid-draft');
  });

  it('refuses a Job with files that can’t be named (R7.2)', async () => {
    const draft = draftOf('tv', 95396, SEVERANCE_S01.slice(0, 1));
    draft.files[0]!.season = null;
    const [status, error, details] = await failure('queue.addJob', { draft });
    expect([status, error]).toEqual([422, 'invalid-draft']);
    expect(details?.[0]).toContain('Choose a season.');
  });

  it('replaces a Job in place, keeping its ID, and removes Jobs (R7.3, R7.4)', async () => {
    await call('queue.addJob', { draft: draftOf('movie', 693134, DUNE) });
    await call('queue.addJob', { draft: draftOf('movie', 335984, BLADE_RUNNER) });
    const q = await call('queue.replaceJob', {
      jobId: 'job-1',
      draft: draftOf('movie', 693134, DUNE.slice(0, 1)),
    }) as Queue;
    expect(q.jobs.map((j) => [j.id, j.draft.files.length])).toEqual([['job-1', 1], ['job-2', 1]]);
    expect((await failure('queue.replaceJob', { jobId: 'job-9', draft: draftOf('movie', 693134, DUNE) }))[0]).toBe(404);
    const after = await call('queue.removeJob', { jobId: 'job-1' }) as Queue;
    expect(after.jobs.map((j) => j.id)).toEqual(['job-2']);
    expect((await failure('queue.removeJob', { jobId: 'job-1' }))[0]).toBe(404);
  });

  it('applies only a non-empty Queue, once at a time (R7.5)', async () => {
    expect(await failure('queue.apply', {})).toEqual([422, 'queue-empty', undefined]);
    await call('queue.addJob', { draft: draftOf('movie', 693134, DUNE) });
    expect(await call('queue.apply')).toEqual({ started: true });
    expect(applied).toBe(1);
    world.state.applying = true;
    expect((await failure('queue.apply', {}))[0]).toBe(409);
  });
});
