// Cover art: TMDB's poster when there is one, otherwise generated art with a hue
// taken from the TMDB ID. The POC works offline, so it always shows generated art.

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('poster-art')
export class PosterArt extends LitElement {
  @property()
  accessor label = '';
  @property({ type: Number })
  accessor year = 0;
  @property()
  accessor type: 'movie' | 'tv' = 'movie';
  @property({ type: Number, attribute: 'tmdb-id' })
  accessor tmdbId = 0;
  @property({ attribute: 'poster-url' })
  accessor posterUrl: string | null = null;

  static override styles = css`
    :host {
      display: block;
      aspect-ratio: 2 / 3;
      border-radius: 2px;
      overflow: hidden;
      container-type: inline-size;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
    }
    img,
    .art {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .art {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 9cqw;
      color: #fff;
      text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
    }
    .type {
      align-self: flex-start;
      margin-bottom: auto;
      font-size: max(8px, 8cqw);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .title {
      font-weight: 800;
      font-size: max(9px, 12cqw);
      line-height: 1.05;
      overflow-wrap: anywhere;
    }
    .year {
      font-size: max(8px, 9cqw);
      opacity: 0.85;
      margin-top: 2cqw;
    }
    .initial {
      display: none;
    }
    /* Too small for text: just the first letter. */
    @container (max-width: 72px) {
      .type,
      .title,
      .year {
        display: none;
      }
      .initial {
        display: block;
        margin: auto;
        font-weight: 800;
        font-size: 45cqw;
      }
    }
  `;

  override render() {
    if (this.posterUrl) return html`<img src=${this.posterUrl} alt="" loading="lazy" />`;
    // A hashed ID, so neighbouring IDs get very different hues.
    const hue = (Math.imul(this.tmdbId, 2654435761) >>> 0) % 360;
    const background = `linear-gradient(160deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 18%))`;
    return html`
      <div class="art" style="background:${background}" role="img" aria-label=${`${this.label} (${this.year})`}>
        <span class="initial">${this.label.slice(0, 1)}</span>
        <span class="type">${this.type === 'tv' ? 'TV' : 'Film'}</span>
        <span class="title">${this.label}</span>
        <span class="year">${this.year}</span>
      </div>
    `;
  }
}
