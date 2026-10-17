// The app shell: the overview (explorer and Queue) or the draft Job, plus the
// questions, the apply progress and result, toasts, and the blocked and stopped
// screens (design doc, sections 7 and 8.5).

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from './store-controller.ts';
import { shared } from '../styles/shared.ts';
import '../components/app-header.ts';
import '../components/draft-job.ts';
import '../components/file-explorer.ts';
import '../components/queue-panel.ts';

@customElement('re-name-app')
export class ReNameApp extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    shared,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      main {
        flex: 1;
        min-height: 0;
        display: grid;
        gap: 14px;
        padding: 14px;
      }
      main.overview {
        grid-template-columns: minmax(0, 1.25fr) minmax(360px, 1fr);
      }
      main.job {
        grid-template-columns: minmax(0, 1fr);
      }
      @media (max-width: 900px) {
        main.overview {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: minmax(320px, 1fr) minmax(280px, auto);
        }
      }
      .center {
        margin: auto;
        max-width: 460px;
        text-align: center;
        padding: 40px 20px;
      }
      .center h1 {
        font-size: 20px;
        margin: 0 0 8px;
      }
      .center p {
        color: var(--fg-2);
        line-height: 1.5;
      }
      .spinner {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid var(--surface-3);
        border-top-color: var(--accent);
        animation: spin 0.8s linear infinite;
        margin: 0 auto 12px;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .overlay {
        position: fixed;
        inset: 0;
        background: rgb(10 12 16 / 45%);
        display: grid;
        place-items: center;
        z-index: 50;
        padding: 20px;
      }
      .dialog {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        width: min(520px, 100%);
        max-height: 85vh;
        overflow: auto;
        padding: 20px;
      }
      .dialog h2 {
        font-size: 17px;
        margin: 0 0 8px;
      }
      .dialog p {
        color: var(--fg-2);
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 10px;
      }
      .dialog .buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 18px;
      }
      .dialog ul {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--fg-2);
        padding-left: 18px;
      }
      .figures {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin: 14px 0;
      }
      .figure {
        background: var(--surface-2);
        border-radius: var(--radius);
        padding: 10px;
      }
      .figure b {
        display: block;
        font-size: 22px;
      }
      .figure span {
        font-size: 12px;
        color: var(--fg-3);
      }
      progress {
        width: 100%;
        height: 8px;
        accent-color: var(--accent);
      }
      .current {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--fg-3);
        margin-top: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .problem {
        background: var(--bad-soft);
        color: var(--bad);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        font-size: 13px;
        margin: 10px 0;
      }
      .log {
        font-family: var(--font-mono);
        font-size: 11px;
        background: var(--surface-2);
        border-radius: var(--radius-sm);
        padding: 8px;
        overflow-wrap: anywhere;
      }
      .toasts {
        position: fixed;
        right: 16px;
        bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 60;
        max-width: 380px;
      }
      .toast {
        background: var(--fg);
        color: var(--bg);
        padding: 10px 14px;
        border-radius: var(--radius);
        font-size: 13px;
        box-shadow: var(--shadow-lg);
        border-left: 4px solid var(--accent);
      }
      .toast.ok {
        border-left-color: var(--ok);
      }
      .toast.bad {
        border-left-color: var(--bad);
      }
    `,
  ];

  override render() {
    const { phase, reason } = this.c.store;
    if (phase === 'connecting') {
      return html`
        <div class="center">
          <div class="spinner"></div>
          <p>Connecting to re-name…</p>
        </div>
      `;
    }
    if (phase === 'blocked') {
      return html`
        <div class="center">
          <h1>re-name can’t open here</h1>
          <p>${reason}</p>
        </div>
      `;
    }
    if (phase === 'stopped') {
      return html`
        <div class="center">
          <h1>re-name has stopped</h1>
          <p>${reason}</p>
        </div>
      `;
    }
    const { screen, draft } = this.c.store;
    return html`
      <app-header></app-header>
      ${screen === 'job' && draft
        ? html`
          <main class="job">
            <draft-job></draft-job>
          </main>
        `
        : html`
          <main class="overview">
            <file-explorer></file-explorer>
            <queue-panel></queue-panel>
          </main>
        `}
      ${this.renderPending()} ${this.renderApply()} ${this.renderToasts()}
    `;
  }

  private renderPending() {
    const store = this.c.store;
    const pending = store.pending;
    if (!pending) return nothing;
    const files = store.queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    const [title, body, yes, danger] = pending.kind === 'discard-draft'
      ? [
        'Discard the draft Job?',
        html`<p>Only one draft can exist at a time. Its match, seasons and tag choices will be lost.</p>`,
        'Discard draft',
        true,
      ]
      : pending.kind === 'remove-job'
      ? [
        `Remove ${pending.job.match.title} from the Queue?`,
        html`<p>Its ${pending.job.draft.files.length} files go back to the explorer and can be selected again.</p>`,
        'Remove Job',
        true,
      ]
      : [
        store.session?.dryRun ? 'Dry-run the Queue?' : 'Apply the Queue?',
        html`
          <p>
                      ${store.session?.dryRun
                        ? html`re-name was started with <span class="mono">--dry-run</span>, so nothing will be moved. You’ll get the
                report.`
                        : html`<b>${files} file${files === 1 ? '' : 's'}</b> in <b>${store.queue.jobs.length} Job${
                          store.queue.jobs.length === 1 ? '' : 's'
                        }</b> will be renamed and moved into <span class="mono">${store.session?.targetName}/</span>.`}
                    </p>
          <p>Every file is checked against the disk first. If anything changed since it was read, nothing is moved. The
                      apply stops at the first error, and a log is written either way.</p>
        `,
        store.session?.dryRun ? 'Run' : 'Apply Queue',
        false,
      ];
    return html`
      <div class="overlay" @click=${(e: Event) => e.target === e.currentTarget && store.answer(false)}>
        <div class="dialog" role="alertdialog" aria-modal="true" aria-label=${title}>
          <h2>${title}</h2>
          ${body}
          <div class="buttons">
            <button @click=${() => store.answer(false)}>Cancel</button>
            <button class="primary ${danger ? 'danger' : ''}" @click=${() => store.answer(true)}>${yes}</button>
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
            <h2>The Queue wasn’t applied</h2>
            <div class="problem">${store.applyError.message}</div>
            ${store.applyError.details.length
              ? html`<ul>${store.applyError.details.map((d) => html`<li>${d}</li>`)}</ul>`
              : nothing}
            <p>Nothing was moved. Check the files, then edit or remove the Jobs they belong to.</p>
            <div class="buttons"><button class="primary" @click=${() => store.dismissApply()}>OK</button></div>
          </div>
        </div>
      `;
    }
    const apply = store.apply;
    if (!apply) return nothing;
    const result = apply.result;
    if (!result) {
      const p = apply.progress;
      return html`
        <div class="overlay">
          <div class="dialog" role="dialog" aria-modal="true" aria-label="Applying the Queue">
            <h2>${store.session?.dryRun ? 'Dry-running the Queue…' : 'Applying the Queue…'}</h2>
            <p>${p ? `Moving file ${p.index + 1} of ${p.total}` : 'Checking every file against the disk…'}</p>
            <progress max=${p?.total ?? 1} value=${p ? p.index : 0}></progress>
            ${p ? html`<div class="current">${p.path}<br />→ ${p.newPath}</div>` : nothing}
          </div>
        </div>
      `;
    }
    return html`
      <div class="overlay">
        <div class="dialog" role="alertdialog" aria-modal="true">
          <h2>
            ${result.error
              ? 'The apply stopped on an error'
              : result.dryRun
              ? 'Dry run complete: nothing was moved'
              : 'The Queue was applied'}
          </h2>
          <div class="figures">
            <div class="figure"><b>${result.moved}</b><span>${result.dryRun ? 'would move' : 'moved'}</span></div>
            <div class="figure"><b>${result.total - result.moved}</b><span>not moved</span></div>
            <div class="figure"><b>${result.queue.jobs.length}</b><span>Jobs left in Queue</span></div>
          </div>
          ${result.error
            ? html`
              <div class="problem">
                            <b>${result.error.path}</b><br />${result.error.message}
                          </div>
              <p>Files already moved were taken out of their Jobs. Everything else is still in the Queue.</p>
            `
            : nothing}
          <p>The log, with the Queue as it was, is at:</p>
          <div class="log">${result.logPath}</div>
          ${!result.error && !result.dryRun
            ? html`
              <p
                style="margin-top:10px">Move the renamed folders from <span class="mono">${store.session
                  ?.targetName}/</span> into your media server’s library when you’re ready.</p>
            `
            : nothing}
          <div class="buttons"><button class="primary" @click=${() => store.dismissApply()}>Done</button></div>
        </div>
      </div>
    `;
  }

  private renderToasts() {
    return html`<div class="toasts" role="status">
      ${this.c.store.toasts.map((t) => html`<div class="toast ${t.tone}">${t.text}</div>`)}
    </div>`;
  }
}
