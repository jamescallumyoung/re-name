// Applying the Queue: check against the disk, then move and rename, stopping at the
// first error, and write a log (design doc §11; spec A1).

import { dirname, join } from '@std/path';
import type { ApplyResult, Queue, ServerEvent } from '@re-name/protocol';
import { HttpError } from './rpc.ts';
import type { State } from './state.ts';

export interface Notify {
  send(event: ServerEvent): void;
  applyFinished(): void;
}

type Outcome = 'moved' | 'would-move' | 'failed' | 'not-run';

interface Change {
  jobId: string;
  path: string;
  newPath: string;
  outcome: Outcome;
  error?: string;
}

/** Spec A1.1: what has changed on disk since the Queue was named. */
export async function checkQueue(state: State, queue: Queue): Promise<string[]> {
  const problems: string[] = [];
  const existing = new Set((await state.targetFiles()).map((p) => p.toLowerCase()));
  for (const job of queue.jobs) {
    for (const f of job.preview.files) {
      if (f.error || !f.newPath) {
        problems.push(`${f.path}: ${f.error ?? 'can’t be named'}`);
        continue;
      }
      const scanned = state.scan.get(f.path);
      const info = await Deno.stat(join(state.run.source, f.path)).catch(() => null);
      if (!scanned || !info) problems.push(`${f.path}: no longer in the source`);
      else if (info.size !== scanned.size || (scanned.mtime !== null && info.mtime?.getTime() !== scanned.mtime)) {
        problems.push(`${f.path}: changed since it was read`);
      }
      if (existing.has(f.newPath.toLowerCase())) problems.push(`${f.newPath}: already in the target`);
    }
  }
  return problems;
}

/**
 * Moves one file, creating its folders. A rename that only changes letter case
 * goes through a temporary name (spec A1.2–A1.4).
 */
export async function moveFile(from: string, to: string): Promise<void> {
  await Deno.mkdir(dirname(to), { recursive: true });
  const sameIgnoringCase = from !== to && from.toLowerCase() === to.toLowerCase();
  if (!sameIgnoringCase && (await Deno.lstat(to).catch(() => null))) {
    throw new Error('A file already has the new name: nothing was overwritten.');
  }
  try {
    if (sameIgnoringCase) {
      const temp = `${to}.re-name-${crypto.randomUUID().slice(0, 8)}`;
      await Deno.rename(from, temp);
      await Deno.rename(temp, to);
    } else {
      await Deno.rename(from, to);
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'EXDEV') {
      throw new Error('The target is on another drive, and re-name never copies.');
    }
    throw error;
  }
}

/**
 * Spec R7.5: checks the Queue against the disk, then starts the apply in the
 * background. A failed check is a 422, and nothing moves.
 */
export async function startApply(state: State, notify: Notify): Promise<void> {
  const queue = await state.queue();
  const problems = await checkQueue(state, queue);
  if (problems.length) {
    throw new HttpError(422, {
      error: 'disk-changed',
      message: 'Files changed on disk since they were read. Nothing was moved.',
      details: problems,
    });
  }
  state.applying = true;
  void runApply(state, queue, notify);
}

/** Spec A1.2–A1.8. */
async function runApply(state: State, queue: Queue, notify: Notify): Promise<void> {
  const { source, target, dryRun, stateDir } = state.run;
  const startedAt = new Date();
  const changes: Change[] = queue.jobs.flatMap((job) =>
    job.preview.files.map((f) => ({
      jobId: job.id,
      path: f.path,
      newPath: f.newPath ?? '',
      outcome: 'not-run' as Outcome,
    }))
  );
  let error: ApplyResult['error'] = null;
  try {
    for (const [index, change] of changes.entries()) {
      notify.send({
        type: 'apply-progress',
        progress: { jobId: change.jobId, path: change.path, newPath: change.newPath, index, total: changes.length },
      });
      if (dryRun) {
        change.outcome = 'would-move';
        continue;
      }
      try {
        await moveFile(join(source, change.path), join(target, change.newPath));
        change.outcome = 'moved';
      } catch (e) {
        change.outcome = 'failed';
        change.error = (e as Error).message;
        error = { path: change.path, message: change.error };
        break;
      }
    }

    if (!dryRun) {
      // Moved files leave their Jobs; Jobs left empty leave the Queue (A1.6).
      const moved = new Set(changes.filter((c) => c.outcome === 'moved').map((c) => c.path));
      state.jobs = state.jobs
        .map((j) => ({ ...j, draft: { ...j.draft, files: j.draft.files.filter((f) => !moved.has(f.path)) } }))
        .filter((j) => j.draft.files.length > 0);
      state.version++;
    }

    const logs = join(stateDir, 'logs');
    await Deno.mkdir(logs, { recursive: true });
    const logPath = join(logs, `apply-${startedAt.toISOString().slice(0, 19).replaceAll(':', '-')}.json`);
    await Deno.writeTextFile(
      logPath,
      JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          dryRun,
          options: state.options,
          source,
          target,
          changes,
          queueBefore: queue,
        },
        null,
        2,
      ),
    );

    await state.rescan();
    state.applying = false;
    notify.send({
      type: 'apply-done',
      result: {
        dryRun,
        moved: changes.filter((c) => c.outcome === 'moved' || c.outcome === 'would-move').length,
        total: changes.length,
        error,
        logPath,
        queue: await state.queue(),
        etag: state.etag,
      },
    });
  } finally {
    state.applying = false;
    notify.applyFinished();
  }
}
