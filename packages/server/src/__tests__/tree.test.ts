import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { dirname, join } from '@std/path';
import type { FolderNode, TreeNode } from '@re-name/protocol';
import { DEFAULT_KNOWN_TAGS, tagRules } from '../naming/known-tags.ts';
import { buildTree, checkPath, scanSource } from '../tree.ts';

const rules = tagRules(DEFAULT_KNOWN_TAGS);
let tmp = '';
let source = '';

async function write(path: string, text = 'x'): Promise<void> {
  await Deno.mkdir(dirname(join(source, path)), { recursive: true });
  await Deno.writeTextFile(join(source, path), text);
}

beforeEach(async () => {
  tmp = await Deno.realPath(await Deno.makeTempDir({ prefix: 're-name-test-' }));
  source = join(tmp, 'Downloads');
  await Deno.mkdir(source);
});
afterEach(() => Deno.remove(tmp, { recursive: true }));

const names = (node: TreeNode): string[] =>
  node.kind === 'file' ? [node.path] : [`${node.path}/`, ...node.children.flatMap(names)];

describe('scanSource and buildTree', () => {
  it('lists video files only, skipping hidden entries, the target and empty folders (S1.1, S1.2, S1.4)', async () => {
    await write('b.mkv');
    await write('A Movie/a.MP4', 'abc');
    await write('A Movie/a.nfo');
    await write('Notes/readme.txt');
    await write('.hidden/x.mkv');
    await write('._b.mkv');
    await write('processed/Old (2020)/old.mkv');
    const scan = await scanSource(source, join(source, 'processed'), rules);
    const tree = buildTree('Downloads', scan, new Map());
    expect(names(tree)).toEqual(['/', 'A Movie/', 'A Movie/a.MP4', 'b.mkv']);
    expect(scan.get('A Movie/a.MP4')?.size).toBe(3);
    expect(typeof scan.get('b.mkv')?.mtime).toBe('number');
  });

  it('gives each file its status: skipped, queued or available (S1.3)', async () => {
    await write('Show/Show.S01E01.mkv');
    await write('Show/Show.S01E02E03.mkv');
    await write('Show/Sample/clip.mkv');
    await write('Movie.cd1.avi');
    const scan = await scanSource(source, join(source, 'processed'), rules);
    const tree = buildTree('Downloads', scan, new Map([['Show/Show.S01E01.mkv', 'job-1']]));
    const files = (n: TreeNode): TreeNode[] => (n.kind === 'file' ? [n] : n.children.flatMap(files));
    expect(files(tree).map((f) => f.kind === 'file' && [f.path, f.status])).toEqual([
      ['Show/Sample/clip.mkv', { state: 'skipped', reason: 'sample' }],
      ['Show/Show.S01E01.mkv', { state: 'queued', jobId: 'job-1' }],
      ['Show/Show.S01E02E03.mkv', { state: 'skipped', reason: 'multi-episode' }],
      ['Movie.cd1.avi', { state: 'skipped', reason: 'split-part' }],
    ]);
    expect((tree.children[0] as FolderNode).name).toBe('Show');
  });

  it('follows symbolic links to files inside the source, and skips ones that lead out (S1.2)', async () => {
    if (Deno.build.os === 'windows') return;
    await write('real.mkv');
    await Deno.writeTextFile(join(tmp, 'outside.mkv'), 'x');
    await Deno.symlink(join(source, 'real.mkv'), join(source, 'link.mkv'));
    await Deno.symlink(join(tmp, 'outside.mkv'), join(source, 'escape.mkv'));
    const scan = await scanSource(source, join(source, 'processed'), rules);
    expect([...scan.keys()].sort()).toEqual(['link.mkv', 'real.mkv']);
  });
});

describe('checkPath', () => {
  it('accepts only clean relative paths to scanned video files (S1.6)', async () => {
    await write('Show/a.mkv');
    const scan = await scanSource(source, join(source, 'processed'), rules);
    expect(checkPath('Show/a.mkv', scan)[0]).toBe(true);
    for (const bad of ['/etc/passwd', 'C:/x.mkv', '../x.mkv', 'Show/../Show/a.mkv', 'Show//a.mkv', 'Show/b.mkv', 7]) {
      expect(checkPath(bad, scan)[0]).toBe(false);
    }
  });
});
