// The Queue card (design doc, sections 7.1 and 11): one row per approved Job,
// opening to its tree of changes, and Apply, which applies the whole Queue.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Job, PreviewFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons, card, tags } from '../styles/shared.ts';
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
    card,
    css`
      .target {
        color: var(--head-muted);
        font-family: var(--font-mono);
        font-size: 13px;
      }
      .job + .job {
        border-top: 1px solid var(--line);
      }
      .job.editing {
        box-shadow: inset 3px 0 0 var(--warn);
      }
      .row {
        display: grid;
        grid-template-columns: 18px 32px minmax(0, 1fr) auto auto;
        gap: 14px;
        align-items: center;
        min-height: 64px;
        padding: 8px 16px 8px 20px;
        cursor: pointer;
        transition: background 0.1s;
      }
      .row:hover {
        background: rgba(237, 231, 218, 0.04);
      }
      .chev {
        width: 18px;
        height: 18px;
        color: var(--muted);
        transition: transform 0.15s;
      }
      .open .chev {
        transform: rotate(90deg);
      }
      .row poster-art {
        width: 32px;
      }
      .title {
        color: var(--fg);
        font-weight: 600;
        font-size: 15px;
      }
      .title .y {
        color: var(--muted);
        font-weight: 400;
      }
      .meta {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .actions {
        display: flex;
        gap: 2px;
      }
      .changes {
        padding: 12px 20px 16px 84px;
        background: var(--bg);
        border-top: 1px solid var(--line);
        font-family: var(--font-mono);
        font-size: 13px;
        line-height: 1.6;
      }
      .tf {
        color: var(--fg);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tf svg {
        width: 15px;
        height: 15px;
        color: var(--muted);
      }
      .nested {
        margin-left: 7px;
        padding-left: 16px;
        border-left: 1px solid var(--line-strong);
      }
      .file {
        padding: 4px 0;
      }
      .new {
        color: var(--fg-2);
        overflow-wrap: anywhere;
      }
      .old {
        color: var(--faint);
        font-size: 11.5px;
        overflow-wrap: anywhere;
      }
      .warning {
        color: var(--warn);
        font-size: 12px;
      }
      .dup {
        color: var(--warn);
        background: var(--warn-soft);
        border-radius: 3px;
        padding: 0 3px;
        font-weight: 700;
      }
    `,
  ];

  override render() {
    const { queue, session } = this.c.store;
    const files = queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    return html`
      <div class="head">
        <h2>Queue</h2>
        <span class="count">${queue.jobs.length} Job${queue.jobs.length === 1 ? '' : 's'} · ${files} file${files === 1
          ? ''
          : 's'}</span>
        <span class="grow"></span>
        <span class="target" title="Files are moved here">→ ${session?.targetPath}</span>
      </div>
      ${queue.jobs.length === 0
        ? html`<div class="empty">
          <b>The Queue is empty.</b><br />Select the files of one movie or show, then create a Job.
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
            ${dups
              ? html`<span class="tag warn" title="Clashing names get a DUP tag">${dups} duplicate${
                dups === 1 ? '' : 's'
              }</span>`
              : nothing}
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
