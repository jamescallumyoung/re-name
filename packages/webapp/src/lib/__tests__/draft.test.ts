import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { AnalysedFile, Details, FoundTag } from '@re-name/protocol';
import {
  addTag,
  columnsOf,
  type Draft,
  effectiveValue,
  folderOf,
  groupByFolder,
  hasCellValue,
  likelySeason,
  newDraft,
  removeAddedTag,
  restoreChoices,
  stepsOf,
  tagKey,
  toDraftJob,
} from '../draft.ts';

const tag = (source: string, value: string | null, known = true): FoundTag => ({ source, value, known });

function file(path: string, tags: FoundTag[], extra: Partial<AnalysedFile> = {}): AnalysedFile {
  return { path, parsedTitle: 'Ted Lasso', parsedYear: null, season: 1, episode: 1, tags, groups: ['NTb'], ...extra };
}

const details = (seasons: number[]): Details => ({
  type: 'tv',
  tmdbId: 97546,
  title: 'Ted Lasso',
  year: 2020,
  posterUrl: null,
  seasons: seasons.map((season) => ({ season, name: `Season ${season}`, episodes: [] })),
});

const tv = { type: 'tv', tmdbId: 97546, title: 'Ted Lasso', year: 2020, posterUrl: null } as const;
const movie = { type: 'movie', tmdbId: 335984, title: 'Blade Runner 2049', year: 2017, posterUrl: null } as const;

describe('newDraft and stepsOf', () => {
  it('starts at Match, with each file’s parsed season, episode and groups', () => {
    const d = newDraft([file('a.mkv', [], { season: 2, episode: 3 })]);
    expect(d.step).toBe('match');
    expect(d.episodes['a.mkv']).toEqual({ season: 2, episode: 3 });
    expect(d.groups['a.mkv']).toEqual(['NTb']);
  });

  it('has a Seasons step only for TV', () => {
    const d = newDraft([]);
    expect(stepsOf(d)).toEqual(['match', 'tags']);
    expect(stepsOf({ ...d, match: movie })).toEqual(['match', 'tags']);
    expect(stepsOf({ ...d, match: tv })).toEqual(['match', 'seasons', 'tags']);
  });
});

describe('tag columns', () => {
  it('shares a column between spellings the known-tags file gives one value', () => {
    const cols = columnsOf([
      file('a.mkv', [tag('web-dl', 'WEB-DL'), tag('265', 'x265')]),
      file('b.mkv', [tag('WEB-DL', 'WEB-DL'), tag('x265', 'x265')]),
    ]);
    expect(cols.map((c) => [c.sources, c.count])).toEqual([
      [['web-dl', 'WEB-DL'], 2],
      [['265', 'x265'], 2],
    ]);
  });

  it('keeps dropped and unknown tags in columns of their own', () => {
    expect(tagKey(tag('appleVT', null))).toBe('drop:applevt');
    expect(tagKey(tag('MiXED', 'MiXED', false))).toBe('u:mixed');
    expect(tagKey(tag('1080p', '1080p'))).toBe('k:1080p');
  });
});

describe('effectiveValue and hasCellValue', () => {
  const t = tag('265', 'x265');
  const base: Draft = newDraft([file('a.mkv', [t]), file('b.mkv', [t])]);

  it('uses the known-tags value by default', () => {
    expect(effectiveValue(base, 'a.mkv', t)).toBe('x265');
  });

  it('uses a column value for every file, and a cell value for one', () => {
    const d: Draft = { ...base, columns: { 'k:x265': 'HEVC' }, cells: { 'b.mkv': { 'k:x265': 'x.265' } } };
    expect(effectiveValue(d, 'a.mkv', t)).toBe('HEVC');
    expect(effectiveValue(d, 'b.mkv', t)).toBe('x.265');
    expect(hasCellValue(d, 'a.mkv', 'k:x265')).toBe(false);
    expect(hasCellValue(d, 'b.mkv', 'k:x265')).toBe(true);
  });

  it('treats null as dropping the tag, not as unset', () => {
    const d: Draft = { ...base, columns: { 'k:x265': null } };
    expect(effectiveValue(d, 'a.mkv', t)).toBe(null);
  });
});

