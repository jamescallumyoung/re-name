// The floating action button, bottom right: "Create Job" from the selection, or
// "Resume draft" while a draft Job is minimised.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { base } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

@customElement('job-fab')
export class JobFab extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    css`
      :host {
        position: fixed;
        right: 28px;
        bottom: 28px;
        z-index: 40;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 14px;
      }
      button {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 56px;
        padding: 0 22px 0 18px;
        border-radius: var(--radius-fab);
        background: var(--primary);
        color: var(--on-primary);
        font-weight: 700;
        font-size: 15px;
        box-shadow: var(--shadow-3);
        transition:
          background 0.15s,
          transform 0.15s;
      }
      button:hover:not(:disabled) {
        background: var(--primary-hover);
      }
      button:active:not(:disabled) {
        transform: translateY(1px);
      }
      button:disabled {
        background: var(--surface-4);
        color: var(--muted);
        box-shadow: var(--shadow-1);
        cursor: not-allowed;
      }
      button svg {
        width: 22px;
        height: 22px;
      }
      .n {
        display: inline-grid;
        place-items: center;
        min-width: 24px;
        height: 24px;
        padding: 0 6px;
        border-radius: 12px;
        background: var(--on-primary);
        color: var(--primary);
        font-size: 12.5px;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { draft, draftOpen } = store;
    if (draft && draftOpen) return nothing;
    return this.renderJob();
  }

  private renderJob() {
    const store = this.c.store;
    const { draft, selection, busy } = store;
    if (draft) {
      return html`<button @click=${() => store.resumeDraft()}>
        ${icon('edit')} Resume draft${draft.match ? `: ${draft.match.title}` : ''}
      </button>`;
    }
    return html`
      <button
        ?disabled=${selection.size === 0 || busy}
        title=${selection.size === 0 ? 'Select the files of one movie or show first' : ''}
        @click=${() => store.newJob()}
      >
            ${icon('plus')} Create Job ${selection.size ? html`<span class="n">${selection.size}</span>` : nothing}
          </button>
    `;
  }
}
