// The app shell. Two views: the overview (Files, then the Queue) and, over it, the
// draft Job's near-full-page modal. Plus the "Create Job" FAB, the settings modal
// (up front, and from the header), the questions, the apply progress and result,
// snackbars, and the blocked and stopped screens (design doc, sections 7 and 8.5).

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from './store-controller.ts';
import { base, buttons, headColours } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import { FLAVOUR_LABEL } from '../components/app-header.ts';
import '../components/app-header.ts';
import '../components/draft-modal.ts';
import '../components/files-section.ts';
import '../components/job-fab.ts';
import '../components/queue-section.ts';
import '../components/settings-modal.ts';

@customElement('re-name-app')
export class ReNameApp extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    headColours,
    css`
      /* The page never scrolls: the app bar stays put, and only the overview scrolls. */
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: var(--bg);
      }
      main {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      .column {
        max-width: 1120px;
        margin: 0 auto;
        padding: 24px 24px 120px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .center {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .center .box {
        max-width: 440px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--line);
        background: var(--surface);
        padding: 24px;
      }
      .center h1 {
        margin: 0 0 8px;
        color: var(--fg);
        font-size: 18px;
      }
      .center p {
        margin: 0;
        line-height: 1.6;
      }
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.6);
      }
      .dialog {
        width: min(520px, 100%);
        max-height: 88vh;
        overflow: auto;
        border-radius: var(--radius-lg);
        background: var(--surface-2);
        box-shadow: var(--shadow-3);
      }
      .dialog .head {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 64px;
        padding: 12px 24px;
      }
      .dialog .dbody {
        padding: 20px 24px 24px;
      }
      .dialog .icon {
        display: grid;
        color: var(--head-accent);
      }
      .dialog .icon svg {
        width: 24px;
        height: 24px;
      }
      .dialog h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }
      .dialog p {
        margin: 0 0 12px;
        line-height: 1.6;
      }
      .dialog b {
        color: var(--fg);
      }
      .dialog .buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 20px;
      }
      .dialog ul {
        margin: 0 0 12px;
        padding-left: 18px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--muted);
      }
      .kv {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 18px;
        margin: 0 0 14px;
        padding: 14px 16px;
        border-radius: var(--radius);
        background: var(--surface-3);
      }
      .kv dt {
        color: var(--muted);
      }
      .kv dd {
        margin: 0;
        color: var(--fg);
        overflow-wrap: anywhere;
      }
      .kv dd.big {
        font-size: 18px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .bar {
        height: 6px;
        border-radius: 3px;
        background: var(--surface-4);
        overflow: hidden;
        margin: 12px 0;
      }
      .bar i {
        display: block;
        height: 100%;
        background: var(--primary);
        transition: width 0.2s;
      }
      .current {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--muted);
        overflow-wrap: anywhere;
      }
      .problem {
        display: flex;
        gap: 10px;
        padding: 12px 14px;
        margin-bottom: 12px;
        border-radius: var(--radius);
        background: var(--bad-soft);
        color: var(--bad);
        overflow-wrap: anywhere;
      }
      .problem svg {
        width: 18px;
        height: 18px;
        flex: none;
      }
      .snackbars {
        position: fixed;
        left: 50%;
        bottom: 28px;
        transform: translateX(-50%);
        z-index: 55;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(480px, calc(100% - 32px));
      }
      .snackbar {
        display: flex;
        gap: 10px;
        align-items: center;
        min-height: 48px;
        padding: 12px 16px;
        border-radius: var(--radius);
        background: var(--fg);
        color: var(--bg);
        font-weight: 500;
        box-shadow: var(--shadow-3);
      }
      .snackbar svg {
        width: 18px;
        height: 18px;
      }
      .snackbar.bad {
        background: #ffd9d6;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { phase, reason } = store;
    if (phase === 'connecting') {
      return html`
        <div class="center">
          <div class="box">
            <p>Connecting to re-name…</p>
          </div>
        </div>
      `;
    }
    if (phase === 'blocked' || phase === 'stopped') {
      return html`
        <div class="center">
          <div class="box">
            <h1>${phase === 'blocked' ? 're-name can’t open here' : 're-name has stopped'}</h1>
            <p>${reason}</p>
          </div>
        </div>
      `;
    }
    return html`
      <app-header></app-header>
      <main>
        <div class="column">
          <files-section></files-section>
          <queue-section></queue-section>
        </div>
      </main>
      <job-fab></job-fab>
      ${store.draft && store.draftOpen ? html`<draft-modal></draft-modal>` : nothing}
      ${store.setupOpen
        ? html`<settings-modal required></settings-modal>`
        : store.settingsOpen
        ? html`<settings-modal></settings-modal>`
        : nothing}
      ${this.renderPending()} ${this.renderApply()} ${this.renderSnackbars()}
    `;
  }

  private renderPending() {
    const store = this.c.store;
    const pending = store.pending;
    if (!pending) return nothing;
    const files = store.queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    const dry = store.session?.dryRun ?? false;
    const [title, body, yes, primary] = pending.kind === 'discard-draft'
      ? [
        'Discard the draft Job?',
        html`<p>Only one draft can exist at a time. Its match, seasons and tags will be lost.</p>`,
        'Discard',
        false,
      ]
      : pending.kind === 'remove-job'
      ? [
        `Remove ${pending.job.match.title} from the Queue?`,
        html`<p>Its ${pending.job.draft.files.length} files leave the Queue and can be selected again.</p>`,
        'Remove',
        false,
      ]
      : [
        dry ? 'Dry-run the Queue?' : 'Apply the Queue?',
        html`
          <dl class="kv">
            <dt>Files</dt>
            <dd><b>${files}</b> in ${store.queue.jobs.length} Job${store.queue.jobs.length === 1 ? '' : 's'}</dd>
            <dt>Names for</dt>
            <dd>${FLAVOUR_LABEL[store.options.flavour]}</dd>
            <dt>Episode names</dt>
            <dd>${store.options.includeEpisodeName ? 'Included' : 'Left out'}</dd>
            <dt>Move into</dt>
            <dd class="mono">${store.session?.targetPath}</dd>
            ${dry
              ? html`
                <dt>Dry run</dt>
                <dd>Yes: nothing will be moved</dd>
              `
              : nothing}
          </dl>
          <p class="muted">Every file is checked first: if anything changed on disk, nothing is moved. The apply stops at
            the first error, and a log is written either way.</p>
        `,
        dry ? 'Run' : 'Apply',
        true,
      ];
    return html`
      <div class="overlay" @click=${(e: Event) => e.target === e.currentTarget && store.answer(false)}>
        <div class="dialog" role="alertdialog" aria-modal="true" aria-label=${title}>
          <div class="head"><span class="icon">${icon(
            pending.kind === 'apply' ? 'play' : 'alert',
          )}</span><h2>${title}</h2></div>
          <div class="dbody">
          ${body}
          <div class="buttons">
            <button class="btn text" @click=${() => store.answer(false)}>Cancel</button>
            <button class="btn ${primary ? 'primary' : 'text danger'}" @click=${() =>
              store.answer(true)}>${yes}</button>
          </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderApply() {
    const store = this.c.store;
    if (store.applyError) {
      return html`
        <div class="overlay">
          <div class="dialog" role="alertdialog" aria-modal="true">
            <div class="head"><span class="icon">${icon('alert')}</span><h2>Nothing was moved</h2></div>
            <div class="dbody">
            <div class="problem">${icon('alert')}<span>${store.applyError.message}</span></div>
            ${store.applyError.details.length
              ? html`<ul>${store.applyError.details.map((d) => html`<li>${d}</li>`)}</ul>`
              : nothing}
            <p>Check those files, then edit or remove the Jobs they’re in.</p>
            <div class="buttons"><button class="btn primary" @click=${() => store.dismissApply()}>OK</button></div>
            </div>
          </div>
        </div>
      `;
    }
    const apply = store.apply;
    if (!apply) return nothing;
    const result = apply.result;
    if (!result) {
      const p = apply.progress;
      const pct = p ? Math.round((p.index / p.total) * 100) : 0;
      return html`
        <div class="overlay">
          <div class="dialog" role="dialog" aria-modal="true" aria-label="Applying the Queue">
            <div class="head"><span class="icon">${icon('play')}</span><h2>${store.session?.dryRun
              ? 'Dry-running the Queue'
              : 'Applying the Queue'}</h2></div>
            <div class="dbody">
            <p>${p ? `Moving file ${p.index + 1} of ${p.total}` : 'Checking every file against the disk…'}</p>
            <div class="bar"><i style="width:${pct}%"></i></div>
            ${p ? html`<div class="current">${p.newPath}</div>` : nothing}
            </div>
          </div>
        </div>
      `;
    }
    return html`
      <div class="overlay">
        <div class="dialog" role="alertdialog" aria-modal="true">
          <div class="head"><span class="icon">${icon(result.error ? 'alert' : 'check')}</span><h2>${result.error
            ? 'The apply stopped on an error'
            : result.dryRun
            ? 'Dry run finished'
            : 'Queue applied'}</h2></div>
          <div class="dbody">
          <dl class="kv">
            <dt>${result.dryRun ? 'Would move' : 'Moved'}</dt>
            <dd class="big">${result.moved}</dd>
            <dt>Not moved</dt>
            <dd class="big">${result.total - result.moved}</dd>
            <dt>Jobs left</dt>
            <dd class="big">${result.queue.jobs.length}</dd>
            <dt>Log</dt>
            <dd class="mono">${result.logPath}</dd>
          </dl>
          ${result.error
            ? html`
              <div class="problem">${icon('alert')}<span><b>${result.error.path}</b><br />${result.error
                .message}</span></div>
              <p>Files already moved left their Jobs. The rest are still in the Queue.</p>
            `
            : !result.dryRun
            ? html`<p>Move the folders in <span class="mono">${store.session?.targetPath}</span> into your media
              server’s library when you’re ready.</p>`
            : nothing}
          <div class="buttons"><button class="btn primary" @click=${() => store.dismissApply()}>Done</button></div>
          </div>
        </div>
      </div>
    `;
  }

  private renderSnackbars() {
    return html`<div class="snackbars" role="status">
      ${
      this.c.store.toasts.map(
        (t) =>
          html`<div class="snackbar ${t.tone}">${
            t.tone === 'bad' ? icon('alert') : t.tone === 'ok' ? icon('check') : nothing
          }
            ${t.text}</div>`,
      )
    }
    </div>`;
  }
}
