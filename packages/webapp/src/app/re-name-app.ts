// The app shell: one page, one column. The header, then Files, the draft Job (while
// there is one) and the Queue, with the status bar along the bottom. Plus the
// settings modal (up front, and from the header), the questions, the apply progress
// and result, toasts, and the blocked and stopped screens (design doc, sections 7
// and 8.5).

import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from './store-controller.ts';
import type { Draft } from '../lib/draft.ts';
import { base, buttons } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import { FLAVOUR_LABEL } from '../components/app-header.ts';
import '../components/app-header.ts';
import '../components/draft-section.ts';
import '../components/files-section.ts';
import '../components/queue-section.ts';
import '../components/settings-modal.ts';
import '../components/status-bar.ts';

@customElement('re-name-app')
export class ReNameApp extends LitElement {
  private readonly c = new StoreController(this);
  private shownDraft: Draft | null = null;

  static override styles = [
    base,
    buttons,
    css`
      /* The page never scrolls: the header and status bar stay put, and only the
        column between them scrolls. */
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      main {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      .column {
        max-width: 1100px;
        margin: 0 auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .center {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .center .box {
        max-width: 420px;
        border: 1px solid var(--line);
        background: var(--surface);
        padding: 20px;
      }
      .center h1 {
        margin: 0 0 8px;
        color: var(--fg);
        font-size: 15px;
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
        padding: 16px;
        background: rgba(0, 0, 0, 0.7);
      }
      .dialog {
        width: min(500px, 100%);
        max-height: 88vh;
        overflow: auto;
        background: var(--surface);
        border: 1px solid var(--line-strong);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
      }
      .dialog .dhead {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 44px;
        padding: 0 14px;
        border-bottom: 1px solid var(--line);
        background: var(--surface-2);
      }
      .dialog h2 {
        margin: 0;
        color: var(--fg);
        font-size: 13px;
        font-weight: 700;
      }
      .dialog .dhead svg {
        width: 15px;
        height: 15px;
        color: var(--accent);
      }
      .dialog .body {
        padding: 14px;
      }
      .dialog p {
        margin: 0 0 10px;
        line-height: 1.6;
      }
      .dialog p:last-child {
        margin-bottom: 0;
      }
      .dialog b {
        color: var(--fg);
      }
      .dialog footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
        background: var(--surface-2);
      }
      .dialog ul {
        margin: 0 0 10px;
        padding-left: 16px;
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--muted);
      }
      .kv {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 14px;
        margin: 0 0 12px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        background: var(--bg);
      }
      .kv dt {
        color: var(--muted);
      }
      .kv dd {
        margin: 0;
        color: var(--fg);
        overflow-wrap: anywhere;
      }
      .kv dd.mono {
        font-size: 12px;
      }
      .kv dd.big {
        font-size: 16px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .bar {
        height: 6px;
        background: var(--bg);
        border: 1px solid var(--line);
        margin: 8px 0;
      }
      .bar i {
        display: block;
        height: 100%;
        background: var(--accent);
        transition: width 0.2s;
      }
      .current {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--muted);
        overflow-wrap: anywhere;
      }
      .problem {
        display: flex;
        gap: 8px;
        padding: 8px 10px;
        margin-bottom: 10px;
        border: 1px solid rgba(255, 99, 105, 0.45);
        background: var(--bad-soft);
        color: var(--bad);
        overflow-wrap: anywhere;
      }
      .problem svg {
        width: 14px;
        height: 14px;
        flex: none;
        margin-top: 2px;
      }
      .toasts {
        position: fixed;
        right: 16px;
        bottom: 60px;
        z-index: 55;
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: 360px;
      }
      .toast {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        background: var(--surface-3);
        border: 1px solid var(--line-strong);
        border-left: 3px solid var(--muted);
        color: var(--fg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
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
      <main @scroll-to=${() => this.scrollToDraft()}>
        <div class="column">
          <files-section></files-section>
          ${store.draft ? html`<draft-section></draft-section>` : nothing}
          <queue-section></queue-section>
        </div>
      </main>
      <status-bar @scroll-to=${() => this.scrollToDraft()}></status-bar>
      ${store.setupOpen
        ? html`<settings-modal required></settings-modal>`
        : store.settingsOpen
        ? html`<settings-modal></settings-modal>`
        : nothing}
      ${this.renderPending()} ${this.renderApply()} ${this.renderToasts()}
    `;
  }

  /** A new draft scrolls into view. */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const draft = this.c.store.draft;
    if (draft && draft !== this.shownDraft) this.scrollToDraft();
    this.shownDraft = draft;
  }

  private scrollToDraft(): void {
    this.renderRoot.querySelector('draft-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <div class="dhead">${icon(pending.kind === 'apply' ? 'play' : 'alert')}<h2>${title}</h2></div>
          <div class="body">${body}</div>
          <footer>
            <button class="btn" @click=${() => store.answer(false)}>Cancel</button>
            <button class="btn ${primary ? 'primary' : 'danger'}" @click=${() => store.answer(true)}>${yes}</button>
          </footer>
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
            <div class="dhead">${icon('alert')}<h2>Nothing was moved</h2></div>
            <div class="body">
              <div class="problem">${icon('alert')}<span>${store.applyError.message}</span></div>
              ${store.applyError.details.length
                ? html`<ul>${store.applyError.details.map((d) => html`<li>${d}</li>`)}</ul>`
                : nothing}
              <p>Check those files, then edit or remove the Jobs they’re in.</p>
            </div>
            <footer><button class="btn primary" @click=${() => store.dismissApply()}>OK</button></footer>
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
            <div class="dhead">${icon('play')}<h2>${store.session?.dryRun
              ? 'Dry-running the Queue'
              : 'Applying the Queue'}</h2></div>
            <div class="body">
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
          <div class="dhead">
            ${icon(result.error ? 'alert' : 'check')}
            <h2>${result.error
              ? 'The apply stopped on an error'
              : result.dryRun
              ? 'Dry run finished'
              : 'Queue applied'}</h2>
          </div>
          <div class="body">
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
          </div>
          <footer><button class="btn primary" @click=${() => store.dismissApply()}>Done</button></footer>
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
