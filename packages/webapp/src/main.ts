// The webapp's entry point: the store, talking to the re-name server that served
// this page (design doc §8).

import { ApiClient, browserTransport } from './api/client.ts';
import { Store } from './app/store.ts';
import { provideStore } from './app/store-controller.ts';
import './app/re-name-app.ts';

const store = new Store(new ApiClient(browserTransport), sessionStorage);
provideStore(store);
document.body.append(document.createElement('re-name-app'));

// A reload loses the draft Job, so warn first (design doc §7.2).
addEventListener('beforeunload', (e) => {
  if (store.draft) e.preventDefault();
});
addEventListener('pagehide', () => store.end());

void store.start();
