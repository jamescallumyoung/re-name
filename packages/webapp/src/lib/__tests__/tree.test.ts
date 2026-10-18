import { describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import type { FileNode, FileStatus, FolderNode } from '@re-name/protocol';
import { filesUnder, folderCheck, folderPaths, formatBytes, isSelectable, rangeBetween } from '../tree.ts';

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
