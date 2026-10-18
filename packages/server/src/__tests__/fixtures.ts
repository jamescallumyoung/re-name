// Test fixtures, from the POC's mock: a source folder and a small TMDB catalogue.
// Titles and IDs are real-ish, but this is sample data, not a source of truth.

import type { Details, Episode, MediaType, Season } from '@re-name/protocol';

export const SOURCE_NAME = 'Downloads';
export const SOURCE_PATH = '/Volumes/Media/Downloads';
export const TARGET_NAME = 'processed';

const ep = (...names: (string | null)[]): Episode[] => names.map((name, i) => ({ episode: i + 1, name }));
const placeholders = (n: number): Episode[] => Array.from({ length: n }, (_, i) => ({ episode: i + 1, name: null }));

/** Every path in the source, relative to it. Non-video files are listed too: the server leaves them out. */
export const SOURCE_FILES: readonly string[] = [
  'Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR/Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.mkv',
  'Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR/Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR.nfo',
  'Blade.Runner.2049.2017.2160p.UHD.BluRay.HDR.DTS-HD.MA.5.1.x265-FraMeSToR/Sample/blade.runner.2049.sample.mkv',
  'Dune.Part.Two.2024.1080p.WEB-DL.DDP5.1.Atmos.H.264-FLUX.mkv',
  'Dune.Part.Two.2024.2160p.WEB-DL.DV.HDR10+.DDP5.1.Atmos.H.265-FLUX.mkv',
  'Arrival.2016.1080p.BluRay.x264-SPARKS/Arrival.2016.1080p.BluRay.x264-SPARKS.cd1.avi',
  'Arrival.2016.1080p.BluRay.x264-SPARKS/Arrival.2016.1080p.BluRay.x264-SPARKS.cd2.avi',
  'Arrival.2016.1080p.BluRay.x264-SPARKS/Subs/English.srt',
  ...[
    'Good.News.About.Hell',
    'Half.Loop',
    'In.Perpetuity',
    'The.You.You.Are',
    'The.Grim.Barbarity.of.Optics.and.Design',
    'Hide.and.Seek',
    'Defiant.Jazz',
    'Whats.for.Dinner',
    'The.We.We.Are',
  ].map((name, i) =>
    `Severance.S01.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb/Severance.S01E0${
      i + 1
    }.${name}.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb.mkv`
  ),
  'Severance.S01.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb/RARBG.txt',
  'Severance.S02E01.1080p.WEB.h264-ETHEL[rartv].mkv',
  'Severance.S02E02.1080p.WEB.h264-ETHEL[rartv].mkv',
  'Severance.S02E03.1080p.WEB.h264-ETHEL[rartv].mkv',
  ...Array.from(
    { length: 10 },
    (_, i) =>
      `Ted.Lasso.S01.1080p.ATVP.WEB-DL.DDP5.1.H.264-CasStudio/Ted.Lasso.S01E${
        String(i + 1).padStart(2, '0')
      }.1080p.ATVP.WEB-DL.DDP5.1.H.264-CasStudio.mkv`,
  ),
  'Ted Lasso S02/Ted.Lasso.S02E01.1080p.web-dl.appleVT.265-ELiTE.mkv',
  'Ted Lasso S02/Ted.Lasso.S02E02.1080p.web-dl.appleVT.265-ELiTE.mkv',
  'Ted Lasso S02/Ted.Lasso.S02E03.720p.WEB.x264-GGEZ-RARBG.mkv',
  'Ted Lasso S02/Ted.Lasso.S02E04.1080p.web-dl.appleVT.265-ELiTE.mkv',
  'Shogun.2024.S01E01.Anjin.2160p.DSNP.WEB-DL.DDP5.1.HDR.H.265-NTb.mkv',
  'Shogun.2024.S01E02.Servants.of.Two.Masters.2160p.DSNP.WEB-DL.DDP5.1.HDR.H.265-NTb.mkv',
  'Slow.Horses.S05E01.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb.mkv',
  'Slow.Horses.S05E02.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb.mkv',
  'The Office (US)/The.Office.US.S00E01.Blooper.Reel.720p.WEB-DL.AAC2.0.H.264-NTb.mkv',
  'The Office (US)/The.Office.US.S02E01E02.The.Dundies.720p.WEB-DL.AAC2.0.H.264-NTb.mkv',
  'The Office (US)/The.Office.US.S02E03.Office.Olympics.720p.WEB-DL.AAC2.0.H.264-NTb.mkv',
  'notes.txt',
  // The target lives inside the source; the server hides it.
  'processed/Blade Runner 2049 (2017) {tmdb-335984}/Blade Runner 2049 (2017) [2160p UHD BluRay HDR DTS-HD MA H.265 -FraMeSToR].mkv',
];

