// The HTTP server: the webapp's files, the RPC commands and the event stream, on
// 127.0.0.1 only (design doc §8.2, §8.6; spec H1, R1).

import { extname, join, normalize, SEPARATOR } from '@std/path';
import { QUEUE_COMMANDS, type RpcMethod } from '@re-name/protocol';
import { type Handler, HttpError } from './rpc.ts';
import type { Session } from './session.ts';
import type { State } from './state.ts';

export interface ServerOptions {
  state: State;
  session: Session;
  handlers: Partial<Record<RpcMethod, Handler>>;
  /** The built webapp: packages/webapp/dist. */
  webRoot: string;
  /** 0 picks a free port. */
  port: number;
}

export interface AppServer {
  port: number;
  /** Spec H1.2: the address to open, with the launch token. */
  launchUrl: string;
  shutdown(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

/** Spec H1.4. */
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://image.tmdb.org",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function startServer(opts: ServerOptions): AppServer {
  const { state, session } = opts;
  let port = 0;

  const headers = (extra: HeadersInit = {}) => {
    const h = new Headers(extra);
    h.set('content-security-policy', CSP);
    h.set('etag', state.etag);
    h.set('cache-control', 'no-store');
    return h;
  };
  const json = (status: number, body: unknown, extra: HeadersInit = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: headers({ ...(body === null ? {} : { 'content-type': 'application/json' }), ...extra }),
    });
  const error = (status: number, code: string, message: string) => json(status, { error: code, message });

  const rpc = async (method: string, req: Request): Promise<Response> => {
    let params: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) params = JSON.parse(text);
    } catch {
      return error(400, 'bad-json', 'The request body isn’t valid JSON.');
    }
    if (method === 'session.claim') {
      const claim = session.claim(params['tabId'], params['token'], req.headers.get('cookie'));
      if (!claim.ok) {
        return claim.status === 409
          ? error(409, 'session-held', 're-name is already open in another tab.')
          : error(403, 'forbidden', 'This page wasn’t opened by re-name.');
      }
      const body = { session: state.session(), options: state.options, queue: await state.queue() };
      return json(200, body, claim.setCookie ? { 'set-cookie': claim.setCookie } : {});
    }
    if (!session.hasCookie(req.headers.get('cookie'))) return error(403, 'forbidden', 'Claim the session first.');
    if (method === 'session.end') return json(204, null);
    const handler = opts.handlers[method as RpcMethod];
    if (!handler) return error(404, 'unknown-command', `There's no command called ${method}.`);
    if (QUEUE_COMMANDS.includes(method as RpcMethod)) {
      const ifMatch = req.headers.get('if-match');
      if (ifMatch === null) return error(428, 'precondition-required', 'This command needs the Queue’s ETag.');
      if (ifMatch !== state.etag) return error(412, 'stale-queue', 'The Queue changed since you last saw it.');
    }
    try {
      const result = await handler(params);
      return json(method === 'queue.apply' ? 202 : 200, result);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, e.body);
      console.error(e);
      return error(500, 'internal', (e as Error).message);
    }
  };

  /** Spec H1.3. */
  const file = async (pathname: string): Promise<Response> => {
    const rel = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^[/\\]+/, '');
    if (rel.split(SEPARATOR).includes('..')) return new Response('Not found', { status: 404, headers: headers() });
    try {
      const body = await Deno.readFile(join(opts.webRoot, rel));
      return new Response(body, {
        headers: headers({ 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' }),
      });
    } catch {
      return new Response('Not found', { status: 404, headers: headers() });
    }
  };

  const rpcRoute = new URLPattern({ pathname: '/rpc/:method' });
  const server = Deno.serve({ hostname: '127.0.0.1', port: opts.port, onListen: () => {} }, (req) => {
    const url = new URL(req.url);
    // Spec H1.5: only this machine's own address, never another site.
    const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowed.includes(req.headers.get('host') ?? '')) return error(403, 'forbidden', 'Wrong host.');
    if (req.method === 'POST' && !allowed.map((h) => `http://${h}`).includes(req.headers.get('origin') ?? '')) {
      return error(403, 'forbidden', 'Wrong origin.');
    }
    const route = rpcRoute.exec(url);
    if (route && req.method === 'POST') return rpc(route.pathname.groups['method'] ?? '', req);
    if (url.pathname === '/events' && req.method === 'GET') {
      if (!session.hasCookie(req.headers.get('cookie'))) return error(403, 'forbidden', 'Claim the session first.');
      return new Response(session.openStream(), {
        headers: headers({ 'content-type': 'text/event-stream', 'x-accel-buffering': 'no' }),
      });
    }
    if (req.method === 'GET') return file(url.pathname);
    return error(405, 'method-not-allowed', 'Not allowed.');
  });
  port = server.addr.port;
  return {
    port,
    launchUrl: `http://127.0.0.1:${port}/?t=${session.token}`,
    shutdown: async () => {
      session.close();
      await server.shutdown();
    },
  };
}
