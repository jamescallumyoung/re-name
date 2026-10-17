// The sidebar, after Loadout's: the logo, the pages, and at the foot the connection
// to the re-name server.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import type { Page } from '../app/store.ts';
import { base, pills } from '../styles/shared.ts';
import { icon, type IconName } from '../styles/icons.ts';

@customElement('side-nav')
export class SideNav extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    pills,
    css`
      :host {
        position: fixed;
        inset: 0 auto 0 0;
        width: 16rem;
        z-index: 30;
        display: flex;
        flex-direction: column;
        background: var(--panel);
        border-right: 1px solid var(--line);
        padding: 1.25rem 0.75rem 4rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0 0.5rem 1.5rem;
      }
      .mark {
        width: 2.1rem;
        height: 2.1rem;
        border-radius: 0.6rem;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        display: grid;
        place-items: center;
        color: #fff;
      }
      .brand b {
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--fg);
        letter-spacing: -0.02em;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        border-radius: 0.5rem;
        color: var(--fg-2);
        font-weight: 500;
        width: 100%;
        text-align: left;
        transition: background 0.15s;
      }
      .item:hover {
        background: var(--panel-2);
        color: var(--fg);
      }
      .item[aria-current='page'] {
        background: linear-gradient(90deg, var(--accent-strong), #9f1239);
        color: #fff;
      }
      .count {
        margin-left: auto;
        border-radius: 999px;
        padding: 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--accent-soft);
        color: var(--accent-text);
        font-variant-numeric: tabular-nums;
      }
      .item[aria-current='page'] .count {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      .divider {
        height: 1px;
        background: var(--line);
        margin: 0.75rem 0.5rem;
      }
      .foot {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .state {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.75rem;
        color: var(--ok-text);
        padding: 0.2rem 0.5rem;
      }
      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        background: currentColor;
      }
      .state .pill {
        margin-left: auto;
      }
      @media (max-width: 900px) {
        :host {
          display: none;
        }
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { session, queue, draft } = store;
    return html`
      <div class="brand"><span class="mark">${icon('rename')}</span><b>re-name</b></div>
      <nav aria-label="Pages">
        ${this.item('files', 'Files', 'files')}
        ${this.item('queue', 'Queue', 'queue', queue.jobs.length || null)}
        ${this.item('settings', 'Settings', 'settings')}
        ${draft
          ? html`<div class="divider"></div>${
            this.item('job', draft.editingJobId ? 'Editing Job' : 'Draft Job', 'edit', draft.files.length)
          }`
          : nothing}
      </nav>
      <div class="foot">
        <div class="state">
          <span class="dot"></span> Connected
          ${session?.dryRun
            ? html`<span class="pill warn" title="Started with --dry-run: nothing will be moved">Dry run</span>`
            : nothing}
        </div>
      </div>
    `;
  }

  private item(page: Page, label: string, iconName: IconName, count: number | null = null) {
    const store = this.c.store;
    return html`<button class="item" aria-current=${store.page === page ? 'page' : 'false'} @click=${() =>
      store.goTo(page)}>
      ${icon(iconName)} ${label} ${count ? html`<span class="count">${count}</span>` : nothing}
    </button>`;
  }
}
