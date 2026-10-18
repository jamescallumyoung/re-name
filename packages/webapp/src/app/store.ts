// The store: the webapp's single state object, as in Loadout. It holds the view
// state and the one draft Job; the server holds everything else (design doc,
// section 8.1), so the store mostly mirrors what the server returns. It emits
// `change` after every update. It never imports Lit.

import type {
  ApplyProgress,
  ApplyResult,
  FolderNode,
  Job,
  Match,
  MediaType,
  Options,
  Queue,
  ServerEvent,
  SessionInfo,
} from '@re-name/protocol';
import { type ApiClient, type EventStream, RpcError } from '../api/client.ts';
import { type Draft, likelySeason, newDraft, type Step, stepsOf, tagKey, toDraftJob } from '../lib/draft.ts';
import { filesUnder, folderPaths, isSelectable, rangeBetween } from '../lib/tree.ts';

export type Phase = 'connecting' | 'ready' | 'blocked' | 'stopped';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'info' | 'bad';
}

/** A question waiting for the user: discard the draft, remove a Job, or apply. */
export type Pending =
  | { kind: 'discard-draft'; then: 'new-job' | { editJobId: string } | 'close' }
  | { kind: 'remove-job'; job: Job }
  | { kind: 'apply' };

export interface ApplyState {
  progress: ApplyProgress | null;
  result: ApplyResult | null;
}

const TAB_KEY = 're-name.tab';
/** How long without a heartbeat before the connection counts as lost: about two missed beats. */
const HEARTBEAT_TIMEOUT = 12_000;

export class Store extends EventTarget {
  phase: Phase = 'connecting';
  /** Why the page is blocked or stopped, in plain words. */
  reason = '';
  session: SessionInfo | null = null;
  options: Options = { flavour: 'plex', includeEpisodeName: true };
  tree: FolderNode | null = null;
  queue: Queue = { jobs: [] };

  /** The settings modal, reopened from the header (view state). */
  settingsOpen = false;
  /** Whether the draft Job's modal is showing; minimising it keeps the draft (view state). */
  draftOpen = false;
  selection = new Set<string>();
  private anchor: string | null = null;
  expanded = new Set<string>();

  draft: Draft | null = null;
  pending: Pending | null = null;
  apply: ApplyState | null = null;
  /** An apply that was refused, such as files changed on disk. */
  applyError: { message: string; details: string[] } | null = null;
  busy = false;
  toasts: Toast[] = [];
  lastHeartbeat = Date.now();
  private stream: EventStream | null = null;
  /** Whether the server's heartbeats are arriving (design doc, section 8.5). */
  connection: 'connected' | 'reconnecting' = 'connected';

  private toastId = 0;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private previewSeq = 0;

  constructor(private readonly api: ApiClient, private readonly tab: Storage) {
    super();
  }

  private emit(): void {
    this.dispatchEvent(new Event('change'));
  }

  // ---------- session ----------

  async start(): Promise<void> {
    let tabId = this.tab.getItem(TAB_KEY);
    if (tabId === null) {
      tabId = crypto.randomUUID();
      this.tab.setItem(TAB_KEY, tabId);
    }
    const token = new URLSearchParams(location.search).get('t') ?? undefined;
    try {
      const claim = await this.api.call('session.claim', token ? { tabId, token } : { tabId });
      this.session = claim.session;
      this.options = claim.options;
      this.queue = claim.queue;
      // The launch token has done its job: the session cookie replaces it.
      if (token) history.replaceState(history.state, '', location.pathname + location.hash);
    } catch (error) {
      this.phase = 'blocked';
      this.reason = error instanceof RpcError && error.status === 409
        ? 're-name is already open in another tab. Use that tab, or close it and reload this one.'
        : error instanceof RpcError && error.status === 403
        ? 'This page wasn’t opened by re-name. Start re-name from your terminal to get a working link.'
        : error instanceof Error
        ? error.message
        : String(error);
      this.emit();
      return;
    }
    this.stream = this.api.listen((e) => this.onEvent(e), () => this.setConnection('reconnecting'));
    // No heartbeat for a while means the connection is in trouble, even if the stream hasn't closed.
    setInterval(() => {
      if (Date.now() - this.lastHeartbeat > HEARTBEAT_TIMEOUT) this.setConnection('reconnecting');
    }, 2000);
    await this.loadTree();
    this.phase = 'ready';
    this.expanded = new Set(folderPaths(this.tree as FolderNode).filter((p) => p.split('/').length === 1));
    this.emit();
  }

