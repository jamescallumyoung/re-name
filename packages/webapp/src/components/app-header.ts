// The header: the app's name, the source folder, and a widget showing the options
// for the whole Queue, which reopens the settings modal.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { base, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

export const FLAVOUR_LABEL = { plex: 'Plex', jellyfin: 'Jellyfin', emby: 'Emby' } as const;

@customElement('app-header')
export class AppHeader extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    tags,
    css`
      :host {
        flex: none;
        display: flex;
        align-items: center;
        gap: 16px;
        height: 48px;
        padding: 0 16px;
        background: var(--surface);
        border-bottom: 1px solid var(--line);
      }
      .name {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--fg);
        font-weight: 800;
        font-size: 14px;
        letter-spacing: -0.01em;
      }
      .name svg {
        width: 18px;
        height: 18px;
        color: var(--accent);
      }
      .source {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
        padding-left: 16px;
        border-left: 1px solid var(--line);
      }
      .source .label {
        color: var(--faint);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .source .path {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 12.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .settings {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 30px;
        padding: 0 10px;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        background: var(--surface-2);
        color: var(--fg-2);
        font-size: 12px;
      }
      .settings:hover {
        background: var(--surface-3);
        color: var(--fg);
      }
      .settings b {
        color: var(--fg);
      }
      .settings .sep {
        width: 1px;
        height: 14px;
        background: var(--line-strong);
      }
      .settings svg {
        width: 14px;
        height: 14px;
        color: var(--muted);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--muted);
        font-size: 12px;
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--ok);
      }
      @media (max-width: 760px) {
        .source .label,
        .status span:last-child {
          display: none;
        }
      }
    `,
  ];

  override render() {
    const { session, options } = this.c.store;
    return html`
      <span class="name">${icon('rename')} re-name</span>
      <div class="source">
        <span class="label">Source</span>
        <span class="path" title=${session?.sourcePath ?? ''}>${session?.sourcePath ?? '…'}</span>
      </div>
      ${session?.dryRun
        ? html`<span class="tag warn" title="Started with --dry-run: nothing will be moved">Dry run</span>`
        : nothing}
      <button class="settings" title="Naming settings" @click=${() => this.c.store.openSettings()}>
        <b>${FLAVOUR_LABEL[options.flavour]}</b>
        <span class="sep"></span>
        <span>Episode names ${options.includeEpisodeName ? 'on' : 'off'}</span>
        ${icon('settings')}
      </button>
      <span class="status" title="Connected to the re-name server"><span class="dot"></span><span>Connected</span></span>
    `;
  }
}
