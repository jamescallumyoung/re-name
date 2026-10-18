import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { ApplyResult, ServerEvent } from '@re-name/protocol';
import { ApiClient } from '../../api/client.ts';
import { Store } from '../store.ts';

const RESULT: ApplyResult = {
  dryRun: false,
  moved: 5,
  total: 5,
  error: null,
  logPath: '/logs/apply.json',
  queue: { jobs: [] },
  etag: '"q-3"',
};

/** A store whose server answers `queue.apply` with `respond`, after `before` has run. */
function storeWith(respond: () => Response, before: (store: Store) => void = () => {}) {
  const transport = {
    fetch: (input: RequestInfo | URL) => {
      const method = String(input).split('/').pop();
      if (method === 'queue.apply') {
        before(store);
        return Promise.resolve(respond());
      }
      return Promise.resolve(Response.json({ root: { kind: 'folder', name: '', path: '', children: [] } }));
    },
    openEvents: () => Object.assign(new EventTarget(), { close() {} }),
  };
  // `fetch` only reads `store` once a test runs, after this.
  const store: Store = new Store(new ApiClient(transport), {} as Storage);
  return store;
}

const send = (store: Store, event: ServerEvent) =>
  (store as unknown as { onEvent(e: ServerEvent): void }).onEvent(event);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('applying the Queue', () => {
  it('shows the result when the apply finishes before the command returns', async () => {
    const store = storeWith(
      () => Response.json({ started: true }, { status: 202 }),
      (s) => {
        send(s, { type: 'apply-progress', progress: { jobId: 'j', path: 'a', newPath: 'b', index: 0, total: 5 } });
        send(s, { type: 'apply-done', result: RESULT });
      },
    );
    store.askApply();
    await store.answer(true);
    await flush();
    expect(store.apply).toEqual({ progress: null, result: RESULT });
  });

  it('shows the check while waiting, and the problems if the check fails', async () => {
    let during: Store['apply'] = null;
    const store = storeWith(
      () =>
        Response.json({ error: 'disk-changed', message: 'Files changed.', details: ['a: changed'] }, { status: 422 }),
      (s) => (during = s.apply),
    );
    store.askApply();
    await store.answer(true);
    expect(during).toEqual({ progress: null, result: null });
    expect(store.apply).toBe(null);
    expect(store.applyError).toEqual({ message: 'Files changed.', details: ['a: changed'] });
  });
});
