// The draft Job section (design doc, section 7.2): Match, then Seasons (TV only),
// then Tags, then add it to the Queue. The draft lives only in the webapp's memory.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { type Step, stepsOf } from '../lib/draft.ts';
import { base, buttons, section, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import './match-step.ts';
import './seasons-step.ts';
import './tags-step.ts';

const LABELS: Record<Step, string> = { match: 'Match', seasons: 'Seasons', tags: 'Tags & names' };

@customElement('draft-section')
export class DraftSection extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    tags,
    section,
    css`
      :host {
        border-color: var(--accent-line);
      }
      .head {
        background: var(--accent-soft);
      }
      .title {
        color: var(--fg);
        font-weight: 600;
      }
      .steps {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--line);
        background: var(--surface);
      }
      .steps button {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 36px;
        padding: 0 14px;
        border-right: 1px solid var(--line);
        border-bottom: 2px solid transparent;
        color: var(--muted);
        font-weight: 600;
        font-size: 12px;
      }
      .steps button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .steps .n {
        display: inline-grid;
        place-items: center;
        width: 18px;
        height: 18px;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-sm);
        font-size: 10.5px;
      }
      .steps button[aria-current='step'] {
        color: var(--fg);
        border-bottom-color: var(--accent);
        background: var(--surface-2);
      }
      .steps button[aria-current='step'] .n {
        border-color: var(--accent);
        background: var(--accent-strong);
        color: #fff;
      }
      .steps .done .n {
        border-color: rgba(61, 214, 140, 0.5);
        color: var(--ok);
      }
      .steps .n svg {
        width: 11px;
        height: 11px;
      }
      .body {
        padding: 14px 12px;
      }
      .error {
        display: flex;
        gap: 8px;
        margin: 0 12px 12px;
        padding: 8px 10px;
        border: 1px solid rgba(255, 99, 105, 0.45);
        background: var(--bad-soft);
        color: var(--bad);
      }
      .error ul {
        margin: 4px 0 0;
        padding-left: 16px;
        font-family: var(--font-mono);
        font-size: 11px;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-top: 1px solid var(--line);
        background: var(--surface-2);
      }
      footer .hint {
        flex: 1;
        color: var(--muted);
        font-size: 12px;
      }
      footer .hint.bad {
        color: var(--bad);
      }
      footer .hint b {
        color: var(--fg);
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
    return html`
      <div class="head">
        <h2>${draft.editingJobId ? 'Editing Job' : 'Draft Job'}</h2>
        ${draft.match
          ? html`<span class="title">${draft.match.title} (${draft.match.year})</span>`
          : html`<span class="count">no match yet</span>`}
        <span class="count">${draft.files.length} file${draft.files.length === 1 ? '' : 's'}</span>
        <span class="grow"></span>
        <button class="btn sm ghost" @click=${() => store.closeDraft()}>${icon('x')} Discard</button>
      </div>
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
            >${draft.editingJobId ? 'Save Job' : 'Add to Queue'}</button>
          `
          : html`<button class="btn primary" ?disabled=${!ready} @click=${() => store.nextStep()}>Next</button>`}
      </footer>
    `;
  }
}
