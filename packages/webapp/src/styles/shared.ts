// Shared component styles: a plain utility look. Colours and fonts come from tokens.css.

import { css } from 'lit';

/** Base rules every component adopts. */
export const base = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font-ui);
    font-size: 13px;
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
    outline: 1px solid var(--accent);
    outline-offset: 1px;
  }
  svg.i {
    width: 14px;
    height: 14px;
    flex: none;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .muted {
    color: var(--muted);
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
`;

export const buttons = css`
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    background: var(--surface-2);
    color: var(--fg);
    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    background: var(--surface-3);
  }
  .btn.primary {
    background: var(--accent-strong);
    border-color: var(--accent);
    color: #fff;
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--accent);
  }
  .btn.danger {
    color: var(--bad);
  }
  .btn.ghost {
    background: none;
    border-color: transparent;
    color: var(--muted);
  }
  .btn.ghost:hover:not(:disabled) {
    color: var(--fg);
    background: var(--surface-2);
  }
  .btn.sm {
    height: 24px;
    padding: 0 8px;
    font-size: 11.5px;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn svg {
    width: 13px;
    height: 13px;
  }
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    color: var(--muted);
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--fg);
    background: var(--surface-3);
  }
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .icon-btn svg {
    width: 13px;
    height: 13px;
  }
`;

export const fields = css`
  input[type='text'],
  input[type='search'],
  input[type='number'],
  select {
    font: inherit;
    font-size: 12.5px;
    height: 28px;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 0 8px;
    min-width: 0;
  }
  input:focus,
  select:focus {
    border-color: var(--accent);
    outline: none;
  }
  input[type='checkbox'],
  input[type='radio'] {
    accent-color: var(--accent);
    width: 14px;
    height: 14px;
    margin: 0;
    cursor: pointer;
  }
  input[type='checkbox']:disabled {
    cursor: default;
  }
`;

/** Small square badges. */
export const tags = css`
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 18px;
    padding: 0 5px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    color: var(--fg-2);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    text-transform: uppercase;
  }
  .tag svg {
    width: 11px;
    height: 11px;
  }
  .tag.accent {
    border-color: var(--accent-line);
    color: var(--accent-text);
    background: var(--accent-soft);
  }
  .tag.warn {
    border-color: rgba(255, 197, 61, 0.45);
    color: var(--warn);
    background: var(--warn-soft);
  }
  .tag.bad {
    border-color: rgba(255, 99, 105, 0.45);
    color: var(--bad);
    background: var(--bad-soft);
  }
  .tag.ok {
    border-color: rgba(61, 214, 140, 0.4);
    color: var(--ok);
    background: var(--ok-soft);
  }
  .tag.dim {
    border-color: var(--line);
    color: var(--faint);
  }
`;

/** A section of the page: a header bar with a label, then its body. */
export const section = css`
  :host {
    display: block;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 12px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
  }
  .head h2 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg);
  }
  .head .count {
    color: var(--muted);
    font-size: 12px;
  }
  .head .grow {
    flex: 1;
  }
  .empty {
    padding: 28px 16px;
    color: var(--muted);
    text-align: center;
    line-height: 1.6;
  }
  .empty b {
    color: var(--fg);
  }
`;
