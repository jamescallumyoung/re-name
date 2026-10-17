// The options for the whole Queue (design doc, section 9.7): which media server
// names are made for, and whether episode names are included. Shown once up front
// in the setup modal, and again in Settings.

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Flavour, Options } from '@re-name/protocol';
import { base } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

const FLAVOURS: { value: Flavour; label: string; example: string }[] = [
  { value: 'plex', label: 'Plex', example: 'Show (2020) {tmdb-97546}' },
  { value: 'jellyfin', label: 'Jellyfin', example: 'Show (2020) [tmdbid-97546]' },
  { value: 'emby', label: 'Emby', example: 'Show (2020) [tmdbid=97546]' },
];

/**
 * @fires options-change - detail: Options
 */
@customElement('options-form')
export class OptionsForm extends LitElement {
  @property({ attribute: false })
  accessor value: Options = { flavour: 'plex', includeEpisodeName: true };

  static override styles = [
    base,
    css`
      :host {
        display: grid;
        gap: 1.4rem;
      }
      .label {
        color: var(--fg);
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .help {
        color: var(--muted);
        font-size: 0.85rem;
        margin-bottom: 0.75rem;
      }
      .flavours {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .flavour {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.4rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--line);
        border-radius: 0.7rem;
        background: var(--bg);
        text-align: left;
        transition:
          border-color 0.15s,
          background 0.15s;
      }
      .flavour:hover {
        border-color: var(--muted);
      }
      .flavour[aria-checked='true'] {
        border-color: var(--accent);
        background: var(--accent-soft);
      }
      .flavour .name {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        color: var(--fg);
        font-weight: 700;
        font-size: 1rem;
      }
      .flavour .name svg {
        width: 1.1rem;
        height: 1.1rem;
        color: var(--accent);
        opacity: 0;
      }
      .flavour[aria-checked='true'] .name svg {
        opacity: 1;
      }
      .flavour .example {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--muted);
      }
      .switch {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--line);
        border-radius: 0.7rem;
        background: var(--bg);
        width: 100%;
        text-align: left;
      }
      .track {
        flex: none;
        width: 2.4rem;
        height: 1.35rem;
        border-radius: 999px;
        background: var(--panel-2);
        border: 1px solid var(--line);
        position: relative;
        transition: background 0.15s;
      }
      .track::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: calc(1.35rem - 6px);
        height: calc(1.35rem - 6px);
        border-radius: 50%;
        background: var(--fg-2);
        transition: transform 0.15s;
      }
      [aria-checked='true'] .track {
        background: var(--accent-strong);
        border-color: var(--accent);
      }
      [aria-checked='true'] .track::after {
        transform: translateX(1.05rem);
        background: #fff;
      }
      .switch .text b {
        display: block;
        color: var(--fg);
        font-weight: 600;
      }
      .switch .text span {
        color: var(--muted);
        font-size: 0.85rem;
        font-family: var(--font-mono);
      }
      @media (max-width: 640px) {
        .flavours {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  override render() {
    const v = this.value;
    return html`
      <div>
        <div class="label">Media server</div>
        <div class="help">Folders and files are named the way this server expects.</div>
        <div class="flavours" role="radiogroup" aria-label="Media server">
          ${FLAVOURS.map(
            (f) =>
              html`
                <button
                  class="flavour"
                  role="radio"
                  aria-checked=${v.flavour === f.value}
                  @click=${() => this.change({ ...v, flavour: f.value })}
                >
                  <span class="name">${f.label} ${icon('check')}</span>
                  <span class="example">${f.example}</span>
                </button>
              `,
          )}
        </div>
      </div>
      <button
        class="switch"
        role="switch"
        aria-checked=${v.includeEpisodeName}
        @click=${() => this.change({ ...v, includeEpisodeName: !v.includeEpisodeName })}
      >
        <span class="track"></span>
        <span class="text">
          <b>Include episode names</b>
          <span>${v.includeEpisodeName ? 'S01E03 - Trent Crimm_ The Independent' : 'S01E03'}</span>
        </span>
      </button>
    `;
  }

  private change(options: Options): void {
    this.value = options;
    this.dispatchEvent(new CustomEvent('options-change', { detail: options, bubbles: true, composed: true }));
  }
}
