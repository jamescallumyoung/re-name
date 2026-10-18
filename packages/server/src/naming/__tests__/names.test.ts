import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { Details, DraftJob, Options } from '@re-name/protocol';
import { findTitle } from '../../__tests__/fixtures.ts';
import { DEFAULT_KNOWN_TAGS, tagRules } from '../known-tags.ts';
import { isPlaceholderEpisodeName, nameQueue, sanitise, type TitleLookup } from '../names.ts';
import { parsePath } from '../parse.ts';

const rules = tagRules(DEFAULT_KNOWN_TAGS);
const opts = (flavour: Options['flavour'], includeEpisodeName = true): Options => ({ flavour, includeEpisodeName });

function draftOf(type: DraftJob['type'], tmdbId: number, ...paths: string[]): DraftJob {
  return {
    type,
    tmdbId,
    files: paths.map((path) => {
      const p = parsePath(path, rules);
      return { path, season: p.season, episode: p.episode, tags: p.tags, groups: p.groups };
    }),
  };
}

const run = (
  jobs: { id: string; draft: DraftJob }[],
  o: Options,
  existing: string[] = [],
  titles: TitleLookup = findTitle,
) => [...nameQueue(jobs, o, existing, titles, rules).values()].flatMap((p) => p.files);
const paths = (...args: Parameters<typeof run>) => run(...args).map((f) => f.newPath ?? f.error);

const BR = 'Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv';
const BR_PLEX =
  'Blade Runner 2049 (2017) {tmdb-335984}/Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 -FraMeSToR].mkv';

