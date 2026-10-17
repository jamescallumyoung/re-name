// The draft Job's page (design doc, section 7.2): Match, then Seasons (TV only),
// then Tags, then add it to the Queue. The draft lives only in the webapp's memory.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { type Step, stepsOf } from '../lib/draft.ts';
import { base, buttons, pageStyles, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import '../components/match-step.ts';
import '../components/seasons-step.ts';
import '../components/tags-step.ts';

const LABELS: Record<Step, string> = { match: 'Match', seasons: 'Seasons', tags: 'Tags & names' };

@customElement('job-page')
export class JobPage extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    pills,
    pageStyles,
    css`
      .steps {
        display: flex;
        gap: 0.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
        flex-wrap: wrap;
      }
      .steps button {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.45rem 0.9rem 0.45rem 0.5rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--muted);
        font-weight: 600;
        font-size: 0.875rem;
      }
      .steps button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .steps .n {
        display: grid;
        place-items: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        background: var(--panel-2);
        font-size: 0.75rem;
      }
      .steps button[aria-current='step'] {
        color: #fff;
        border-color: var(--accent);
        background: var(--accent-soft);
      }
      .steps button[aria-current='step'] .n {
        background: var(--accent-strong);
      }
      .steps .done .n {
        background: var(--ok-soft);
        color: var(--ok-text);
      }
      .error {
        display: flex;
        gap: 0.6rem;
        padding: 0.9rem 1rem;
        border-color: rgba(248, 113, 113, 0.45);
        background: var(--bad-soft);
        color: var(--bad-text);
      }
      .error ul {
        margin: 0.4rem 0 0;
        padding-left: 1.1rem;
        font-family: var(--font-mono);
        font-size: 0.75rem;
      }
      .hint.bad {
        color: var(--bad-text);
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
      <div class="page-title">
        <div>
          <h1>${draft.editingJobId ? 'Edit Job' : 'New Job'}${draft.match ? html`: ${draft.match.title}` : ''}</h1>
          <div class="sub">
            ${draft.files.length} file${draft.files.length === 1 ? '' : 's'} · ${draft.editingJobId
              ? 'the Job stays in the Queue until you save it'
              : 'nothing is queued until you add it'}
          </div>
        </div>
        <button class="btn ghost" @click=${() => store.closeDraft()}>${icon('x')} Discard</button>
      </div>

      <ol class="steps" aria-label="Steps">
        ${steps.map(
          (s, i) =>
            html`<li><button
              class=${i < index ? 'done' : ''}
              aria-current=${s === draft.step ? 'step' : 'false'}
              ?disabled=${s !== 'match' && !ready}
              @click=${() => store.goToStep(s)}
            ><span class="n">${i < index ? icon('check') : i + 1}</span>${LABELS[s]}</button></li>`,
        )}
      </ol>

      ${draft.step === 'match'
        ? html`<match-step></match-step>`
        : draft.step === 'seasons'
        ? html`<seasons-step></seasons-step>`
        : html`<tags-step></tags-step>`}

      ${draft.error
        ? html`<div class="panel error" role="alert">
          ${icon('alert')}
          <div>
            ${draft.error.message}
            ${draft.error.details.length ? html`<ul>${draft.error.details.map((d) => html`<li>${d}</li>`)}</ul>` : ''}
          </div>
        </div>`
        : nothing}

      <div class="action-bar">
        <span class="summary hint ${errors ? 'bad' : ''}">
          ${draft.step === 'match' && !draft.match
            ? 'Pick the title these files belong to.'
            : errors
            ? `${errors} file${errors === 1 ? '' : 's'} can’t be named yet.`
            : draft.step === 'match'
            ? html`Matched to <b>${draft.match?.title} (${draft.match?.year})</b>.`
            : draft.previewing
            ? 'Updating names…'
            : ''}
        </span>
        ${index > 0
          ? html`<button class="btn" @click=${() => store.previousStep()}>${icon('back')} Back</button>`
          : nothing}
        ${last
          ? html`
            <button
              class="btn primary"
              ?disabled=${!ready || busy || errors > 0 || !draft.preview}
              @click=${() => store.submitDraft()}
            >${icon('check')} ${draft.editingJobId ? 'Save Job' : 'Add to Queue'}</button>
          `
          : html`<button class="btn primary" ?disabled=${!ready} @click=${() => store.nextStep()}>
            Next ${icon('chev')}
          </button>`}
      </div>
    `;
  }
}
