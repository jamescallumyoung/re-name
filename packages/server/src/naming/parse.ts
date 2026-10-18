// Parsing release names into a title, year, episode, tags and release groups, and
// the skip rules (design doc §9.3, §9.4, §10; spec P1, S1.1).

import type { FoundTag, SkipReason } from '@re-name/protocol';
import type { TagRules } from './known-tags.ts';

export interface ParsedName {
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  tags: FoundTag[];
  groups: string[];
  skip: SkipReason | null;
}

const VIDEO_EXTENSIONS = new Set(['mkv', 'mp4', 'm4v', 'avi', 'mov', 'wmv', 'ts', 'm2ts', 'webm', 'mpg', 'mpeg']);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Spec S1.1. */
export function isVideo(name: string): boolean {
  return VIDEO_EXTENSIONS.has(extensionOf(name));
}

const SAMPLE = /(^|[\s._-])sample([\s._-]|$)/i;
const SPLIT_PART = /(^|[\s._-])(cd|pt|part|disc|disk|dvd)[\s._-]?\d{1,2}([\s._-]|$)/i;
const EPISODE = /(?:^|[\s._-])S(\d{1,2})E(\d{1,3})((?:-?E\d{1,3})+)?(?=[\s._-]|$)/i;
const YEAR = /(?:^|[\s._(-])((?:19|20)\d\d)(?=[\s._)-]|$)/g;
const TRAILING_BRACKET = /\[([^[\]]*)\]\s*$/;
const ID_TAG = /[[{](?:tmdb|tmdbid|imdb|imdbid|tvdb|tvdbid)[-=][^\]}]*[\]}]/gi;
/** One or more trailing groups: `-NTb`, `-NTb[rartv]`, `-GGEZ-RARBG`. */
const GROUPS = /((?:-[A-Za-z0-9]+(?:\[[A-Za-z0-9]+\])*)+)$/;

/** Parses a path relative to the source: its file name, and whether it's under a `Sample` folder (spec P1.6). */
export function parsePath(path: string, rules: TagRules): ParsedName {
  const parts = path.split('/');
  const inSampleFolder = parts.slice(0, -1).some((p) => p.toLowerCase() === 'sample');
  return parseName(parts[parts.length - 1] ?? path, rules, inSampleFolder);
}

/** Parses a file name, without its folders (spec P1.1–P1.6). */
export function parseName(fileName: string, rules: TagRules, inSampleFolder = false): ParsedName {
  const stem = fileName.slice(0, fileName.length - extensionOf(fileName).length - 1);
  let skip: SkipReason | null = null;
  if (inSampleFolder || SAMPLE.test(stem)) skip = 'sample';
  else if (SPLIT_PART.test(stem)) skip = 'split-part';

  let season: number | null = null;
  let episode: number | null = null;
  const ep = EPISODE.exec(stem);
  if (ep) {
    season = Number(ep[1]);
    episode = Number(ep[2]);
    if (ep[3] && skip === null) skip = 'multi-episode';
  }

  // The title ends at the episode, the year, or the first known tag (P1.2, P1.3).
  const firstTag = firstKnownTagIndex(stem, rules);
  const head = ep ? ep.index : firstTag;
  let year: number | null = null;
  let yearAt = -1;
  let yearEnd = -1;
  for (const m of stem.slice(0, head).matchAll(YEAR)) {
    // The last year-like number counts: `Blade.Runner.2049.2017` is from 2017.
    if (m.index > 0) {
      year = Number(m[1]);
      yearAt = m.index;
      yearEnd = m.index + m[0].length;
    }
  }
  const titleEnd = yearAt !== -1 ? yearAt : head;
  const rest = ep ? stem.slice(ep.index + ep[0].length) : yearEnd !== -1 ? stem.slice(yearEnd) : stem.slice(firstTag);

  const title = stem.slice(0, titleEnd).replace(/[._]+/g, ' ').replace(/[\s(-]+$/, '').trim();
  const { tags, groups } = parseTags(rest.replace(/^[\s._)-]+/, ''), rules);
  return { title, year, season, episode, tags, groups, skip };
}

/** Where the first known tag starts, at a token boundary; the end of `stem` if none. */
function firstKnownTagIndex(stem: string, rules: TagRules): number {
  for (const m of stem.matchAll(/(?:^|[.\s_])([^.\s_])/g)) {
    const at = m.index + m[0].length - 1;
    if (at > 0 && rules.match(stem.slice(at).replace(/\s/g, '.')) !== null) return at;
  }
  return stem.length;
}

