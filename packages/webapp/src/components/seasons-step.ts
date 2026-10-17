// Step 2, Seasons, TV only (design doc, section 7.2): a season dropdown for each
// file, pre-set to the most likely season, with files grouped by folder.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { AnalysedFile, Details } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { groupByFolder } from '../lib/draft.ts';
import { base, fields, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

const pad = (n: number) => String(n).padStart(2, '0');

@customElement('seasons-step')
export class SeasonsStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    fields,
    pills,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .note {
        color: var(--muted);
        margin: 0;
      }
      section {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.8rem;
        overflow: hidden;
      }
      header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.8rem 1rem;
        border-bottom: 1px solid var(--line);
        flex-wrap: wrap;
      }
      header .folder {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-right: auto;
        color: var(--fg);
        font-weight: 600;
        min-width: 0;
      }
      header .folder span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      header .folder svg {
        width: 1.05rem;
        height: 1.05rem;
        color: var(--muted);
        flex: none;
      }
      header label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) 10rem 5rem minmax(0, 1.4fr);
        gap: 1rem;
        align-items: center;
        padding: 0.65rem 1rem;
        border-top: 1px solid var(--line-soft);
      }
      header + .row {
        border-top: none;
      }
      .file {
        min-width: 0;
      }
      .file .code {
        color: var(--fg);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .file .name {
        color: var(--faint);
        font-family: var(--font-mono);
        font-size: 0.72rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tmdb {
        color: var(--fg-2);
        min-width: 0;
      }
      .tmdb .placeholder {
        color: var(--faint);
        font-style: italic;
      }
      input[type='number'] {
        width: 100%;
      }
      @media (max-width: 900px) {
        .row {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const details = draft.details;
    if (!details) return html`<p class="note">Loading seasons from TMDB…</p>`;
    return html`
      <p class="note">Check each file’s season and episode against ${details.title} on TMDB.</p>
      ${groupByFolder(draft.files).map(([folder, files]) => this.renderFolder(folder, files, details))}
    `;
  }

  private renderFolder(folder: string, files: AnalysedFile[], details: Details) {
    const store = this.c.store;
    const seasons = new Set(files.map((f) => store.draft?.episodes[f.path]?.season ?? null));
    const common = seasons.size === 1 ? [...seasons][0] : undefined;
    return html`
      <section>
        <header>
          <span class="folder">${icon('folder')}<span>${folder || `${store.session?.sourceName}/`}</span></span>
          <label>
            Season for all
            <select
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v !== 'mixed') store.setFolderSeason(files.map((f) => f.path), v === '' ? null : Number(v));
              }}
            >
              ${common === undefined ? html`<option value="mixed" .selected=${true}>Mixed</option>` : nothing}
              ${this.seasonOptions(details, common)}
            </select>
          </label>
        </header>
        ${files.map((f) => this.renderRow(f, details))}
      </section>
    `;
  }

  /**
   * The options, with `chosen` selected (`undefined`: none, for a mixed folder).
   * `.selected` on each option, because `.value` on the select is applied before
   * its options exist, and the `selected` attribute stops working once the user
   * has changed the select.
   */
  private seasonOptions(details: Details, chosen: number | null | undefined) {
    return html`
      <option value="" .selected=${chosen === null}>Choose…</option>
      ${details.seasons.map(
        (s) =>
          html`<option value=${s.season} .selected=${s.season === chosen}>${
            s.season === 0 ? 'Specials' : `Season ${s.season}`
          }</option>`,
      )}
    `;
  }

  private renderRow(file: AnalysedFile, details: Details) {
    const store = this.c.store;
    const choice = store.draft?.episodes[file.path] ?? { season: null, episode: null };
    const season = details.seasons.find((s) => s.season === choice.season);
    const episode = season?.episodes.find((e) => e.episode === choice.episode);
    const name = file.path.slice(file.path.lastIndexOf('/') + 1);
    const code = choice.season !== null && choice.episode !== null
      ? `S${pad(choice.season)}E${pad(choice.episode)}`
      : 'S??E??';
    return html`
      <div class="row">
        <div class="file" title=${file.path}>
          <div class="code">${code}</div>
          <div class="name">${name}</div>
        </div>
        <select
          aria-label=${`Season of ${name}`}
          @change=${(e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            store.setEpisode(file.path, { season: v === '' ? null : Number(v) });
          }}
        >${this.seasonOptions(details, choice.season)}</select>
        <input
          type="number"
          min="0"
          aria-label=${`Episode of ${name}`}
          .value=${choice.episode === null ? '' : String(choice.episode)}
          @input=${(e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            store.setEpisode(file.path, { episode: v === '' ? null : Number(v) });
          }}
        />
        <div class="tmdb">
          ${choice.season === null
            ? html`<span class="pill bad">${icon('alert')} Choose a season</span>`
            : !season
            ? html`<span class="pill warn">No such season on TMDB</span>`
            : !episode
            ? html`<span class="pill warn">Not in season ${choice.season}</span>`
            : episode.name
            ? episode.name
            : html`<span class="placeholder" title="TMDB only has a placeholder, so the name is left out">No name on TMDB yet</span>`}
        </div>
      </div>
    `;
  }
}
