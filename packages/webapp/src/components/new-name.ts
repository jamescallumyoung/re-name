// Renders a new file name with its `DUP-{n}` tag highlighted. Callers style `.dup`.

import { html } from 'lit';

export function renderNewName(name: string): unknown {
  const parts = name.split(/(DUP-\d+)/);
  return parts.map((part) => (/^DUP-\d+$/.test(part) ? html`<span class="dup">${part}</span>` : part));
}
