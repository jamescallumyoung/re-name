import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { DraftJob, Options } from '@re-name/protocol';
import { nameQueue } from '../naming.ts';
import { parseName } from '../parse.ts';

const opts = (flavour: Options['flavour'], includeEpisodeName = true): Options => ({ flavour, includeEpisodeName });

function draftOf(type: DraftJob['type'], tmdbId: number, ...paths: string[]): DraftJob {
  return {
    type,
    tmdbId,
    files: paths.map((path) => {
      const p = parseName(path.slice(path.lastIndexOf('/') + 1));
      return { path, season: p.season, episode: p.episode, tags: p.tags, groups: p.groups };
    }),
  };
}

const newPaths = (jobs: { id: string; draft: DraftJob }[], o: Options, existing: string[] = []) =>
  [...nameQueue(jobs, o, existing).values()].flatMap((p) => p.files.map((f) => f.newPath ?? f.error));

const BR = 'Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv';

describe('nameQueue (mock)', () => {
  it('names a movie in each flavour', () => {
    const jobs = [{ id: 'a', draft: draftOf('movie', 335984, BR) }];
    expect(newPaths(jobs, opts('plex'))).toEqual([
      'Blade Runner 2049 (2017) {tmdb-335984}/Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 -FraMeSToR].mkv',
    ]);
    expect(newPaths(jobs, opts('jellyfin'))).toEqual([
      'Blade Runner 2049 (2017) [tmdbid-335984]/Blade Runner 2049 (2017) [tmdbid-335984] - [2160p UHD BluRay HDR DTS-HD MA x265 -FraMeSToR].mkv',
    ]);
    expect(newPaths(jobs, opts('emby'))[0]).toContain('[tmdbid=335984] - [');
  });

  it('names an episode, replacing invalid characters with _', () => {
    const jobs = [{
      id: 'a',
      draft: draftOf('tv', 95396, 'Severance.S01E08.Whats.for.Dinner.1080p.WEB-DL.H.264-NTb.mkv'),
    }];
    expect(newPaths(jobs, opts('plex'))).toEqual([
      "Severance (2022) {tmdb-95396}/Season 01/Severance (2022) - S01E08 - What's for Dinner_ - [1080p WEB-DL H.264 -NTb].mkv",
    ]);
  });

  it('leaves out placeholder episode names, and the episode name when the option is off', () => {
    const slow = [{ id: 'a', draft: draftOf('tv', 95480, 'Slow.Horses.S05E01.1080p.WEB-DL-NTb.mkv') }];
    expect(newPaths(slow, opts('plex'))[0]).toContain('Slow Horses (2022) - S05E01 - [1080p WEB-DL -NTb].mkv');
    const sev = [{ id: 'a', draft: draftOf('tv', 95396, 'Severance.S01E01.1080p.WEB-DL-NTb.mkv') }];
    expect(newPaths(sev, opts('plex', false))[0]).toContain('Severance (2022) - S01E01 - [1080p WEB-DL -NTb].mkv');
  });

  it('adds DUP-n to the newer file, before the groups', () => {
    const existing = [
      'Blade Runner 2049 (2017) {tmdb-335984}/Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 -FraMeSToR].mkv',
    ];
    const jobs = [
      { id: 'a', draft: draftOf('movie', 335984, BR) },
      { id: 'b', draft: draftOf('movie', 335984, `copy/${BR}`) },
    ];
    expect(newPaths(jobs, opts('plex'), existing).map((p) => p?.slice(p.indexOf('/') + 1))).toEqual([
      'Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 DUP-1 -FraMeSToR].mkv',
      'Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA x265 DUP-2 -FraMeSToR].mkv',
    ]);
  });

  it('never invents brackets', () => {
    const jobs = [{ id: 'a', draft: draftOf('movie', 329865, 'Arrival.2016.mkv') }];
    expect(newPaths(jobs, opts('plex'))).toEqual(['Arrival (2016) {tmdb-329865}/Arrival (2016).mkv']);
  });
});
