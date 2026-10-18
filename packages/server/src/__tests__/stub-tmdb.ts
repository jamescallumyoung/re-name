// A stub TMDB API for tests, serving the fixture catalogue in TMDB's JSON shapes.

import { CATALOGUE } from './fixtures.ts';

export interface StubTmdb {
  url: string;
  /** Every request's path and query, in order. */
  requests: string[];
  /** Answer the next n requests with 429. */
  throttle(n: number): void;
  close(): Promise<void>;
}

const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/);

export function stubTmdb(): StubTmdb {
  const requests: string[] = [];
  let throttled = 0;
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, (req) => {
    const url = new URL(req.url);
    requests.push(url.pathname + url.search);
    if (throttled > 0) {
      throttled--;
      return new Response('slow down', { status: 429, headers: { 'retry-after': '0' } });
    }
    const json = (body: unknown) => Response.json(body);
    const path = url.pathname.replace(/^\/3/, '');
    const search = /^\/search\/(movie|tv)$/.exec(path);
    if (search) {
      const type = search[1];
      const q = words(url.searchParams.get('query') ?? '').filter(Boolean);
      const results = CATALOGUE.filter((d) =>
        d.type === type && q.every((w) => words(d.title).some((t) => t.startsWith(w)))
      )
        .map((d) =>
          type === 'movie'
            ? {
              id: d.tmdbId,
              title: d.title,
              original_title: d.title,
              release_date: `${d.year}-05-01`,
              poster_path: null,
            }
            : {
              id: d.tmdbId,
              name: d.title,
              original_name: d.title,
              first_air_date: `${d.year}-05-01`,
              poster_path: '/p.jpg',
            }
        );
      return json({ results });
    }
    const one = /^\/(movie|tv)\/(\d+)$/.exec(path);
    const d = one && CATALOGUE.find((c) => c.type === one[1] && c.tmdbId === Number(one[2]));
    if (one && d) {
      return json(
        d.type === 'movie'
          ? {
            id: d.tmdbId,
            title: d.title,
            original_title: d.title,
            release_date: `${d.year}-05-01`,
            poster_path: null,
          }
          : {
            id: d.tmdbId,
            name: d.title,
            original_name: d.title,
            first_air_date: `${d.year}-05-01`,
            poster_path: '/p.jpg',
            seasons: d.seasons.map((s) => ({ season_number: s.season, name: s.name })),
          },
      );
    }
    const season = /^\/tv\/(\d+)\/season\/(\d+)$/.exec(path);
    const show = season && CATALOGUE.find((c) => c.type === 'tv' && c.tmdbId === Number(season[1]));
    const s = show?.seasons.find((x) => x.season === Number(season?.[2]));
    if (s) {
      return json({
        episodes: s.episodes.map((e) => ({ episode_number: e.episode, name: e.name ?? `Episode ${e.episode}` })),
      });
    }
    return Response.json({ status_message: 'Not found' }, { status: 404 });
  });
  return {
    url: `http://127.0.0.1:${server.addr.port}/3`,
    requests,
    throttle: (n) => (throttled = n),
    close: () => server.shutdown(),
  };
}
