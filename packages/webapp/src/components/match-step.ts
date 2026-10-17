// Step 1, Match (design doc, section 7.2): five suggestions from the server, and a
// manual search for when they're all wrong.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Match } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons, fields, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import './poster-art.ts';

@customElement('match-step')
export class MatchStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    fields,
    pills,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }
      h2 {
        margin: 0 0 0.3rem;
        color: var(--fg);
        font-size: 1.15rem;
      }
      .note {
        color: var(--muted);
        font-size: 0.875rem;
        margin: 0 0 1rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
        gap: 1rem;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.5rem;
        border-radius: 0.8rem;
        border: 2px solid transparent;
        text-align: left;
        transition:
          background 0.15s,
          border-color 0.15s;
      }
      .card:hover {
        background: var(--panel);
      }
      .card[aria-pressed='true'] {
        border-color: var(--accent);
        background: var(--accent-soft);
      }
      .card .name {
        color: var(--fg);
        font-weight: 700;
        line-height: 1.25;
      }
      .card .meta {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        color: var(--muted);
        font-size: 0.8rem;
      }
      .card .id {
        color: var(--faint);
        font-family: var(--font-mono);
        font-size: 0.72rem;
      }
      .skeleton {
        aspect-ratio: 2 / 3;
        border-radius: 6px;
        background: linear-gradient(90deg, var(--panel), var(--panel-2), var(--panel));
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
        gap: 0.6rem;
        max-width: 42rem;
        margin-bottom: 1.25rem;
      }
      form input {
        flex: 1;
      }
      .none {
        color: var(--muted);
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const parsed = draft.files[0];
    return html`
      <section>
        <h2>Which title is this?</h2>
        <p class="note">
          Suggestions for <b>${parsed?.parsedTitle || '—'}</b>${parsed?.parsedYear ? ` (${parsed.parsedYear})` : ''}, as
          read from the file names.
        </p>
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
      </section>
      <section>
        <h2>Not there? Search TMDB</h2>
        <p class="note">Search by title, and narrow it to movies or TV if you need to.</p>
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
          <button class="btn" type="submit" ?disabled=${draft.searching}>${icon('search')} ${draft.searching
            ? 'Searching…'
            : 'Search'}</button>
        </form>
        ${draft.searchResults === null
          ? nothing
          : draft.searchResults.length === 0
          ? html`<p class="none">No titles found.</p>`
          : html`<div class="grid">${draft.searchResults.map((m) => this.renderCard(m))}</div>`}
      </section>
    `;
  }

  private renderCard(m: Match) {
    const selected = this.c.store.draft?.match;
    const pressed = selected?.tmdbId === m.tmdbId && selected.type === m.type;
    return html`
      <button class="card" aria-pressed=${pressed} @click=${() => this.c.store.chooseMatch(m)}>
        <poster-art label=${m.title} year=${m.year} type=${m.type} tmdb-id=${m.tmdbId}
          poster-url=${m.posterUrl ??
            ''}></poster-art>
        <span class="name">${m.title}</span>
        <span class="meta">${m.year} <span class="pill">${m.type === 'tv' ? 'TV' : 'Movie'}</span></span>
        <span class="id">TMDB ${m.tmdbId}</span>
      </button>
    `;
  }
}