  /** The page is closing: tell the server (design doc, section 8.5). */
  end(): void {
    void this.api.call('session.end', {}).catch(() => {});
  }

  private setConnection(state: Store['connection']): void {
    if (state === this.connection) return;
    this.connection = state;
    if (state === 'connected') this.toast('Reconnected to the re-name server.', 'ok');
    this.emit();
  }

  private onEvent(event: ServerEvent): void {
    switch (event.type) {
      case 'heartbeat':
        this.lastHeartbeat = Date.now();
        this.setConnection('connected');
        return;
      case 'apply-progress':
        this.apply = { progress: event.progress, result: null };
        break;
      case 'apply-done':
        this.apply = { progress: null, result: event.result };
        this.queue = event.result.queue;
        this.api.etag = event.result.etag;
        void this.loadTree();
        break;
      case 'shutting-down':
        this.stop('re-name was stopped from the terminal. You can close this tab.');
        break;
      case 'taken-over':
        this.stop('re-name was opened in another tab, which now has the session.');
        break;
    }
    this.emit();
  }

  /** The session is over: stop listening, so the stream doesn't reconnect and take it back. */
  private stop(reason: string): void {
    this.phase = 'stopped';
    this.reason = reason;
    this.stream?.close();
    this.stream = null;
  }

  /** Reads the source again, on request (design doc §7.1). */
  async refreshTree(): Promise<void> {
    try {
      await this.loadTree();
    } catch (error) {
      this.report(error);
    }
  }

  private async loadTree(): Promise<void> {
    const { root } = await this.api.call('tree.get', {});
    this.tree = root;
    // Files that left the tree, or became unselectable, leave the selection.
    const selectable = new Set(filesUnder(root).filter(isSelectable).map((f) => f.path));
    this.selection = new Set([...this.selection].filter((p) => selectable.has(p)));
    this.emit();
  }

  // ---------- toasts ----------