describe('nameQueue', () => {
  it('names a movie in each flavour (N1.1, N1.2)', () => {
    const jobs = [{ id: 'a', draft: draftOf('movie', 335984, BR) }];
    expect(paths(jobs, opts('plex'))).toEqual([BR_PLEX]);
    expect(paths(jobs, opts('jellyfin'))).toEqual([
      'Blade Runner 2049 (2017) [tmdbid-335984]/Blade Runner 2049 (2017) [tmdbid-335984] - [2160p UHD BluRay HDR DTS-HD MA x265 -FraMeSToR].mkv',
    ]);
    expect(paths(jobs, opts('emby'))[0]).toContain('[tmdbid=335984]/Blade Runner 2049 (2017) [tmdbid=335984] - [');
  });

  it('names an episode, replacing invalid characters with _ (N1.3, N1.6)', () => {
    const jobs = [{
      id: 'a',
      draft: draftOf('tv', 95396, 'Severance.S01E08.Whats.for.Dinner.1080p.WEB-DL.H.264-NTb.mkv'),
    }];
    expect(paths(jobs, opts('plex'))).toEqual([
      "Severance (2022) {tmdb-95396}/Season 01/Severance (2022) - S01E08 - What's for Dinner_ [1080p WEB-DL H.264 -NTb].mkv",
    ]);
  });

  it('puts a space before Plex’s episode brackets and " - " before Jellyfin’s and Emby’s (N1.3)', () => {
    const jobs = [{ id: 'a', draft: draftOf('tv', 97546, 'Ted.Lasso.S01E02.1080p.WEB-DL-NTb.mkv') }];
    expect(paths(jobs, opts('plex'))[0]).toContain('Ted Lasso (2020) - S01E02 - Biscuits [1080p WEB-DL -NTb].mkv');
    expect(paths(jobs, opts('jellyfin'))[0]).toContain(
      'Ted Lasso (2020) - S01E02 - Biscuits - [1080p WEB-DL -NTb].mkv',
    );
    expect(paths(jobs, opts('emby'))[0]).toContain('Ted Lasso (2020) - S01E02 - Biscuits - [1080p WEB-DL -NTb].mkv');
  });

  it('leaves out placeholder episode names, and all of them when the option is off (N1.5)', () => {
    const slow = [{ id: 'a', draft: draftOf('tv', 95480, 'Slow.Horses.S05E01.1080p.WEB-DL-NTb.mkv') }];
    expect(paths(slow, opts('plex'))[0]).toContain('Slow Horses (2022) - S05E01 [1080p WEB-DL -NTb].mkv');
    const sev = [{ id: 'a', draft: draftOf('tv', 95396, 'Severance.S01E01.1080p.WEB-DL-NTb.mkv') }];
    expect(paths(sev, opts('plex', false))[0]).toContain('Severance (2022) - S01E01 [1080p WEB-DL -NTb].mkv');
  });

  it('recognises placeholder names in several languages, for the file’s own episode (N1.5)', () => {
    expect(
      ['Episode 3', 'Épisode 3', 'Folge 3', 'Episodio 3', 'Aflevering 3', 'Avsnitt 3'].map((n) =>
        isPlaceholderEpisodeName(n, 3)
      ),
    ).toEqual([true, true, true, true, true, true]);
    expect(isPlaceholderEpisodeName('Episode 4', 3)).toBe(false);
    expect(isPlaceholderEpisodeName('The Episode 3 Story', 3)).toBe(false);
  });

  it('never invents brackets (N1.4)', () => {
    expect(paths([{ id: 'a', draft: draftOf('movie', 329865, 'Arrival.2016.mkv') }], opts('plex'))).toEqual([
      'Arrival (2016) {tmdb-329865}/Arrival (2016).mkv',
    ]);
  });

  it('orders tags by category, then by their original order (N1.4)', () => {
    const job = draftOf('movie', 329865, 'Arrival.2016.x265.REPACK.WEB-DL.2160p.mkv');
    expect(paths([{ id: 'a', draft: job }], opts('plex'))[0]).toBe(
      'Arrival (2016) {tmdb-329865}/Arrival (2016) [2160p WEB-DL x265 REPACK].mkv',
    );
  });

  it('adds DUP-n to newer files, before the groups, ignoring case (N1.9)', () => {
    const jobs = [
      { id: 'a', draft: draftOf('movie', 335984, BR) },
      { id: 'b', draft: draftOf('movie', 335984, `copy/${BR}`) },
    ];
    const names = run(jobs, opts('plex'), [BR_PLEX.toUpperCase()]);
    expect(names.map((f) => [f.dup, f.newPath?.slice(f.newPath.indexOf('/') + 1)])).toEqual([
      [1, 'Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 DUP-1 -FraMeSToR].mkv'],
      [2, 'Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 DUP-2 -FraMeSToR].mkv'],
    ]);
  });

  it('needs a season and an episode for TV, and warns about ones TMDB doesn’t know (N1.10)', () => {
    const noSeason = draftOf('tv', 97546, 'Ted.Lasso.S01E01.mkv');
    noSeason.files[0] = { ...noSeason.files[0]!, season: null };
    expect(run([{ id: 'a', draft: noSeason }], opts('plex'))[0]?.error).toBe('Choose a season.');
    const unknown = run([{ id: 'a', draft: draftOf('tv', 97546, 'Ted.Lasso.S01E99.mkv') }], opts('plex'))[0];
    expect(unknown?.warnings).toEqual(['TMDB has no episode 99 in season 1.']);
    expect(unknown?.newPath).toContain('Ted Lasso (2020) - S01E99.mkv');
  });

  it('drops a long episode name first, then fails if still too long (N1.7)', () => {
    const long = (title: string, episode: string): TitleLookup => () => ({
      type: 'tv',
      tmdbId: 1,
      title,
      year: 2020,
      posterUrl: null,
      seasons: [{ season: 1, name: 'Season 1', episodes: [{ episode: 1, name: episode }] }],
    } satisfies Details);
    const job = [{ id: 'a', draft: draftOf('tv', 1, 'Show.S01E01.mkv') }];
    const dropped = run(job, opts('plex'), [], long('Show', 'x'.repeat(260)))[0];
    expect(dropped?.newPath).toBe('Show (2020) {tmdb-1}/Season 01/Show (2020) - S01E01.mkv');
    expect(dropped?.warnings).toEqual(['The episode name was left out: the name would be too long.']);
    const failed = run(job, opts('plex'), [], long('y'.repeat(260), 'x'))[0];
    expect(failed?.newPath).toBe(null);
    expect(failed?.error).toContain('longer than 255 bytes');
  });

  it('refuses names Windows can’t hold (N1.8)', () => {
    const lookup: TitleLookup = () => ({
      type: 'movie',
      tmdbId: 7,
      title: 'CON',
      year: 2020,
      posterUrl: null,
      seasons: [],
    });
    // `CON (2020)` is fine: only a part before the first dot that is exactly reserved fails.
    expect(paths([{ id: 'a', draft: draftOf('movie', 7, 'Con.2020.mkv') }], opts('plex'), [], lookup)[0]).toBe(
      'CON (2020) {tmdb-7}/CON (2020).mkv',
    );
    expect(sanitise('a:b?c\u0001')).toBe('a_b_c_');
  });

  it('fails every file of a Job whose title is unknown', () => {
    expect(run([{ id: 'a', draft: draftOf('movie', 1, 'x.mkv') }], opts('plex'), [], () => undefined)[0]?.error)
      .toBe('The TMDB title wasn’t found.');
  });
});
