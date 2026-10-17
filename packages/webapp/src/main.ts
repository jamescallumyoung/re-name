// The webapp's entry point. In this POC the API runs against an in-page mock
// server; the real app passes `browserTransport` instead.

import { ApiClient } from './api/client.ts';
import { Store } from './app/store.ts';
import { provideStore } from './app/store-controller.ts';
import { MockServer } from './mock/server.ts';
import './app/re-name-app.ts';
import './poc/poc-panel.ts';
import type { PocPanel } from './poc/poc-panel.ts';

const server = new MockServer();
const api = new ApiClient({ fetch: server.fetch, openEvents: server.openEvents });
const store = new Store(api, sessionStorage);
provideStore(store);

document.body.append(document.createElement('re-name-app'));
const panel = document.createElement('poc-panel') as PocPanel;
panel.server = server;
document.body.append(panel);

// The screen lives in the URL, so Back returns to the overview and keeps the draft.
store.addEventListener('change', () => {
  const hash = store.screen === 'job' && store.draft ? `#/job/${store.draft.step}` : '#/';
  if (location.hash !== hash) {
    const toJob = hash.startsWith('#/job') && !location.hash.startsWith('#/job');
    toJob ? history.pushState(null, '', hash) : history.replaceState(null, '', hash);
  }
});
addEventListener('popstate', () => (location.hash.startsWith('#/job') ? store.showDraft() : store.showOverview()));

// A reload loses the draft Job, so warn first (design doc, section 7.2).
addEventListener('beforeunload', (e) => {
  if (store.draft) e.preventDefault();
});
addEventListener('pagehide', () => store.end());

// POC only: reachable from DevTools as `reNamePoc.store` and `reNamePoc.server`.
Object.assign(globalThis, { reNamePoc: { store, server } });

void store.start();
