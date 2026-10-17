// Step 2, Seasons, TV only (design doc, section 7.2): a season dropdown for each
// file, pre-set to the most likely season, with files grouped by folder.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { AnalysedFile, Details } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { groupByFolder } from '../lib/draft.ts';
import { base, fields, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

const pad = (n: number) => String(n).padStart(2, '0');

@customElement('seasons-step')
export class SeasonsStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    fields,
    tags,
    css`
      :host {
        display: grid;
        gap: 20px;
      }
      .group {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
      }
      .ghead {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 52px;
        padding: 6px 16px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--line);
      }
      .ghead .folder {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--fg);
        font-weight: 600;
      }
      .ghead .folder span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ghead .folder svg {
        width: 18px;
        height: 18px;
        color: var(--muted);
        flex: none;
      }
      .ghead label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 13px;
      }
      .row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) 140px 76px minmax(0, 1fr);
        gap: 14px;
        align-items: center;
        min-height: 54px;
        padding: 6px 16px;
        border-top: 1px solid var(--line);
      }
      .ghead + .row {
        border-top: none;
      }
      .code {
        color: var(--fg);
        font-family: var(--font-mono);
        font-weight: 600;
      }
      .name {
        color: var(--faint);
        font-family: var(--font-mono);
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tmdb {
        color: var(--fg-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tmdb i {
        color: var(--faint);
      }
      select,
      input[type='number'] {
        width: 100%;
      }
      .loading {
        color: var(--muted);
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const details = draft.details;
    if (!details) return html`<div class="loading">Loading seasons from TMDB…</div>`;
    return html`${groupByFolder(draft.files).map(([folder, files]) => this.renderFolder(folder, files, details))}`;
  }

  private renderFolder(folder: string, files: AnalysedFile[], details: Details) {
    const store = this.c.store;
    const seasons = new Set(files.map((f) => store.draft?.episodes[f.path]?.season ?? null));
    const common = seasons.size === 1 ? [...seasons][0] : undefined;
    return html`
      <div class="group">
        <div class="ghead">
          <span class="folder">${icon('folder')}<span>${folder || '(top level)'}</span></span>
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
        </div>
        ${files.map((f) => this.renderRow(f, details))}
      </div>
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
    return html`
      <div class="row">
        <span class="code">${choice.season !== null && choice.episode !== null
          ? `S${pad(choice.season)}E${pad(choice.episode)}`
          : 'S??E??'}</span>
        <span class="name" title=${file.path}>${name}</span>
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
        <span class="tmdb">
          ${choice.season === null
            ? html`<span class="tag bad">${icon('alert')} Choose a season</span>`
            : !season
            ? html`<span class="tag warn">No such season</span>`
            : !episode
            ? html`<span class="tag warn">Not in season ${choice.season}</span>`
            : episode.name
            ? episode.name
            : html`<i title="TMDB only has a placeholder, so the name is left out">no name on TMDB yet</i>`}
        </span>
      </div>
    `;
  }
}
