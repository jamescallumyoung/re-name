// The options for the whole Queue (design doc, section 9.7): which media server
// names are made for, and whether episode names are included.

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Flavour, Options } from '@re-name/protocol';
import { base, fields } from '../styles/shared.ts';

const FLAVOURS: { value: Flavour; label: string; example: string }[] = [
  { value: 'plex', label: 'Plex', example: 'Ted Lasso (2020) {tmdb-97546}' },
  { value: 'jellyfin', label: 'Jellyfin', example: 'Ted Lasso (2020) [tmdbid-97546]' },
  { value: 'emby', label: 'Emby', example: 'Ted Lasso (2020) [tmdbid=97546]' },
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
    fields,
    css`
      :host {
        display: grid;
        gap: 18px;
      }
      fieldset {
        margin: 0;
        padding: 0;
        border: 0;
      }
      legend {
        padding: 0;
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .options {
        border: 1px solid var(--line);
      }
      label {
        display: grid;
        grid-template-columns: 14px 90px 1fr;
        gap: 12px;
        align-items: center;
        min-height: 36px;
        padding: 0 12px;
        cursor: pointer;
        border-top: 1px solid var(--line);
      }
      label:first-child {
        border-top: none;
      }
      label:hover {
        background: var(--surface-2);
      }
      label.on {
        background: var(--accent-soft);
      }
      label b {
        color: var(--fg);
      }
      .example {
        color: var(--muted);
        font-family: var(--font-mono);
        font-size: 11.5px;
      }
    `,
  ];

  override render() {
    const v = this.value;
    return html`
      <fieldset>
        <legend>Media server</legend>
        <div class="options">
          ${FLAVOURS.map(
            (f) =>
              html`
                <label class=${v.flavour === f.value ? 'on' : ''}>
                  <input
                    type="radio"
                    name="flavour"
                    .checked=${v.flavour === f.value}
                    @change=${() => this.change({ ...v, flavour: f.value })}
                  />
                  <b>${f.label}</b>
                  <span class="example">${f.example}/</span>
                </label>
              `,
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend>Episode file names</legend>
        <div class="options">
          <label class=${v.includeEpisodeName ? 'on' : ''}>
            <input
              type="checkbox"
              .checked=${v.includeEpisodeName}
              @change=${(e: Event) => this.change({ ...v, includeEpisodeName: (e.target as HTMLInputElement).checked })}
            />
            <b>Episode name</b>
            <span class="example">${v.includeEpisodeName ? 'S01E02 - Biscuits' : 'S01E02'}</span>
          </label>
        </div>
      </fieldset>
    `;
  }

  private change(options: Options): void {
    this.value = options;
    this.dispatchEvent(new CustomEvent('options-change', { detail: options, bubbles: true, composed: true }));
  }
}
