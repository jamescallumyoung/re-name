// POC ONLY: the header colour presets in tokens.css, to compare them. Picked with
// `?headers=<id>` in the URL, or the switcher by the POC button; remembered in
// localStorage.

export const HEADER_PRESETS = [
  { id: 'tonal', name: 'Tonal: dark gold, sage, sand' },
  { id: 'filled', name: 'Filled: gold, sage, sand' },
  { id: 'cool', name: 'Cool: teal, gold, indigo' },
  { id: 'warm', name: 'Warm: amber, terracotta, plum' },
  { id: 'light', name: 'Light: cream, gold, parchment' },
  { id: 'ink', name: 'Ink: black and gold, slate, wine' },
] as const;

export type HeaderPreset = (typeof HEADER_PRESETS)[number]['id'];

const KEY = 're-name.poc.headers';
const isPreset = (v: string | null): v is HeaderPreset => HEADER_PRESETS.some((p) => p.id === v);

export function currentPreset(): HeaderPreset {
  const v = document.documentElement.dataset['headers'] ?? null;
  return isPreset(v) ? v : 'tonal';
}

export function applyPreset(id: HeaderPreset): void {
  document.documentElement.dataset['headers'] = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Only a convenience: it's fine not to remember.
  }
}

/** The preset from the URL, else the remembered one, else the default. */
export function applyInitialPreset(): void {
  let id: string | null = new URLSearchParams(location.search).get('headers');
  if (!isPreset(id)) {
    try {
      id = localStorage.getItem(KEY);
    } catch {
      id = null;
    }
  }
  applyPreset(isPreset(id) ? id : 'tonal');
}
