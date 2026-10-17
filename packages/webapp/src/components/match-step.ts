// Step 1, Match (design doc, section 7.2): five suggestions from the server as a
// list to pick from, and a manual search for when they're all wrong.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Match } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons, fields, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import './poster-art.ts';

@customElement('match-step')
export class MatchStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    fields,
    tags,
    css`
      :host {
        display: grid;
        gap: 16px;
      }
      .label {
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .label b {
        color: var(--fg-2);
        text-transform: none;
        letter-spacing: 0;
        font-weight: 600;
        font-size: 12px;
      }
      .list {
        border: 1px solid var(--line);
      }
      .match {
        display: grid;
        grid-template-columns: 14px 28px minmax(0, 1fr) 60px 90px;
        gap: 12px;
        align-items: center;
        width: 100%;
        min-height: 52px;
        padding: 5px 10px;
        border-top: 1px solid var(--line);
        text-align: left;
        cursor: pointer;
      }
      .match:first-child {
        border-top: none;
      }
      .match:hover {
        background: var(--surface-2);
      }
      .match.on {
        background: var(--accent-soft);
      }
      .match poster-art {
        width: 28px;
      }
      .match .t {
        color: var(--fg);
        font-weight: 600;
      }
      .match .y {
        color: var(--muted);
        margin-left: 4px;
      }
      .match .id {
        color: var(--faint);
        font-family: var(--font-mono);
        font-size: 11px;
        text-align: right;
      }
      .loading {
        padding: 14px 10px;
        color: var(--muted);
      }
      form {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }
      form input {
        flex: 1;
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const parsed = draft.files[0];
    return html`
      <div>
        <div class="label">
          Suggestions · read from the names as <b>${parsed?.parsedTitle || '—'}${parsed?.parsedYear
            ? ` (${parsed.parsedYear})`
            : ''}</b>
        </div>
        <div class="list" role="radiogroup" aria-label="Suggested titles">
          ${draft.suggestions === null
            ? html`<div class="loading">Asking TMDB…</div>`
            : draft.suggestions.map((m) => this.renderMatch(m))}
        </div>
      </div>
      <div>
        <div class="label">Search TMDB</div>
        <form
          @submit=${(e: Event) => {
            e.preventDefault();
            void this.c.store.search();
          }}
        >
          <input
            type="search"
            placeholder="Title"
            aria-label="Title"
            .value=${draft.searchQuery}
            @input=${(e: Event) => this.c.store.setSearch((e.target as HTMLInputElement).value, draft.searchType)}
          />
          <select
            aria-label="Type"
            @change=${(e: Event) =>
              this.c.store.setSearch(
                draft.searchQuery,
                (e.target as HTMLSelectElement).value as 'all' | 'movie' | 'tv',
              )}
          >
            <option value="all" .selected=${draft.searchType === 'all'}>Movies & TV</option>
            <option value="movie" .selected=${draft.searchType === 'movie'}>Movies</option>
            <option value="tv" .selected=${draft.searchType === 'tv'}>TV</option>
          </select>
          <button class="btn" type="submit" ?disabled=${draft.searching}>${icon('search')} Search</button>
        </form>
        ${draft.searchResults === null ? nothing : draft.searchResults.length === 0
          ? html`
            <div class="list">
              <div class="loading">No titles found.</div>
            </div>
          `
          : html`<div class="list" role="radiogroup" aria-label="Search results">
            ${draft.searchResults.map((m) => this.renderMatch(m))}
          </div>`}
      </div>
    `;
  }

  private renderMatch(m: Match) {
    const selected = this.c.store.draft?.match;
    const on = selected?.tmdbId === m.tmdbId && selected.type === m.type;
    return html`
      <button class="match ${on ? 'on' : ''}" role="radio" aria-checked=${on} @click=${() =>
        this.c.store.chooseMatch(m)}>
        <input type="radio" tabindex="-1" .checked=${on} />
        <poster-art label=${m.title} year=${m.year} type=${m.type} tmdb-id=${m.tmdbId}
          poster-url=${m.posterUrl ??
            ''}></poster-art>
        <span><span class="t">${m.title}</span><span class="y">(${m.year})</span></span>
        <span class="tag">${m.type === 'tv' ? 'TV' : 'Movie'}</span>
        <span class="id">tmdb ${m.tmdbId}</span>
      </button>
    `;
  }
}
