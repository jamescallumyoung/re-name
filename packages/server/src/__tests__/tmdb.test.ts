import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { tmdbClient, type TmdbOptions } from '../tmdb.ts';
import { type StubTmdb, stubTmdb } from './stub-tmdb.ts';

let stub: StubTmdb;
let cacheDir = '';
beforeEach(async () => {
  stub = stubTmdb();
  cacheDir = await Deno.makeTempDir({ prefix: 're-name-cache-' });
});
afterEach(async () => {
  await stub.close();
  await Deno.remove(cacheDir, { recursive: true });
});

const client = (extra: Partial<TmdbOptions> = {}) =>
  tmdbClient({ baseUrl: stub.url, credential: 'v3key', language: 'en-US', cacheDir: null, ...extra });

describe('tmdb', () => {
  it('sends a v3 key as api_key, and a v4 token as a Bearer header (T1.1)', async () => {
    await client().search('arrival', 'movie');
    expect(stub.requests[0]).toContain('api_key=v3key');
    await client({ credential: 'eyJtoken' }).search('arrival', 'movie');
    expect(stub.requests[1]).not.toContain('api_key');
  });

  it('sends the language, or none for "original" (T1.2)', async () => {
    await client().search('dune', 'movie');
    expect(stub.requests[0]).toContain('language=en-US');
    await client({ language: 'original' }).search('dune', 'movie');
    expect(stub.requests[1]).not.toContain('language=');
  });

  it('searches movies and TV, alternating their results, with years and posters (T1.3)', async () => {
    const results = await client().search('the office');
    expect(results.map((m) => [m.type, m.title, m.year])).toEqual([
      ['tv', 'The Office', 2005],
      ['tv', 'The Office', 2001],
    ]);
    expect(results[0]?.posterUrl).toBe('https://image.tmdb.org/t/p/w185/p.jpg');
    expect(await client().search('  ')).toEqual([]);
  });

  it('gets TV details with each season’s episodes, and placeholder names as null (T1.4)', async () => {
    const d = await client().details('tv', 97546);
    expect(d.title).toBe('Ted Lasso');
    expect(d.seasons.map((s) => s.season)).toEqual([1, 2, 3]);
    expect(d.seasons[0]?.episodes[1]).toEqual({ episode: 2, name: 'Biscuits' });
    expect(d.seasons[2]?.episodes[0]).toEqual({ episode: 1, name: null });
    expect((await client().details('movie', 329865)).seasons).toEqual([]);
  });

  it('suggests up to 5, ranked by shared words, year and type (T1.5)', async () => {
    const files = [
      { parsedTitle: 'Blade Runner 2049', parsedYear: 2017, episode: null },
      { parsedTitle: 'Blade Runner 2049', parsedYear: 2017, episode: null },
      { parsedTitle: 'Other', parsedYear: null, episode: null },
    ];
    const s = await client().suggest(files);
    expect(s[0]?.title).toBe('Blade Runner 2049');
    expect(s.length).toBeLessThanOrEqual(5);
    expect(await client().suggest([])).toEqual([]);
  });

  it('retries a 429 after Retry-After (T1.6)', async () => {
    stub.throttle(2);
    expect((await client().search('arrival', 'movie')).length).toBe(1);
    expect(stub.requests.length).toBe(3);
  });

  it('caches responses on disk, without the credential in the key (T1.7)', async () => {
    await client({ cacheDir }).details('movie', 329865);
    await client({ cacheDir, credential: 'another' }).details('movie', 329865);
    expect(stub.requests.length).toBe(1);
    const files = [...Deno.readDirSync(cacheDir)].map((e) => Deno.readTextFileSync(`${cacheDir}/${e.name}`));
    expect(files.join('')).not.toContain('v3key');
  });

  it('turns failures into 404 and 502 (T1.8)', async () => {
    await expect(client().details('movie', 1)).rejects.toMatchObject({ status: 404 });
    const down = tmdbClient({ baseUrl: 'http://127.0.0.1:1/3', credential: 'k', language: 'en-US', cacheDir: null });
    await expect(down.search('x')).rejects.toMatchObject({ status: 502 });
  });
});
