// The lock: one file per run in the state folder, so two runs never work on
// overlapping folders (design doc §5.2; spec L1).

import { join, SEPARATOR } from '@std/path';

const REFRESH_MS = 30_000;
const STALE_MS = 120_000;

interface LockFile {
  source: string;
  pid: number;
  updatedAt: number;
}

export interface Lock {
  /** Spec L1.3. */
  release(): Promise<void>;
}

const inside = (a: string, b: string) => a === b || a.startsWith(b.endsWith(SEPARATOR) ? b : b + SEPARATOR);

/** Spec L1.1, L1.2. `source` must be a real path. */
export async function acquireLock(
  stateDir: string,
  source: string,
  pid: number = Deno.pid,
  now: () => number = Date.now,
): Promise<[true, Lock] | [false, string]> {
  const dir = join(stateDir, 'locks');
  await Deno.mkdir(dir, { recursive: true });
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith('.json') || entry.name === `${pid}.json`) continue;
    const path = join(dir, entry.name);
    let other: LockFile;
    try {
      other = JSON.parse(await Deno.readTextFile(path));
    } catch {
      continue;
    }
    if (now() - other.updatedAt > STALE_MS) {
      await Deno.remove(path).catch(() => {});
      continue;
    }
    if (inside(source, other.source) || inside(other.source, source)) {
      return [false, `Another re-name (process ${other.pid}) is already working on ${other.source}.`];
    }
  }

  const file = join(dir, `${pid}.json`);
  const write = () => Deno.writeTextFile(file, JSON.stringify({ source, pid, updatedAt: now() } satisfies LockFile));
  await write();
  const timer = setInterval(() => void write().catch(() => {}), REFRESH_MS);
  Deno.unrefTimer(timer);
  return [true, {
    release: async () => {
      clearInterval(timer);
      await Deno.remove(file).catch(() => {});
    },
  }];
}