describe('toDraftJob', () => {
  it('is null until a title is matched', () => {
    expect(toDraftJob(newDraft([file('a.mkv', [])]))).toBe(null);
  });

  it('sends each file’s chosen tags, groups, season and episode', () => {
    const d: Draft = {
      ...newDraft([file('S/a.mkv', [tag('265', 'x265'), tag('appleVT', null)])]),
      match: tv,
      columns: { 'k:x265': 'HEVC' },
      episodes: { 'S/a.mkv': { season: 1, episode: 4 } },
      groups: { 'S/a.mkv': ['NTb', 'rartv'] },
    };
    expect(toDraftJob(d)).toEqual({
      type: 'tv',
      tmdbId: 97546,
      files: [{
        path: 'S/a.mkv',
        season: 1,
        episode: 4,
        tags: [{ source: '265', value: 'HEVC' }, { source: 'appleVT', value: null }],
        groups: ['NTb', 'rartv'],
      }],
    });
  });

  it('sends no season or episode for a movie', () => {
    const d: Draft = { ...newDraft([file('a.mkv', [])]), match: movie };
    expect(toDraftJob(d)?.files[0]).toMatchObject({ season: null, episode: null });
  });
});

describe('tags added by hand', () => {
  const draft = () => {
    const d = newDraft([
      file('a.mkv', [tag('1080p', '1080p'), tag('x264', 'H.264')]),
      file('b.mkv', [tag('1080p', '1080p')]),
    ]);
    d.match = movie;
    return d;
  };
  const sent = (d: Draft) => toDraftJob(d)?.files.map((f) => f.tags.map((t) => `${t.source}=${t.value}`));

  it('adds a tag to every file that doesn’t have that value, as its own column', () => {
    const d = draft();
    addTag(d, ' H.264 ');
    expect(sent(d)).toEqual([['1080p=1080p', 'x264=H.264'], ['1080p=1080p', 'H.264=H.264']]);
    addTag(d, 'BluRay');
    expect(columnsOf(d.files).filter((c) => c.added).map((c) => [c.sources, c.count])).toEqual([[['BluRay'], 2]]);
  });

  it('can drop an added tag from one file, or remove it from all', () => {
    const d = draft();
    addTag(d, 'BluRay');
    d.cells['a.mkv'] = { [tagKey(tag('BluRay', 'BluRay'))]: null };
    expect(sent(d)?.map((f) => f.at(-1))).toEqual(['BluRay=null', 'BluRay=BluRay']);
    removeAddedTag(d, tagKey(tag('BluRay', 'BluRay')));
    expect(sent(d)).toEqual([['1080p=1080p', 'x264=H.264'], ['1080p=1080p']]);
    expect(d.cells['a.mkv']).toEqual({});
  });

  it('comes back, with every other choice, when the Job is edited', () => {
    const d = draft();
    addTag(d, 'BluRay');
    d.cells['b.mkv'] = { [tagKey(tag('1080p', '1080p'))]: '2160p' };
    d.groups['a.mkv'] = ['GalaxyRG'];
    const job = toDraftJob(d)!;
    const again = draft();
    restoreChoices(again, job.files);
    expect(toDraftJob(again)).toEqual(job);
    expect(columnsOf(again.files).find((c) => c.added)?.sources).toEqual(['BluRay']);
  });
});

describe('likelySeason', () => {
  it('uses the season in the name when TMDB has it', () => {
    expect(likelySeason(file('a.mkv', [], { season: 2 }), details([1, 2]))).toBe(2);
  });

  it('falls back to a season in the folder name', () => {
    const f = file('Ted Lasso S02/Ted.Lasso.03.mkv', [], { season: null });
    expect(likelySeason(f, details([1, 2]))).toBe(2);
    const g = file('Ted Lasso Season 1/x.mkv', [], { season: null });
    expect(likelySeason(g, details([1, 2]))).toBe(1);
  });

  it('falls back to TMDB’s only season, ignoring specials', () => {
    expect(likelySeason(file('x.mkv', [], { season: 7 }), details([0, 1]))).toBe(1);
  });

  it('gives null when it can’t tell', () => {
    expect(likelySeason(file('x.mkv', [], { season: null }), details([1, 2]))).toBe(null);
  });
});

describe('folders', () => {
  it('finds a file’s folder', () => {
    expect(folderOf('a/b/c.mkv')).toBe('a/b');
    expect(folderOf('c.mkv')).toBe('');
  });

  it('groups files by folder, sorted by path', () => {
    const groups = groupByFolder([{ path: 'b/2.mkv' }, { path: 'a/1.mkv' }, { path: 'b/1.mkv' }, { path: 'top.mkv' }]);
    expect(groups.map(([folder, files]) => [folder, files.map((f) => f.path)])).toEqual([
      ['a', ['a/1.mkv']],
      ['b', ['b/1.mkv', 'b/2.mkv']],
      ['', ['top.mkv']],
    ]);
  });
});
