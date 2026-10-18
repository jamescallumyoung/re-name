// MOCK: the naming rules (design doc, section 9). In the real app only the server
// works out new names; the webapp asks for them with `job.getPreview`.

import type { DraftFile, DraftJob, Flavour, Options, Preview, PreviewFile } from '@re-name/protocol';
import { findTitle } from './data.ts';
import { CATEGORY_ORDER, categoryOf } from './known-tags.ts';
import { extensionOf } from './parse.ts';

const MAX_BYTES = 255;
// Control characters are invalid names on Windows, so matching them is intended.
// deno-lint-ignore no-control-regex
const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;

/** Replaces each invalid character with `_` (section 9.6). */
export function sanitise(name: string): string {
  return name.replace(INVALID, '_');
}

const pad = (n: number) => String(n).padStart(2, '0');
const bytes = (s: string) => new TextEncoder().encode(s).length;

export function idTag(flavour: Flavour, tmdbId: number): string {
  switch (flavour) {
    case 'plex':
      return `{tmdb-${tmdbId}}`;
    case 'jellyfin':
      return `[tmdbid-${tmdbId}]`;
    case 'emby':
      return `[tmdbid=${tmdbId}]`;
  }
}

/** The bracket: tags in the server's order, then `DUP-{n}`, then each group (section 9.3). */
export function bracket(file: DraftFile, dup: number | null): string {
  const tags = file.tags
    .map((t, i) => ({ ...t, i, rank: CATEGORY_ORDER.indexOf(categoryOf(t.source)) }))
    .filter((t) => t.value !== null && t.value.trim() !== '')
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((t) => t.value as string);
  if (dup !== null) tags.push(`DUP-${dup}`);
  const parts = [...tags, ...file.groups.filter((g) => g.trim() !== '').map((g) => `-${g}`)];
  return parts.length === 0 ? '' : `[${parts.join(' ')}]`;
}

interface Named {
  folder: string[];
  file: string;
  warnings: string[];
}

function nameFile(
  job: DraftJob,
  file: DraftFile,
  options: Options,
  dup: number | null,
): [true, Named] | [false, string] {
  const details = findTitle(job.type, job.tmdbId);
  if (!details) return [false, `TMDB ${job.type} ${job.tmdbId} wasn't found.`];
  const title = sanitise(details.title);
  const base = `${title} (${details.year})`;
  const id = idTag(options.flavour, details.tmdbId);
  const ext = extensionOf(file.path);
  const b = bracket(file, dup);
  const warnings: string[] = [];

  if (job.type === 'movie') {
    const folder = `${base} ${id}`;
    const name = options.flavour === 'plex'
      ? `${base}${b ? ` ${b}` : ''}.${ext}`
      : `${folder}${b ? ` - ${b}` : ''}.${ext}`;
    return [true, { folder: [folder], file: name, warnings }];
  }

  if (file.season === null) return [false, 'Choose a season.'];
  if (file.episode === null) return [false, 'No episode number was found.'];
  const season = details.seasons.find((s) => s.season === file.season);
  const episode = season?.episodes.find((e) => e.episode === file.episode);
  if (!season) warnings.push(`TMDB has no season ${file.season}.`);
  else if (!episode) warnings.push(`TMDB has no episode ${file.episode} in season ${file.season}.`);
  const code = `S${pad(file.season)}E${pad(file.episode)}`;
  // Plex puts a space before the brackets; Jellyfin and Emby use ` - ` (section 9.1).
  const tail = `${b ? (options.flavour === 'plex' ? ` ${b}` : ` - ${b}`) : ''}.${ext}`;
  let name = `${base} - ${code}`;
  const episodeName = options.includeEpisodeName && episode?.name ? sanitise(episode.name) : null;
  if (episodeName && bytes(`${name} - ${episodeName}${tail}`) <= MAX_BYTES) name += ` - ${episodeName}`;
  else if (episodeName) warnings.push('The episode name was left out: the name would be too long.');
  return [true, { folder: [`${base} ${id}`, `Season ${pad(file.season)}`], file: name + tail, warnings }];
}

function check(named: Named): string | null {
  for (const part of [...named.folder, named.file]) {
    if (bytes(part) > MAX_BYTES) return `"${part.slice(0, 40)}…" is longer than ${MAX_BYTES} bytes.`;
    if (/[. ]$/.test(part) || RESERVED.test(part)) return `"${part}" isn't a valid name on every OS.`;
  }
  return null;
}

export interface QueuedDraft {
  id: string;
  draft: DraftJob;
}

/**
 * Names every file of every Job, in Queue order, numbering clashes with
 * `DUP-{n}`: files already in the target keep their names, then earlier Jobs
 * win (section 9.5). Paths are compared case-insensitively.
 */
export function nameQueue(jobs: QueuedDraft[], options: Options, existing: readonly string[]): Map<string, Preview> {
  const taken = new Set(existing.map((p) => p.toLowerCase()));
  const previews = new Map<string, Preview>();
  for (const { id, draft } of jobs) {
    const files: PreviewFile[] = draft.files.map((file) => {
      for (let dup: number | null = null;; dup = (dup ?? 0) + 1) {
        const [ok, named] = nameFile(draft, file, options, dup);
        if (!ok) return { path: file.path, newPath: null, dup: null, warnings: [], error: named };
        const error = check(named);
        if (error) return { path: file.path, newPath: null, dup: null, warnings: named.warnings, error };
        const newPath = [...named.folder, named.file].join('/');
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
