// Step 2, Seasons & episodes, TV only (design doc, section 7.2): a season dropdown
// for each file, pre-set to the most likely season, with files grouped by folder.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { AnalysedFile, Details } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { groupByFolder } from '../lib/draft.ts';
import { shared } from '../styles/shared.ts';
import { renderNewName } from './new-name.ts';

const pad = (n: number) => String(n).padStart(2, '0');

@customElement('seasons-step')
export class SeasonsStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        padding: 16px 18px 24px;
      }
      .intro {
        font-size: 14px;
        margin: 0 0 16px;
      }
      section {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        margin-bottom: 14px;
        overflow: hidden;
      }
      section > header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }
      section > header .folder {
        font-family: var(--font-mono);
        font-weight: 600;
        margin-right: auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th {
        text-align: left;
        font-size: 11px;
        font-weight: 600;
        color: var(--fg-3);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 6px 12px;
      }
      td {
        padding: 6px 12px;
        border-top: 1px solid var(--border);
        vertical-align: top;
      }
      td.file {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--fg-2);
        max-width: 360px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      input[type='number'] {
        width: 64px;
      }
      .episode-name {
        font-size: 13px;
      }
      .new {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--fg-3);
        margin-top: 3px;
        white-space: nowrap;
      }
      .dup {
        background: var(--warn-soft);
        color: var(--warn);
        border-radius: 3px;
        padding: 0 3px;
        font-weight: 700;
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const details = draft.details;
    if (!details) return html`<p class="intro muted">Loading seasons from TMDB…</p>`;
    return html`
      <p class="intro">
        Check each file’s season and episode against <b>${details.title}</b> on TMDB. Seasons are pre-set from the names
        and folders.
      </p>
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
          <span class="folder">📁 ${folder || `${store.session?.sourceName}/ (top level)`}</span>
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
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Season</th>
              <th>Episode</th>
              <th>On TMDB</th>
            </tr>
          </thead>
          <tbody>${files.map((f) => this.renderRow(f, details))}</tbody>
        </table>
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
            s.season === 0 ? 'Specials (Season 00)' : `Season ${pad(s.season)}`
          } · ${s.episodes.length} ep</option>`,
      )}
    `;
  }

  private renderRow(file: AnalysedFile, details: Details) {
    const store = this.c.store;
    const choice = store.draft?.episodes[file.path] ?? { season: null, episode: null };
    const season = details.seasons.find((s) => s.season === choice.season);
    const episode = season?.episodes.find((e) => e.episode === choice.episode);
    const preview = store.draft?.preview?.files.find((f) => f.path === file.path);
    const name = file.path.slice(file.path.lastIndexOf('/') + 1);
    return html`
      <tr>
        <td class="file" title=${file.path}>
          ${name}
          ${file.season !== null
            ? html`<div><span class="badge">read as S${pad(file.season)}E${pad(file.episode ?? 0)}</span></div>`
            : nothing}
        </td>
        <td>
          <select
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              store.setEpisode(file.path, { season: v === '' ? null : Number(v) });
            }}
          >${this.seasonOptions(details, choice.season)}</select>
        </td>
        <td>
          <input
            type="number"
            min="0"
            .value=${choice.episode === null ? '' : String(choice.episode)}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              store.setEpisode(file.path, { episode: v === '' ? null : Number(v) });
            }}
          />
        </td>
        <td>
          ${choice.season === null
            ? html`<span class="badge bad">Choose a season</span>`
            : !season
            ? html`<span class="badge warn">No such season on TMDB</span>`
            : !episode
            ? html`<span class="badge warn">No episode ${choice.episode ?? '?'} in this season</span>`
            : episode.name
            ? html`<span class="episode-name">${episode.name}</span>`
            : html`<span class="muted" title="TMDB only has a placeholder name, so it’s left out">No name yet on TMDB</span>`}
          ${preview?.newPath
            ? html`<div class="new">→ ${renderNewName(preview.newPath.split('/').pop() ?? '')}</div>`
            : nothing}
        </td>
      </tr>
    `;
  }
}
