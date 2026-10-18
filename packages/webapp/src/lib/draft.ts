// The draft Job held in the webapp's memory (design doc, section 7.2), and the pure
// functions over it: tag grid columns, effective tag values, and the sparse
// `DraftJob` sent to the server.

import type { AnalysedFile, Details, DraftJob, FoundTag, Match, MediaType, Preview } from '@re-name/protocol';

export type Step = 'match' | 'seasons' | 'tags';

export interface EpisodeChoice {
  season: number | null;
  episode: number | null;
}

export interface Draft {
  /** The approved Job this draft will replace, when editing one. */
  editingJobId: string | null;
  step: Step;
  files: AnalysedFile[];
  suggestions: Match[] | null;
  searchQuery: string;
  searchType: MediaType | 'all';
  searchResults: Match[] | null;
  searching: boolean;
  match: Match | null;
  details: Details | null;
  episodes: Record<string, EpisodeChoice>;
  /** Column values set from the grid's header, by column key. */
  columns: Record<string, string | null>;
  /** Values set on single cells, by file path then column key. */
  cells: Record<string, Record<string, string | null>>;
  groups: Record<string, string[]>;
  preview: Preview | null;
  previewing: boolean;
  /** A problem the server reported when the draft was last sent. */
  error: { message: string; details: string[] } | null;
}

export function newDraft(files: AnalysedFile[]): Draft {
  return {
    editingJobId: null,
    step: 'match',
    files,
    suggestions: null,
    searchQuery: '',
    searchType: 'all',
    searchResults: null,
    searching: false,
    match: null,
    details: null,
    episodes: Object.fromEntries(files.map((f) => [f.path, { season: f.season, episode: f.episode }])),
    columns: {},
    cells: {},
    groups: Object.fromEntries(files.map((f) => [f.path, [...f.groups]])),
    preview: null,
    previewing: false,
    error: null,
  };
}

export function stepsOf(draft: Draft): Step[] {
  return draft.match?.type === 'tv' ? ['match', 'seasons', 'tags'] : ['match', 'tags'];
}

/**
 * A column of the tag grid: one tag, wherever it appears. Tags that the known-tags
 * file gives the same value (`265` and `x265`) share a column.
 */
export interface TagColumn {
  key: string;
  /** The spellings found in the files, such as `web-dl` and `WEB-DL`. */
  sources: string[];
  /** The value the known-tags file gives; for an unknown tag, its own text. */
  defaultValue: string | null;
  known: boolean;
  /** How many files have this tag. */
  count: number;
  /** Added by hand, not found in the names. */
  added: boolean;
}

export function tagKey(tag: FoundTag): string {
  if (!tag.known) return `u:${tag.source.toLowerCase()}`;
  return tag.value === null ? `drop:${tag.source.toLowerCase()}` : `k:${tag.value.toLowerCase()}`;
}

export function columnsOf(files: AnalysedFile[]): TagColumn[] {
  const columns = new Map<string, TagColumn>();
  for (const file of files) {
    for (const tag of file.tags) {
      const key = tagKey(tag);
      const column = columns.get(key) ??
        { key, sources: [], defaultValue: tag.value, known: tag.known, count: 0, added: tag.added === true };
      if (!column.sources.includes(tag.source)) column.sources.push(tag.source);
      column.count++;
      columns.set(key, column);
    }
  }
  return [...columns.values()];
}

/**
 * Adds a tag by hand to every file that doesn't already have one with that value
 * (design doc §7.2). It's sent like a found tag, with its text as the source, so the
 * server orders it by what it is (`H.264` sorts as a codec).
 */
export function addTag(draft: Draft, text: string): void {
  const value = text.trim();
  if (!value) return;
  const tag: FoundTag = { source: value, value, known: true, added: true };
  const key = tagKey(tag);
  draft.files = draft.files.map((f) =>
    f.tags.some((t) => tagKey(t) === key) ? f : { ...f, tags: [...f.tags, { ...tag }] }
  );
}

/** Removes a tag added by hand from every file, with any values set for it. */
export function removeAddedTag(draft: Draft, key: string): void {
  draft.files = draft.files.map((f) => ({ ...f, tags: f.tags.filter((t) => !(t.added && tagKey(t) === key)) }));
  delete draft.columns[key];
  for (const cells of Object.values(draft.cells)) delete cells[key];
}

/**
 * Fills a draft in from an approved Job's files, so editing it starts where it was
 * left: the episodes, groups and tag values, and any tags added by hand.
 */
export function restoreChoices(draft: Draft, jobFiles: DraftJob['files']): void {
  for (const f of jobFiles) {
    draft.episodes[f.path] = { season: f.season, episode: f.episode };
    draft.groups[f.path] = [...f.groups];
    const file = draft.files.find((a) => a.path === f.path);
    if (!file) continue;
    for (const choice of f.tags) {
      let tag = file.tags.find((t) => t.source === choice.source);
      if (!tag) {
        // Not in the name, so it was added by hand.
        tag = { source: choice.source, value: choice.source, known: true, added: true };
        file.tags = [...file.tags, tag];
      }
      if (tag.value !== choice.value) draft.cells[f.path] = { ...draft.cells[f.path], [tagKey(tag)]: choice.value };
    }
  }
}

/** The value a file's tag will have: its cell, else its column, else the default. */
export function effectiveValue(draft: Draft, path: string, tag: FoundTag): string | null {
  const key = tagKey(tag);
  const cells = draft.cells[path];
  if (cells && key in cells) return cells[key] ?? null;
  if (key in draft.columns) return draft.columns[key] ?? null;
  return tag.value;
}

/** Whether the file's cell for `key` has its own value. */
export function hasCellValue(draft: Draft, path: string, key: string): boolean {
  return key in (draft.cells[path] ?? {});
}

/** The sparse description sent to the server (section 7.3). */
export function toDraftJob(draft: Draft): DraftJob | null {
  if (!draft.match) return null;
  return {
    type: draft.match.type,
    tmdbId: draft.match.tmdbId,
    files: draft.files.map((f) => ({
      path: f.path,
      season: draft.match?.type === 'tv' ? draft.episodes[f.path]?.season ?? null : null,
      episode: draft.match?.type === 'tv' ? draft.episodes[f.path]?.episode ?? null : null,
      tags: f.tags.map((t) => ({ source: t.source, value: effectiveValue(draft, f.path, t) })),
      groups: draft.groups[f.path] ?? [],
    })),
  };
}

/**
 * The most likely season for a file: the one in its name if TMDB has it, else
 * one in its folder's name, else TMDB's only season.
 */
export function likelySeason(file: AnalysedFile, details: Details): number | null {
  const has = (n: number | null | undefined) => n != null && details.seasons.some((s) => s.season === n);
  if (has(file.season)) return file.season;
  const folder = /(?:^|[\s._/-])(?:S|Season[\s._]?)(\d{1,2})(?=[\s._/-]|$)/i.exec(
    file.path.slice(0, file.path.lastIndexOf('/') + 1),
  );
  if (folder && has(Number(folder[1]))) return Number(folder[1]);
  const real = details.seasons.filter((s) => s.season > 0);
  return real.length === 1 ? real[0]?.season ?? null : null;
}

/** The folder a file is in, for grouping rows; `''` for the source's top level. */
export function folderOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

export function groupByFolder<T extends { path: string }>(files: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const folder = folderOf(f.path);
    groups.set(folder, [...(groups.get(folder) ?? []), f]);
  }
  return [...groups.entries()];
}
