// The Queue section (design doc, sections 7.1 and 11): one row per approved Job,
// opening to its tree of changes, and Apply, which applies the whole Queue.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Job, PreviewFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons, section, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import { renderNewName } from './new-name.ts';
import './poster-art.ts';

interface TreeFolder {
  name: string;
  folders: Map<string, TreeFolder>;
  files: PreviewFile[];
}

function treeOf(files: PreviewFile[]): TreeFolder {
  const root: TreeFolder = { name: '', folders: new Map(), files: [] };
  for (const f of files) {
    if (!f.newPath) continue;
    let folder = root;
    for (const name of f.newPath.split('/').slice(0, -1)) {
      let next = folder.folders.get(name);
      if (!next) folder.folders.set(name, next = { name, folders: new Map(), files: [] });
      folder = next;
    }
    folder.files.push(f);
  }
  return root;
}

@customElement('queue-section')
export class QueueSection extends LitElement {
  private readonly c = new StoreController(this);
  /** Which Jobs are open: view state only. */
  @state()
  accessor open = new Set<string>();

  static override styles = [
    base,
    buttons,
    tags,
    section,
    css`
      .job {
        border-bottom: 1px solid var(--line);
      }
      .job:last-child {
        border-bottom: none;
      }
      .job.editing {
        box-shadow: inset 2px 0 0 var(--warn);
      }
      .row {
        display: grid;
        grid-template-columns: 14px 24px minmax(0, 1fr) auto auto;
        gap: 10px;
        align-items: center;
        min-height: 44px;
        padding: 4px 12px;
        cursor: pointer;
      }
      .row:hover {
        background: var(--surface-2);
      }
      .chev {
        width: 14px;
        height: 14px;
        color: var(--faint);
      }
      .open .chev {
        transform: rotate(90deg);
      }
      .row poster-art {
        width: 24px;
      }
      .title {
        color: var(--fg);
        font-weight: 600;
      }
      .title .y {
        color: var(--muted);
        font-weight: 400;
      }
      .meta {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .actions {
        display: flex;
        gap: 2px;
      }
      .changes {
        padding: 8px 12px 10px 48px;
        background: var(--bg);
        border-top: 1px solid var(--line);
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.55;
      }
      .tf {
        color: var(--fg);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .tf svg {
        width: 13px;
        height: 13px;
        color: var(--muted);
      }
      .nested {
        margin-left: 6px;
        padding-left: 14px;
        border-left: 1px solid var(--line-strong);
      }
      .file {
        padding: 2px 0;
      }
      .new {
        color: var(--fg-2);
        overflow-wrap: anywhere;
      }
      .old {
        color: var(--faint);
        font-size: 10.5px;
        overflow-wrap: anywhere;
      }
      .warning {
        color: var(--warn);
        font-size: 11px;
      }
      .dup {
        color: var(--warn);
        background: var(--warn-soft);
        padding: 0 2px;
        font-weight: 700;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { queue, session, apply } = store;
    const files = queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    return html`
      <div class="head">
        <h2>Queue</h2>
        <span class="count">${queue.jobs.length} Job${queue.jobs.length === 1 ? '' : 's'} · ${files} file${files === 1
          ? ''
          : 's'} → <span class="mono">${session?.targetPath}</span></span>
        <span class="grow"></span>
        <button class="btn sm primary" ?disabled=${queue.jobs.length === 0 || apply !== null} @click=${() =>
          store.askApply()}>
          ${icon('play')} ${session?.dryRun ? 'Dry-run Queue' : 'Apply Queue'}
        </button>
      </div>
      ${queue.jobs.length === 0
        ? html`<div class="empty">
          <b>The Queue is empty.</b><br />Select the files of one movie or show above, then start a Job.
        </div>`
        : queue.jobs.map((j) => this.renderJob(j))}
    `;
  }

  private renderJob(job: Job) {
    const store = this.c.store;
    const open = this.open.has(job.id);
    const editing = store.draft?.editingJobId === job.id;
    const dups = job.preview.files.filter((f) => f.dup !== null).length;
    const warnings = job.preview.files.filter((f) => f.warnings.length).length;
    return html`
      <div class="job ${editing ? 'editing' : ''}">
        <div class="row ${open ? 'open' : ''}" @click=${() => this.toggle(job.id)} aria-expanded=${open}>
          ${icon('chev', 'chev')}
          <poster-art label=${job.match.title} year=${job.match.year} type=${job.match.type} tmdb-id=${job.match
            .tmdbId}></poster-art>
          <span class="title">${job.match.title} <span class="y">(${job.match.year})</span></span>
          <span class="meta">
            <span class="tag">${job.match.type === 'tv' ? 'TV' : 'Movie'}</span>
            <span class="tag">${job.draft.files.length} file${job.draft.files.length === 1 ? '' : 's'}</span>
            ${dups ? html`<span class="tag warn" title="Clashing names get a DUP tag">${dups} DUP</span>` : nothing}
            ${warnings ? html`<span class="tag warn">${icon('alert')} ${warnings}</span>` : nothing}
            ${editing ? html`<span class="tag warn">Editing</span>` : nothing}
          </span>
          <span class="actions" @click=${(e: Event) => e.stopPropagation()}>
            <button class="icon-btn" title="Edit" @click=${() => store.editJob(job.id)}>${icon('edit')}</button>
            <button class="icon-btn" title="Remove from the Queue" @click=${() => store.askRemoveJob(job)}>${icon(
              'trash',
            )}</button>
          </span>
        </div>
        ${open ? html`<div class="changes">${this.renderTree(treeOf(job.preview.files))}</div>` : nothing}
      </div>
    `;
  }

  private renderTree(folder: TreeFolder): unknown {
    return html`
      ${[...folder.folders.values()].map(
        (f) =>
          html`
            <div class="tf">${icon('folder')} ${f.name}/</div>
            <div class="nested">${this.renderTree(f)}</div>
          `,
      )}
      ${folder.files.map(
        (f) =>
          html`<div class="file">
            <div class="new">${renderNewName(f.newPath?.split('/').pop() ?? '')}</div>
            <div class="old">← ${f.path}</div>
            ${f.warnings.map((w) => html`<div class="warning">${w}</div>`)}
          </div>`,
      )}
    `;
  }

  private toggle(id: string): void {
    const next = new Set(this.open);
    next.has(id) ? next.delete(id) : next.add(id);
    this.open = next;
  }
}