/**
 * Splits the text after the title, year or episode into tags and release groups
 * (spec P1.4, P1.5, P1.7, P1.8). Text before the first known tag is an episode name in
 * the source, and isn't a tag.
 */
export function parseTags(text: string, rules: TagRules): { tags: FoundTag[]; groups: string[] } {
  // Media server IDs, from a name re-name (or another tool) wrote, aren't tags (P1.9).
  text = text.replace(ID_TAG, ' ');
  // Trailing brackets are groups, whatever they hold: `-MeGusta[eztv.re]` (P1.5)...
  const bracketed: string[] = [];
  for (let m = TRAILING_BRACKET.exec(text); m; m = TRAILING_BRACKET.exec(text)) {
    const inner = (m[1] ?? '').trim();
    text = text.slice(0, m.index).replace(/[\s._]+$/, '');
    if (!/\s/.test(inner) && rules.match(inner)?.length !== inner.length) {
      bracketed.unshift(inner);
      continue;
    }
    // ...unless they hold spaces or one known tag: then they're tags, as re-name writes them (P1.9).
    const words = inner.split(/\s+/).filter((w) => !/^DUP-\d+$/i.test(w));
    bracketed.unshift(...words.filter((w) => w.startsWith('-')).map((w) => w.slice(1)));
    text = `${text} ${words.filter((w) => !w.startsWith('-')).join(' ')}`;
    break;
  }
  let body = text.replace(/\s+/g, '.');
  const groups: string[] = [];
  const g = GROUPS.exec(body);
  if (g) {
    let head = body.slice(0, g.index);
    const parts = [...(g[1] ?? '').matchAll(/-([A-Za-z0-9]+)((?:\[[A-Za-z0-9]+\])*)/g)];
    // A part that completes a known tag (`WEB` + `-DL`) belongs to the tags, not the groups.
    while (parts.length > 0) {
      const lastToken = head.slice(head.lastIndexOf('.') + 1);
      const joined = `${lastToken}${parts[0]?.[0] ?? ''}`;
      const known = rules.match(joined);
      if (!lastToken || !known || known.length !== joined.length) break;
      head += parts.shift()?.[0] ?? '';
    }
    for (const part of parts) {
      groups.push(part[1] ?? '');
      for (const bracket of (part[2] ?? '').matchAll(/\[([A-Za-z0-9]+)\]/g)) groups.push(bracket[1] ?? '');
    }
    body = head;
  }

  let tags = readTags(body, rules);
  // A group the pattern above can't read (`x265-GRP_X`) is left stuck to the last tag (P1.8).
  const at = tags.at(-1)?.known === false ? stuckGroupAt(body, rules) : null;
  if (at !== null) {
    groups.unshift(...body.slice(at + 1).split('-').filter((g) => g !== ''));
    tags = readTags(body.slice(0, at), rules);
  }
  groups.push(...bracketed.filter((g) => g !== ''));
  return { tags, groups };
}

/** Known tags, and unknown tokens after the first known one (P1.4). */
function readTags(body: string, rules: TagRules): FoundTag[] {
  const tags: FoundTag[] = [];
  let seenKnown = false;
  let i = 0;
  while (i < body.length) {
    if (body[i] === '.') {
      i++;
      continue;
    }
    const known = rules.match(body.slice(i));
    if (known) {
      seenKnown = true;
      tags.push({ source: body.slice(i, i + known.length), value: known.tag.value, known: true });
      i += known.length;
      continue;
    }
    const next = body.indexOf('.', i);
    const token = body.slice(i, next === -1 ? body.length : next);
    if (seenKnown && token) tags.push({ source: token, value: token, known: false });
    i += token.length;
  }
  return tags;
}

/**
 * Where to split `…x265-GRP_X` into tags and a group: the `-` in the last token
 * after which the tags end with a known one (the last such), or else its first `-`.
 * Null if the last token has no `-` in the middle.
 */
function stuckGroupAt(body: string, rules: TagRules): number | null {
  const from = body.lastIndexOf('.') + 1;
  const dashes = [...body.slice(from).matchAll(/-/g)].map((m) => from + m.index)
    .filter((d) => d > from && d < body.length - 1);
  const endsKnown = (d: number) => readTags(body.slice(0, d), rules).at(-1)?.known === true;
  return dashes.findLast(endsKnown) ?? dashes[0] ?? null;
}
