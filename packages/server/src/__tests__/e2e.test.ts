// End to end: re-name started as its own process (main.ts), against a temporary source,
// a temporary home and the stub TMDB, driven over HTTP as the webapp drives it.

import { afterEach, beforeAll, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { dirname, join } from '@std/path';
import type { ApplyResult, Flavour, Match, Queue } from '@re-name/protocol';
import { SOURCE_FILES } from './fixtures.ts';
import { draftOf, DUNE, SEVERANCE_S01 } from './helpers.ts';
import { type StubTmdb, stubTmdb } from './stub-tmdb.ts';

const MAIN = new URL('../../main.ts', import.meta.url).pathname;
const WEBAPP = new URL('../../../webapp/', import.meta.url).pathname;

/** Deno's cache: the child gets a temporary HOME, which would otherwise move it. */
let denoDir = '';

// main.ts serves the built webapp, and refuses to start without it.
beforeAll(async () => {
  const info = await new Deno.Command(Deno.execPath(), { args: ['info', '--json'] }).output();
  denoDir = JSON.parse(new TextDecoder().decode(info.stdout)).denoDir;
  if (await Deno.stat(join(WEBAPP, 'dist', 'index.html')).catch(() => null)) return;
  const build = new Deno.Command(Deno.execPath(), { args: ['task', 'build'], cwd: WEBAPP, stdout: 'null' });
  expect((await build.output()).code).toBe(0);
});

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

/** Starts re-name on a fresh copy of the fixture files, and claims its session. */
async function start() {
  const tmp = await Deno.realPath(await Deno.makeTempDir({ prefix: 're-name-e2e-' }));
  const source = join(tmp, 'Downloads');
  for (const path of SOURCE_FILES) {
    await Deno.mkdir(dirname(join(source, path)), { recursive: true });
    await Deno.writeTextFile(join(source, path), path);
  }
  const tmdb: StubTmdb = stubTmdb();
  const home = join(tmp, 'home');
  const child = new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', MAIN, source, '--no-open'],
    env: {
      HOME: home,
      DENO_DIR: denoDir,
      XDG_CONFIG_HOME: join(home, 'config'),
      XDG_STATE_HOME: join(home, 'state'),
      XDG_CACHE_HOME: join(home, 'cache'),
      APPDATA: join(home, 'appdata'),
      LOCALAPPDATA: join(home, 'localappdata'),
      TMDB_API_KEY: 'k',
      RENAME_TMDB_BASE_URL: tmdb.url,
    },
    stdout: 'piped',
    stderr: 'inherit',
  }).spawn();
  const stdout = child.stdout.pipeThrough(new TextDecoderStream()).getReader();
  cleanup.push(async () => {
    await stop().catch(() => {});
    await tmdb.close();
    await Deno.remove(tmp, { recursive: true });
  });

  let printed = '';
  while (!/running at (\S+)/.test(printed)) {
    const { value, done } = await stdout.read();
    if (done) throw new Error(`re-name exited before it started:\n${printed}`);
    printed += value;
  }
  const launch = new URL(/running at (\S+)/.exec(printed)![1]!);
  const origin = launch.origin;

  let cookie = '';
  let etag = '';
  async function rpc<T>(method: string, params: unknown, ifMatch = false): Promise<T> {
    const res = await fetch(`${origin}/rpc/${method}`, {
      method: 'POST',
      headers: { origin, cookie, 'content-type': 'application/json', ...(ifMatch ? { 'if-match': etag } : {}) },
      body: JSON.stringify(params),
    });
    etag = res.headers.get('etag') ?? etag;
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(`${method}: ${res.status} ${JSON.stringify(body)}`);
    return body as T;
  }

  /** Ctrl-C: the run ends and releases its lock. Resolves to the exit code. */
  let stopped: Promise<number> | null = null;
  function stop(): Promise<number> {
    stopped ??= (async () => {
      child.kill(Deno.build.os === 'windows' ? 'SIGKILL' : 'SIGINT');
      await stdout.cancel();
      return (await child.status).code;
    })();
    return stopped;
  }

  const claim = await fetch(`${origin}/rpc/session.claim`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ tabId: 'e2e', token: launch.searchParams.get('t') }),
  });
  expect(claim.status).toBe(200);
  cookie = (claim.headers.get('set-cookie') ?? '').split(';')[0]!;
  etag = claim.headers.get('etag')!;
  await claim.body?.cancel();

  return { source, home, origin, cookie, rpc, stop };
}

