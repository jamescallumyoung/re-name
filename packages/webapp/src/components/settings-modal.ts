// The settings modal. Shown up front once per run, when it can't be dismissed, and
// reopened from the header's settings widget, when it can.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Options } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import './options-form.ts';

@customElement('settings-modal')
export class SettingsModal extends LitElement {
  private readonly c = new StoreController(this);
  /** True up front: the options must be chosen before anything else. */
  @property({ type: Boolean })
  accessor required = false;
  @state()
  accessor choice: Options | null = null;
  @state()
  accessor saving = false;

  static override styles = [
    base,
    buttons,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.6);
      }
      .modal {
        width: min(600px, 100%);
        border-radius: var(--radius-lg);
        background: var(--surface-2);
        box-shadow: var(--shadow-3);
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 64px;
        padding: 0 16px 0 24px;
      }
      .head h1 {
        margin: 0;
        flex: 1;
        color: var(--fg);
        font-size: 20px;
        font-weight: 600;
      }
      .head svg {
        width: 22px;
        height: 22px;
        color: var(--primary);
      }
      .body {
        padding: 4px 24px 20px;
        display: grid;
        gap: 20px;
      }
      .intro {
        margin: 0;
        line-height: 1.6;
      }
      .paths {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 6px 16px;
        padding: 12px 14px;
        border-radius: var(--radius);
        background: var(--surface-3);
      }
      .paths dt {
        color: var(--muted);
      }
      .paths dd {
        margin: 0;
        color: var(--fg);
        font-family: var(--font-mono);
        overflow-wrap: anywhere;
      }
      .note {
        color: var(--muted);
        font-size: 13px;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 24px 20px;
      }
      footer .note {
        flex: 1;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const session = store.session;
    const choice = this.choice ?? store.options;
    const jobs = store.queue.jobs.length;
    return html`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="title" @keydown=${this.onKey}>
        <div class="head">
          ${icon('settings')}
          <h1 id="title">${this.required ? 'Before you start' : 'Naming settings'}</h1>
          ${this.required
            ? nothing
            : html`<button class="icon-btn" aria-label="Close" @click=${() => this.close()}>${icon('x')}</button>`}
        </div>
        <div class="body">
          ${this.required
            ? html`<p class="intro">
              re-name matches files to TMDB, then renames and moves them for your media server. Choose how names are
              made. Nothing is moved until you apply the Queue.
            </p>`
            : nothing}
          <dl class="paths">
            <dt>Source</dt>
            <dd>${session?.sourcePath}</dd>
            <dt>Target</dt>
            <dd>${session?.targetPath}</dd>
          </dl>
          <options-form .value=${choice} @options-change=${(
            e: CustomEvent<Options>,
          ) => (this.choice = e.detail)}></options-form>
        </div>
        <footer>
          <span class="note">
            ${this.required
              ? 'You can change these later from the header.'
              : jobs
              ? `Changing these renames the files of all ${jobs} queued Job${jobs === 1 ? '' : 's'}.`
              : 'These apply to every Job in the Queue.'}
          </span>
          ${this.required ? nothing : html`<button class="btn text" @click=${() => this.close()}>Cancel</button>`}
          <button class="btn primary" ?disabled=${this.saving} @click=${() => this.save(choice)}>
            ${this.required ? 'Continue' : 'Save'}
          </button>
        </footer>
      </div>
    `;
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.required) this.close();
  };

  private close(): void {
    this.choice = null;
    this.c.store.closeSettings();
  }

  private async save(options: Options): Promise<void> {
    this.saving = true;
    await this.c.store.chooseOptions(options);
    this.saving = false;
    this.choice = null;
  }
}
