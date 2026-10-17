// Shared component styles, loosely after Material 3: tonal surfaces, filled and tonal
// buttons, state layers on hover. Colours and fonts come from tokens.css.

import { css } from 'lit';

/** Base rules every component adopts. */
export const base = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font-ui);
    font-size: 14px;
    line-height: 1.45;
    color: var(--fg-2);
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  :focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  svg.i {
    width: 18px;
    height: 18px;
    flex: none;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
  .muted {
    color: var(--muted);
  }
`;

export const buttons = css`
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 36px;
    padding: 0 16px;
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--fg);
    font-weight: 600;
    font-size: 13.5px;
    letter-spacing: 0.01em;
    white-space: nowrap;
    transition:
      background 0.15s,
      box-shadow 0.15s;
  }
  .btn:hover:not(:disabled) {
    background: rgba(237, 231, 218, 0.06);
  }
  /* Filled: the one main action. */
  .btn.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--on-primary);
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--primary-hover);
    box-shadow: var(--shadow-1);
  }
  /* Tonal: secondary actions. */
  .btn.tonal {
    background: var(--primary-container);
    border-color: transparent;
    color: var(--on-primary-container);
  }
  .btn.tonal:hover:not(:disabled) {
    background: color-mix(in srgb, var(--primary-container) 85%, var(--primary));
  }
  .btn.text {
    border-color: transparent;
    color: var(--primary);
    padding: 0 12px;
  }
  .btn.text:hover:not(:disabled) {
    background: var(--primary-soft);
  }
  .btn.danger {
    color: var(--bad);
  }
  .btn.sm {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }
  .btn:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }
  .btn svg {
    width: 16px;
    height: 16px;
  }
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius);
    color: var(--muted);
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--fg);
    background: rgba(237, 231, 218, 0.08);
  }
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .icon-btn svg {
    width: 17px;
    height: 17px;
  }
`;

export const fields = css`
  input[type='text'],
  input[type='search'],
  input[type='number'],
  select {
    font: inherit;
    font-size: 14px;
    height: 38px;
    color: var(--fg);
    background: var(--surface-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 0 10px;
    min-width: 0;
  }
  input:hover,
  select:hover {
    border-color: var(--muted);
  }
  input:focus,
  select:focus {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 1px var(--primary);
    outline: none;
  }
  input[type='checkbox'],
  input[type='radio'] {
    accent-color: var(--primary);
    width: 17px;
    height: 17px;
    margin: 0;
    cursor: pointer;
  }
  input[type='checkbox']:disabled {
    cursor: default;
  }
`;

/** Small chips. */
export const tags = css`
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 8px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: var(--secondary-container);
    color: var(--on-secondary-container);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .tag svg {
    width: 13px;
    height: 13px;
  }
  .tag.primary {
    border-color: transparent;
    background: var(--primary-container);
    color: var(--on-primary-container);
  }
  .tag.warn {
    border-color: transparent;
    background: var(--warn-soft);
    color: var(--warn);
  }
  .tag.bad {
    border-color: transparent;
    background: var(--bad-soft);
    color: var(--bad);
  }
  .tag.dim {
    border-color: var(--line);
    background: none;
    color: var(--faint);
  }
`;

/** The shared header bar: everything in `.head` takes the header colours (tokens.css). */
export const headColours = css`
  .head {
    background: var(--head-bg);
    color: var(--head-muted);
    border-bottom-color: transparent;
  }
  .head h1,
  .head h2,
  .head .title {
    color: var(--head-fg);
  }
  .head .count,
  .head .muted {
    color: var(--head-muted);
  }
  .head .hl {
    color: var(--head-accent);
  }
  .head .btn.text,
  .head .btn.text.danger {
    color: var(--head-accent);
  }
  .head .btn.text:hover:not(:disabled) {
    background: color-mix(in srgb, var(--head-accent) 16%, transparent);
  }
  .head .btn.primary {
    background: var(--head-btn-bg);
    border-color: var(--head-btn-bg);
    color: var(--head-btn-fg);
  }
  .head .btn.primary:hover:not(:disabled) {
    background: var(--head-btn-bg);
    filter: brightness(1.08);
  }
  .head .icon-btn {
    color: var(--head-muted);
  }
  .head .icon-btn:hover:not(:disabled) {
    color: var(--head-fg);
    background: color-mix(in srgb, var(--head-fg) 12%, transparent);
  }
  .head :focus-visible {
    outline-color: var(--head-fg);
  }
`;

/** A card on the overview: a title row, then its body. */
export const card = css`
  :host {
    display: block;
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 10px 16px 10px 20px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  ${headColours} /* Colours come from headColours. */
    .head h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
  }
  .head .grow {
    flex: 1;
  }
  .empty {
    padding: 40px 20px;
    color: var(--muted);
    text-align: center;
    line-height: 1.6;
  }
  .empty b {
    color: var(--fg);
  }
`;