/** Files already in the target, relative to it, for duplicate detection (section 9.5). */
export const TARGET_FILES: readonly string[] = SOURCE_FILES.filter((p) => p.startsWith(`${TARGET_NAME}/`)).map((p) =>
  p.slice(TARGET_NAME.length + 1)
);

/** A deterministic size, so the tree looks plausible. */
export function sizeOf(path: string): number {
  let h = 0;
  for (const c of path) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return path.includes('2160p') ? 12e9 + (h % 30e9) : 1e9 + (h % 3e9);
}

const movie = (tmdbId: number, title: string, year: number): Details => ({
  type: 'movie',
  tmdbId,
  title,
  year,
  posterUrl: null,
  seasons: [],
});
const tv = (tmdbId: number, title: string, year: number, seasons: Season[]): Details => ({
  type: 'tv',
  tmdbId,
  title,
  year,
  posterUrl: null,
  seasons,
});
const season = (n: number, episodes: Episode[]): Season => ({
  season: n,
  name: n === 0 ? 'Specials' : `Season ${n}`,
  episodes,
});

export const CATALOGUE: readonly Details[] = [
  movie(335984, 'Blade Runner 2049', 2017),
  movie(78, 'Blade Runner', 1982),
  movie(126757, 'Blade Runner: Black Out 2022', 2017),
  movie(693134, 'Dune: Part Two', 2024),
  movie(438631, 'Dune', 2021),
  movie(841, 'Dune', 1984),
  movie(329865, 'Arrival', 2016),
  movie(575264, 'Mission: Impossible - Dead Reckoning Part One', 2023),
  tv(95396, 'Severance', 2022, [
    season(1, [
      ...ep(
        'Good News About Hell',
        'Half Loop',
        'In Perpetuity',
        'The You You Are',
        'The Grim Barbarity of Optics and Design',
        'Hide and Seek',
        'Defiant Jazz',
        "What's for Dinner?",
        'The We We Are',
      ),
    ]),
    season(2, [
      ...ep(
        'Hello, Ms. Cobel',
        'Goodbye, Mrs. Selvig',
        'Who Is Alive?',
        "Woe's Hollow",
        "Trojan's Horse",
        'Attila',
        'Chikhai Bardo',
        'Sweet Vitriol',
        'The After Hours',
        'Cold Harbor',
      ),
    ]),
  ]),
  tv(97546, 'Ted Lasso', 2020, [
    season(1, [
      ...ep(
        'Pilot',
        'Biscuits',
        'Trent Crimm: The Independent',
        'For the Children',
        'Tan Lines',
        'Two Aces',
        'Make Rebecca Great Again',
        'The Diamond Dogs',
        'All Apologies',
        'The Hope That Kills You',
      ),
    ]),
    season(2, [
      ...ep(
        'Goodbye Earl',
        'Lavender',
        'Do the Right-est Thing',
        'Carol of the Bells',
        'Rainbow',
        'The Signal',
        'Headspace',
        'Man City',
        'Beard After Hours',
        'No Weddings and a Funeral',
        'Midnight Train to Royston',
        'Inverting the Pyramid of Success',
      ),
    ]),
    season(3, placeholders(12)),
  ]),
  tv(126308, 'Shōgun', 2024, [season(1, ep('Anjin', 'Servants of Two Masters', 'Tomorrow Is Tomorrow'))]),
  tv(95480, 'Slow Horses', 2022, [season(4, placeholders(6)), season(5, placeholders(6))]),
  tv(2316, 'The Office', 2005, [
    season(0, ep('The Accountants: The Books', 'Blooper Reel')),
    season(2, ep('The Dundies', 'Sexual Harassment', 'Office Olympics', 'The Fire')),
  ]),
  tv(2996, 'The Office', 2001, [season(1, ep('Downsize', 'Work Experience'))]),
  tv(93405, 'Squid Game', 2021, [season(1, placeholders(9))]),
];

export function findTitle(type: MediaType, tmdbId: number): Details | undefined {
  return CATALOGUE.find((d) => d.type === type && d.tmdbId === tmdbId);
}