  toast(text: string, tone: Toast['tone'] = 'info'): void {
    const toast = { id: ++this.toastId, text, tone };
    this.toasts = [...this.toasts, toast];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t !== toast);
      this.emit();
    }, tone === 'bad' ? 7000 : 3500);
  }

  private report(error: unknown): void {
    this.toast(error instanceof Error ? error.message : String(error), 'bad');
  }

  /**
   * Runs a command that changes the Queue. A stale ETag (412) fetches the Queue
   * again and retries once (design doc, section 8.4).
   */
  private async queueCommand<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof RpcError && error.stale)) throw error;
      this.queue = await this.api.call('queue.get', {});
      this.toast('The Queue had changed, so it was refreshed.', 'info');
      return await run();
    }
  }

  // ---------- view ----------

  openSettings(): void {
    this.settingsOpen = true;
    this.emit();
  }

  closeSettings(): void {
    this.settingsOpen = false;
    this.emit();
  }

  /** Hides the draft Job's modal without discarding the draft. */
  minimiseDraft(): void {
    this.draftOpen = false;
    this.emit();
  }

  resumeDraft(): void {
    if (this.draft) this.draftOpen = true;
    this.emit();
  }

  // ---------- options ----------

  /** The options are asked for once, up front (design doc, section 9.7); this can't be dismissed. */
  get setupOpen(): boolean {
    return this.phase === 'ready' && this.session !== null && !this.session.optionsChosen;
  }

  async chooseOptions(options: Options): Promise<void> {
    if ((await this.setOptions(options)) && this.session) {
      this.session = { ...this.session, optionsChosen: true };
      this.settingsOpen = false;
    }
    this.emit();
  }

  /** Changing an option renames every queued file, so it changes the Queue. */
  async setOptions(change: Partial<Options>): Promise<boolean> {
    const next = { ...this.options, ...change };
    try {
      const result = await this.queueCommand(() => this.api.call('options.set', next));
      this.options = result.options;
      this.queue = result.queue;
      if (this.draft) this.schedulePreview();
      return true;
    } catch (error) {
      this.report(error);
      return false;
    } finally {
      this.emit();
    }
  }

  // ---------- the explorer ----------

  toggleFile(path: string, shift: boolean): void {
    if (!this.tree) return;
    if (shift && this.anchor !== null) {
      const range = rangeBetween(this.tree, this.anchor, path);
      const select = !this.selection.has(path);
      for (const p of range) select ? this.selection.add(p) : this.selection.delete(p);
    } else {
      this.selection.has(path) ? this.selection.delete(path) : this.selection.add(path);
    }
    this.anchor = path;
    this.selection = new Set(this.selection);
    this.emit();
  }

  toggleFolder(folder: FolderNode): void {
    const files = filesUnder(folder).filter(isSelectable).map((f) => f.path);
    const all = files.every((p) => this.selection.has(p));
    for (const p of files) all ? this.selection.delete(p) : this.selection.add(p);
    this.selection = new Set(this.selection);
    this.emit();
  }

  selectAll(): void {
    if (!this.tree) return;
    this.selection = new Set(filesUnder(this.tree).filter(isSelectable).map((f) => f.path));
    this.emit();
  }

  clearSelection(): void {
    this.selection = new Set();
    this.anchor = null;
    this.emit();
  }

  toggleExpanded(path: string): void {
    this.expanded.has(path) ? this.expanded.delete(path) : this.expanded.add(path);
    this.expanded = new Set(this.expanded);
    this.emit();
  }

  setAllExpanded(open: boolean): void {
    this.expanded = new Set(open && this.tree ? folderPaths(this.tree) : []);
    this.emit();
  }

  // ---------- starting, editing and leaving a draft ----------

  /** Starts a draft Job from the selection, or asks to discard the current draft. */
  async newJob(): Promise<void> {
    if (this.draft) {
      this.pending = { kind: 'discard-draft', then: 'new-job' };
      this.emit();
      return;
    }
    const files = [...this.selection];
    if (files.length === 0) return;
    await this.openDraft(files, null);
  }

  async editJob(jobId: string): Promise<void> {
    if (this.draft) {
      this.pending = { kind: 'discard-draft', then: { editJobId: jobId } };
      this.emit();
      return;
    }
    const job = this.queue.jobs.find((j) => j.id === jobId);
    if (job) await this.openDraft(job.draft.files.map((f) => f.path), job);
  }

  private async openDraft(paths: string[], job: Job | null): Promise<void> {
    this.busy = true;
    this.emit();
    try {
      const files = await this.api.call(
        'job.analyseFiles',
        job ? { files: paths, forJobId: job.id } : { files: paths },
      );
      const draft = newDraft(files);
      this.draft = draft;
      this.draftOpen = true;
      if (job) {
        // Fill in what the approved Job chose, so only small changes are needed.
        draft.editingJobId = job.id;
        for (const f of job.draft.files) {
          draft.episodes[f.path] = { season: f.season, episode: f.episode };
          draft.groups[f.path] = [...f.groups];
          const analysed = files.find((a) => a.path === f.path);
          for (const choice of f.tags) {
            const tag = analysed?.tags.find((t) => t.source === choice.source);
            if (tag && tag.value !== choice.value) {
              draft.cells[f.path] = { ...draft.cells[f.path], [tagKey(tag)]: choice.value };
            }
          }
        }
        await this.chooseMatch(job.match, true);
        draft.step = 'tags';
      } else {
        this.selection = new Set();
        void this.loadSuggestions();
      }
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  /** Discarding asks first (design doc, section 7.2). */
  closeDraft(): void {
    this.pending = { kind: 'discard-draft', then: 'close' };
    this.emit();
  }

  // ---------- questions ----------

  async answer(yes: boolean): Promise<void> {
    const pending = this.pending;
    this.pending = null;
    this.emit();
    if (!yes || !pending) return;
    switch (pending.kind) {
      case 'discard-draft':
        this.draft = null;
        this.draftOpen = false;
        if (pending.then === 'new-job') await this.newJob();
        else if (pending.then !== 'close') await this.editJob(pending.then.editJobId);
        break;
      case 'remove-job':
        await this.removeJob(pending.job.id);
        break;
      case 'apply':
        await this.startApply();
        break;
    }
    this.emit();
  }

  askRemoveJob(job: Job): void {
    this.pending = { kind: 'remove-job', job };
    this.emit();
  }

  askApply(): void {
    this.applyError = null;
    this.pending = { kind: 'apply' };
    this.emit();
  }

  // ---------- matching ----------

  private async loadSuggestions(): Promise<void> {
    const draft = this.draft;
    if (!draft) return;
    try {
      const suggestions = await this.api.call('tmdb.getSuggestions', { files: draft.files.map((f) => f.path) });
      if (this.draft !== draft) return;
      draft.suggestions = suggestions;
      if (!draft.searchQuery) draft.searchQuery = draft.files[0]?.parsedTitle ?? '';
    } catch (error) {
      this.report(error);
      draft.suggestions = [];
    }
    this.emit();
  }

  setSearch(query: string, type: MediaType | 'all'): void {
    if (!this.draft) return;
    this.draft.searchQuery = query;
    this.draft.searchType = type;
    this.emit();
  }

  async search(): Promise<void> {
    const draft = this.draft;
    if (!draft || !draft.searchQuery.trim()) return;
    draft.searching = true;
    this.emit();
    try {
      const params = draft.searchType === 'all'
        ? { query: draft.searchQuery }
        : { query: draft.searchQuery, type: draft.searchType };
      draft.searchResults = await this.api.call('tmdb.search', params);
    } catch (error) {
      this.report(error);
    } finally {
      draft.searching = false;
      this.emit();
    }
  }

  async chooseMatch(match: Match, keepEpisodes = false): Promise<void> {
    const draft = this.draft;
    if (!draft) return;
    draft.match = match;
    draft.details = null;
    this.emit();
    try {
      const details = await this.api.call('tmdb.getDetails', { type: match.type, tmdbId: match.tmdbId });
      if (this.draft !== draft || draft.match !== match) return;
      draft.details = details;
      if (match.type === 'tv' && !keepEpisodes) {
        for (const f of draft.files) {
          draft.episodes[f.path] = { season: likelySeason(f, details), episode: f.episode };
        }
      }
      this.schedulePreview(0);
    } catch (error) {
      this.report(error);
    }
    this.emit();
  }

  // ---------- steps ----------

  goToStep(step: Step): void {
    if (!this.draft || !this.draft.match || !stepsOf(this.draft).includes(step)) return;
    this.draft.step = step;
    this.emit();
  }

  nextStep(): void {
    if (!this.draft) return;
    const steps = stepsOf(this.draft);
    const next = steps[steps.indexOf(this.draft.step) + 1];
    if (next) this.goToStep(next);
  }

  previousStep(): void {
    if (!this.draft) return;
    const steps = stepsOf(this.draft);
    const previous = steps[steps.indexOf(this.draft.step) - 1];
    if (previous) this.goToStep(previous);
  }

  // ---------- seasons and episodes ----------

  setEpisode(path: string, change: { season?: number | null; episode?: number | null }): void {
    if (!this.draft) return;
    const current = this.draft.episodes[path] ?? { season: null, episode: null };
    this.draft.episodes[path] = { ...current, ...change };
    this.schedulePreview();
    this.emit();
  }

  setFolderSeason(paths: string[], season: number | null): void {
    for (const p of paths) this.setEpisode(p, { season });
  }

  // ---------- tags ----------

  /** Sets a column's value for every file; `undefined` goes back to the default. */
  setColumn(key: string, value: string | null | undefined): void {
    const draft = this.draft;
    if (!draft) return;
    if (value === undefined) delete draft.columns[key];
    else draft.columns[key] = value;
    // A column value replaces the cells' own values.
    for (const cells of Object.values(draft.cells)) delete cells[key];
    draft.columns = { ...draft.columns };
    this.schedulePreview();
    this.emit();
  }

  /** Sets one file's value; `undefined` goes back to the column's. */
  setCell(path: string, key: string, value: string | null | undefined): void {
    const draft = this.draft;
    if (!draft) return;
    const cells = { ...draft.cells[path] };
    if (value === undefined) delete cells[key];
    else cells[key] = value;
    draft.cells = { ...draft.cells, [path]: cells };
    this.schedulePreview();
    this.emit();
  }

  setGroups(path: string, groups: string[]): void {
    if (!this.draft) return;
    this.draft.groups = { ...this.draft.groups, [path]: groups };
    this.schedulePreview();
    this.emit();
  }

  setAllGroups(groups: string[]): void {
    if (!this.draft) return;
    this.draft.groups = Object.fromEntries(this.draft.files.map((f) => [f.path, [...groups]]));
    this.schedulePreview();
    this.emit();
  }

  // ---------- preview and submit ----------

  /** New names come from the server only (design doc, section 8.3). */
  private schedulePreview(delay = 200): void {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.loadPreview(), delay);
  }

  private async loadPreview(): Promise<void> {
    const draft = this.draft;
    const job = draft && toDraftJob(draft);
    if (!draft || !job) return;
    const seq = ++this.previewSeq;
    draft.previewing = true;
    this.emit();
    try {
      const preview = await this.api.call(
        'job.getPreview',
        draft.editingJobId ? { draft: job, replacesJobId: draft.editingJobId } : { draft: job },
      );
      if (seq === this.previewSeq && this.draft === draft) draft.preview = preview;
    } catch (error) {
      this.report(error);
    } finally {
      if (seq === this.previewSeq) draft.previewing = false;
      this.emit();
    }
  }

  async submitDraft(): Promise<void> {
    const draft = this.draft;
    const job = draft && toDraftJob(draft);
    if (!draft || !job || this.busy) return;
    this.busy = true;
    draft.error = null;
    this.emit();
    try {
      const editing = draft.editingJobId;
      this.queue = await this.queueCommand(() =>
        editing
          ? this.api.call('queue.replaceJob', { jobId: editing, draft: job })
          : this.api.call('queue.addJob', { draft: job })
      );
      this.draft = null;
      this.draftOpen = false;
      this.toast(editing ? 'The Job was updated.' : 'The Job was added to the Queue.', 'ok');
      await this.loadTree();
    } catch (error) {
      if (error instanceof RpcError) draft.error = { message: error.message, details: error.details };
      else this.report(error);
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  // ---------- the Queue ----------

  private async removeJob(jobId: string): Promise<void> {
    try {
      this.queue = await this.queueCommand(() => this.api.call('queue.removeJob', { jobId }));
      this.toast('The Job was removed. Its files can be selected again.', 'ok');
      await this.loadTree();
    } catch (error) {
      this.report(error);
    }
  }

  private async startApply(): Promise<void> {
    this.applyError = null;
    // Shown before the call: a small apply can finish, and its events arrive, before the call returns.
    this.apply = { progress: null, result: null };
    this.emit();
    try {
      await this.queueCommand(() => this.api.call('queue.apply', {}));
    } catch (error) {
      this.apply = null;
      if (error instanceof RpcError && error.status === 422) {
        this.applyError = { message: error.message, details: error.details };
      } else this.report(error);
    }
    this.emit();
  }

  dismissApply(): void {
    this.apply = null;
    this.applyError = null;
    this.emit();
  }
}
