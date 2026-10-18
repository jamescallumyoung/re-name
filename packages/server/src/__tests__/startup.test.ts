import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { join } from '@std/path';
import { checkFolders, parseCli } from '../cli.ts';
import { folders, loadConfig } from '../config.ts';
import { acquireLock } from '../lock.ts';

let tmp = '';
beforeEach(async () => {
  tmp = await Deno.makeTempDir({ prefix: 're-name-test-' });
});
afterEach(async () => {
  await Deno.chmod(tmp, 0o755).catch(() => {});
  await Deno.remove(tmp, { recursive: true });
});

describe('parseCli', () => {
  it('defaults the source to the current folder, and the target inside it (C1.1)', () => {
    expect(parseCli([], '/media')).toEqual({
      run: { source: '/media', target: '/media/processed', open: true, port: 0, dryRun: false },
    });
  });

  it('reads every option (C1.1)', () => {
    expect(parseCli(['dl', '--target', '../out', '--no-open', '--port', '3000', '--dry-run'], '/media')).toEqual({
      run: { source: '/media/dl', target: '/out', open: false, port: 3000, dryRun: true },
    });
  });

  it('prints help and the version, and rejects bad arguments (C1.2)', () => {
    expect(parseCli(['--help'], '/')).toMatchObject({ exit: 0 });
    expect(parseCli(['--version'], '/')).toEqual({ exit: 0, message: 're-name 0.1.0' });
    expect(parseCli(['--colour'], '/')).toMatchObject({ exit: 2 });
    expect(parseCli(['a', 'b'], '/')).toMatchObject({ exit: 2 });
    expect(parseCli(['--port', 'x'], '/')).toMatchObject({ exit: 2 });
    expect(parseCli(['--port', '70000'], '/')).toMatchObject({ exit: 2 });
  });
});

describe('checkFolders', () => {
  it('needs an existing source folder, and accepts a target that doesn’t exist yet (C1.3)', async () => {
    expect(await checkFolders(join(tmp, 'missing'), join(tmp, 'out'))).toEqual([
      false,
      `The source folder doesn't exist: ${join(tmp, 'missing')}`,
    ]);
    expect(await checkFolders(tmp, join(tmp, 'processed', 'deeper'))).toEqual([true]);
  });

  it('refuses a target that is a file (C1.3)', async () => {
    await Deno.writeTextFile(join(tmp, 'file'), '');
    expect((await checkFolders(tmp, join(tmp, 'file')))[0]).toBe(false);
  });
});

describe('folders', () => {
  it('uses each OS’s native folders (F1.1)', () => {
    expect(folders('linux', { HOME: '/h' })).toEqual({
      config: '/h/.config/re-name',
      state: '/h/.local/state/re-name',
      cache: '/h/.cache/re-name',
    });
    expect(folders('linux', { HOME: '/h', XDG_CONFIG_HOME: '/x/c', XDG_STATE_HOME: '/x/s', XDG_CACHE_HOME: '/x/k' }))
      .toEqual({ config: '/x/c/re-name', state: '/x/s/re-name', cache: '/x/k/re-name' });
    expect(folders('darwin', { HOME: '/Users/a' })).toEqual({
      config: '/Users/a/Library/Application Support/re-name',
      state: '/Users/a/Library/Application Support/re-name',
      cache: '/Users/a/Library/Caches/re-name',
    });
  });
});

