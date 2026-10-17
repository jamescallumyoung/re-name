// Shared component styles, after Loadout's. Colours and fonts come from tokens.css.

import { css } from 'lit';

/** Base rules every component adopts. */
export const base = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font-ui);
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
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  svg.i {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
  .muted {
    color: var(--muted);
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
      animation-duration: 2s !important;
    }
  }
`;

export const buttons = css`
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.5rem 1rem;
    border-radius: 0.45rem;
    font-weight: 600;
    font-size: 0.875rem;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--fg);
    transition:
      background 0.15s,
      border-color 0.15s;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--muted);
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
    background: var(--bad-soft);
    border-color: rgba(248, 113, 113, 0.5);
    color: var(--bad-text);
  }
  .btn.ghost {
    background: none;
    border-color: transparent;
    color: var(--muted);
  }
  .btn.ghost:hover:not(:disabled) {
    color: var(--fg);
    border-color: var(--line);
  }
  .btn.sm {
    padding: 0.3rem 0.65rem;
    font-size: 0.8rem;
  }
  .btn.lg {
    padding: 0.7rem 1.4rem;
    font-size: 0.95rem;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .btn svg {
    width: 1rem;
    height: 1rem;
  }
`;

export const fields = css`
  input[type='text'],
  input[type='search'],
  input[type='number'],
  select {
    font: inherit;
    font-size: 0.875rem;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 0.45rem;
    padding: 0.45rem 0.65rem;
    min-width: 0;
  }
  input:focus,
  select:focus {
    border-color: var(--accent);
    outline: none;
  }
  input[type='checkbox'] {
    accent-color: var(--accent);
    width: 1rem;
    height: 1rem;
    margin: 0;
    cursor: pointer;
  }
  input[type='checkbox']:disabled {
    cursor: default;
  }
`;

export const pills = css`
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--fg-2);
  }
  .pill svg {
    width: 0.8rem;
    height: 0.8rem;
  }
  .pill.ok {
    background: var(--ok-soft);
    color: var(--ok-text);
    border-color: rgba(34, 197, 94, 0.4);
  }
  .pill.q {
    background: var(--accent-soft);
    color: var(--accent-text);
    border-color: var(--accent-line);
  }
  .pill.warn {
    background: var(--warn-soft);
    color: var(--warn-text);
    border-color: rgba(234, 179, 8, 0.4);
  }
  .pill.bad {
    background: var(--bad-soft);
    color: var(--bad-text);
    border-color: rgba(248, 113, 113, 0.45);
  }
  .pill.dim {
    color: var(--faint);
    background: none;
  }
`;

export const spinner = css`
  .spin {
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    flex: none;
    border: 2px solid currentColor;
    border-right-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

/** Layout shared by every page. */
export const pageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    padding: 1.75rem 2.25rem 6rem;
    max-width: 72rem;
  }
  .page-title {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .page-title h1 {
    margin: 0;
    color: var(--fg);
    font-size: 1.85rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .page-title .sub {
    color: var(--muted);
    margin-top: 0.3rem;
    line-height: 1.5;
  }
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 0.8rem;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
    flex-wrap: wrap;
  }
  .section-head h2 {
    margin: 0;
    color: var(--fg);
    font-size: 1.15rem;
    font-weight: 700;
  }
  .section-head .note {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--muted);
    line-height: 1.5;
  }
  .empty-state svg {
    width: 2rem;
    height: 2rem;
    color: var(--faint);
  }
  .empty-state b {
    color: var(--fg);
    font-size: 1.05rem;
  }
  /* The bar that sticks to the bottom of a page, for its main action. */
  .action-bar {
    position: fixed;
    left: 16rem;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.9rem 2.25rem;
    background: rgba(11, 17, 28, 0.92);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--line);
  }
  .action-bar .summary {
    margin-right: auto;
    color: var(--fg-2);
  }
  .action-bar .summary b {
    color: var(--fg);
  }
  @media (max-width: 900px) {
    :host {
      padding: 1.25rem 1rem 6rem;
    }
    .page-title h1 {
      font-size: 1.5rem;
    }
    .action-bar {
      left: 0;
      padding: 0.8rem 1rem;
    }
  }
`;
