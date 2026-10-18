// The banner below the Queue: one large button that applies the whole Queue, its
// label and arrow on the right. Shown while the Queue has Jobs.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { base } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

@customElement('apply-banner')
export class ApplyBanner extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      button {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 14px;
        width: 100%;
        min-height: 80px;
        padding: 0 28px;
        border-radius: var(--radius-lg);
        background: var(--primary);
        color: var(--on-primary);
        font-size: 19px;
        font-weight: 700;
        text-align: right;
        box-shadow: var(--shadow-1);
        transition: background 0.15s;
        /* The gold gently darkens and returns, to draw the eye to the next step. */
        animation: pulse 2.8s ease-in-out infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          background-color: var(--primary);
        }
        /* Gold mixed 70/30 with the cards' background: a clearly darker gold that keeps
          the dark label readable (about 5.3:1, above WCAG AA's 4.5:1). */
        50% {
          background-color: color-mix(in srgb, var(--primary) 70%, var(--surface));
        }
      }
      /* An animation outranks other styles, so hover stops it to show its own colour. */
      button:hover:not(:disabled) {
        animation: none;
        background: var(--primary-hover);
      }
      @media (prefers-reduced-motion: reduce) {
        button {
          animation: none;
        }
      }
      button:disabled {
        background: var(--surface-4);
        color: var(--muted);
        box-shadow: none;
        animation: none;
        cursor: not-allowed;
      }
      .label {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.25;
      }
      .sub {
        font-size: 13px;
        font-weight: 600;
        opacity: 0.75;
      }
      .arrow {
        width: 30px;
        height: 30px;
        stroke-width: 2.5;
        transition: transform 0.15s;
      }
      button:hover:not(:disabled) .arrow {
        transform: translateX(3px);
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { queue, apply, session } = store;
    if (queue.jobs.length === 0) return nothing;
    const files = queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    return html`
      <button ?disabled=${apply !== null} @click=${() => store.askApply()}>
        <span class="label">
          ${session?.dryRun ? 'Dry-run the Queue' : 'Apply the Queue'}
          <span class="sub">${queue.jobs.length} Job${queue.jobs.length === 1 ? '' : 's'} · ${files} file${files === 1
            ? ''
            : 's'} → ${session?.targetPath}</span>
        </span>
        ${icon('chev', 'arrow')}
      </button>
    `;
  }
}
