// The app shell, after Loadout's: the sidebar and the current page, the setup
// modal shown once up front, the questions, the apply progress and result, toasts,
// and the blocked and stopped screens (design doc, sections 7 and 8.5).

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from './store-controller.ts';
import type { Page } from './store.ts';
import { base, buttons, spinner } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import '../components/setup-modal.ts';
import '../components/side-nav.ts';
import '../pages/files-page.ts';
import '../pages/job-page.ts';
import '../pages/queue-page.ts';
import '../pages/settings-page.ts';

@customElement('re-name-app')
export class ReNameApp extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    spinner,
    css`
      :host {
        display: block;
        min-height: 100%;
      }
      main {
        margin-left: 16rem;
      }
      .mobile-nav {
        display: none;
      }
      @media (max-width: 900px) {
        main {
          margin-left: 0;
        }
        .mobile-nav {
          display: flex;
          gap: 0.25rem;
          padding: 0.6rem 1rem;
          background: var(--panel);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 25;
        }
        .mobile-nav button {
          padding: 0.4rem 0.75rem;
          border-radius: 0.45rem;
          color: var(--fg-2);
          font-weight: 600;
          font-size: 0.85rem;
        }
        .mobile-nav button[aria-current='page'] {
          background: var(--accent-strong);
          color: #fff;
        }
      }
      .center {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
      }
      .center .box {
        max-width: 28rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.8rem;
      }
      .center h1 {
        margin: 0;
        color: var(--fg);
        font-size: 1.5rem;
        font-weight: 800;
      }
      .center p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .center .spin {
        width: 1.6rem;
        height: 1.6rem;
        color: var(--accent);
      }
      .mark {
        width: 3rem;
        height: 3rem;
        border-radius: 0.8rem;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        display: grid;
        place-items: center;
        color: #fff;
      }
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        padding: 1.25rem;
        background: rgba(3, 7, 18, 0.72);
        backdrop-filter: blur(4px);
      }
      .dialog {
        width: min(32rem, 100%);
        max-height: 88vh;
        overflow: auto;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 1rem;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
      }
      .dialog .body {
        padding: 1.6rem 1.6rem 1.2rem;
      }
      .dialog h2 {
        margin: 0 0 0.6rem;
        color: var(--fg);
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .dialog p {
        margin: 0 0 0.8rem;
        color: var(--fg-2);
        line-height: 1.6;
      }
      .dialog .mono {
        color: var(--fg);
      }
      .dialog footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
        padding: 1rem 1.6rem;
        background: var(--bg-deep);
        border-top: 1px solid var(--line);
      }
      .dialog ul {
        margin: 0 0 0.8rem;
        padding-left: 1.1rem;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--muted);
      }
      .settings {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.5rem 1.2rem;
        margin: 0 0 1rem;
        padding: 0.9rem 1rem;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 0.7rem;
        font-size: 0.9rem;
      }
      .settings dt {
        color: var(--muted);
      }
      .settings dd {
        margin: 0;
        color: var(--fg);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .settings dd.mono {
        font-weight: 500;
      }
      .figures {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.6rem;
        margin: 0.4rem 0 1rem;
      }
      .figure {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 0.7rem;
        padding: 0.8rem;
      }
      .figure b {
        display: block;
        color: var(--fg);
        font-size: 1.6rem;
        font-weight: 800;
      }
      .figure span {
        color: var(--muted);
        font-size: 0.8rem;
      }
      .bar {
        height: 0.5rem;
        border-radius: 999px;
        background: var(--bg);
        overflow: hidden;
        margin: 0.4rem 0 0.8rem;
      }
      .bar i {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, var(--accent-strong), var(--accent-2));
        transition: width 0.2s;
      }
      .current {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--muted);
        overflow-wrap: anywhere;
      }
      .problem {
        display: flex;
        gap: 0.6rem;
        padding: 0.8rem 0.9rem;
        border-radius: 0.6rem;
        background: var(--bad-soft);
        border: 1px solid rgba(248, 113, 113, 0.45);
        color: var(--bad-text);
        margin-bottom: 0.9rem;
        font-size: 0.9rem;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
      .log {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 0.5rem;
        padding: 0.6rem 0.7rem;
        overflow-wrap: anywhere;
        color: var(--fg-2);
        margin-bottom: 0.8rem;
      }
      .toasts {
        position: fixed;
        right: 1.25rem;
        bottom: 5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 55;
        max-width: 24rem;
      }
      .toast {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        padding: 0.75rem 1rem;
        border-radius: 0.7rem;
        background: var(--panel-2);
        border: 1px solid var(--line);
        color: var(--fg);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
        font-size: 0.875rem;
      }
      .toast svg {
        width: 1.05rem;
        height: 1.05rem;
      }
      .toast.ok svg {
        color: var(--ok-text);
      }
      .toast.bad svg {
        color: var(--bad-text);
      }
      .toast.info svg {
        color: var(--muted);
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { phase, reason } = store;
    if (phase === 'connecting') {
      return html`
        <div class="center">
          <div class="box"><span class="spin"></span><p>Connecting to re-name…</p></div>
        </div>
      `;
    }
    if (phase === 'blocked' || phase === 'stopped') {
      return html`
        <div class="center">
          <div class="box">
            <span class="mark">${icon('rename')}</span>
            <h1>${phase === 'blocked' ? 're-name can’t open here' : 're-name has stopped'}</h1>
            <p>${reason}</p>
          </div>
        </div>
      `;
    }
    return html`
      <side-nav></side-nav>
      <main>
        ${this.renderMobileNav()} ${this.renderPage(store.page)}
      </main>
      ${store.setupOpen ? html`<setup-modal></setup-modal>` : nothing} ${this.renderPending()} ${this.renderApply()}
      ${this.renderToasts()}
    `;
  }

  private renderPage(page: Page) {
    switch (page) {
      case 'files':
        return html`<files-page></files-page>`;
      case 'queue':
        return html`<queue-page></queue-page>`;
      case 'settings':
        return html`<settings-page></settings-page>`;
      case 'job':
        return html`<job-page></job-page>`;
    }
  }

  private renderMobileNav() {
    const store = this.c.store;
    const pages: [Page, string][] = [['files', 'Files'], ['queue', `Queue (${store.queue.jobs.length})`], [
      'settings',
      'Settings',
    ]];
    if (store.draft) pages.push(['job', 'Draft Job']);
    return html`<nav class="mobile-nav">${
      pages.map(([p, label]) =>
        html`<button aria-current=${store.page === p ? 'page' : 'false'} @click=${() =>
          store.goTo(p)}>${label}</button>`
      )
    }</nav>`;
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
        `Remove ${pending.job.match.title}?`,
        html`<p>Its ${pending.job.draft.files.length} files leave the Queue and can be selected again.</p>`,
        'Remove',
        false,
      ]
      : [
        dry ? 'Dry-run the Queue?' : 'Apply the Queue?',
        html`
          <p>
            ${dry
              ? html`re-name was started with <span class="mono">--dry-run</span>, so nothing will be moved.`
              : html`<b>${files} file${files === 1 ? '' : 's'}</b> in ${store.queue.jobs.length} Job${
                store.queue.jobs.length === 1 ? '' : 's'
              } will be renamed and moved.`}
          </p>
          ${this.renderApplySettings()}
          <p class="muted">Every file is checked first: if anything changed on disk, nothing is moved. The apply stops at
            the first error, and a log is written either way.</p>
        `,
        dry ? 'Run' : 'Apply',
        true,
      ];
    return html`
      <div class="overlay" @click=${(e: Event) => e.target === e.currentTarget && store.answer(false)}>
        <div class="dialog" role="alertdialog" aria-modal="true" aria-label=${title}>
          <div class="body"><h2>${title}</h2>${body}</div>
          <footer>
            <button class="btn" @click=${() => store.answer(false)}>Cancel</button>
            <button class="btn ${primary ? 'primary' : 'danger'}" @click=${() => store.answer(true)}>${yes}</button>
          </footer>
        </div>
      </div>
    `;
  }

  /** The settings the apply will use, so they can be checked before anything moves. */
  private renderApplySettings() {
    const { options, session } = this.c.store;
    const server = { plex: 'Plex', jellyfin: 'Jellyfin', emby: 'Emby' }[options.flavour];
    return html`
      <dl class="settings">
        <dt>Names for</dt>
        <dd>${server}</dd>
        <dt>Episode names</dt>
        <dd>${options.includeEpisodeName ? 'Included' : 'Left out'}</dd>
        <dt>Move into</dt>
        <dd class="mono">${session?.targetPath}</dd>
      </dl>
    `;
  }

  private renderApply() {
    const store = this.c.store;
    if (store.applyError) {
      return html`
        <div class="overlay">
          <div class="dialog" role="alertdialog" aria-modal="true">
            <div class="body">
              <h2>Nothing was moved</h2>
              <div class="problem">${icon('alert')} <span>${store.applyError.message}</span></div>
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
            <div class="body">
              <h2>${store.session?.dryRun ? 'Dry-running the Queue' : 'Applying the Queue'}</h2>
              <p>${p ? `Moving file ${p.index + 1} of ${p.total}` : 'Checking every file against the disk…'}</p>
              <div class="bar"><i style="width:${pct}%"></i></div>
              ${p ? html`<div class="current">${p.newPath.split('/').pop()}</div>` : nothing}
            </div>
          </div>
        </div>
      `;
    }
    return html`
      <div class="overlay">
        <div class="dialog" role="alertdialog" aria-modal="true">
          <div class="body">
            <h2>
              ${result.error
                ? 'The apply stopped on an error'
                : result.dryRun
                ? 'Dry run finished'
                : 'Your files are renamed'}
            </h2>
            <div class="figures">
              <div class="figure"><b>${result.moved}</b><span>${result.dryRun ? 'would move' : 'moved'}</span></div>
              <div class="figure"><b>${result.total - result.moved}</b><span>not moved</span></div>
              <div class="figure"><b>${result.queue.jobs.length}</b><span>Jobs left</span></div>
            </div>
            ${result.error
              ? html`
                <div class="problem">${icon('alert')} <span><b>${result.error.path.split('/').pop()}</b><br />${result
                  .error.message}</span></div>
                <p>Files already moved left their Jobs. The rest are still in the Queue.</p>
              `
              : !result.dryRun
              ? html`<p>Move the folders in <span class="mono">${store.session?.targetName}/</span> into your media
                server’s library when you’re ready.</p>`
              : nothing}
            <p class="muted">The log is at:</p>
            <div class="log">${result.logPath}</div>
          </div>
          <footer><button class="btn primary" @click=${() => store.dismissApply()}>Done</button></footer>
        </div>
      </div>
    `;
  }

  private renderToasts() {
    return html`<div class="toasts" role="status">
      ${
      this.c.store.toasts.map(
        (t) =>
          html`<div class="toast ${t.tone}">${
            icon(t.tone === 'ok' ? 'check' : t.tone === 'bad' ? 'alert' : 'queue')
          } ${t.text}</div>`,
      )
    }
    </div>`;
  }
}
