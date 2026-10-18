import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { DEFAULT_KNOWN_TAGS, tagRules, validateKnownTags } from '../known-tags.ts';
import { isVideo, parseName, parsePath } from '../parse.ts';

const rules = tagRules(DEFAULT_KNOWN_TAGS);
const parse = (name: string) => parseName(name, rules);
const values = (name: string) => parse(name).tags.map((t) => t.value);

describe('parseName', () => {
  it('reads a movie title and the last year before the tags (P1.1, P1.3)', () => {
    const p = parse('Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv');
    expect([p.title, p.year]).toEqual(['Blade Runner 2049', 2017]);
    expect(values('Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv')).toEqual([
      '2160p',
      'UHD',
      'BluRay',
      'HDR',
      'DTS-HD MA',
      'H.265',
    ]);
    expect(p.groups).toEqual(['FraMeSToR']);
  });

  it('keeps dotted tags whole, longest first (P1.4)', () => {
    expect(values('Dune.Part.Two.2024.1080p.WEB-DL.DDP5.1.Atmos.H.264-FLUX.mkv')).toEqual([
      '1080p',
      'WEB-DL',
      'DDP5.1 Atmos',
      'H.264',
    ]);
  });

  it('reads an episode, skips the episode name in the source, and keeps unknown tags (P1.2, P1.4, P1.7)', () => {
    const p = parse('Severance.S01E08.Whats.for.Dinner.1080p.ATVP.WEB-DL.DDP5.1.H.264.MiXED-NTb.mkv');
    expect([p.title, p.season, p.episode]).toEqual(['Severance', 1, 8]);
    expect(p.tags.map((t) => [t.source, t.known])).toEqual([
      ['1080p', true],
      ['ATVP', true],
      ['WEB-DL', true],
      ['DDP5.1', true],
      ['H.264', true],
      ['MiXED', false],
    ]);
  });

  it('reads one or several release groups, in order (P1.5)', () => {
    expect(parse('Severance.S02E03.1080p.WEB.h264-ETHEL[rartv].mkv').groups).toEqual(['ETHEL', 'rartv']);
    expect(parse('Ted.Lasso.S01E01.720p.WEB.x264-GGEZ-RARBG.mkv').groups).toEqual(['GGEZ', 'RARBG']);
    const p = parse('Show.S01E01.1080p.WEB.x265-MeGusta[eztv.re].mkv');
    expect([p.tags.map((t) => t.value), p.groups]).toEqual([['1080p', 'WEB', 'H.265'], ['MeGusta', 'eztv.re']]);
    expect(parse('Show S01E01 1080p WEB x265-MeGusta [eztv.re].mkv').groups).toEqual(['MeGusta', 'eztv.re']);
    expect(parse('Show.S01E01.1080p.WEB.x264-GRP_X[TGx][eztv.re].mkv').groups).toEqual(['GRP_X', 'TGx', 'eztv.re']);
  });

  it('keeps a part that completes a known tag out of the groups (P1.5)', () => {
    const p = parse('Slow.Horses.S05E01.1080p.WEB-DL-NTb.mkv');
    expect(p.tags.map((t) => t.value)).toEqual(['1080p', 'WEB-DL']);
    expect(p.groups).toEqual(['NTb']);
  });

  it('splits a group it can’t read from the last tag it’s stuck to (P1.8)', () => {
    const p = parse('Movie.2020.1080p.BluRay.x264-GROUP_X.mkv');
    expect([p.tags.map((t) => t.value), p.groups]).toEqual([['1080p', 'BluRay', 'H.264'], ['GROUP_X']]);
    const q = parse('Show.S01E01.1080p.WEB-DL.DDP5.1.H.264-GRP_A-RARBG.mkv');
    expect([q.tags.map((t) => t.value), q.groups]).toEqual([['1080p', 'WEB-DL', 'DDP5.1', 'H.264'], [
      'GRP_A',
      'RARBG',
    ]]);
    const r = parse('Show.S01E01.1080p.WEB.Foo-Bar_1.mkv');
    expect([r.tags.map((t) => [t.source, t.known]), r.groups]).toEqual([
      [['1080p', true], ['WEB', true], ['Foo', false]],
      ['Bar_1'],
    ]);
  });

  it('reads back names it already wrote, in each flavour (P1.9)', () => {
    const tags = (name: string) => {
      const p = parse(name);
      return [p.title, p.year, p.tags.map((t) => t.value), p.groups];
    };
    expect(tags('Hope Gap (2020) [1080p BluRay DD5.1 x264 -GalaxyRG].mkv')).toEqual([
      'Hope Gap',
      2020,
      ['1080p', 'BluRay', 'DD5.1', 'H.264'],
      ['GalaxyRG'],
    ]);
    expect(tags('Hope Gap (2020) [tmdbid=123] - [1080p BluRay H.264 DUP-1 -GalaxyRG -rartv].mkv')).toEqual([
      'Hope Gap',
      2020,
      ['1080p', 'BluRay', 'H.264'],
      ['GalaxyRG', 'rartv'],
    ]);
    expect(tags('Movie (2019) [2160p].mkv')[2]).toEqual(['2160p']);
    const ep = parse('Severance (2022) - S01E01 - Good News About Hell - [1080p WEB-DL H.264 -NTb].mkv');
    expect([ep.season, ep.episode, ep.tags.map((t) => t.value), ep.groups]).toEqual([
      1,
      1,
      ['1080p', 'WEB-DL', 'H.264'],
      ['NTb'],
    ]);
  });

  it('writes every spelling of the two codecs as H.264 or H.265', () => {
    for (const codec of ['x264', 'h264', 'H.264', 'AVC']) expect(values(`Movie.2020.${codec}.mkv`)).toEqual(['H.264']);
    for (const codec of ['x265', 'h265', 'H.265', 'HEVC']) expect(values(`Movie.2020.${codec}.mkv`)).toEqual(['H.265']);
  });

  it('gives null for tags the known-tags list drops (P1.7)', () => {
    expect(parse('Ted.Lasso.S04E03.1080p.web-dl.appleVT.265-ELiTE.mkv').tags).toEqual([
      { source: '1080p', value: '1080p', known: true },
      { source: 'web-dl', value: 'WEB-DL', known: true },
      { source: 'appleVT', value: null, known: true },
      { source: '265', value: 'H.265', known: true },
    ]);
  });

  it('marks samples, split parts and multi-episode files (P1.6)', () => {
    expect(parse('blade.runner.2049.sample.mkv').skip).toBe('sample');
    expect(parse('Arrival.2016.1080p.BluRay.x264-SPARKS.cd1.avi').skip).toBe('split-part');
    expect(parse('The.Office.US.S02E01E02.720p.WEB-DL.mkv').skip).toBe('multi-episode');
    expect(parse('The.Office.US.S02E01-E02.720p.WEB-DL.mkv').skip).toBe('multi-episode');
    expect(parse('Severance.S01E01.1080p.WEB-DL.mkv').skip).toBe(null);
  });

  it('marks files under a Sample folder as samples (P1.6)', () => {
    expect(parsePath('Blade.Runner/Sample/clip.mkv', rules).skip).toBe('sample');
    expect(parsePath('Blade.Runner/Extras/clip.mkv', rules).skip).toBe(null);
  });
});

