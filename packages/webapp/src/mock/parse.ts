// MOCK: parsing release names (design doc, sections 9.3, 9.4 and 10). In the real
// app this runs on the server. It's simple on purpose: enough to feel real.

import type { FoundTag, SkipReason } from '@re-name/protocol';
import { matchKnownTag } from './known-tags.ts';

export interface ParsedName {
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  tags: FoundTag[];
  groups: string[];
  skip: SkipReason | null;
}

export const VIDEO_EXTENSIONS = ['mkv', 'mp4', 'm4v', 'avi', 'mov', 'wmv', 'ts', 'm2ts', 'webm', 'mpg', 'mpeg'];

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isVideo(name: string): boolean {
  return VIDEO_EXTENSIONS.includes(extensionOf(name));
}

const SAMPLE = /(^|[\s._-])sample([\s._-]|$)/i;
const SPLIT_PART = /(^|[\s._-])(cd|pt|part|disc|disk|dvd)[\s._-]?\d{1,2}([\s._-]|$)/i;
const EPISODE = /(?:^|[\s._-])S(\d{1,2})E(\d{1,3})((?:-?E\d{1,3})+)?(?=[\s._-]|$)/i;
const YEAR = /(?:^|[\s._(-])((?:19|20)\d\d)(?=[\s._)-]|$)/;
/** One or more trailing groups: `-NTb`, `-NTb[rartv]`, `-NTb-RARBG`. */
const GROUPS = /((?:-[A-Za-z0-9]+(?:\[[A-Za-z0-9]+\])*)+)$/;

/** Parses a file name (without its folders). `inSampleFolder` marks files under `Sample/`. */
export function parseName(fileName: string, inSampleFolder = false): ParsedName {
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

  // The title ends at the episode, the year, or the first known tag.
  const firstTag = firstKnownTagIndex(stem);
  const head = ep ? ep.index : firstTag;
  let year: number | null = null;
  let yearAt = -1;
  let yearEnd = -1;
  for (const m of stem.slice(0, head).matchAll(new RegExp(YEAR.source, 'g'))) {
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
  const { tags, groups } = parseTags(rest.replace(/^[\s._)-]+/, ''));
  return { title, year, season, episode, tags, groups, skip };
}

/** Where the first known tag starts, at a token boundary; the end of `stem` if none. */
function firstKnownTagIndex(stem: string): number {
  for (const m of stem.matchAll(/(?:^|[.\s_])([^.\s_])/g)) {
    const at = m.index + m[0].length - 1;
    if (at > 0 && matchKnownTag(stem.slice(at).replace(/\s/g, '.')) !== null) return at;
  }
  return stem.length;
}

/**
 * Splits the text after the title, year or episode into tags and groups. Known
 * tags are tried longest first, so dotted tags (`DDP5.1`) stay whole. Text before
 * the first known tag is an episode name in the source, and isn't a tag.
 */
export function parseTags(text: string): { tags: FoundTag[]; groups: string[] } {
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
      const known = matchKnownTag(joined);
      if (!lastToken || !known || known.length !== joined.length) break;
      head += parts.shift()?.[0] ?? '';
    }
    for (const part of parts) {
      groups.push(part[1] ?? '');
      for (const bracket of (part[2] ?? '').matchAll(/\[([A-Za-z0-9]+)\]/g)) groups.push(bracket[1] ?? '');
    }
    body = head;
  }

  const tags: FoundTag[] = [];
  let seenKnown = false;
  let i = 0;
  while (i < body.length) {
    if (body[i] === '.') {
      i++;
      continue;
    }
    const known = matchKnownTag(body.slice(i));
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
  return { tags, groups };
}
