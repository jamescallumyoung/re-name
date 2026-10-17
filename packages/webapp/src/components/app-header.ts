// The top app bar: the app's name, the source folder, and a widget showing the
// options for the whole Queue, which reopens the settings modal.

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
        gap: 20px;
        height: 64px;
        padding: 0 24px;
        background: var(--surface);
        border-bottom: 1px solid var(--line);
      }
      .name {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--fg);
        font-weight: 800;
        font-size: 18px;
        letter-spacing: -0.01em;
      }
      .mark {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: var(--radius);
        background: var(--primary);
        color: var(--on-primary);
      }
      .source {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding-left: 20px;
        border-left: 1px solid var(--line);
        line-height: 1.3;
      }
      .source .label {
        color: var(--muted);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .source .path {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .settings {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 14px 0 16px;
        border-radius: var(--radius);
        background: var(--secondary-container);
        color: var(--on-secondary-container);
        transition: background 0.15s;
      }
      .settings:hover {
        background: color-mix(in srgb, var(--secondary-container) 85%, var(--secondary));
      }
      .settings b {
        color: var(--on-secondary-container);
      }
      .settings .sep {
        width: 1px;
        height: 16px;
        background: color-mix(in srgb, var(--on-secondary-container) 30%, transparent);
      }
      .settings svg {
        width: 18px;
        height: 18px;
        color: var(--primary);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 13px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ok);
      }
      @media (max-width: 800px) {
        .status span:last-child,
        .settings .ep {
          display: none;
        }
      }
    `,
  ];

  override render() {
    const { session, options } = this.c.store;
    return html`
      <span class="name"><span class="mark">${icon('rename')}</span> re-name</span>
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
        <span class="ep">Episode names ${options.includeEpisodeName ? 'on' : 'off'}</span>
        ${icon('settings')}
      </button>
      <span class="status" title="Connected to the re-name server"><span class="dot"></span><span>Connected</span></span>
    `;
  }
}
