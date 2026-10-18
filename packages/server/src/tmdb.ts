// The TMDB client: search, details and suggestions, with a disk cache and a limit
// on requests in flight (design doc §5.2, §9.4; spec T1).

import { join } from '@std/path';
import type { Details, Match, MediaType, Season } from '@re-name/protocol';
import { isPlaceholderEpisodeName } from './naming/names.ts';

export class TmdbError extends Error {
  constructor(readonly status: 404 | 502, message: string) {
    super(message);
  }
}

export interface TmdbOptions {
  baseUrl: string;
  credential: string;
  /** `original`, or a TMDB language code (spec T1.2). */
  language: string;
  /** Where responses are cached; null caches nothing. */
  cacheDir: string | null;
  now?: () => number;
}

/** What suggestions need from each file (spec T1.5). */
export interface SuggestFrom {
  parsedTitle: string;
  parsedYear: number | null;
  episode: number | null;
}

export interface Tmdb {
  search(query: string, type?: MediaType): Promise<Match[]>;
  details(type: MediaType, tmdbId: number): Promise<Details>;
  suggest(files: readonly SuggestFrom[]): Promise<Match[]>;
}

const MAX_IN_FLIGHT = 8;
const MAX_RETRIES = 3;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

// deno-lint-ignore no-explicit-any
type Json = any;

export function tmdbClient(opts: TmdbOptions): Tmdb {
  const now = opts.now ?? Date.now;
  const original = opts.language === 'original';
  const bearer = opts.credential.startsWith('eyJ');
  let inFlight = 0;
  const waiting: (() => void)[] = [];

  /** Spec T1.6: at most 8 requests at once. */
  const slot = async <T>(run: () => Promise<T>): Promise<T> => {
    if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
    inFlight++;
    try {
      return await run();
    } finally {
      inFlight--;
      waiting.shift()?.();
    }
  };

  /** Spec T1.1, T1.2, T1.6–T1.8. */
  const get = async (path: string, params: Record<string, string> = {}): Promise<Json> => {
    const url = new URL(`${opts.baseUrl}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!original) url.searchParams.set('language', opts.language);
    const key = url.toString();
    const cacheFile = opts.cacheDir && join(opts.cacheDir, `${await sha256(key)}.json`);
    if (cacheFile) {
      try {
        const cached = JSON.parse(await Deno.readTextFile(cacheFile));
        if (now() - cached.savedAt < CACHE_MS) return cached.body;
      } catch {
        // Not cached, or unreadable: fetch it.
      }
    }
    if (!bearer) url.searchParams.set('api_key', opts.credential);
    const headers = bearer ? { authorization: `Bearer ${opts.credential}`, accept: 'application/json' } : undefined;
    const body = await slot(async () => {
      for (let attempt = 0;; attempt++) {
        let response: Response;
        try {
          response = await fetch(url, headers ? { headers } : {});
        } catch {
          throw new TmdbError(502, 'TMDB can’t be reached.');
        }
        if (response.ok) return await response.json();
        await response.body?.cancel();
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const wait = Number(response.headers.get('retry-after') ?? 1);
          await new Promise((r) => setTimeout(r, (Number.isFinite(wait) ? wait : 1) * 1000));
          continue;
        }
        if (response.status === 404) throw new TmdbError(404, 'TMDB has no such title.');
        if (response.status === 401) throw new TmdbError(502, 'TMDB refused the credential in TMDB_API_KEY.');
        throw new TmdbError(502, `TMDB can’t be reached (status ${response.status}).`);
      }
    });
    if (cacheFile) await Deno.writeTextFile(cacheFile, JSON.stringify({ savedAt: now(), body })).catch(() => {});
    return body;
  };

  const toMatch = (type: MediaType, r: Json): Match => {
    const date: string = (type === 'movie' ? r.release_date : r.first_air_date) ?? '';
    const name: string = type === 'movie'
      ? (original ? r.original_title : r.title) || r.original_title
      : (original ? r.original_name : r.name) || r.original_name;
    return {
      type,
      tmdbId: r.id,
      title: name ?? '',
      year: Number(date.slice(0, 4)) || 0,
      posterUrl: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : null,
    };
  };

  /** Spec T1.3. */
  const search = async (query: string, type?: MediaType): Promise<Match[]> => {
    if (!query.trim()) return [];
    const [movies, shows] = await Promise.all([
      type === 'tv'
        ? []
        : get('search/movie', { query }).then((r) => (r.results ?? []).map((x: Json) => toMatch('movie', x))),
      type === 'movie'
        ? []
        : get('search/tv', { query }).then((r) => (r.results ?? []).map((x: Json) => toMatch('tv', x))),
    ]);
    const merged: Match[] = [];
    for (let i = 0; i < Math.max(movies.length, shows.length); i++) {
      if (movies[i]) merged.push(movies[i]);
      if (shows[i]) merged.push(shows[i]);
    }
    return merged;
  };

  /** Spec T1.4. */
  const details = async (type: MediaType, tmdbId: number): Promise<Details> => {
    const r = await get(`${type}/${tmdbId}`);
    const match = toMatch(type, r);
    if (type === 'movie') return { ...match, seasons: [] };
    const seasons: Season[] = await Promise.all(
      (r.seasons ?? []).map(async (s: Json): Promise<Season> => {
        const season = await get(`tv/${tmdbId}/season/${s.season_number}`);
        return {
          season: s.season_number,
          name: s.name ?? `Season ${s.season_number}`,
          episodes: (season.episodes ?? []).map((e: Json) => {
            const name: string = e.name ?? '';
            return {
              episode: e.episode_number,
              name: !name || isPlaceholderEpisodeName(name, e.episode_number) ? null : name,
            };
          }),
        };
      }),
    );
    return { ...match, seasons: seasons.sort((a, b) => a.season - b.season) };
  };

  /** Spec T1.5. */
  const suggest = async (files: readonly SuggestFrom[]): Promise<Match[]> => {
    const counts = new Map<string, { title: string; year: number | null; tv: boolean; n: number }>();
    for (const f of files) {
      const key = `${f.parsedTitle.toLowerCase()}|${f.parsedYear ?? ''}`;
      const entry = counts.get(key) ?? { title: f.parsedTitle, year: f.parsedYear, tv: f.episode !== null, n: 0 };
      entry.n++;
      counts.set(key, entry);
    }
    // Map keeps insertion order, and the sort is stable, so ties go to the first file's.
    const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    if (!best?.title) return [];
    const words = tokens(best.title);
    const scored = (await search(best.title)).map((m) => {
      const t = tokens(m.title);
      return {
        m,
        overlap: words.filter((w) => t.includes(w)).length,
        year: m.year === best.year,
        type: (m.type === 'tv') === best.tv,
      };
    });
    scored.sort((a, b) => b.overlap - a.overlap || Number(b.year) - Number(a.year) || Number(b.type) - Number(a.type));
    return scored.slice(0, 5).map((s) => s.m);
  };

  return { search, details, suggest };
}

const tokens = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