describe('loadConfig', () => {
  const env = () => ({
    HOME: tmp,
    XDG_CONFIG_HOME: join(tmp, 'c'),
    XDG_STATE_HOME: join(tmp, 's'),
    XDG_CACHE_HOME: join(tmp, 'k'),
  });

  it('creates .env with the defaults, then stops for the missing credential (F1.3, F1.5)', async () => {
    const [ok, message] = await loadConfig('linux', env());
    expect(ok).toBe(false);
    expect(message).toContain('TMDB_API_KEY');
    expect(message).toContain(join(tmp, 'c', 're-name', '.env'));
    const text = await Deno.readTextFile(join(tmp, 'c', 're-name', '.env'));
    expect(text).toContain('RENAME_FLAVOUR=plex');
    expect(text).toContain('RENAME_TITLE_LANGUAGE=en-US');
    if (Deno.build.os !== 'windows') {
      expect((await Deno.stat(join(tmp, 'c', 're-name', '.env'))).mode! & 0o777).toBe(0o600);
    }
  });

  it('reads .env, lets the environment win, and never rewrites an existing file (F1.3, F1.4)', async () => {
    await Deno.mkdir(join(tmp, 'c', 're-name'), { recursive: true });
    const envFile = join(tmp, 'c', 're-name', '.env');
    await Deno.writeTextFile(envFile, 'TMDB_API_KEY=from-file\nRENAME_FLAVOUR=emby\n');
    const [ok, config] = await loadConfig('linux', { ...env(), RENAME_FLAVOUR: 'jellyfin' });
    if (!ok) throw new Error(config);
    expect([config.credential, config.flavour, config.titleLanguage]).toEqual(['from-file', 'jellyfin', 'en-US']);
    expect(await Deno.readTextFile(envFile)).toBe('TMDB_API_KEY=from-file\nRENAME_FLAVOUR=emby\n');
    expect(config.knownTags.length).toBeGreaterThan(10);
  });

  it('rejects an unknown flavour (F1.6)', async () => {
    const [ok, message] = await loadConfig('linux', { ...env(), TMDB_API_KEY: 'k', RENAME_FLAVOUR: 'kodi' });
    expect(ok).toBe(false);
    expect(message).toContain('plex, jellyfin or emby');
  });

  it('creates known-tags.json, and rejects a broken one, naming it (F1.7)', async () => {
    const [ok] = await loadConfig('linux', { ...env(), TMDB_API_KEY: 'k' });
    expect(ok).toBe(true);
    const tagsFile = join(tmp, 'c', 're-name', 'known-tags.json');
    await Deno.writeTextFile(tagsFile, '[{"pattern": "(", "value": "x", "category": "other"}]');
    const [ok2, message] = await loadConfig('linux', { ...env(), TMDB_API_KEY: 'k' });
    expect(ok2).toBe(false);
    expect(message).toContain(tagsFile);
    expect(message).toContain('Entry 1');
  });

  it('stops when the config folder can’t be written, naming it (F1.2)', async () => {
    if (Deno.build.os === 'windows') return;
    await Deno.mkdir(join(tmp, 'c', 're-name'), { recursive: true });
    await Deno.chmod(join(tmp, 'c', 're-name'), 0o500);
    const [ok, message] = await loadConfig('linux', { ...env(), TMDB_API_KEY: 'k' });
    await Deno.chmod(join(tmp, 'c', 're-name'), 0o755);
    expect(ok).toBe(false);
    expect(message).toContain(join(tmp, 'c', 're-name'));
  });
});

describe('acquireLock', () => {
  it('refuses overlapping sources, either way round (L1.2)', async () => {
    const [ok, lock] = await acquireLock(tmp, '/media/dl', 1);
    if (!ok) throw new Error(lock);
    expect(await acquireLock(tmp, '/media/dl/tv', 2)).toEqual([
      false,
      'Another re-name (process 1) is already working on /media/dl.',
    ]);
    expect((await acquireLock(tmp, '/media', 3))[0]).toBe(false);
    const [ok4, other] = await acquireLock(tmp, '/media/dl2', 4);
    expect(ok4).toBe(true);
    await lock.release();
    if (ok4) await other.release();
  });

  it('ignores and removes stale locks, and frees the source on release (L1.2, L1.3)', async () => {
    await Deno.mkdir(join(tmp, 'locks'));
    await Deno.writeTextFile(join(tmp, 'locks', '9.json'), JSON.stringify({ source: '/m', pid: 9, updatedAt: 0 }));
    const [ok, lock] = await acquireLock(tmp, '/m', 1);
    if (!ok) throw new Error(lock);
    expect(await Deno.stat(join(tmp, 'locks', '9.json')).catch(() => null)).toBe(null);
    await lock.release();
    expect((await acquireLock(tmp, '/m', 2))[0]).toBe(true);
  });
});
