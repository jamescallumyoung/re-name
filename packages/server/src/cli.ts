// The command line (design doc §4; spec C1).

import { parseArgs } from 'node:util';
import { dirname, isAbsolute, join, parse as parsePath, resolve } from '@std/path';

export const VERSION = '0.1.0';

export const USAGE = `Usage: re-name [source] [options]

Renames and moves movie and TV files into the folders Plex, Jellyfin or Emby
expect, matched against TMDB. Opens its interface in your browser.

  source            The folder to rename files from. Default: the current folder.

Options:
  --target <dir>    Where renamed files are moved. Default: <source>/processed.
                    It must be on the same drive as the source.
  --no-open         Print the address instead of opening the browser.
  --port <n>        Listen on this port. Default: any free port.
  --dry-run         Applying the Queue reports what it would do, and moves nothing.
  --version         Print the version.
  --help            Print this help.`;

export interface Args {
  source: string;
  target: string;
  open: boolean;
  /** 0 picks a free port. */
  port: number;
  dryRun: boolean;
}

export type Cli = { run: Args } | { exit: number; message: string };

/** Spec C1.1, C1.2. */
export function parseCli(argv: readonly string[], cwd: string): Cli {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        target: { type: 'string' },
        'no-open': { type: 'boolean', default: false },
        port: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    // Keep the first sentence: node:util's advice about `--` doesn't apply here.
    return { exit: 2, message: `${(error as Error).message.replace(/\. To specify .*$/s, '.')}\n\n${USAGE}` };
  }
  const { values, positionals } = parsed;
  if (values.help) return { exit: 0, message: USAGE };
  if (values.version) return { exit: 0, message: `re-name ${VERSION}` };
  if (positionals.length > 1) return { exit: 2, message: `Only one source folder can be given.\n\n${USAGE}` };
  let port = 0;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!/^\d+$/.test(values.port) || port < 1 || port > 65535) {
      return { exit: 2, message: `--port must be a number from 1 to 65535.\n\n${USAGE}` };
    }
  }
  const source = resolve(cwd, positionals[0] ?? '.');
  const target = values.target === undefined ? join(source, 'processed') : resolve(cwd, values.target);
  return { run: { source, target, open: !values['no-open'], port, dryRun: values['dry-run'] } };
}

/**
 * Spec C1.3: the source is an existing folder, and the target (or its nearest
 * existing parent) is on the same drive, so moves are renames.
 */
export async function checkFolders(source: string, target: string): Promise<[true] | [false, string]> {
  const src = await Deno.stat(source).catch(() => null);
  if (!src?.isDirectory) return [false, `The source folder doesn't exist: ${source}`];
  let existing = target;
  let info = await Deno.stat(existing).catch(() => null);
  while (!info) {
    const parent = dirname(existing);
    if (parent === existing) return [false, `No part of the target path exists: ${target}`];
    existing = parent;
    info = await Deno.stat(existing).catch(() => null);
  }
  if (!info.isDirectory) return [false, `The target isn't a folder: ${existing}`];
  const sameDrive = src.dev && info.dev
    ? src.dev === info.dev
    : volumeRoot(await Deno.realPath(source)) === volumeRoot(await Deno.realPath(existing));
  if (!sameDrive) {
    return [false, `The target must be on the same drive as the source, so files are moved, never copied: ${target}`];
  }
  return [true];
}

/** A path's drive or share root, for Windows, where `dev` may be missing. */
function volumeRoot(path: string): string {
  return (isAbsolute(path) ? parsePath(path).root : '').toLowerCase();
}
