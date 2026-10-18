// Config, state and cache folders, `.env`, and the known-tags file (design doc §5;
// spec F1).

import { parseEnv } from 'node:util';
import { join } from '@std/path';
import type { Flavour } from '@re-name/protocol';
import { DEFAULT_KNOWN_TAGS, type KnownTag, validateKnownTags } from './naming/known-tags.ts';

export interface Folders {
  config: string;
  state: string;
  cache: string;
}

export interface Config {
  folders: Folders;
  envFile: string;
  credential: string;
  flavour: Flavour;
  /** `original`, or a TMDB language code. */
  titleLanguage: string;
  knownTags: KnownTag[];
  /** Only for tests (spec T1.1). */
  tmdbBaseUrl: string;
}

type Env = Record<string, string | undefined>;

const ENV_DEFAULTS = `# re-name's settings. Real environment variables take precedence over this file.

# Your TMDB credential: a v4 read access token (recommended) or a v3 API key.
# Get one at https://www.themoviedb.org/settings/api
TMDB_API_KEY=

# The media server names are made for: plex, jellyfin or emby.
RENAME_FLAVOUR=plex

# The language of titles and episode names: a TMDB language code such as en-US,
# or "original" for each title's own language.
RENAME_TITLE_LANGUAGE=en-US
`;

/** Spec F1.1. */
export function folders(os: typeof Deno.build.os, env: Env): Folders {
  const home = env['HOME'] ?? env['USERPROFILE'] ?? '.';
  if (os === 'windows') {
    const roaming = env['APPDATA'] ?? join(home, 'AppData', 'Roaming');
    const local = env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local');
    return { config: join(roaming, 're-name'), state: join(local, 're-name'), cache: join(local, 're-name', 'Cache') };
  }
  if (os === 'darwin') {
    const support = join(home, 'Library', 'Application Support', 're-name');
    return { config: support, state: support, cache: join(home, 'Library', 'Caches', 're-name') };
  }
  return {
    config: join(env['XDG_CONFIG_HOME'] || join(home, '.config'), 're-name'),
    state: join(env['XDG_STATE_HOME'] || join(home, '.local', 'state'), 're-name'),
    cache: join(env['XDG_CACHE_HOME'] || join(home, '.cache'), 're-name'),
  };
}

/** Spec F1.2–F1.7. Creates what's missing, then reads the settings. */
export async function loadConfig(
  os: typeof Deno.build.os = Deno.build.os,
  env: Env = Deno.env.toObject(),
): Promise<[true, Config] | [false, string]> {
  const dirs = folders(os, env);
  try {
    await Deno.mkdir(dirs.config, { recursive: true });
    const probe = join(dirs.config, `.write-test-${Deno.pid}`);
    await Deno.writeTextFile(probe, '');
    await Deno.remove(probe);
  } catch (error) {
    return [false, `re-name can't use its config folder, ${dirs.config}: ${(error as Error).message}`];
  }
  for (const dir of [dirs.state, dirs.cache]) await Deno.mkdir(dir, { recursive: true });

  const envFile = join(dirs.config, '.env');
  await writeIfMissing(envFile, ENV_DEFAULTS, 0o600);
  const fromFile = parseEnv(await Deno.readTextFile(envFile)) as Env;
  const setting = (name: string) => env[name] ?? fromFile[name] ?? '';

  const credential = setting('TMDB_API_KEY').trim();
  if (!credential) {
    return [false, `TMDB_API_KEY isn't set. Add your TMDB credential to ${envFile}, or set the TMDB_API_KEY variable.`];
  }
  const flavour = setting('RENAME_FLAVOUR').trim() || 'plex';
  if (flavour !== 'plex' && flavour !== 'jellyfin' && flavour !== 'emby') {
    return [
      false,
      `RENAME_FLAVOUR must be plex, jellyfin or emby, not "${flavour}" (in ${envFile} or the environment).`,
    ];
  }

  const tagsFile = join(dirs.config, 'known-tags.json');
  await writeIfMissing(tagsFile, `${JSON.stringify(DEFAULT_KNOWN_TAGS, null, 2)}\n`);
  let tags;
  try {
    tags = JSON.parse(await Deno.readTextFile(tagsFile));
  } catch (error) {
    return [false, `${tagsFile} isn't valid JSON: ${(error as Error).message}`];
  }
  const [ok, knownTags] = validateKnownTags(tags);
  if (!ok) return [false, `${tagsFile} has a problem. ${knownTags}`];

  return [true, {
    folders: dirs,
    envFile,
    credential,
    flavour,
    titleLanguage: setting('RENAME_TITLE_LANGUAGE').trim() || 'en-US',
    knownTags,
    tmdbBaseUrl: env['RENAME_TMDB_BASE_URL'] || 'https://api.themoviedb.org/3',
  }];
}

async function writeIfMissing(path: string, text: string, mode?: number): Promise<void> {
  try {
    await Deno.writeTextFile(path, text, { createNew: true, ...(mode === undefined ? {} : { mode }) });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  }
}
