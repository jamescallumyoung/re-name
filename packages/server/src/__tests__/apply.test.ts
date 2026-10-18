import { afterEach, describe, it } from '@std/testing/bdd';
import { expect } from '@std/expect';
import { dirname, join } from '@std/path';
import type { ApplyResult, ServerEvent } from '@re-name/protocol';
import { moveFile, startApply } from '../apply.ts';
import { handlers, HttpError } from '../rpc.ts';
import { draftOf, DUNE, makeWorld, SEVERANCE_S01, type World } from './helpers.ts';

let world: World | undefined;
afterEach(async () => {
  await world?.cleanup();
  world = undefined;
});

/** A world with Dune and Severance S01 queued, and a way to apply and wait for the result. */
async function setUp(opts: { dryRun?: boolean } = {}) {
  world = await makeWorld(opts);
  const events: ServerEvent[] = [];
  let done!: (r: ApplyResult) => void;
  const finished = new Promise<ApplyResult>((r) => (done = r));
  const notify = {
    send: (e: ServerEvent) => {
      events.push(e);
      if (e.type === 'apply-done') done(e.result);
    },
    applyFinished: () => {},
  };
  const state = world.state;
  const rpc = handlers(state, () => startApply(state, notify));
  await rpc['queue.addJob']!({ draft: draftOf('movie', 693134, DUNE) });
  await rpc['queue.addJob']!({ draft: draftOf('tv', 95396, SEVERANCE_S01.slice(0, 2)) });
  return { w: world, rpc, events, finished };
}

const exists = (path: string) => Deno.stat(path).then(() => true, () => false);

describe('applying the Queue', () => {
  it('moves every file into its new folders, logs it, and empties the Queue (A1.2, A1.5–A1.8)', async () => {
    const { w, rpc, events, finished } = await setUp();
    expect(await rpc['queue.apply']!({})).toEqual({ started: true });
    const result = await finished;
    expect([result.moved, result.total, result.error, result.queue.jobs.length]).toEqual([4, 4, null, 0]);
    expect(
      await exists(join(
        w.target,
        'Severance (2022) {tmdb-95396}/Season 01/Severance (2022) - S01E01 - Good News About Hell [1080p WEB-DL ATVP DDP5.1 H.264 -NTb].mkv',
      )),
    ).toBe(true);
    expect(await exists(join(w.target, 'Dune_ Part Two (2024) {tmdb-693134}'))).toBe(true);
    for (const path of [...DUNE, ...SEVERANCE_S01.slice(0, 2)]) expect(await exists(join(w.source, path))).toBe(false);
    expect(events.filter((e) => e.type === 'apply-progress').length).toBe(4);
    const log = JSON.parse(await Deno.readTextFile(result.logPath));
    expect(log.changes.map((c: { outcome: string }) => c.outcome)).toEqual(['moved', 'moved', 'moved', 'moved']);
    expect(log.queueBefore.jobs.length).toBe(2);
    expect(w.state.applying).toBe(false);
  });

  it('moves nothing in a dry run, and keeps the Queue (A1.6)', async () => {
    const { w, rpc, finished } = await setUp({ dryRun: true });
    await rpc['queue.apply']!({});
    const result = await finished;
    expect([result.dryRun, result.moved, result.queue.jobs.length]).toEqual([true, 4, 2]);
    expect(await exists(join(w.source, DUNE[0]!))).toBe(true);
    expect(await exists(join(w.target, 'Dune_ Part Two (2024) {tmdb-693134}'))).toBe(false);
  });

  it('refuses when a queued file changed, moving nothing (A1.1)', async () => {
    const { w, rpc } = await setUp();
    await Deno.writeTextFile(join(w.source, DUNE[0]!), 'a different size now');
    const error = await rpc['queue.apply']!({}).catch((e: HttpError) => e) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect([error.status, error.body.error, error.body.details]).toEqual([
      422,
      'disk-changed',
      [`${DUNE[0]}: changed since it was read`],
    ]);
    expect(await exists(join(w.source, DUNE[1]!))).toBe(true);
  });

  it('refuses when a file has appeared at a new name, rather than renumbering (A1.1)', async () => {
    const { w, rpc } = await setUp();
    const queue = await w.state.queue();
    const newPath = queue.jobs[0]!.preview.files[0]!.newPath!;
    await Deno.mkdir(dirname(join(w.target, newPath)), { recursive: true });
    await Deno.writeTextFile(join(w.target, newPath), 'already here');
    const error = await rpc['queue.apply']!({}).catch((e: HttpError) => e) as HttpError;
    expect(error.body.details).toEqual([`${newPath}: already in the target`]);
  });

  it('stops at the first error, splitting the Job, and keeps the rest queued (A1.6)', async () => {
    if (Deno.build.os === 'windows') return;
    const { w, rpc, finished } = await setUp();
    // Make the second Job's season folder unwritable, so its first file fails.
    const season = join(w.target, 'Severance (2022) {tmdb-95396}', 'Season 01');
    await Deno.mkdir(season, { recursive: true });
    await Deno.chmod(season, 0o500);
    await w.state.rescan();
    await rpc['queue.apply']!({});
    const result = await finished;
    await Deno.chmod(season, 0o755);
    expect(result.moved).toBe(2);
    expect(result.error?.path).toBe(SEVERANCE_S01[0]);
    expect(result.queue.jobs.map((j) => [j.id, j.draft.files.length])).toEqual([['job-2', 2]]);
    const log = JSON.parse(await Deno.readTextFile(result.logPath));
    expect(log.changes.map((c: { outcome: string }) => c.outcome)).toEqual(['moved', 'moved', 'failed', 'not-run']);
  });
});

describe('moveFile', () => {
  it('renames a change of letter case only through a temporary name (A1.3)', async () => {
    world = await makeWorld();
    const from = join(world.tmp, 'the matrix.mkv');
    await Deno.writeTextFile(from, 'x');
    await moveFile(from, join(world.tmp, 'The Matrix.mkv'));
    const names = [...Deno.readDirSync(world.tmp)].map((e) => e.name);
    expect(names).toContain('The Matrix.mkv');
    expect(names).not.toContain('the matrix.mkv');
  });

  it('never overwrites an existing file (A1.4)', async () => {
    world = await makeWorld();
    await Deno.writeTextFile(join(world.tmp, 'a.mkv'), 'a');
    await Deno.writeTextFile(join(world.tmp, 'b.mkv'), 'b');
    await expect(moveFile(join(world.tmp, 'a.mkv'), join(world.tmp, 'b.mkv'))).rejects.toThrow(
      'nothing was overwritten',
    );
    expect(await Deno.readTextFile(join(world.tmp, 'b.mkv'))).toBe('b');
  });
});
