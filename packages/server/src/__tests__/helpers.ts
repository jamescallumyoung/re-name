// Shared test set-up: a temporary source folder from the fixture file names, and a
// State wired to a stub TMDB server.

import { dirname, join } from '@std/path';
import type { DraftJob } from '@re-name/protocol';
import { DEFAULT_KNOWN_TAGS, tagRules } from '../naming/known-tags.ts';
import { parsePath } from '../naming/parse.ts';
import { State } from '../state.ts';
import { tmdbClient } from '../tmdb.ts';
import { SOURCE_FILES } from './fixtures.ts';
import { type StubTmdb, stubTmdb } from './stub-tmdb.ts';

export const rules = tagRules(DEFAULT_KNOWN_TAGS);

export interface World {
  tmp: string;
  source: string;
  target: string;
  state: State;
  tmdb: StubTmdb;
  cleanup(): Promise<void>;
}

/** A temporary `Downloads` folder holding the fixture files (each a few bytes), with `processed` inside it. */
export async function makeWorld(opts: { dryRun?: boolean } = {}): Promise<World> {
  const tmp = await Deno.realPath(await Deno.makeTempDir({ prefix: 're-name-test-' }));
  const source = join(tmp, 'Downloads');
  for (const path of SOURCE_FILES) {
    await Deno.mkdir(dirname(join(source, path)), { recursive: true });
    await Deno.writeTextFile(join(source, path), path);
  }
  const tmdb = stubTmdb();
  const target = join(source, 'processed');
  const state = new State({
    source,
    target,
    dryRun: opts.dryRun ?? false,
    rules,
    tmdb: tmdbClient({ baseUrl: tmdb.url, credential: 'k', language: 'en-US', cacheDir: null }),
    stateDir: join(tmp, 'state'),
  }, 'plex');
  await state.rescan();
  return {
    tmp,
    source,
    target,
    state,
    tmdb,
    cleanup: async () => {
      await tmdb.close();
      await Deno.remove(tmp, { recursive: true });
    },
  };
}

/** A draft Job for `paths`, with tags and episodes as parsed. */
export function draftOf(type: DraftJob['type'], tmdbId: number, paths: readonly string[]): DraftJob {
  return {
    type,
    tmdbId,
    files: paths.map((path) => {
      const p = parsePath(path, rules);
      return { path, season: p.season, episode: p.episode, tags: p.tags, groups: p.groups };
    }),
  };
}

export const SEVERANCE_S01 = SOURCE_FILES.filter((p) => p.startsWith('Severance.S01') && p.endsWith('.mkv'));
export const BLADE_RUNNER = SOURCE_FILES.filter((p) => /^Blade.*FraMeSToR\.mkv$/.test(p));
export const DUNE = SOURCE_FILES.filter((p) => p.startsWith('Dune'));
