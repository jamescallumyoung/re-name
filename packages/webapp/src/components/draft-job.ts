// The draft Job (design doc, section 7.2): Match, then Seasons (TV only), then Tags,
// then add it to the Queue. The draft lives only in the webapp's memory.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { type Step, stepsOf } from '../lib/draft.ts';
import { shared } from '../styles/shared.ts';
import './match-step.ts';
import './seasons-step.ts';
import './tags-step.ts';

const LABELS: Record<Step, string> = { match: 'Match', seasons: 'Seasons & episodes', tags: 'Tags & names' };

@customElement('draft-job')
export class DraftJob extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    shared,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--border);
      }
      .top h2 {
        font-size: 15px;
        margin: 0;
      }
      .top .spacer {
        flex: 1;
      }
      ol {
        display: flex;
        gap: 4px;
        list-style: none;
        margin: 0;
        padding: 10px 14px;
        border-bottom: 1px solid var(--border);
        background: var(--surface-2);
        counter-reset: step;
      }
      li button {
        border: none;
        background: transparent;
        color: var(--fg-3);
        gap: 8px;
      }
      li button::before {
        counter-increment: step;
        content: counter(step);
        display: inline-grid;
        place-items: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--surface-3);
        font-size: 11px;
        font-weight: 700;
      }
      li button[aria-current='step'] {
        color: var(--fg);
        background: var(--surface);
        box-shadow: var(--shadow);
      }
      li button[aria-current='step']::before {
        background: var(--accent);
        color: var(--accent-fg);
      }
      li + li::before {
        content: '›';
        color: var(--fg-3);
        margin-right: 4px;
      }
      li {
        display: flex;
        align-items: center;
      }
      .body {
        flex: 1;
        overflow: auto;
        min-height: 0;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
      }
      footer .hint {
        margin-right: auto;
        font-size: 12px;
        color: var(--fg-3);
      }
      .error {
        margin: 0 14px 10px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--bad-soft);
        color: var(--bad);
        font-size: 13px;
      }
      .error ul {
        margin: 6px 0 0;
        padding-left: 18px;
        font-family: var(--font-mono);
        font-size: 11px;
      }
    `,
  ];

  override render() {
    const { draft, busy } = this.c.store;
    if (!draft) return nothing;
    const steps = stepsOf(draft);
    const index = steps.indexOf(draft.step);
    const last = index === steps.length - 1;
    const errors = draft.preview?.files.filter((f) => f.error).length ?? 0;
    const canAdvance = draft.match !== null && draft.details !== null;
    return html`
      <div class="top">
        <button class="small ghost" @click=${() =>
          this.c.store.showOverview()} title="The draft is kept">← Overview</button>
        <h2>
          ${draft.editingJobId ? 'Edit Job' : 'New Job'}${draft.match
            ? html`
              · ${draft.match.title}
            `
            : ''}
          <span class="muted">· ${draft.files.length} file${draft.files.length === 1 ? '' : 's'}</span>
        </h2>
        <span class="spacer"></span>
        <button class="small danger" @click=${() => this.c.store.closeDraft()}>Discard draft</button>
      </div>
      <ol>
        ${steps.map(
          (s) =>
            html`<li><button
              aria-current=${s === draft.step ? 'step' : 'false'}
              ?disabled=${s !== 'match' && !canAdvance}
              @click=${() => this.c.store.goToStep(s)}
            >${LABELS[s]}</button></li>`,
        )}
      </ol>
      <div class="body">
        ${draft.step === 'match'
          ? html`<match-step></match-step>`
          : draft.step === 'seasons'
          ? html`<seasons-step></seasons-step>`
          : html`<tags-step></tags-step>`}
      </div>
      ${draft.error
        ? html`<div class="error" role="alert">
          ${draft.error.message}
          ${draft.error.details.length ? html`<ul>${draft.error.details.map((d) => html`<li>${d}</li>`)}</ul>` : ''}
        </div>`
        : nothing}
      <footer>
        <span class="hint">
          ${draft.step === 'match' && !draft.match
            ? 'Pick the TMDB title these files belong to.'
            : errors
            ? html`<span style="color:var(--bad)">${errors} file${errors === 1 ? '' : 's'} can’t be named yet.</span>`
            : draft.previewing
            ? 'Updating names…'
            : 'Names are worked out by the server as you go.'}
        </span>
        ${index > 0 ? html`<button @click=${() => this.c.store.previousStep()}>Back</button>` : nothing}
        ${last
          ? html`
            <button
              class="primary"
              ?disabled=${!canAdvance || busy || errors > 0 || !draft.preview}
              @click=${() => this.c.store.submitDraft()}
            >${draft.editingJobId ? 'Save changes to Job' : 'Add Job to Queue'}</button>
          `
          : html`<button class="primary" ?disabled=${!canAdvance} @click=${() =>
            this.c.store.nextStep()}>Next</button>`}
      </footer>
    `;
  }
}