describe('isVideo', () => {
  it('recognises video extensions, ignoring case (S1.1)', () => {
    expect(['a.mkv', 'b.MP4', 'c.m2ts', 'd.mpeg'].map(isVideo)).toEqual([true, true, true, true]);
    expect(['a.srt', 'b.nfo', 'c.txt', 'mkv'].map(isVideo)).toEqual([false, false, false, false]);
  });
});

describe('validateKnownTags', () => {
  it('accepts the defaults (F1.7)', () => {
    expect(validateKnownTags(JSON.parse(JSON.stringify(DEFAULT_KNOWN_TAGS)))[0]).toBe(true);
  });

  it('rejects a bad file, naming the entry (F1.7)', () => {
    expect(validateKnownTags({})).toEqual([false, 'It must be a JSON array of { "pattern", "value", "category" }.']);
    expect(validateKnownTags([{ pattern: '(', value: 'x', category: 'other' }])[1]).toContain('Entry 1');
    expect(validateKnownTags([{ pattern: 'a', value: 1, category: 'other' }])[1]).toContain('"value"');
    expect(validateKnownTags([{ pattern: 'a', value: 'a', category: 'size' }])[1]).toContain('"category"');
  });

  it('builds rules from a custom list', () => {
    const custom = tagRules([{ pattern: 'imax', value: 'IMAX', category: 'other' }]);
    expect(parseName('Dune.2021.IMAX.mkv', custom).tags).toEqual([{ source: 'IMAX', value: 'IMAX', known: true }]);
  });
});
