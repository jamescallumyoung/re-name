// The Files page, the overview (design doc, section 7.1): the explorer, the Jobs
// already queued, and a bar for the selection that appears once there is one.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../app/store-controller.ts';
import { filesUnder, formatBytes, isSelectable } from '../lib/tree.ts';
import { base, buttons, pageStyles, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import '../components/file-explorer.ts';
import '../components/poster-art.ts';

@customElement('files-page')
export class FilesPage extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    pills,
    pageStyles,
    css`
      .source {
        display: flex;
        align-items: center;
        gap: 1.1rem;
        padding: 1.3rem 1.5rem;
        border: 1px solid var(--line);
        border-radius: 0.9rem;
        background:
          radial-gradient(ellipse 50% 120% at 0% 0%, var(--glow), transparent 70%), var(--panel);
      }
      .source-mark {
        flex: none;
        width: 3rem;
        height: 3rem;
        border-radius: 0.8rem;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        border: 1px solid var(--accent-line);
        color: var(--accent-text);
      }
      .source-mark svg {
        width: 1.5rem;
        height: 1.5rem;
      }
      .source-text {
        flex: 1;
        min-width: 0;
      }
      .source-label {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .source-path {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 1.25rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .source-count {
        flex: none;
        color: var(--muted);
        font-size: 0.85rem;
        text-align: right;
        line-height: 1.4;
      }
      .source-count b {
        color: var(--fg);
        font-size: 1.1rem;
      }
      @media (max-width: 640px) {
        .source-count {
          display: none;
        }
      }
      .queued {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        flex-wrap: wrap;
      }
      .queued .label {
        color: var(--muted);
        font-size: 0.85rem;
        font-weight: 600;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.3rem 0.7rem 0.3rem 0.35rem;
        border: 1px solid var(--line);
        border-radius: 0.6rem;
        background: var(--bg);
        color: var(--fg);
        font-weight: 600;
        font-size: 0.85rem;
      }
      .chip poster-art {
        width: 1.6rem;
      }
      .chip .n {
        color: var(--muted);
        font-weight: 500;
      }
      .queued .btn {
        margin-left: auto;
      }
      .draft {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.8rem 1rem;
        border-color: rgba(234, 179, 8, 0.4);
        background: var(--warn-soft);
        color: var(--warn-text);
      }
      .draft span {
        margin-right: auto;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { queue, selection, draft, busy, tree, session } = store;
    const all = tree ? filesUnder(tree) : [];
    const available = all.filter(isSelectable).length;
    const bytes = all.filter((f) => selection.has(f.path)).reduce((n, f) => n + f.size, 0);
    return html`
      <div class="page-title">
        <div>
          <h1>Files</h1>
          <div class="sub">Select the files of one movie or show, then start a Job to match and rename them.</div>
        </div>
      </div>

      <div class="source">
        <span class="source-mark">${icon('folder')}</span>
        <div class="source-text">
          <div class="source-label">Source</div>
          <div class="source-path" title=${session?.sourcePath ?? ''}>${session?.sourcePath ?? '…'}</div>
        </div>
        <div class="source-count">
          <b>${available}</b> of ${all.length} video files<br />available to rename
        </div>
      </div>

      ${draft
        ? html`<div class="panel draft">
          ${icon('edit')}
          <span>${draft.editingJobId ? 'You’re editing a Job' : 'A draft Job is in progress'}${
          draft.match
            ? html`
              for <b>${draft.match.title}</b>
            `
            : ''
        }.</span>
          <button class="btn sm" @click=${() => store.goTo('job')}>Resume</button>
        </div>`
        : nothing}

      ${queue.jobs.length
        ? html`<div class="panel queued">
          <span class="label">Queued</span>
          ${
          queue.jobs.map(
            (j) =>
              html`<span class="chip">
                <poster-art label=${j.match.title} year=${j.match.year} type=${j.match.type} tmdb-id=${j.match.tmdbId}></poster-art>
                ${j.match.title} <span class="n">${j.draft.files.length}</span>
              </span>`,
          )
        }
          <button class="btn sm" @click=${() => store.goTo('queue')}>Review Queue ${icon('chev')}</button>
        </div>`
        : nothing}

      <file-explorer></file-explorer>

      ${selection.size > 0
        ? html`
          <div class="action-bar">
            <span class="summary"><b>${selection.size}</b> file${selection.size === 1
              ? ''
              : 's'} selected · ${formatBytes(bytes)}</span>
            <button class="btn ghost" @click=${() => store.clearSelection()}>Clear</button>
            <button class="btn primary" ?disabled=${busy} @click=${() => store.newJob()}>
                      New Job ${icon('arrow')}
                    </button>
          </div>
        `
        : queue.jobs.length
        ? html`
          <div class="action-bar">
            <span class="summary"><b>${queue.jobs.length}</b> Job${queue.jobs.length === 1
              ? ''
              : 's'} queued for ${session?.targetName}/</span>
            <button class="btn" @click=${() => store.goTo('queue')}>Review and apply ${icon('chev')}</button>
          </div>
        `
        : nothing}
    `;
  }
}
