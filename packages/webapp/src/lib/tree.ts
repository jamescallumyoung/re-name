// Pure helpers over the source tree the server sends (`tree.get`).

import type { FileNode, FolderNode, TreeNode } from '@re-name/protocol';

/** Every file under `node`, in display order. */
export function filesUnder(node: TreeNode): FileNode[] {
  return node.kind === 'file' ? [node] : node.children.flatMap(filesUnder);
}

export function isSelectable(file: FileNode): boolean {
  return file.status.state === 'available';
}

/** The selectable files between two paths, inclusive, in display order (shift-click). */
export function rangeBetween(root: FolderNode, from: string, to: string): string[] {
  const files = filesUnder(root);
  const a = files.findIndex((f) => f.path === from);
  const b = files.findIndex((f) => f.path === to);
  if (a === -1 || b === -1) return [to];
  const [start, end] = a < b ? [a, b] : [b, a];
  return files.slice(start, end + 1).filter(isSelectable).map((f) => f.path);
}

export type CheckState = 'none' | 'some' | 'all';

/** A folder's checkbox: none, some or all of its selectable files are selected. */
export function folderCheck(folder: FolderNode, selection: ReadonlySet<string>): CheckState {
  const files = filesUnder(folder).filter(isSelectable);
  const n = files.filter((f) => selection.has(f.path)).length;
  return n === 0 ? 'none' : n === files.length ? 'all' : 'some';
}

export function folderPaths(node: TreeNode): string[] {
  return node.kind === 'file' ? [] : [node.path, ...node.children.flatMap(folderPaths)];
}

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

/** A row the file tree shows: what keyboard navigation moves between. */
export interface VisibleRow {
  path: string;
  kind: 'file' | 'folder';
  /** The folder it's in, `''` for the top level. */
  parent: string;
  open: boolean;
}

/** The rows on screen, in order: folders are followed by their children only when open. */
export function visibleRows(root: FolderNode, expanded: ReadonlySet<string>): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (folder: FolderNode) => {
    for (const node of folder.children) {
      const open = node.kind === 'folder' && expanded.has(node.path);
      rows.push({ path: node.path, kind: node.kind, parent: folder.path, open });
      if (node.kind === 'folder' && open) walk(node);
    }
  };
  walk(root);
  return rows;
}

/** What a key does in the tree (WAI-ARIA tree view pattern, design doc §7.4). */
export type TreeKeyAction =
  | { kind: 'focus'; path: string; extend: boolean }
  | { kind: 'expand' | 'collapse' | 'toggle'; path: string }
  | null;

export function treeKey(rows: readonly VisibleRow[], current: string, key: string, shift: boolean): TreeKeyAction {
  const i = Math.max(0, rows.findIndex((r) => r.path === current));
  const row = rows[i];
  if (!row) return null;
  const focus = (r: VisibleRow | undefined, extend = false): TreeKeyAction =>
    r ? { kind: 'focus', path: r.path, extend } : null;
  switch (key) {
    case 'ArrowDown':
      return focus(rows[i + 1], shift);
    case 'ArrowUp':
      return focus(rows[i - 1], shift);
    case 'Home':
      return focus(rows[0]);
    case 'End':
      return focus(rows[rows.length - 1]);
    case 'ArrowRight':
      if (row.kind !== 'folder') return null;
      return row.open
        ? focus(rows[i + 1]?.parent === row.path ? rows[i + 1] : undefined)
        : { kind: 'expand', path: row.path };
    case 'ArrowLeft':
      if (row.kind === 'folder' && row.open) return { kind: 'collapse', path: row.path };
      return row.parent ? focus(rows.find((r) => r.path === row.parent)) : null;
    case ' ':
    case 'Enter':
      return { kind: 'toggle', path: row.path };
    default:
      return null;
  }
}
