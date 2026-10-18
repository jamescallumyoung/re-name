// Scanning the source into the tree the webapp shows (design doc §7.1, §10; spec S1).

import { join, relative, SEPARATOR } from '@std/path';
import type { FileNode, FolderNode, SkipReason } from '@re-name/protocol';
import type { TagRules } from './naming/known-tags.ts';
import { isVideo, parsePath } from './naming/parse.ts';

export interface ScannedFile {
  /** Relative to the source, with `/` separators. */
  path: string;
  size: number;
  /** Milliseconds since the epoch, or null where the file system has none (spec S1.5). */
  mtime: number | null;
  skip: SkipReason | null;
}

/** The video files in a scan, by path. */
export type Scan = Map<string, ScannedFile>;

const isInside = (path: string, dir: string) => path === dir || path.startsWith(dir + SEPARATOR);

/**
 * Spec S1.1, S1.2, S1.5. `source` and `target` must be absolute, and `source` a
 * real path. Symbolic links are followed only to files inside the source:
 * following linked folders could loop.
 */
export async function scanSource(source: string, target: string, rules: TagRules): Promise<Scan> {
  const scan: Scan = new Map();
  const walk = async (dir: string): Promise<void> => {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (full === target) continue;
      let isFile = entry.isFile;
      if (entry.isSymlink) {
        const real = await Deno.realPath(full).catch(() => null);
        if (!real || !isInside(real, source)) continue;
        isFile = (await Deno.stat(real)).isFile;
      } else if (entry.isDirectory) {
        await walk(full);
        continue;
      }
      if (!isFile || !isVideo(entry.name)) continue;
      const path = relative(source, full).split(SEPARATOR).join('/');
      const info = await Deno.stat(full);
      scan.set(path, {
        path,
        size: info.size,
        mtime: info.mtime?.getTime() ?? null,
        skip: parsePath(path, rules).skip,
      });
    }
  };
  await walk(source);
  return scan;
}

/** Spec S1.3, S1.4: the tree, with each file's status. Folders without video files are left out. */
export function buildTree(sourceName: string, scan: Scan, queued: ReadonlyMap<string, string>): FolderNode {
  const root: FolderNode = { kind: 'folder', name: sourceName, path: '', children: [] };
  for (const file of scan.values()) {
    const parts = file.path.split('/');
    let folder = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join('/');
      let next = folder.children.find((c): c is FolderNode => c.kind === 'folder' && c.path === path);
      if (!next) folder.children.push(next = { kind: 'folder', name: parts[i] ?? '', path, children: [] });
      folder = next;
    }
    const jobId = queued.get(file.path);
    const node: FileNode = {
      kind: 'file',
      name: parts[parts.length - 1] ?? file.path,
      path: file.path,
      size: file.size,
      status: file.skip
        ? { state: 'skipped', reason: file.skip }
        : jobId
        ? { state: 'queued', jobId }
        : { state: 'available' },
    };
    folder.children.push(node);
  }
  const sort = (f: FolderNode) => {
    f.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
    for (const c of f.children) if (c.kind === 'folder') sort(c);
  };
  sort(root);
  return root;
}

/** Spec S1.6: a path from the webapp names a video file in the last scan. */
export function checkPath(path: unknown, scan: Scan): [true, ScannedFile] | [false, string] {
  if (typeof path !== 'string' || path === '' || path.startsWith('/') || /^[a-z]:/i.test(path)) {
    return [false, `Not a path inside the source: ${String(path)}`];
  }
  if (path.split('/').some((p) => p === '.' || p === '..' || p === '')) return [false, `Not a clean path: ${path}`];
  const file = scan.get(path);
  return file ? [true, file] : [false, `Not a video file in the source: ${path}`];
}
