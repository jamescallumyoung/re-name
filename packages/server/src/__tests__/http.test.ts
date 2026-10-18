import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { join } from '@std/path';
import { type AppServer, startServer } from '../http.ts';
import { handlers } from '../rpc.ts';
import { Session } from '../session.ts';
import { makeWorld, type World } from './helpers.ts';

let world: World;
let session: Session;
let server: AppServer;
let ended = 0;
let applying = false;

beforeEach(async () => {
  world = await makeWorld();
  ended = 0;
  applying = false;
  const webRoot = join(world.tmp, 'web');
  await Deno.mkdir(webRoot);
  await Deno.writeTextFile(join(webRoot, 'index.html'), '<!doctype html><title>re-name</title>');
  await Deno.writeTextFile(join(webRoot, 'app.js'), 'export {};');
  session = new Session({ heartbeatMs: 40, graceMs: 120, applying: () => applying, onEnd: () => ended++ });
  server = startServer({
    state: world.state,
    session,
    handlers: handlers(world.state, () => Promise.resolve()),
    webRoot,
    port: 0,
  });
});
afterEach(async () => {
  await server.shutdown();
  await world.cleanup();
});

const base = () => `http://127.0.0.1:${server.port}`;
const post = (method: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base()}/rpc/${method}`, {
    method: 'POST',
    headers: { origin: base(), 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
async function claim(tabId = 'tab-a'): Promise<string> {
  const res = await post('session.claim', { tabId, token: session.token });
  await res.body?.cancel();
  return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reads SSE events from a stream until `count` arrive. */
async function readEvents(body: ReadableStream<Uint8Array>, count: number): Promise<string[]> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  const events: string[] = [];
  let buffer = '';
  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    for (const m of buffer.matchAll(/^data: (.*)$/gm)) events.push(JSON.parse(m[1] ?? '{}').type);
    buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
  }
  await reader.cancel();
  return events;
}

describe('the page', () => {
  it('serves the webapp without a cookie, with the content security policy (H1.3, H1.4)', async () => {
    const res = await fetch(`${base()}/`);
    expect(await res.text()).toContain('<title>re-name</title>');
    expect(res.headers.get('content-security-policy')).toContain("img-src 'self' data: https://image.tmdb.org");
    const js = await fetch(`${base()}/app.js`);
    expect(js.headers.get('content-type')).toContain('text/javascript');
    await js.body?.cancel();
    const missing = await fetch(`${base()}/nope.js`);
    expect(missing.status).toBe(404);
    await missing.body?.cancel();
    const escape = await fetch(`${base()}/..%2F..%2Fetc%2Fpasswd`);
    expect(escape.status).toBe(404);
    await escape.body?.cancel();
  });

  it('gives the launch address with a 32-digit token (H1.2)', () => {
    expect(server.launchUrl).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${server.port}/\\?t=[0-9a-f]{32}$`));
  });
});

describe('security and the session', () => {
  it('refuses writes from another origin (H1.5)', async () => {
    for (const origin of ['http://evil.example', '']) {
      const res = await post('session.claim', { tabId: 'a', token: session.token }, { origin });
      expect(res.status).toBe(403);
      await res.body?.cancel();
    }
  });

  it('swaps the launch token for a cookie, and needs it for commands (H1.6, H1.7)', async () => {
    const noToken = await post('session.claim', { tabId: 'a' });
    expect(noToken.status).toBe(403);
    await noToken.body?.cancel();
    const first = await post('session.claim', { tabId: 'a', token: session.token });
    const body = await first.json();
    expect(first.status).toBe(200);
    expect(first.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
    expect(body.session.sourceName).toBe('Downloads');
    const cookie = (first.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const without = await post('options.get', {});
    expect(without.status).toBe(403);
    await without.body?.cancel();
    const withCookie = await post('options.get', {}, { cookie });
    expect(await withCookie.json()).toEqual({ flavour: 'plex', includeEpisodeName: true });
    const reload = await post('session.claim', { tabId: 'a' }, { cookie });
    expect(reload.status).toBe(200);
    await reload.body?.cancel();
    const unknown = await post('nope.nothing', {}, { cookie });
    expect(unknown.status).toBe(404);
    await unknown.body?.cancel();
  });

  it('needs the Queue’s ETag for changes, and sends it on every response (R1.1, R1.2)', async () => {
    const cookie = await claim();
    const options = { flavour: 'emby', includeEpisodeName: true };
    const missing = await post('options.set', options, { cookie });
    expect(missing.status).toBe(428);
    expect(missing.headers.get('etag')).toBe('"q-1"');
    await missing.body?.cancel();
    const stale = await post('options.set', options, { cookie, 'if-match': '"q-0"' });
    expect(stale.status).toBe(412);
    await stale.body?.cancel();
    const ok = await post('options.set', options, { cookie, 'if-match': '"q-1"' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('etag')).toBe('"q-2"');
    await ok.body?.cancel();
  });

  it('lets one tab hold the session while its stream is open, then lets another take over (H1.8, H1.9)', async () => {
    const cookie = await claim('tab-a');
    const stream = await fetch(`${base()}/events`, { headers: { cookie } });
    const other = await post('session.claim', { tabId: 'tab-b' }, { cookie });
    expect(other.status).toBe(409);
    await other.body?.cancel();
    expect(await readEvents(stream.body!, 1)).toEqual(['heartbeat']);
    await wait(20);
    const takeover = await post('session.claim', { tabId: 'tab-b' }, { cookie });
    expect(takeover.status).toBe(200);
    await takeover.body?.cancel();
  });

  it('tells an older stream it was taken over (H1.9)', async () => {
    const cookie = await claim();
    const first = await fetch(`${base()}/events`, { headers: { cookie } });
    const firstEvents = readEvents(first.body!, 1);
    await wait(10);
    const second = await fetch(`${base()}/events`, { headers: { cookie } });
    expect(await firstEvents).toEqual(['taken-over']);
    await second.body?.cancel();
  });
});

describe('ending the run', () => {
  it('ends once the stream has been closed for the grace period, but not before the page connects (H1.10)', async () => {
    await wait(200);
    expect(ended).toBe(0);
    const cookie = await claim();
    const stream = await fetch(`${base()}/events`, { headers: { cookie } });
    await stream.body?.cancel();
    await wait(60);
    expect(ended).toBe(0);
    await wait(150);
    expect(ended).toBe(1);
  });

  it('a reconnect within the grace period keeps the run going (H1.10)', async () => {
    const cookie = await claim();
    await (await fetch(`${base()}/events`, { headers: { cookie } })).body?.cancel();
    await wait(50);
    const again = await fetch(`${base()}/events`, { headers: { cookie } });
    await wait(150);
    expect(ended).toBe(0);
    await again.body?.cancel();
  });

  it('on Ctrl-C, says so, and waits for an apply to finish (H1.11)', async () => {
    const cookie = await claim();
    const stream = await fetch(`${base()}/events`, { headers: { cookie } });
    const events = readEvents(stream.body!, 1);
    applying = true;
    session.requestEnd();
    expect(await events).toEqual(['shutting-down']);
    expect(ended).toBe(0);
    applying = false;
    session.applyFinished();
    expect(ended).toBe(1);
  });
});
