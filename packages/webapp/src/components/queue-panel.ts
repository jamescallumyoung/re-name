// The Queue (design doc, section 7.1): one card per approved Job, each with a tree
// of the changes it will make, and Confirm, which applies the whole Queue.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Job, PreviewFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { shared } from '../styles/shared.ts';
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
    const parts = f.newPath.split('/');
    let folder = root;
    for (const name of parts.slice(0, -1)) {
      let next = folder.folders.get(name);
      if (!next) folder.folders.set(name, next = { name, folders: new Map(), files: [] });
      folder = next;
    }
    folder.files.push(f);
  }
  return root;
}

@customElement('queue-panel')
export class QueuePanel extends LitElement {
  private readonly c = new StoreController(this);
  /** Which Jobs show their changes: view state only. */
  @state()
  accessor collapsed = new Set<string>();

  static override styles = [
    shared,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
      }
      header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
      }
      h2 {
        font-size: 14px;
        margin: 0 auto 0 0;
      }
      h2 .muted {
        font-weight: 500;
      }
      .jobs {
        flex: 1;
        overflow: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .empty {
        margin: auto;
        max-width: 280px;
        text-align: center;
        color: var(--fg-3);
        font-size: 13px;
        line-height: 1.5;
      }
      .empty b {
        display: block;
        color: var(--fg-2);
        font-size: 14px;
        margin-bottom: 4px;
      }
      .job {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }
      .job.editing {
        border-color: var(--warn);
        box-shadow: 0 0 0 2px var(--warn-soft);
      }
      .summary {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 8px;
      }
      .summary poster-art {
        width: 40px;
      }
      .title {
        font-weight: 700;
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        display: flex;
        gap: 6px;
        align-items: center;
        margin-top: 4px;
        flex-wrap: wrap;
      }
      .actions {
        display: flex;
        gap: 4px;
      }
      .changes {
        border-top: 1px solid var(--border);
        padding: 8px 10px 10px;
        font-size: 12px;
        background: var(--surface-2);
        border-radius: 0 0 var(--radius) var(--radius);
        overflow-x: auto;
      }
      .folder {
        font-family: var(--font-mono);
        font-weight: 600;
        padding: 2px 0;
        white-space: nowrap;
      }
      .nested {
        padding-left: 16px;
        border-left: 1px dashed var(--border-strong);
        margin-left: 5px;
      }
      .file {
        padding: 3px 0;
      }
      .new {
        font-family: var(--font-mono);
        overflow-wrap: anywhere;
      }
      .old {
        font-family: var(--font-mono);
        color: var(--fg-3);
        font-size: 11px;
        overflow-wrap: anywhere;
      }
      .old::before {
        content: '← ';
      }
      .dup {
        background: var(--warn-soft);
        color: var(--warn);
        border-radius: 3px;
        padding: 0 3px;
        font-weight: 700;
      }
      .warning {
        color: var(--warn);
        font-size: 11px;
      }
      footer {
        padding: 10px 12px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      footer .note {
        font-size: 12px;
        color: var(--fg-3);
        margin-right: auto;
        line-height: 1.4;
      }
      .toggle {
        border: none;
        background: none;
        padding: 0;
        font-size: 12px;
        color: var(--accent);
      }
    `,
  ];

  override render() {
    const { queue, session, apply, draft } = this.c.store;
    const files = queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    return html`
      <header>
        <h2>Queue <span class="muted">· ${queue.jobs.length} Job${queue.jobs.length === 1
          ? ''
          : 's'} · ${files} file${files === 1 ? '' : 's'}</span></h2>
      </header>
      <div class="jobs">
        ${queue.jobs.length === 0
          ? html`<div class="empty">
            <b>The Queue is empty</b>
            Select the files of one movie or show on the left, then start a Job. Approved Jobs wait here until you apply the
            Queue.
          </div>`
          : queue.jobs.map((job) => this.renderJob(job, draft?.editingJobId === job.id))}
      </div>
      <footer>
        <span class="note">
          Files are moved into <span class="mono">${session
            ?.targetName}/</span>. Anything not in a Job stays where it is.
        </span>
        <button class="primary" ?disabled=${queue.jobs.length === 0 || apply !== null} @click=${() =>
          this.c.store.askApply()}>
          ${session?.dryRun ? 'Dry run' : 'Confirm'} · apply Queue
        </button>
      </footer>
    `;
  }

  private renderJob(job: Job, editing: boolean) {
    const open = !this.collapsed.has(job.id);
    const dups = job.preview.files.filter((f) => f.dup !== null).length;
    const warnings = job.preview.files.filter((f) => f.warnings.length > 0).length;
    return html`
      <article class="job ${editing ? 'editing' : ''}">
        <div class="summary">
          <poster-art
            label=${job.match.title}
            year=${job.match.year}
            type=${job.match.type}
            tmdb-id=${job.match.tmdbId}
          ></poster-art>
          <div>
            <div class="title" title=${job.match.title}>${job.match.title} <span class="muted">(${job.match
              .year})</span></div>
            <div class="meta">
              <span class="badge accent">${job.match.type === 'tv' ? 'TV' : 'Movie'}</span>
              <span class="badge">${job.draft.files.length} file${job.draft.files.length === 1 ? '' : 's'}</span>
              ${dups
                ? html`<span class="badge warn" title="Names that clash get a DUP tag">${dups} DUP</span>`
                : nothing}
              ${warnings
                ? html`<span class="badge warn">${warnings} warning${warnings === 1 ? '' : 's'}</span>`
                : nothing}
              ${editing ? html`<span class="badge warn">Being edited</span>` : nothing}
              <button class="toggle" @click=${() => this.toggle(job.id)}>${open
                ? 'Hide changes'
                : 'Show changes'}</button>
            </div>
          </div>
          <div class="actions">
            <button class="small" @click=${() => this.c.store.editJob(job.id)}>Edit</button>
            <button class="small danger" @click=${() => this.c.store.askRemoveJob(job)}>Remove</button>
          </div>
        </div>
        ${open ? html`<div class="changes">${this.renderTree(treeOf(job.preview.files))}</div>` : nothing}
      </article>
    `;
  }

  private renderTree(folder: TreeFolder): unknown {
    return html`
      ${[...folder.folders.values()].map(
        (f) =>
          html`
            <div class="folder">📁 ${f.name}/</div>
            <div class="nested">${this.renderTree(f)}</div>
          `,
      )}
      ${folder.files.map(
        (f) =>
          html`<div class="file">
          <div class="new">${renderNewName(f.newPath?.split('/').pop() ?? '')}</div>
          <div class="old">${f.path}</div>
          ${f.warnings.map((w) => html`<div class="warning">⚠ ${w}</div>`)}
        </div>`,
      )}
    `;
  }

  private toggle(id: string): void {
    const next = new Set(this.collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    this.collapsed = next;
  }
}
