// The webapp's RPC client (design doc, section 8.2): `POST /rpc/<method>` with a
// JSON body, real HTTP statuses, and the Queue's ETag on commands that change it.
// The transport is injected, so the POC can run against the mock server.

import type { RpcErrorBody, RpcMethod, RpcParams, RpcResult, ServerEvent } from '@re-name/protocol';
import { QUEUE_COMMANDS } from '@re-name/protocol';

/** What `EventSource` offers that the client uses. */
export interface EventStream extends EventTarget {
  close(): void;
}

export interface Transport {
  fetch: typeof fetch;
  openEvents: () => EventStream;
}

export const browserTransport: Transport = {
  fetch: (input, init) => fetch(input, init),
  openEvents: () => new EventSource('/events'),
};

export class RpcError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }

  /** True for a stale Queue: fetch it again and retry. */
  get stale(): boolean {
    return this.status === 412;
  }
}

export class ApiClient {
  /** The Queue's ETag, from the last response that carried one. */
  etag: string | null = null;

  constructor(private readonly transport: Transport) {}

  async call<M extends RpcMethod>(method: M, params: RpcParams<M>): Promise<RpcResult<M>> {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (QUEUE_COMMANDS.includes(method) && this.etag !== null) headers.set('if-match', this.etag);
    let response: Response;
    try {
      response = await this.transport.fetch(`/rpc/${method}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
    } catch {
      throw new RpcError(0, 'network', 'The re-name server can’t be reached. Is it still running?');
    }
    const etag = response.headers.get('etag');
    if (etag !== null) this.etag = etag;
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as RpcErrorBody | null;
      throw new RpcError(
        response.status,
        body?.error ?? 'unknown',
        body?.message ?? `The server answered ${response.status}.`,
        body?.details,
      );
    }
    if (response.status === 204) return null as RpcResult<M>;
    return (await response.json()) as RpcResult<M>;
  }

  /** Opens the event stream; `onEvent` gets each event, `onClose` a dropped stream. */
  listen(onEvent: (event: ServerEvent) => void, onClose: () => void): EventStream {
    const stream = this.transport.openEvents();
    stream.addEventListener('message', (e) => {
      try {
        onEvent(JSON.parse((e as MessageEvent<string>).data) as ServerEvent);
      } catch {
        // A malformed event is ignored.
      }
    });
    stream.addEventListener('error', onClose);
    return stream;
  }
}
