// MOCK: the known-tags config file (design doc, section 9.4). The real one lives
// in the user's config folder; this is a stand-in with sensible defaults.

export type TagCategory = 'resolution' | 'source' | 'service' | 'hdr' | 'audio' | 'codec' | 'other';

export interface KnownTag {
  /** Matched against one or more dot-separated tokens, case-insensitively. */
  pattern: string;
  /** The output value; `null` drops the tag. */
  value: string | null;
  category: TagCategory;
}

/** The order tags appear in a new name: the server decides it (section 9.3). */
export const CATEGORY_ORDER: readonly TagCategory[] = [
  'resolution',
  'source',
  'service',
  'hdr',
  'audio',
  'codec',
  'other',
];

export const KNOWN_TAGS: readonly KnownTag[] = [
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
  { pattern: 'x265|265', value: 'x265', category: 'codec' },
  { pattern: 'h\\.?265|hevc', value: 'H.265', category: 'codec' },
  { pattern: 'x264|264', value: 'x264', category: 'codec' },
  { pattern: 'h\\.?264|avc', value: 'H.264', category: 'codec' },
  { pattern: '10bit', value: '10bit', category: 'other' },
  { pattern: 'repack', value: 'REPACK', category: 'other' },
  { pattern: 'proper', value: 'PROPER', category: 'other' },
];

const COMPILED = KNOWN_TAGS.map((tag) => ({ tag, re: new RegExp(`^(?:${tag.pattern})(?=\\.|$)`, 'i') }));

/** The known tag matching the longest run of tokens at the start of `text`. */
export function matchKnownTag(text: string): { tag: KnownTag; length: number } | null {
  let best: { tag: KnownTag; length: number } | null = null;
  for (const { tag, re } of COMPILED) {
    const m = re.exec(text);
    if (m && (best === null || m[0].length > best.length)) best = { tag, length: m[0].length };
  }
  return best;
}

/** The category of a known tag's source text, or `other` for an unknown one. */
export function categoryOf(source: string): TagCategory {
  const m = matchKnownTag(source);
  return m && m.length === source.length ? m.tag.category : 'other';
}
