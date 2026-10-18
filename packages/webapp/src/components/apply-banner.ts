// The banner below the Queue: one large button that applies the whole Queue, its
// label and arrow on the right. Shown while the Queue has Jobs.
//
// Two idle animations draw the eye to it: the arrow is a trail of three chevrons
// lighting up in turn, and a sharp band of light sweeps across every 17 seconds. The
// light only raises the label's contrast, so it stays easy to read.

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
      button {
        position: relative;
        isolation: isolate;
        overflow: hidden;
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
      }
      button:hover:not(:disabled) {
        background: var(--primary-hover);
      }
      button:disabled {
        background: var(--surface-4);
        color: var(--muted);
        box-shadow: none;
        cursor: not-allowed;
      }
      .label,
      .arrows {
        position: relative;
        z-index: 1;
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

      /* The arrow trail: three chevrons light up in turn and step forward. */
      .arrows {
        display: flex;
        align-items: center;
        transition: transform 0.15s;
      }
      .arrows svg {
        width: 30px;
        height: 30px;
        stroke-width: 2.5;
        animation: trail 1.5s ease-in-out infinite;
      }
      .arrows svg + svg {
        margin-left: -16px;
      }
      .arrows svg:nth-child(2) {
        animation-delay: 0.18s;
      }
      .arrows svg:nth-child(3) {
        animation-delay: 0.36s;
      }
      @keyframes trail {
        0%,
        100% {
          opacity: 0.25;
          transform: translateX(0);
        }
        40% {
          opacity: 1;
          transform: translateX(5px);
        }
      }
      button:hover:not(:disabled) .arrows {
        transform: translateX(3px);
      }

      /* The shine: a sharp band of light sweeps across in about 1.2 s, every 17 s. */
      .shine {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
      }
      .shine::before {
        content: '';
        position: absolute;
        top: -10%;
        bottom: -10%;
        left: 0;
        width: 14%;
        background: rgba(255, 250, 232, 0.5);
        transform: translateX(-160%) skewX(-22deg);
        animation: shine 17s cubic-bezier(0.7, 0, 0.3, 1) infinite;
      }
      @keyframes shine {
        0% {
          transform: translateX(-160%) skewX(-22deg);
        }
        7%,
        100% {
          transform: translateX(820%) skewX(-22deg);
        }
      }

      button:disabled .shine,
      button:disabled .arrows svg {
        animation: none;
        display: none;
      }
      button:disabled .arrows svg:last-child {
        display: block;
        opacity: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        .shine {
          display: none;
        }
        .arrows svg {
          animation: none;
          opacity: 1;
        }
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
        <span class="shine" aria-hidden="true"></span>
        <span class="label">
          ${session?.dryRun ? 'Dry-run the Queue' : 'Apply the Queue'}
          <span class="sub">${queue.jobs.length} Job${queue.jobs.length === 1 ? '' : 's'} · ${files} file${files === 1
            ? ''
            : 's'} → ${session?.targetPath}</span>
        </span>
        <span class="arrows" aria-hidden="true">${icon('chev')}${icon('chev')}${icon('chev')}</span>
      </button>
    `;
  }
}
