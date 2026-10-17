// The top bar: where files come from and go to, the options for the whole Queue
// (flavour and episode names, design doc section 9.7), and the connection.

import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Flavour } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { shared } from '../styles/shared.ts';

const FLAVOURS: { value: Flavour; label: string }[] = [
  { value: 'plex', label: 'Plex' },
  { value: 'jellyfin', label: 'Jellyfin' },
  { value: 'emby', label: 'Emby' },
];

@customElement('app-header')
export class AppHeader extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    shared,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 10px 20px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
      }
      .brand {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-weight: 800;
        font-size: 16px;
        letter-spacing: -0.01em;
      }
      .brand .dot {
        color: var(--accent);
      }
      .paths {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--fg-2);
        min-width: 0;
      }
      .paths .folder {
        font-family: var(--font-mono);
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2px 6px;
      }
      .spacer {
        flex: 1;
      }
      .options {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .segmented {
        display: inline-flex;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 2px;
      }
      .segmented button {
        border: none;
        background: transparent;
        padding: 4px 10px;
        color: var(--fg-2);
      }
      .segmented button[aria-pressed='true'] {
        background: var(--surface);
        color: var(--fg);
        box-shadow: var(--shadow);
      }
      label.toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--fg-2);
        cursor: pointer;
      }
      .label {
        font-size: 11px;
        font-weight: 600;
        color: var(--fg-3);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--fg-3);
      }
      .status i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ok);
        box-shadow: 0 0 0 3px var(--ok-soft);
      }
    `,
  ];

  override render() {
    const { session, options } = this.c.store;
    return html`
      <div class="brand">re<span class="dot">·</span>name</div>
      ${session
        ? html`
          <div class="paths" title="Files are moved from the source into the target">
            <span class="folder">${session.sourceName}/</span>
            <span>→</span>
            <span class="folder">${session.sourceName}/${session.targetName}/</span>
          </div>
          ${session.dryRun
            ? html`<span class="badge warn" title="re-name was started with --dry-run: nothing will be moved">Dry run</span>`
            : ''}
        `
        : ''}
      <div class="spacer"></div>
      <div class="options">
        <span class="label">Name for</span>
        <div class="segmented" role="group" aria-label="Media server">
          ${FLAVOURS.map(
            (f) =>
              html`
                <button
                  aria-pressed=${options.flavour === f.value}
                  @click=${() => this.c.store.setOptions({ flavour: f.value })}
                >${f.label}</button>
              `,
          )}
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            .checked=${options.includeEpisodeName}
            @change=${(e: Event) =>
              this.c.store.setOptions({ includeEpisodeName: (e.target as HTMLInputElement).checked })}
          />
          Episode names
        </label>
      </div>
      <span class="status" title="Connected to the re-name server"><i></i> Connected</span>
    `;
  }
}
