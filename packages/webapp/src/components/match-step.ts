// Step 1, Match (design doc, section 7.2): five suggestions from the server, and a
// manual search for when they're all wrong.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Match } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { shared } from '../styles/shared.ts';
import './poster-art.ts';

@customElement('match-step')
export class MatchStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        padding: 16px 18px 24px;
      }
      h3 {
        font-size: 13px;
        margin: 0 0 10px;
        color: var(--fg-2);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .intro {
        font-size: 14px;
        margin: 0 0 16px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .card {
        all: unset;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px;
        border-radius: var(--radius);
        border: 2px solid transparent;
        transition: background 0.1s;
      }
      .card:hover {
        background: var(--surface-2);
      }
      .card:focus-visible {
        outline: 2px solid var(--accent);
      }
      .card[aria-pressed='true'] {
        border-color: var(--accent);
        background: var(--accent-soft);
      }
      .card .name {
        font-weight: 700;
        font-size: 13px;
        line-height: 1.25;
      }
      .card .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
        font-size: 11px;
        color: var(--fg-3);
      }
      .skeleton {
        aspect-ratio: 2 / 3;
        border-radius: 6px;
        background: linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2));
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite linear;
      }
      @keyframes shimmer {
        to {
          background-position: -200% 0;
        }
      }
      form {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
        max-width: 640px;
      }
      form input {
        flex: 1;
      }
      details {
        font-size: 12px;
        color: var(--fg-2);
      }
      details ul {
        font-family: var(--font-mono);
        font-size: 11px;
        margin: 6px 0 0;
        padding-left: 18px;
        color: var(--fg-3);
      }
      .none {
        font-size: 13px;
        color: var(--fg-3);
        margin-bottom: 24px;
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const parsed = draft.files[0];
    return html`
      <p class="intro">
        Which title do these files belong to? The suggestions come from the names, read as
        <b>${parsed?.parsedTitle || '—'}</b>${parsed?.parsedYear
          ? html`
            <span class="muted">(${parsed.parsedYear})</span>
          `
          : ''}.
      </p>
      <h3>Suggestions</h3>
      <div class="grid">
        ${draft.suggestions === null
          ? Array.from({ length: 5 }, () =>
            html`
              <div>
                <div class="skeleton"></div>
              </div>
            `)
          : draft.suggestions.map((m) => this.renderCard(m))}
      </div>
      <h3>Search TMDB</h3>
      <form
        @submit=${(e: Event) => {
          e.preventDefault();
          void this.c.store.search();
        }}
      >
        <input
          type="search"
          placeholder="Title…"
          .value=${draft.searchQuery}
          @input=${(e: Event) => this.c.store.setSearch((e.target as HTMLInputElement).value, draft.searchType)}
        />
        <select
          @change=${(e: Event) =>
            this.c.store.setSearch(draft.searchQuery, (e.target as HTMLSelectElement).value as 'all' | 'movie' | 'tv')}
        >
          <option value="all" .selected=${draft.searchType === 'all'}>Movies & TV</option>
          <option value="movie" .selected=${draft.searchType === 'movie'}>Movies</option>
          <option value="tv" .selected=${draft.searchType === 'tv'}>TV</option>
        </select>
        <button type="submit" ?disabled=${draft.searching}>${draft.searching ? 'Searching…' : 'Search'}</button>
      </form>
      ${draft.searchResults === null
        ? nothing
        : draft.searchResults.length === 0
        ? html`<p class="none">No titles found.</p>`
        : html`<div class="grid">${draft.searchResults.map((m) => this.renderCard(m))}</div>`}
      <details>
        <summary>The ${draft.files.length} file${draft.files.length === 1 ? '' : 's'} in this Job</summary>
        <ul>${draft.files.map((f) => html`<li>${f.path}</li>`)}</ul>
      </details>
    `;
  }

  private renderCard(m: Match) {
    const selected = this.c.store.draft?.match;
    const pressed = selected?.tmdbId === m.tmdbId && selected.type === m.type;
    return html`
      <button class="card" aria-pressed=${pressed} @click=${() => this.c.store.chooseMatch(m)}>
        <poster-art label=${m.title} year=${m.year} type=${m.type} tmdb-id=${m.tmdbId}
          poster-url=${m.posterUrl ?? ''}></poster-art>
        <span class="name">${m.title}</span>
        <span class="meta">
          <span>${m.year}</span>
          <span class="badge ${m.type === 'tv' ? 'accent' : ''}">${m.type === 'tv' ? 'TV' : 'Movie'}</span>
          <span class="mono">tmdb ${m.tmdbId}</span>
        </span>
      </button>
    `;
  }
}
