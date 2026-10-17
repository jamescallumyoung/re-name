// The setup modal, after Loadout's welcome modal: shown once per run, before
// anything else, to choose the options for the whole Queue. It can't be dismissed.

import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Options } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import './options-form.ts';

@customElement('setup-modal')
export class SetupModal extends LitElement {
  private readonly c = new StoreController(this);
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
        overflow-y: auto;
        padding: 1.25rem 1rem;
        background: rgba(3, 7, 18, 0.78);
        backdrop-filter: blur(6px);
      }
      .modal {
        width: min(54rem, 100%);
        display: flex;
        flex-direction: column;
        border: 1px solid var(--line);
        border-radius: 1.1rem;
        overflow: hidden;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.65);
        background:
          radial-gradient(ellipse 60% 50% at 0% 0%, var(--glow), transparent 70%),
          radial-gradient(ellipse 50% 40% at 100% 0%, var(--glow-2), transparent 70%), var(--panel);
      }
      .head {
        padding: 2.2rem 2.4rem 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }
      .mark {
        width: 2.6rem;
        height: 2.6rem;
        border-radius: 0.75rem;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        display: grid;
        place-items: center;
        color: #fff;
      }
      .brand b {
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--fg);
        letter-spacing: -0.02em;
      }
      h1 {
        margin: 0;
        color: var(--fg);
        font-size: 1.9rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .lead {
        margin: 0;
        color: var(--fg-2);
        max-width: 62ch;
        line-height: 1.6;
      }
      .paths {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .folder {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.4rem 0.7rem;
        border: 1px solid var(--line);
        border-radius: 0.55rem;
        background: var(--bg);
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 0.8rem;
      }
      .folder svg,
      .paths > svg {
        width: 1rem;
        height: 1rem;
        color: var(--muted);
      }
      options-form {
        padding: 0.6rem 2.4rem 2rem;
      }
      footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 1.1rem 2.4rem;
        background: var(--bg-deep);
        border-top: 1px solid var(--line);
      }
      .note {
        color: var(--muted);
        font-size: 0.82rem;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const session = store.session;
    const choice = this.choice ?? store.options;
    return html`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="title">
        <div class="head">
          <div class="brand"><span class="mark">${icon('rename')}</span><b>re-name</b></div>
          <h1 id="title">Rename your media for your server</h1>
          <p class="lead">
            re-name matches your files to TMDB, then renames and moves them into folders your media server understands. You’ll
            pick files next. Nothing is moved until you apply the Queue.
          </p>
          ${session
            ? html`<div class="paths">
              <span class="folder">${icon('folder')} ${session.sourcePath}</span>
              ${icon('arrow')}
              <span class="folder">${icon('folder')} ${session.targetPath}</span>
            </div>`
            : ''}
        </div>
        <options-form .value=${choice} @options-change=${(
          e: CustomEvent<Options>,
        ) => (this.choice = e.detail)}></options-form>
        <footer>
          <span class="note">You can change these later in Settings.</span>
          <button class="btn primary lg" ?disabled=${this.saving} @click=${() => this.continue(choice)}>
            Continue ${icon('chev')}
          </button>
        </footer>
      </div>
    `;
  }

  private async continue(options: Options): Promise<void> {
    this.saving = true;
    await this.c.store.chooseOptions(options);
    this.saving = false;
  }
}
