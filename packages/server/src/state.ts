// The run's state: options, the Queue, the last scan, and TMDB details seen so far
// (design doc §8.1). Only the server holds it; the webapp holds the draft Job.

import { basename, join, relative, SEPARATOR } from '@std/path';
import type { Details, MediaType, Options, Queue, SessionInfo } from '@re-name/protocol';
import type { TagRules } from './naming/known-tags.ts';
import { nameQueue, type QueuedDraft } from './naming/names.ts';
import type { Tmdb } from './tmdb.ts';
import { type Scan, scanSource } from './tree.ts';

export interface Run {
  /** The source's real path. */
  source: string;
  /** The target's absolute path. */
  target: string;
  dryRun: boolean;
  rules: TagRules;
  tmdb: Tmdb;
  /** The state folder, where apply logs go. */
  stateDir: string;
}

export class State {
  options: Options;
  optionsChosen = false;
  jobs: QueuedDraft[] = [];
  /** Goes up with every change to the Queue or the options (spec R1.1). */
  version = 1;
  scan: Scan = new Map();
  /**
   * The target's files at the last scan. Names are worked out against this, not the
   * live folder, so a file appearing later is caught by the apply's check rather
   * than silently renumbering `DUP-{n}` (spec A1.1).
   */
  targetSnapshot: string[] = [];
  applying = false;
  private nextJob = 1;
  private readonly titles = new Map<string, Details>();

  constructor(readonly run: Run, flavour: Options['flavour']) {
    this.options = { flavour, includeEpisodeName: true };
  }

  get etag(): string {
    return `"q-${this.version}"`;
  }

  newJobId(): string {
    return `job-${this.nextJob++}`;
  }

  session(): SessionInfo {
    const { source, target, dryRun } = this.run;
    const inside = target.startsWith(source + SEPARATOR);
    return {
      sourceName: basename(source),
      sourcePath: source,
      targetPath: target,
      targetName: inside ? relative(source, target).split(SEPARATOR).join('/') : target,
      dryRun,
      optionsChosen: this.optionsChosen,
    };
  }

  async rescan(): Promise<void> {
    this.scan = await scanSource(this.run.source, this.run.target, this.run.rules);
    this.targetSnapshot = await this.targetFiles();
  }

  /** Each queued path's Job, leaving out `exceptJob`'s. */
  queued(exceptJob: string | null = null): Map<string, string> {
    const map = new Map<string, string>();
    for (const job of this.jobs) {
      if (job.id !== exceptJob) { for (const f of job.draft.files) map.set(f.path, job.id); }
    }
    return map;
  }

  /** TMDB details, fetched once per run. */
  async details(type: MediaType, tmdbId: number): Promise<Details> {
    const key = `${type}/${tmdbId}`;
    let d = this.titles.get(key);
    if (!d) this.titles.set(key, d = await this.run.tmdb.details(type, tmdbId));
    return d;
  }

  /** Names a list of Jobs against what's already in the target (spec N1.9). */
  async name(jobs: readonly QueuedDraft[]) {
    for (const job of jobs) await this.details(job.draft.type, job.draft.tmdbId).catch(() => {});
    return nameQueue(
      jobs,
      this.options,
      this.targetSnapshot,
      (type, id) => this.titles.get(`${type}/${id}`),
      this.run.rules,
    );
  }

  /** The Queue, with every Job's preview (spec R7.1). */
  async queue(): Promise<Queue> {
    const previews = await this.name(this.jobs);
    return {
      jobs: this.jobs.map(({ id, draft }) => {
        const d = this.titles.get(`${draft.type}/${draft.tmdbId}`);
        return {
          id,
          draft,
          match: d
            ? { type: d.type, tmdbId: d.tmdbId, title: d.title, year: d.year, posterUrl: d.posterUrl }
            : { type: draft.type, tmdbId: draft.tmdbId, title: 'Unknown', year: 0, posterUrl: null },
          preview: previews.get(id) ?? { files: [], ok: false },
        };
      }),
    };
  }

  /** Every file already in the target, relative to it, with `/` separators. */
  async targetFiles(): Promise<string[]> {
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for await (const e of Deno.readDir(dir)) {
        const full = join(dir, e.name);
        if (e.isDirectory) await walk(full);
        else files.push(relative(this.run.target, full).split(SEPARATOR).join('/'));
      }
    };
    await walk(this.run.target).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
    return files;
  }
}
