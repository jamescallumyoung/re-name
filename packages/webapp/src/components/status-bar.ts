// The bar along the bottom of the page: the selection and its action on the left,
// the Queue and Apply on the right. It's always there, so the next step is too.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { filesUnder, formatBytes } from '../lib/tree.ts';
import { base, buttons } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

@customElement('status-bar')
export class StatusBar extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    css`
      :host {
        flex: none;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 48px;
        padding: 0 16px;
        background: var(--surface);
        border-top: 1px solid var(--line-strong);
      }
      .part {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .grow {
        flex: 1;
      }
      .divider {
        width: 1px;
        height: 24px;
        background: var(--line);
      }
      b {
        color: var(--fg);
      }
      .muted {
        font-size: 12px;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { selection, tree, draft, busy, queue, apply, session } = store;
    const bytes = tree ? filesUnder(tree).filter((f) => selection.has(f.path)).reduce((n, f) => n + f.size, 0) : 0;
    const queued = queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    return html`
      <div class="part">
        ${draft
          ? html`
            <span>${draft.editingJobId ? 'Editing' : 'Drafting'} a Job${draft.match
              ? html`
                for <b>${draft.match.title}</b>
              `
              : ''}</span>
            <button class="btn sm" @click=${() => this.scrollToDraft()}>Go to draft</button>
          `
          : selection.size
          ? html`
            <span><b>${selection.size}</b> selected · ${formatBytes(bytes)}</span>
            <button class="btn sm ghost" @click=${() => store.clearSelection()}>Clear</button>
            <button class="btn sm primary" ?disabled=${busy} @click=${() => store.newJob()}>
                          New Job ${icon('arrow')}
                        </button>
          `
          : html`<span class="muted">Select the files of one movie or show to start a Job.</span>`}
      </div>
      <span class="grow"></span>
      <div class="part">
        <span class="muted">Queue</span>
        <span><b>${queue.jobs.length}</b> Job${queue.jobs.length === 1 ? '' : 's'} · <b>${queued}</b> file${queued === 1
          ? ''
          : 's'}</span>
        ${queue.jobs.length
          ? html`
            <span class="divider"></span>
            <button class="btn sm primary" ?disabled=${apply !== null} @click=${() => store.askApply()}>
                          ${icon('play')} ${session?.dryRun ? 'Dry-run Queue' : 'Apply Queue'}
                        </button>
          `
          : nothing}
      </div>
    `;
  }

  private scrollToDraft(): void {
    this.dispatchEvent(new CustomEvent('scroll-to', { detail: 'draft', bubbles: true, composed: true }));
  }
}
