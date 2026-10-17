// The app's one store, and the controller that re-renders a Lit element when it changes.

import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Store } from './store.ts';

let current: Store | undefined;

/** Called once by main.ts, before any element renders. */
export function provideStore(store: Store): void {
  current = store;
}

export function getStore(): Store {
  if (!current) throw new Error('The store was used before main.ts provided it.');
  return current;
}

/** Re-renders `host` whenever the store emits `change`. */
export class StoreController implements ReactiveController {
  readonly store = getStore();
  private readonly onChange = () => this.host.requestUpdate();

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    this.store.addEventListener('change', this.onChange);
  }

  hostDisconnected(): void {
    this.store.removeEventListener('change', this.onChange);
  }
}
