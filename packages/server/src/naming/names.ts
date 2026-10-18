// The naming rules (design doc §9; spec N1). Only the server works out new names;
// the webapp asks for them with `job.getPreview`.

import type {
  Details,
  DraftFile,
  DraftJob,
  Flavour,
  MediaType,
  Options,
  Preview,
  PreviewFile,
} from '@re-name/protocol';
import { CATEGORY_ORDER, type TagRules } from './known-tags.ts';
import { extensionOf } from './parse.ts';

const MAX_BYTES = 255;
// Control characters are invalid names on Windows, so matching them is intended.
// deno-lint-ignore no-control-regex
const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;
const PLACEHOLDER = /^(episode|épisode|folge|episodio|aflevering|avsnitt)\s+(\d+)$/i;

/** TMDB's details for a matched title, from the cache the RPC layer keeps. */
export type TitleLookup = (type: MediaType, tmdbId: number) => Details | undefined;

export interface QueuedDraft {
  id: string;
  draft: DraftJob;
}

/** Spec N1.6. */
export function sanitise(name: string): string {
  return name.replace(INVALID, '_');
}

/** True for TMDB's stand-in episode names, such as `Episode 3` (spec N1.5). */
export function isPlaceholderEpisodeName(name: string, episode: number): boolean {
  const m = PLACEHOLDER.exec(name.trim());
  return m !== null && Number(m[2]) === episode;
}

const pad = (n: number) => String(n).padStart(2, '0');
const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Spec N1.1. */
function idTag(flavour: Flavour, tmdbId: number): string {
  switch (flavour) {
    case 'plex':
      return `{tmdb-${tmdbId}}`;
    case 'jellyfin':
      return `[tmdbid-${tmdbId}]`;
    case 'emby':
      return `[tmdbid=${tmdbId}]`;
  }
}

/** The brackets: tags in category order, then `DUP-{n}`, then each group (spec N1.4). */
function bracket(file: DraftFile, dup: number | null, rules: TagRules): string {
  const tags = file.tags
    .map((t, i) => ({ ...t, i, rank: CATEGORY_ORDER.indexOf(rules.categoryOf(t.source)) }))
    .filter((t) => t.value !== null && t.value.trim() !== '')
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((t) => t.value as string);
  if (dup !== null) tags.push(`DUP-${dup}`);
  const parts = [...tags, ...file.groups.filter((g) => g.trim() !== '').map((g) => `-${g}`)];
  return parts.length === 0 ? '' : `[${parts.join(' ')}]`;
}

interface Named {
  folders: string[];
  file: string;
  warnings: string[];
}

/** Spec N1.2, N1.3, N1.5, N1.7, N1.10. */
function nameFile(
  details: Details,
  file: DraftFile,
  options: Options,
  dup: number | null,
  rules: TagRules,
): [true, Named] | [false, string] {
  const base = `${sanitise(details.title)} (${details.year})`;
  const id = idTag(options.flavour, details.tmdbId);
  const ext = extensionOf(file.path);
  const b = bracket(file, dup, rules);
  // Plex puts a space before the brackets; Jellyfin and Emby use ` - ` (§9.1).
  const tail = `${b ? (options.flavour === 'plex' ? ` ${b}` : ` - ${b}`) : ''}.${ext}`;
  const warnings: string[] = [];

  if (details.type === 'movie') {
    const folder = `${base} ${id}`;
    const name = options.flavour === 'plex' ? `${base}${tail}` : `${folder}${tail}`;
    return [true, { folders: [folder], file: name, warnings }];
  }

  if (file.season === null) return [false, 'Choose a season.'];
  if (file.episode === null) return [false, 'No episode number was found.'];
  const season = details.seasons.find((s) => s.season === file.season);
  const episode = season?.episodes.find((e) => e.episode === file.episode);
  if (!season) warnings.push(`TMDB has no season ${file.season}.`);
  else if (!episode) warnings.push(`TMDB has no episode ${file.episode} in season ${file.season}.`);

  let name = `${base} - S${pad(file.season)}E${pad(file.episode)}`;
  const rawName = episode?.name ?? null;
  const episodeName = options.includeEpisodeName && rawName && !isPlaceholderEpisodeName(rawName, file.episode)
    ? sanitise(rawName)
    : null;
  if (episodeName && bytes(`${name} - ${episodeName}${tail}`) <= MAX_BYTES) name += ` - ${episodeName}`;
  else if (episodeName) warnings.push('The episode name was left out: the name would be too long.');
  return [true, { folders: [`${base} ${id}`, `Season ${pad(file.season)}`], file: name + tail, warnings }];
}

/** Spec N1.7, N1.8. */
function check(named: Named): string | null {
  for (const part of [...named.folders, named.file]) {
    if (bytes(part) > MAX_BYTES) return `"${part.slice(0, 40)}…" is longer than ${MAX_BYTES} bytes.`;
    if (/[. ]$/.test(part) || RESERVED.test(part)) return `"${part}" isn't a valid name on every OS.`;
  }
  return null;
}

/**
 * Names every file of every Job, in Queue order, numbering clashes with
 * `DUP-{n}`: files already in the target keep their names, then earlier Jobs
 * win. Paths are compared ignoring case (spec N1.9).
 */
export function nameQueue(
  jobs: readonly QueuedDraft[],
  options: Options,
  existing: readonly string[],
  titles: TitleLookup,
  rules: TagRules,
): Map<string, Preview> {
  const taken = new Set(existing.map((p) => p.toLowerCase()));
  const previews = new Map<string, Preview>();
  for (const { id, draft } of jobs) {
    const details = titles(draft.type, draft.tmdbId);
    const files: PreviewFile[] = draft.files.map((file) => {
      if (!details) {
        return { path: file.path, newPath: null, dup: null, warnings: [], error: 'The TMDB title wasn’t found.' };
      }
      for (let dup: number | null = null;; dup = (dup ?? 0) + 1) {
        const [ok, named] = nameFile(details, file, options, dup, rules);
        if (!ok) return { path: file.path, newPath: null, dup: null, warnings: [], error: named };
        const error = check(named);
        if (error) return { path: file.path, newPath: null, dup: null, warnings: named.warnings, error };
        const newPath = [...named.folders, named.file].join('/');
        if (!taken.has(newPath.toLowerCase())) {
          taken.add(newPath.toLowerCase());
          return { path: file.path, newPath, dup, warnings: named.warnings, error: null };
        }
      }
    });
    previews.set(id, { files, ok: files.every((f) => f.error === null) });
  }
  return previews;
}
