// Settings: the options chosen up front, listed again, and where re-name reads and
// writes its own files (design doc, section 5).

import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Options } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons, pageStyles, pills } from '../styles/shared.ts';
import '../components/options-form.ts';

@customElement('settings-page')
export class SettingsPage extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    pills,
    pageStyles,
    css`
      section.panel {
        padding: 1.4rem 1.5rem;
      }
      .warn {
        margin-top: 1rem;
        color: var(--muted);
        font-size: 0.85rem;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.7rem 1.5rem;
        margin: 0;
        font-size: 0.9rem;
      }
      dt {
        color: var(--muted);
      }
      dd {
        margin: 0;
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 0.82rem;
        overflow-wrap: anywhere;
      }
    `,
  ];

  private warning(): string {
    const n = this.c.store.queue.jobs.length;
    return n === 0
      ? 'Changing these later renames the files of every Job in the Queue.'
      : `Changing these renames the files of all ${n} Job${
        n === 1 ? '' : 's'
      } in the Queue. Check the Queue afterwards.`;
  }

  override render() {
    const store = this.c.store;
    const s = store.session;
    return html`
      <div class="page-title">
        <div>
          <h1>Settings</h1>
          <div class="sub">The options for this run, chosen when re-name started.</div>
        </div>
      </div>
      <section>
        <div class="section-head">
          <h2>Naming</h2>
        </div>
        <div class="panel" style="padding:1.4rem 1.5rem">
          <options-form
            .value=${store.options}
            @options-change=${(e: CustomEvent<Options>) => store.setOptions(e.detail)}
          ></options-form>
          <div class="warn">${this.warning()}</div>
        </div>
      </section>
      <section>
        <div class="section-head">
          <h2>This run</h2>
          <span class="note">Set when re-name was started; restart it to change them.</span>
        </div>
        <div class="panel" style="padding:1.4rem 1.5rem">
          <dl>
            <dt>Source</dt>
            <dd>${s?.sourcePath}</dd>
            <dt>Target</dt>
            <dd>${s?.targetPath}</dd>
            <dt>Dry run</dt>
            <dd>${s?.dryRun ? 'Yes: nothing will be moved' : 'No'}</dd>
            <dt>Config and known tags</dt>
            <dd>~/Library/Application Support/re-name/</dd>
            <dt>Logs</dt>
            <dd>~/Library/Application Support/re-name/logs/</dd>
          </dl>
        </div>
      </section>
    `;
  }
}
