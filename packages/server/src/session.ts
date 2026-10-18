// The session: one tab at a time, the launch token and cookie, the event stream,
// and when the run ends (design doc §8.5; spec H1.7–H1.12).

import type { ServerEvent } from '@re-name/protocol';

export interface SessionOptions {
  heartbeatMs?: number;
  graceMs?: number;
  /** Whether an apply is running: the run never ends during one. */
  applying: () => boolean;
  /** Called once, when the run should end. */
  onEnd: () => void;
}

export type Claim = { ok: true; setCookie: string | null } | { ok: false; status: 403 | 409 };

const random = () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
const encoder = new TextEncoder();

export class Session {
  /** Spec H1.2. */
  readonly token = random();
  private readonly cookie = random();
  private tabId: string | null = null;
  private stream: ReadableStreamDefaultController<Uint8Array> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private grace: ReturnType<typeof setTimeout> | undefined;
  private everConnected = false;
  private endRequested = false;
  private ended = false;
  private readonly heartbeatMs: number;
  private readonly graceMs: number;

  constructor(private readonly opts: SessionOptions) {
    this.heartbeatMs = opts.heartbeatMs ?? 5000;
    this.graceMs = opts.graceMs ?? 15_000;
  }

  static readonly COOKIE = 're-name-session';

  hasCookie(cookieHeader: string | null): boolean {
    return (cookieHeader ?? '').split(';').some((c) => c.trim() === `${Session.COOKIE}=${this.cookie}`);
  }

  /** Spec H1.7, H1.8. */
  claim(tabId: unknown, token: unknown, cookieHeader: string | null): Claim {
    const withToken = typeof token === 'string' && token === this.token;
    if (!withToken && !this.hasCookie(cookieHeader)) return { ok: false, status: 403 };
    if (typeof tabId !== 'string' || !tabId) return { ok: false, status: 403 };
    if (this.tabId !== null && this.tabId !== tabId && this.stream) return { ok: false, status: 409 };
    this.tabId = tabId;
    return {
      ok: true,
      setCookie: withToken ? `${Session.COOKIE}=${this.cookie}; HttpOnly; SameSite=Strict; Path=/` : null,
    };
  }

  /** Spec H1.9: a newer stream replaces an older one, which is told first. */
  openStream(): ReadableStream<Uint8Array> {
    let mine: ReadableStreamDefaultController<Uint8Array> | null = null;
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        if (this.stream) {
          this.write(this.stream, { type: 'taken-over' });
          this.closeQuietly(this.stream);
        }
        mine = this.stream = controller;
        this.everConnected = true;
        clearTimeout(this.grace);
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => this.send({ type: 'heartbeat' }), this.heartbeatMs);
        controller.enqueue(encoder.encode(': connected\n\n'));
      },
      cancel: () => {
        if (this.stream !== mine) return;
        this.stream = null;
        clearInterval(this.heartbeat);
        this.startGrace();
      },
    });
  }

  send(event: ServerEvent): void {
    if (this.stream) this.write(this.stream, event);
  }

  /** Spec H1.11: Ctrl-C. */
  requestEnd(): void {
    this.send({ type: 'shutting-down' });
    this.endRequested = true;
    this.maybeEnd();
  }

  /** The apply finished: end now if the run was waiting for it (spec H1.10, H1.11). */
  applyFinished(): void {
    this.maybeEnd();
  }

  /** Stops the timers (spec H1.12). */
  close(): void {
    clearInterval(this.heartbeat);
    clearTimeout(this.grace);
    if (this.stream) this.closeQuietly(this.stream);
    this.stream = null;
  }

  /** Spec H1.10: once the page has connected, 15 s without a stream ends the run. */
  private startGrace(): void {
    if (!this.everConnected) return;
    clearTimeout(this.grace);
    this.grace = setTimeout(() => {
      if (!this.stream) {
        this.endRequested = true;
        this.maybeEnd();
      }
    }, this.graceMs);
  }

  private maybeEnd(): void {
    if (!this.endRequested || this.ended || this.opts.applying()) return;
    this.ended = true;
    this.close();
    this.opts.onEnd();
  }

  private write(controller: ReadableStreamDefaultController<Uint8Array>, event: ServerEvent): void {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // The stream already closed.
    }
  }

  private closeQuietly(controller: ReadableStreamDefaultController<Uint8Array>): void {
    try {
      controller.close();
    } catch {
      // Already closed.
    }
  }
}
