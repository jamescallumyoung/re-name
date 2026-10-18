import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { FileNode, FileStatus, FolderNode } from '@re-name/protocol';
import {
  filesUnder,
  folderCheck,
  folderPaths,
  formatBytes,
  isSelectable,
  rangeBetween,
  treeKey,
  visibleRows,
} from '../tree.ts';

const f = (path: string, status: FileStatus = { state: 'available' }): FileNode => ({
  kind: 'file',
  name: path.slice(path.lastIndexOf('/') + 1),
  path,
  size: 1,
  status,
});

// Show/1.mkv, Show/2.mkv (queued), Show/3.mkv, Show/Extras/4.mkv (sample), 5.mkv
const show: FolderNode = {
  kind: 'folder',
  name: 'Show',
  path: 'Show',
  children: [
    f('Show/1.mkv'),
    f('Show/2.mkv', { state: 'queued', jobId: 'job-1' }),
    f('Show/3.mkv'),
    {
      kind: 'folder',
      name: 'Extras',
      path: 'Show/Extras',
      children: [f('Show/Extras/4.mkv', { state: 'skipped', reason: 'sample' })],
    },
  ],
};
const root: FolderNode = { kind: 'folder', name: 'Downloads', path: '', children: [show, f('5.mkv')] };

describe('tree', () => {
  it('lists every file under a node, in display order', () => {
    expect(filesUnder(root).map((x) => x.path)).toEqual([
      'Show/1.mkv',
      'Show/2.mkv',
      'Show/3.mkv',
      'Show/Extras/4.mkv',
      '5.mkv',
    ]);
  });

  it('only lets available files be selected', () => {
    expect(filesUnder(root).filter(isSelectable).map((x) => x.path)).toEqual(['Show/1.mkv', 'Show/3.mkv', '5.mkv']);
  });

  it('selects the selectable files between two paths, either way round (shift-click)', () => {
    expect(rangeBetween(root, 'Show/1.mkv', '5.mkv')).toEqual(['Show/1.mkv', 'Show/3.mkv', '5.mkv']);
    expect(rangeBetween(root, '5.mkv', 'Show/3.mkv')).toEqual(['Show/3.mkv', '5.mkv']);
    expect(rangeBetween(root, 'missing.mkv', '5.mkv')).toEqual(['5.mkv']);
  });

  it('shows a folder as none, some or all selected, counting selectable files only', () => {
    expect(folderCheck(show, new Set())).toBe('none');
    expect(folderCheck(show, new Set(['Show/1.mkv']))).toBe('some');
    expect(folderCheck(show, new Set(['Show/1.mkv', 'Show/3.mkv']))).toBe('all');
  });

  it('lists every folder path', () => {
    expect(folderPaths(root)).toEqual(['', 'Show', 'Show/Extras']);
  });

  it('formats sizes', () => {
    expect(formatBytes(15.8e9)).toBe('15.8 GB');
    expect(formatBytes(350e6)).toBe('350 MB');
    expect(formatBytes(900)).toBe('1 KB');
  });
});

describe('keyboard navigation (design doc §7.4)', () => {
  const rows = visibleRows(root, new Set(['Show']));

  it('lists the rows on screen, opening only expanded folders', () => {
    expect(rows.map((r) => r.path)).toEqual(['Show', 'Show/1.mkv', 'Show/2.mkv', 'Show/3.mkv', 'Show/Extras', '5.mkv']);
    expect(visibleRows(root, new Set()).map((r) => r.path)).toEqual(['Show', '5.mkv']);
  });

  it('moves up and down, extending with Shift, and jumps with Home and End', () => {
    expect(treeKey(rows, 'Show/1.mkv', 'ArrowDown', false)).toEqual({
      kind: 'focus',
      path: 'Show/2.mkv',
      extend: false,
    });
    expect(treeKey(rows, 'Show/1.mkv', 'ArrowUp', true)).toEqual({ kind: 'focus', path: 'Show', extend: true });
    expect(treeKey(rows, '5.mkv', 'ArrowDown', false)).toBe(null);
    expect(treeKey(rows, 'Show/3.mkv', 'Home', false)).toEqual({ kind: 'focus', path: 'Show', extend: false });
    expect(treeKey(rows, 'Show', 'End', false)).toEqual({ kind: 'focus', path: '5.mkv', extend: false });
  });

  it('expands and enters folders with Right, and collapses or climbs with Left', () => {
    expect(treeKey(rows, 'Show/Extras', 'ArrowRight', false)).toEqual({ kind: 'expand', path: 'Show/Extras' });
    expect(treeKey(rows, 'Show', 'ArrowRight', false)).toEqual({ kind: 'focus', path: 'Show/1.mkv', extend: false });
    expect(treeKey(rows, 'Show', 'ArrowLeft', false)).toEqual({ kind: 'collapse', path: 'Show' });
    expect(treeKey(rows, 'Show/2.mkv', 'ArrowLeft', false)).toEqual({ kind: 'focus', path: 'Show', extend: false });
    expect(treeKey(rows, '5.mkv', 'ArrowLeft', false)).toBe(null);
  });

  it('toggles with Space and Enter', () => {
    expect(treeKey(rows, 'Show/1.mkv', ' ', false)).toEqual({ kind: 'toggle', path: 'Show/1.mkv' });
    expect(treeKey(rows, 'Show', 'Enter', false)).toEqual({ kind: 'toggle', path: 'Show' });
  });
});
