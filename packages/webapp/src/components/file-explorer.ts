// The file explorer (design doc, section 7.1): the source's video files as a list,
// multi-select with shift-click ranges, folders that select everything inside
// them, and queued and skipped files dimmed, each with its own pill.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { FileNode, FolderNode, SkipReason, TreeNode } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { filesUnder, folderCheck, folderPaths, formatBytes, isSelectable } from '../lib/tree.ts';
import { base, fields, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

const SKIP: Record<SkipReason, { label: string; why: string }> = {
  sample: { label: 'Sample', why: 'Samples are left out. If this isn’t one, rename or move it by hand.' },
  'multi-episode': { label: 'Several episodes', why: 'Files with more than one episode aren’t supported yet.' },
  'split-part': { label: 'Split part', why: 'Movies split into parts (cd1, pt1…) aren’t supported yet.' },
};

@customElement('file-explorer')
export class FileExplorer extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    fields,
    pills,
    css`
      :host {
        display: block;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.8rem;
        overflow: hidden;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--line);
        flex-wrap: wrap;
      }
      .toolbar .where {
        margin-right: auto;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .toolbar .where b {
        color: var(--fg);
      }
      .link {
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 600;
        padding: 0.3rem 0.6rem;
        border-radius: 0.4rem;
      }
      .link:hover:not(:disabled) {
        color: var(--fg);
        background: var(--panel-2);
      }
      .link:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .rows {
        padding: 0.4rem 0;
        user-select: none;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        min-height: 2.5rem;
        padding: 0.3rem 1rem 0.3rem calc(1rem + var(--depth) * 1.5rem);
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: background 0.1s;
      }
      .row:hover {
        background: var(--panel-2);
      }
      .row.selected {
        background: var(--accent-soft);
        border-left-color: var(--accent);
      }
      .row.off {
        cursor: default;
      }
      .row.off .name,
      .row.off input {
        opacity: 0.5;
      }
      .chev {
        width: 1.1rem;
        height: 1.1rem;
        color: var(--faint);
        flex: none;
        transition: transform 0.15s;
      }
      .open .chev {
        transform: rotate(90deg);
      }
      .spacer {
        width: 1.1rem;
        flex: none;
      }
      .folder .name {
        color: var(--fg);
        font-weight: 600;
        font-size: 0.9rem;
      }
      .folder-icon {
        width: 1.05rem;
        height: 1.05rem;
        color: var(--muted);
        flex: none;
      }
      .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file .name {
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--fg-2);
      }
      .row.selected .name {
        color: var(--fg);
      }
      .count {
        color: var(--faint);
        font-size: 0.78rem;
        font-variant-numeric: tabular-nums;
      }
      .empty {
        padding: 2.5rem;
        text-align: center;
        color: var(--muted);
      }
    `,
  ];

  override render() {
    const { tree, selection, expanded, session } = this.c.store;
    if (!tree) return html`<div class="empty">Reading ${session?.sourceName ?? 'the source'}…</div>`;
    const files = filesUnder(tree);
    const available = files.filter(isSelectable).length;
    const allOpen = folderPaths(tree).slice(1).every((p) => expanded.has(p));
    return html`
      <div class="toolbar">
        <span class="where">Video files only · shift-click to select a range</span>
        <button class="link" @click=${() => this.c.store.selectAll()} ?disabled=${available === 0}>Select all</button>
        <button class="link" @click=${() => this.c.store.clearSelection()} ?disabled=${selection.size === 0}>
          Clear selection
        </button>
        <button class="link" @click=${() => this.c.store.setAllExpanded(!allOpen)}>
          ${allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div class="rows" role="tree" aria-multiselectable="true">
        ${files.length === 0
          ? html`<div class="empty">No video files are left in ${session?.sourceName}/.</div>`
          : tree.children.map((n) => this.renderNode(n, 0))}
      </div>
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
    return html`
      <div
        class="row folder ${open ? 'open' : ''}"
        style="--depth:${depth}"
        role="treeitem"
        aria-expanded=${open}
        @click=${() => this.c.store.toggleExpanded(folder.path)}
      >
        ${icon('chev', 'chev')}
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
        ${icon('folder', 'folder-icon')}
        <span class="name" title=${folder.path}>${folder.name}</span>
        <span class="count">${all.length}</span>
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
    const title = status.state === 'skipped'
      ? SKIP[status.reason].why
      : status.state === 'queued'
      ? `In the Job for ${job?.match.title ?? '…'}`
      : `${file.path} · ${formatBytes(file.size)}`;
    return html`
      <div
        class="row file ${selected ? 'selected' : ''} ${selectable ? '' : 'off'}"
        style="--depth:${depth}"
        role="treeitem"
        aria-selected=${selected}
        aria-disabled=${!selectable}
        title=${title}
        @click=${(e: MouseEvent) => selectable && this.c.store.toggleFile(file.path, e.shiftKey)}
      >
        <span class="spacer"></span>
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
        ${status.state === 'queued'
          ? html`<span class="pill">${icon('queue')} ${job?.match.title ?? 'Queued'}</span>`
          : status.state === 'skipped'
          ? html`<span class="pill dim">${icon('skip')} ${SKIP[status.reason].label}</span>`
          : nothing}
      </div>
    `;
  }
}
