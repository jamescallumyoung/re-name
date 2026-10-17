// The webapp's entry point. In this POC the API runs against an in-page mock
// server; the real app passes `browserTransport` instead.

import { ApiClient } from './api/client.ts';
import { type Page, Store } from './app/store.ts';
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

// The page lives in the URL, so Back and Forward move between pages (the draft is kept).
const PAGES: readonly Page[] = ['files', 'queue', 'settings', 'job'];
store.addEventListener('change', () => {
  const hash = `#/${store.page}`;
  if (location.hash !== hash) history.pushState(null, '', hash);
});
const fromHash = () => {
  const page = location.hash.slice(2) as Page;
  if (PAGES.includes(page)) store.goTo(page);
};
addEventListener('popstate', fromHash);
store.addEventListener('change', function first() {
  if (store.phase !== 'ready') return;
  store.removeEventListener('change', first);
  fromHash();
});

// A reload loses the draft Job, so warn first (design doc, section 7.2).
addEventListener('beforeunload', (e) => {
  if (store.draft) e.preventDefault();
});
addEventListener('pagehide', () => store.end());

// POC only: reachable from DevTools as `reNamePoc.store` and `reNamePoc.server`.
Object.assign(globalThis, { reNamePoc: { store, server } });

void store.start();
