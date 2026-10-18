// The draft Job (design doc, section 7.2), in a near-full-page modal: Match, then
// Seasons (TV only), then Tags, then add it to the Queue. The draft lives only in
// the webapp's memory. Minimising hides the modal and keeps the draft.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { type Step, stepsOf } from '../lib/draft.ts';
import { base, buttons, headColours, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import './match-step.ts';
import './poster-art.ts';
import './seasons-step.ts';
import './tags-step.ts';

const LABELS: Record<Step, string> = { match: 'Match', seasons: 'Seasons', tags: 'Tags & names' };

@customElement('draft-modal')
export class DraftModal extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    tags,
    headColours,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 45;
        display: flex;
        padding: 24px;
        background: rgba(0, 0, 0, 0.55);
      }
      .modal:focus {
        outline: none;
      }
      .modal {
        flex: 1;
        display: flex;
        flex-direction: column;
        max-width: 1180px;
        margin: 0 auto;
        min-height: 0;
        border-radius: var(--radius-lg);
        background: var(--surface);
        border: 1px solid var(--line-strong);
        box-shadow: var(--shadow-3);
        overflow: hidden;
      }
      header {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 72px;
        padding: 12px 16px 12px 24px;
      }
      header poster-art {
        width: 32px;
      }
      .titles {
        flex: 1;
        min-width: 0;
      }
      .kind {
        color: var(--head-accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      h1 .y,
      h1 .n {
        color: var(--head-muted);
        font-weight: 400;
      }
      .steps {
        display: flex;
        gap: 4px;
        padding: 0 24px;
        border-bottom: 1px solid var(--line);
      }
      .steps button {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 52px;
        padding: 0 16px;
        border-bottom: 3px solid transparent;
        color: var(--muted);
        font-weight: 600;
      }
      .steps button:hover:not(:disabled) {
        color: var(--fg);
      }
      .steps button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .steps .n {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--surface-3);
        font-size: 12px;
      }
      .steps .n svg {
        width: 14px;
        height: 14px;
      }
      .steps button[aria-current='step'] {
        color: var(--fg);
        border-bottom-color: var(--primary);
      }
      .steps button[aria-current='step'] .n {
        background: var(--primary);
        color: var(--on-primary);
      }
      .steps .done .n {
        background: var(--primary-container);
        color: var(--on-primary-container);
      }
      .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 24px;
      }
      .error {
        display: flex;
        gap: 10px;
        margin: 0 24px 12px;
        padding: 12px 14px;
        border-radius: var(--radius);
        background: var(--bad-soft);
        color: var(--bad);
      }
      .error ul {
        margin: 6px 0 0;
        padding-left: 18px;
        font-family: var(--font-mono);
        font-size: 12px;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 68px;
        padding: 12px 24px;
        border-top: 1px solid var(--line);
        background: var(--surface-2);
      }
      footer .hint {
        flex: 1;
        color: var(--muted);
      }
      footer .hint.bad {
        color: var(--bad);
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { draft, busy } = store;
    if (!draft) return nothing;
    const steps = stepsOf(draft);
    const index = steps.indexOf(draft.step);
    const last = index === steps.length - 1;
    const errors = draft.preview?.files.filter((f) => f.error).length ?? 0;
    const ready = draft.match !== null && draft.details !== null;
    const m = draft.match;
    return html`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="title" tabindex="-1" @keydown=${this.onKey}>
        <header class="head">
          ${m
            ? html`<poster-art label=${m.title} year=${m.year} type=${m.type} tmdb-id=${m.tmdbId}></poster-art>`
            : nothing}
          <div class="titles">
            <div class="kind">${draft.editingJobId ? 'Edit Job' : 'New Job'}</div>
            <h1 id="title">
              ${m ? html`${m.title} <span class="y">(${m.year})</span>` : 'Which title is this?'}
              <span class="n">· ${draft.files.length} file${draft.files.length === 1 ? '' : 's'}</span>
            </h1>
          </div>
          <button class="btn text danger" @click=${() => store.closeDraft()}>Discard</button>
          <button class="icon-btn" title="Minimise (the draft is kept)" aria-label="Minimise" @click=${() =>
            store.minimiseDraft()}>${icon('minimise')}</button>
        </header>
        <nav class="steps" aria-label="Steps">
          ${steps.map(
            (s, i) =>
              html`
                <button
                  class=${i < index ? 'done' : ''}
                  aria-current=${s === draft.step ? 'step' : 'false'}
                  ?disabled=${s !== 'match' && !ready}
                  @click=${() => store.goToStep(s)}
                ><span class="n">${i < index ? icon('check') : i + 1}</span>${LABELS[s]}</button>
              `,
          )}
        </nav>
        <div class="body">
          ${draft.step === 'match'
            ? html`<match-step></match-step>`
            : draft.step === 'seasons'
            ? html`<seasons-step></seasons-step>`
            : html`<tags-step></tags-step>`}
        </div>
        ${draft.error
          ? html`<div class="error" role="alert">
            ${icon('alert')}
            <div>
              ${draft.error.message} ${
            draft.error.details.length ? html`<ul>${draft.error.details.map((d) => html`<li>${d}</li>`)}</ul>` : ''
          }
            </div>
          </div>`
          : nothing}
        <footer>
          <span class="hint ${errors ? 'bad' : ''}">
            ${draft.step === 'match' && !draft.match
              ? 'Pick the title these files belong to.'
              : errors
              ? `${errors} file${errors === 1 ? '' : 's'} can’t be named yet.`
              : draft.previewing
              ? 'Updating names…'
              : draft.editingJobId
              ? 'The Job stays in the Queue until you save it.'
              : 'Nothing is queued until you add it.'}
          </span>
          ${index > 0 ? html`<button class="btn" @click=${() => store.previousStep()}>Back</button>` : nothing}
          ${last
            ? html`
              <button
                class="btn primary"
                ?disabled=${!ready || busy || errors > 0 || !draft.preview}
                @click=${() => store.submitDraft()}
              >${icon('check')} ${draft.editingJobId ? 'Save Job' : 'Add to Queue'}</button>
            `
            : html`<button class="btn primary" ?disabled=${!ready} @click=${() => store.nextStep()}>Next</button>`}
        </footer>
      </div>
    `;
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.c.store.minimiseDraft();
  };
}