/** Reads the event stream until the apply finishes. */
async function applyDone(origin: string, cookie: string, apply: () => Promise<unknown>): Promise<ApplyResult> {
  const res = await fetch(`${origin}/events`, { headers: { cookie } });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  await apply();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error('The event stream closed before the apply finished.');
    buffer += value;
    for (const m of buffer.matchAll(/^data: (.*)$/gm)) {
      const event = JSON.parse(m[1]!);
      if (event.type === 'apply-done') {
        await reader.cancel();
        return event.result;
      }
    }
  }
}

const exists = (path: string) => Deno.stat(path).then(() => true, () => false);

const EXPECTED: Record<Flavour, [movie: string, episode: string]> = {
  plex: [
    'Dune_ Part Two (2024) {tmdb-693134}',
    'Severance (2022) {tmdb-95396}/Season 01/Severance (2022) - S01E01 - Good News About Hell [1080p WEB-DL ATVP DDP5.1 H.264 -NTb].mkv',
  ],
  jellyfin: [
    'Dune_ Part Two (2024) [tmdbid-693134]',
    'Severance (2022) [tmdbid-95396]/Season 01/Severance (2022) - S01E01 - Good News About Hell - [1080p WEB-DL ATVP DDP5.1 H.264 -NTb].mkv',
  ],
  emby: [
    'Dune_ Part Two (2024) [tmdbid=693134]',
    'Severance (2022) [tmdbid=95396]/Season 01/Severance (2022) - S01E01 - Good News About Hell - [1080p WEB-DL ATVP DDP5.1 H.264 -NTb].mkv',
  ],
};

describe('re-name, end to end', () => {
  for (const flavour of ['plex', 'jellyfin', 'emby'] as const) {
    it(`serves the webapp, and names, queues and applies a movie and a TV season for ${flavour}`, async () => {
      const app = await start();
      const page = await fetch(`${app.origin}/`);
      expect(await page.text()).toContain('<script');

      const tree = await app.rpc<{ root: { children: unknown[] } }>('tree.get', {});
      expect(tree.root.children.length).toBeGreaterThan(0);
      await app.rpc('options.set', { flavour, includeEpisodeName: true }, true);

      const suggestions = await app.rpc<Match[]>('tmdb.getSuggestions', { files: DUNE });
      expect(suggestions[0]?.tmdbId).toBe(693134);
      await app.rpc('tmdb.getDetails', { type: 'movie', tmdbId: 693134 });
      await app.rpc('queue.addJob', { draft: draftOf('movie', 693134, DUNE) }, true);
      const tv = SEVERANCE_S01.slice(0, 2);
      await app.rpc('job.analyseFiles', { files: tv });
      const queue = await app.rpc<Queue>('queue.addJob', { draft: draftOf('tv', 95396, tv) }, true);
      expect(queue.jobs.length).toBe(2);

      const result = await applyDone(app.origin, app.cookie, () => app.rpc('queue.apply', {}, true));
      expect([result.moved, result.total, result.error, result.queue.jobs.length]).toEqual([4, 4, null, 0]);
      const target = join(app.source, 'processed');
      for (const path of EXPECTED[flavour]) expect(await exists(join(target, path))).toBe(true);
      expect(result.logPath.startsWith(app.home)).toBe(true);
      expect(await exists(result.logPath)).toBe(true);

      if (Deno.build.os !== 'windows') expect(await app.stop()).toBe(0);
    });
  }
});
