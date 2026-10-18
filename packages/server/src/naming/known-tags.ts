// The known-tags list (design doc §9.4; spec F1.7, P1.4): what each tag found in a
// file name becomes, and where it goes in the order. The user's copy lives in the
// config folder as known-tags.json; these are its defaults.

export type TagCategory = 'resolution' | 'source' | 'service' | 'hdr' | 'audio' | 'codec' | 'other';

export interface KnownTag {
  /** A case-insensitive regex, matched against one or more whole dot-separated tokens. */
  pattern: string;
  /** The output value; `null` drops the tag. */
  value: string | null;
  category: TagCategory;
}

/** The order tags appear in a new name (spec N1.4). */
export const CATEGORY_ORDER: readonly TagCategory[] = [
  'resolution',
  'source',
  'service',
  'hdr',
  'audio',
  'codec',
  'other',
];

export const DEFAULT_KNOWN_TAGS: readonly KnownTag[] = [
  { pattern: '2160p|4k', value: '2160p', category: 'resolution' },
  { pattern: '1080p', value: '1080p', category: 'resolution' },
  { pattern: '720p', value: '720p', category: 'resolution' },
  { pattern: '480p', value: '480p', category: 'resolution' },
  { pattern: 'uhd', value: 'UHD', category: 'source' },
  { pattern: 'blu-?ray|bdrip', value: 'BluRay', category: 'source' },
  { pattern: 'remux', value: 'Remux', category: 'source' },
  { pattern: 'web-?dl', value: 'WEB-DL', category: 'source' },
  { pattern: 'web-?rip', value: 'WEBRip', category: 'source' },
  { pattern: 'web', value: 'WEB', category: 'source' },
  { pattern: 'hdtv', value: 'HDTV', category: 'source' },
  { pattern: 'atvp', value: 'ATVP', category: 'service' },
  { pattern: 'amzn', value: 'AMZN', category: 'service' },
  { pattern: 'nf', value: 'NF', category: 'service' },
  { pattern: 'dsnp', value: 'DSNP', category: 'service' },
  { pattern: 'applevt', value: null, category: 'service' },
  { pattern: 'hdr10\\+|hdr10plus', value: 'HDR10+', category: 'hdr' },
  { pattern: 'hdr10', value: 'HDR10', category: 'hdr' },
  { pattern: 'hdr', value: 'HDR', category: 'hdr' },
  { pattern: 'dv|dovi', value: 'DV', category: 'hdr' },
  { pattern: 'ddp?5\\.1\\.atmos', value: 'DDP5.1 Atmos', category: 'audio' },
  { pattern: 'ddp5\\.1|dd\\+5\\.1', value: 'DDP5.1', category: 'audio' },
  { pattern: 'dd5\\.1', value: 'DD5.1', category: 'audio' },
  { pattern: 'dts-hd\\.ma\\.[57]\\.1', value: 'DTS-HD MA', category: 'audio' },
  { pattern: 'truehd\\.7\\.1\\.atmos', value: 'TrueHD 7.1 Atmos', category: 'audio' },
  { pattern: 'aac2\\.0', value: 'AAC2.0', category: 'audio' },
  { pattern: 'atmos', value: 'Atmos', category: 'audio' },
  { pattern: '[xh]\\.?265|265|hevc', value: 'H.265', category: 'codec' },
  { pattern: '[xh]\\.?264|264|avc', value: 'H.264', category: 'codec' },
  { pattern: '10bit', value: '10bit', category: 'other' },
  { pattern: 'repack', value: 'REPACK', category: 'other' },
  { pattern: 'proper', value: 'PROPER', category: 'other' },
];

/** The known tags, compiled for matching. */
export interface TagRules {
  /** The known tag matching the longest run of whole tokens at the start of `text`. */
  match(text: string): { tag: KnownTag; length: number } | null;
  /** A tag's category from its source text; unknown tags are `other`. */
  categoryOf(source: string): TagCategory;
}

export function tagRules(list: readonly KnownTag[]): TagRules {
  const compiled = list.map((tag) => ({ tag, re: new RegExp(`^(?:${tag.pattern})(?=\\.|$)`, 'i') }));
  const match = (text: string) => {
    let best: { tag: KnownTag; length: number } | null = null;
    for (const { tag, re } of compiled) {
      const m = re.exec(text);
      if (m && (best === null || m[0].length > best.length)) best = { tag, length: m[0].length };
    }
    return best;
  };
  return {
    match,
    categoryOf: (source) => {
      const m = match(source);
      return m && m.length === source.length ? m.tag.category : 'other';
    },
  };
}

/** Checks a parsed known-tags.json (spec F1.7). */
export function validateKnownTags(data: unknown): [true, KnownTag[]] | [false, string] {
  if (!Array.isArray(data)) return [false, 'It must be a JSON array of { "pattern", "value", "category" }.'];
  for (const [i, entry] of data.entries()) {
    const e = entry as Partial<KnownTag> | null;
    const where = `Entry ${i + 1}`;
    if (typeof e !== 'object' || e === null) return [false, `${where} isn't an object.`];
    if (typeof e.pattern !== 'string' || e.pattern === '') return [false, `${where} needs a "pattern".`];
    try {
      new RegExp(e.pattern);
    } catch {
      return [false, `${where}'s pattern isn't a valid regex: ${e.pattern}`];
    }
    if (e.value !== null && typeof e.value !== 'string') return [false, `${where} needs a "value" (a string or null).`];
    if (!CATEGORY_ORDER.includes(e.category as TagCategory)) {
      return [false, `${where}'s "category" must be one of ${CATEGORY_ORDER.join(', ')}.`];
    }
  }
  return [true, data as KnownTag[]];
}
