// The overview's file explorer (design doc, section 7.1): the source's video files,
// multi-select with shift-click ranges, folders that select everything inside them,
// and queued and skipped files greyed out, each in its own way.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { FileNode, FolderNode, SkipReason, TreeNode } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { filesUnder, folderCheck, formatBytes, isSelectable } from '../lib/tree.ts';
import { shared } from '../styles/shared.ts';

const SKIP: Record<SkipReason, { label: string; why: string }> = {
  sample: {
    label: 'Sample',
    why: 'Samples are hidden from Jobs. If this isn’t a sample, rename or move it by hand.',
  },
  'multi-episode': {
    label: 'Several episodes',
    why: 'Files with more than one episode (S01E01-E02) aren’t supported yet.',
  },
  'split-part': {
    label: 'Split part',
    why: 'Movies split into parts (cd1, pt1…) aren’t supported yet.',
  },
};

@customElement('file-explorer')
export class FileExplorer extends LitElement {
  private readonly c = new StoreController(this);

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
        flex-wrap: wrap;
      }
      h2 {
        font-size: 14px;
        margin: 0 auto 0 0;
      }
      h2 .muted {
        font-weight: 500;
      }
      .rows {
        flex: 1;
        overflow: auto;
        padding: 6px 0;
        user-select: none;
      }
      .row {
        display: grid;
        grid-template-columns: 18px 18px minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 6px;
        padding: 3px 12px 3px calc(12px + var(--depth) * 18px);
        font-size: 13px;
        cursor: pointer;
        border-left: 2px solid transparent;
      }
      .row:hover {
        background: var(--surface-2);
      }
      .row.selected {
        background: var(--accent-soft);
        border-left-color: var(--accent);
      }
      .row.folder {
        font-weight: 600;
      }
      .row.off {
        cursor: default;
      }
      .row.off .name {
        color: var(--fg-3);
      }
      .row.queued .name {
        text-decoration: line-through;
        text-decoration-color: var(--queued);
        text-decoration-thickness: 1px;
      }
      .row.skipped .name {
        font-style: italic;
      }
      .chevron {
        border: none;
        background: none;
        padding: 0;
        width: 18px;
        height: 18px;
        justify-content: center;
        color: var(--fg-3);
        transition: transform 0.12s;
      }
      .chevron.open {
        transform: rotate(90deg);
      }
      input[type='checkbox'] {
        margin: 0;
        accent-color: var(--accent);
        cursor: pointer;
      }
      input[type='checkbox']:disabled {
        cursor: default;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file .name {
        font-family: var(--font-mono);
        font-size: 12px;
      }
      .size {
        font-size: 11px;
        color: var(--fg-3);
        font-variant-numeric: tabular-nums;
      }
      .count {
        font-size: 11px;
        color: var(--fg-3);
        font-weight: 500;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
      }
      footer .summary {
        font-size: 13px;
        margin-right: auto;
      }
      .draft-note {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--warn-soft);
        color: var(--warn);
        font-size: 13px;
        border-bottom: 1px solid var(--border);
      }
      .draft-note span {
        margin-right: auto;
      }
      .legend {
        display: flex;
        gap: 10px;
        padding: 6px 12px;
        border-bottom: 1px solid var(--border);
        font-size: 11px;
        color: var(--fg-3);
      }
    `,
  ];

  override render() {
    const { tree, selection, draft, busy, session } = this.c.store;
    if (!tree) {
      return html`
        <header>
          <h2>Loading…</h2>
        </header>
      `;
    }
    const files = filesUnder(tree);
    const available = files.filter(isSelectable).length;
    const selectedBytes = files.filter((f) => selection.has(f.path)).reduce((n, f) => n + f.size, 0);
    return html`
      <header>
        <h2>Source <span class="muted">· ${session?.sourceName}/ · ${available} of ${files
          .length} video files available</span></h2>
        <button class="small" @click=${() => this.c.store.selectAll()}>Select all</button>
        <button class="small" @click=${() => this.c.store.clearSelection()} ?disabled=${selection.size === 0}>
          Deselect all
        </button>
        <button class="small ghost" @click=${() => this.c.store.setAllExpanded(true)}>Expand all</button>
        <button class="small ghost" @click=${() => this.c.store.setAllExpanded(false)}>Collapse all</button>
      </header>
      ${draft
        ? html`
          <div class="draft-note">
            <span>A draft Job${draft.match
              ? html`
                for <b>${draft.match.title}</b>
              `
              : ''} is in progress.</span>
            <button class="small" @click=${() => this.c.store.showDraft()}>Resume draft</button>
          </div>
        `
        : nothing}
      <div class="legend">
        <span class="badge queued">In a Job</span>
        <span class="badge skipped">Skipped</span>
        <span>Shift-click to select a range. Only video files are shown.</span>
      </div>
      <div class="rows" role="tree" aria-multiselectable="true">
        ${tree.children.map((n) => this.renderNode(n, 0))}
      </div>
      <footer>
        <span class="summary">
          ${selection.size === 0
            ? html`<span class="muted">Select the files of one movie or show to start a Job.</span>`
            : html`<b>${selection.size}</b> file${selection.size === 1 ? '' : 's'} selected · ${
              formatBytes(selectedBytes)
            }`}
        </span>
        <button class="primary" ?disabled=${selection.size === 0 || busy} @click=${() => this.c.store.newJob()}>
          New Job from selection →
        </button>
      </footer>
    `;
  }

  private renderNode(node: TreeNode, depth: number): unknown {
    return node.kind === 'folder' ? this.renderFolder(node, depth) : this.renderFile(node, depth);
  }

  private renderFolder(folder: FolderNode, depth: number) {
    const { expanded, selection } = this.c.store;
    const open = expanded.has(folder.path);
    const check = folderCheck(folder, selection);
    const all = filesUnder(folder);
    const selectable = all.filter(isSelectable).length;
    const selected = all.filter((f) => selection.has(f.path)).length;
    return html`
      <div
        class="row folder ${check === 'all' && selectable > 0 ? 'selected' : ''}"
        style="--depth:${depth}"
        role="treeitem"
        aria-expanded=${open}
        @click=${() => this.c.store.toggleExpanded(folder.path)}
      >
        <button class="chevron ${open ? 'open' : ''}" aria-label=${open ? 'Collapse' : 'Expand'}>▸</button>
        <input
          type="checkbox"
          aria-label=${`Select everything in ${folder.name}`}
          .checked=${check === 'all' && selectable > 0}
          .indeterminate=${check === 'some'}
          ?disabled=${selectable === 0}
          @click=${(e: Event) => {
            e.stopPropagation();
            this.c.store.toggleFolder(folder);
          }}
        />
        <span class="name" title=${folder.path}>📁 ${folder.name}</span>
        <span class="count">${selected > 0 ? `${selected}/` : ''}${all.length}</span>
        <span></span>
      </div>
      ${open ? folder.children.map((n) => this.renderNode(n, depth + 1)) : nothing}
    `;
  }

  private renderFile(file: FileNode, depth: number) {
    const { selection, queue } = this.c.store;
    const selectable = isSelectable(file);
    const selected = selection.has(file.path);
    const status = file.status;
    const job = status.state === 'queued' ? queue.jobs.find((j) => j.id === status.jobId) : undefined;
    const badge = status.state === 'queued'
      ? html`<span class="badge queued" title="This file is in an approved Job">In Job · ${
        job?.match.title ?? '…'
      }</span>`
      : status.state === 'skipped'
      ? html`<span class="badge skipped" title=${SKIP[status.reason].why}>⊘ ${SKIP[status.reason].label}</span>`
      : html`<span></span>`;
    return html`
      <div
        class="row file ${selected ? 'selected' : ''} ${selectable ? '' : `off ${status.state}`}"
        style="--depth:${depth}"
        role="treeitem"
        aria-selected=${selected}
        aria-disabled=${!selectable}
        title=${status.state === 'skipped' ? SKIP[status.reason].why : file.path}
        @click=${(e: MouseEvent) => selectable && this.c.store.toggleFile(file.path, e.shiftKey)}
      >
        <span></span>
        <input
          type="checkbox"
          aria-label=${`Select ${file.name}`}
          .checked=${selected}
          ?disabled=${!selectable}
          @click=${(e: MouseEvent) => {
            e.stopPropagation();
            if (selectable) this.c.store.toggleFile(file.path, e.shiftKey);
          }}
        />
        <span class="name">${file.name}</span>
        ${badge}
        <span class="size">${formatBytes(file.size)}</span>
      </div>
    `;
  }
}
