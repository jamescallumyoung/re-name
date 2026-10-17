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
