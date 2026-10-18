// The contract between the server and the webapp (docs/design-doc.md, section 8).
// Both packages import these types; `Rpc` lists every command, and `ServerEvent`
// every event on the SSE stream.

export type Flavour = 'plex' | 'jellyfin' | 'emby';
export type MediaType = 'movie' | 'tv';

/** The options chosen up front, for the whole Queue (section 9.7). */
export interface Options {
  flavour: Flavour;
  includeEpisodeName: boolean;
}

/** What the session tells the webapp about the run. */
export interface SessionInfo {
  /** The source folder's own name. */
  sourceName: string;
  /** The source folder's full path, as the server sees it. */
  sourcePath: string;
  /** The target folder's full path. */
  targetPath: string;
  /** The target, relative to the source when it's inside it. */
  targetName: string;
  dryRun: boolean;
  /** False until the options have been chosen in this run: the webapp asks for them up front. */
  optionsChosen: boolean;
}

// ---------- the source tree ----------

export type SkipReason = 'sample' | 'multi-episode' | 'split-part';

export type FileStatus =
  | { state: 'available' }
  | { state: 'queued'; jobId: string }
  | { state: 'skipped'; reason: SkipReason };

export interface FileNode {
  kind: 'file';
  name: string;
  /** Relative to the source, with `/` separators. */
  path: string;
  size: number;
  status: FileStatus;
}

export interface FolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileNode | FolderNode;

// ---------- TMDB ----------

/** One TMDB title, as a suggestion or search result. */
export interface Match {
  type: MediaType;
  tmdbId: number;
  title: string;
  year: number;
  /** A poster URL, or `null` when TMDB has none. */
  posterUrl: string | null;
}

export interface Episode {
  episode: number;
  /** `null` when TMDB has only a placeholder name (section 9.2). */
  name: string | null;
}

export interface Season {
  season: number;
  name: string;
  episodes: Episode[];
}

export interface Details extends Match {
  /** For TV only; empty for a movie. */
  seasons: Season[];
}

// ---------- analysing files ----------

/** One tag found in a file name, and the value the known-tags file gives it. */
export interface FoundTag {
  /** The text as it appears in the name, such as `web-dl`. */
  source: string;
  /** The transformed value; `null` drops the tag. */
  value: string | null;
  /** `false` for a tag that isn't in the known-tags file: it's kept as it is. */
  known: boolean;
}

export interface AnalysedFile {
  path: string;
  /** The title and year parsed from the name, used for suggestions. */
  parsedTitle: string;
  parsedYear: number | null;
  season: number | null;
  episode: number | null;
  tags: FoundTag[];
  groups: string[];
}

// ---------- jobs and the Queue ----------

export interface TagChoice {
  source: string;
  /** `null` drops the tag. */
  value: string | null;
}

/** One file of a draft Job: the sparse description the webapp sends (section 7.3). */
export interface DraftFile {
  path: string;
  season: number | null;
  episode: number | null;
  tags: TagChoice[];
  groups: string[];
}

export interface DraftJob {
  type: MediaType;
  tmdbId: number;
  files: DraftFile[];
}

export interface PreviewFile {
  path: string;
  /** The new path, relative to the target; `null` when the file can't be named. */
  newPath: string | null;
  /** The `DUP-{n}` number given to this file, if any (section 9.5). */
  dup: number | null;
  warnings: string[];
  error: string | null;
}

export interface Preview {
  files: PreviewFile[];
  /** True when every file can be named. */
  ok: boolean;
}

/** An approved Job: what the webapp sent, plus what the server worked out. */
export interface Job {
  id: string;
  draft: DraftJob;
  match: Match;
  preview: Preview;
}

export interface Queue {
  jobs: Job[];
}

// ---------- commands ----------

export interface Rpc {
  'session.claim': {
    params: { tabId: string; token?: string };
    result: { session: SessionInfo; options: Options; queue: Queue };
  };
  'session.end': { params: Record<string, never>; result: null };
  'options.get': { params: Record<string, never>; result: Options };
  'options.set': { params: Options; result: { options: Options; queue: Queue } };
  'tree.get': { params: Record<string, never>; result: { root: FolderNode } };
  'tmdb.getSuggestions': { params: { files: string[] }; result: Match[] };
  'tmdb.search': { params: { query: string; type?: MediaType }; result: Match[] };
  'tmdb.getDetails': { params: { type: MediaType; tmdbId: number }; result: Details };
  /** `forJobId`: the approved Job being edited, whose own files count as available. */
  'job.analyseFiles': { params: { files: string[]; forJobId?: string }; result: AnalysedFile[] };
  'job.getPreview': { params: { draft: DraftJob; replacesJobId?: string }; result: Preview };
  'queue.get': { params: Record<string, never>; result: Queue };
  'queue.addJob': { params: { draft: DraftJob }; result: Queue };
  'queue.replaceJob': { params: { jobId: string; draft: DraftJob }; result: Queue };
  'queue.removeJob': { params: { jobId: string }; result: Queue };
  'queue.apply': { params: Record<string, never>; result: { started: true } };
}

export type RpcMethod = keyof Rpc;
export type RpcParams<M extends RpcMethod> = Rpc[M]['params'];
export type RpcResult<M extends RpcMethod> = Rpc[M]['result'];

/** Commands that change the Queue send `If-Match` with the Queue's ETag (section 8.4). */
export const QUEUE_COMMANDS: readonly RpcMethod[] = [
  'options.set',
  'queue.addJob',
  'queue.replaceJob',
  'queue.removeJob',
  'queue.apply',
];

/** The body of every error response. */
export interface RpcErrorBody {
  /** A stable code, such as `stale-queue` or `files-already-queued`. */
  error: string;
  message: string;
  /** Extra detail, such as the files that changed on disk. */
  details?: string[];
}

// ---------- events on the SSE stream ----------

export interface ApplyProgress {
  jobId: string;
  path: string;
  newPath: string;
  /** 0-based index of the file being moved, across the whole Queue. */
  index: number;
  total: number;
}

export interface ApplyResult {
  dryRun: boolean;
  moved: number;
  total: number;
  /** Set when the apply stopped on an error. */
  error: { path: string; message: string } | null;
  /** Where the JSON log was written. */
  logPath: string;
  queue: Queue;
  etag: string;
}

export type ServerEvent =
  | { type: 'heartbeat' }
  | { type: 'apply-progress'; progress: ApplyProgress }
  | { type: 'apply-done'; result: ApplyResult }
  | { type: 'shutting-down' }
  | { type: 'taken-over' };
