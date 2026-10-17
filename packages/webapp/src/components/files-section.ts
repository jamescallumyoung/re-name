// The Files card (design doc, section 7.1): the source's video files as rows,
// multi-select with shift-click ranges, folders that select everything inside them,
// and queued and skipped files dimmed with a chip.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { FileNode, FolderNode, SkipReason, TreeNode } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { filesUnder, folderCheck, folderPaths, formatBytes, isSelectable } from '../lib/tree.ts';
import { base, buttons, card, fields, tags } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';

const SKIP: Record<SkipReason, { label: string; why: string }> = {
  sample: { label: 'Sample', why: 'Samples are left out. If this isn’t one, rename or move it by hand.' },
  'multi-episode': { label: 'Multi-episode', why: 'Files with more than one episode aren’t supported yet.' },
  'split-part': { label: 'Split part', why: 'Movies split into parts (cd1, pt1…) aren’t supported yet.' },
};

@customElement('files-section')
export class FilesSection extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    base,
    buttons,
    fields,
    tags,
    card,
    css`
      .selected-count {
        color: var(--primary);
        font-weight: 600;
      }
      .rows {
        user-select: none;
        padding: 6px 0;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: var(--row);
        padding: 0 20px 0 calc(16px + var(--depth) * 24px);
        cursor: pointer;
        transition: background 0.1s;
      }
      .row:hover {
        background: rgba(237, 231, 218, 0.04);
      }
      .row.selected {
        background: var(--primary-soft);
      }
      .row.off {
        cursor: default;
      }
      .row.off .name,
      .row.off input {
        opacity: 0.42;
      }
      .chev {
        width: 18px;
        height: 18px;
        color: var(--muted);
        flex: none;
        transition: transform 0.15s;
      }
      .open .chev {
        transform: rotate(90deg);
      }
      .gap {
        width: 18px;
        flex: none;
      }
      .ficon {
        width: 18px;
        height: 18px;
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
      .folder .name {
        color: var(--fg);
        font-weight: 600;
      }
      .file .name {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--fg-2);
      }
      .row.selected .name {
        color: var(--fg);
      }
      .size {
        width: 72px;
        text-align: right;
        color: var(--faint);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        flex: none;
      }
    `,
  ];

  override render() {
    const store = this.c.store;
    const { tree, selection, expanded } = store;
    const files = tree ? filesUnder(tree) : [];
    const available = files.filter(isSelectable).length;
    const allOpen = tree ? folderPaths(tree).slice(1).every((p) => expanded.has(p)) : false;
    const bytes = files.filter((f) => selection.has(f.path)).reduce((n, f) => n + f.size, 0);
    return html`
      <div class="head">
        <h2>Files</h2>
        ${selection.size
          ? html`<span class="selected-count">${selection.size} selected · ${formatBytes(bytes)}</span>`
          : html`<span class="count">${available} of ${files.length} video files available</span>`}
        <span class="grow"></span>
        <button class="btn sm text" @click=${() => store.selectAll()} ?disabled=${available === 0}>Select all</button>
        <button class="btn sm text" @click=${() => store.clearSelection()} ?disabled=${selection.size === 0}>
          Clear
        </button>
        <button class="btn sm text" @click=${() => store.setAllExpanded(!allOpen)}>
          ${allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      ${!tree
        ? html`<div class="empty">Reading the source…</div>`
        : files.length === 0
        ? html`<div class="empty">No video files are left in the source.</div>`
        : html`<div class="rows" role="tree" aria-multiselectable="true">
          ${tree.children.map((n) => this.renderNode(n, 0))}
        </div>`}
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
        ${icon('folder', 'ficon')}
        <span class="name" title=${folder.path}>${folder.name}</span>
        <span class="size">${all.length} file${all.length === 1 ? '' : 's'}</span>
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
    return html`
      <div
        class="row file ${selected ? 'selected' : ''} ${selectable ? '' : 'off'}"
        style="--depth:${depth}"
        role="treeitem"
        aria-selected=${selected}
        aria-disabled=${!selectable}
        title=${status.state === 'skipped' ? SKIP[status.reason].why : file.path}
        @click=${(e: MouseEvent) => selectable && this.c.store.toggleFile(file.path, e.shiftKey)}
      >
        <span class="gap"></span>
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
          ? html`<span class="tag" title="In an approved Job">${icon('queue')} ${job?.match.title ?? 'Queued'}</span>`
          : status.state === 'skipped'
          ? html`<span class="tag dim">${icon('skip')} ${SKIP[status.reason].label}</span>`
          : nothing}
        <span class="size">${formatBytes(file.size)}</span>
      </div>
    `;
  }
}
