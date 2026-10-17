// Styles shared by components: buttons, inputs, badges and the like.

import { css } from 'lit';

export const shared = css`
  :host {
    box-sizing: border-box;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  button {
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    transition: background 0.12s, border-color 0.12s;
  }
  button:hover:not(:disabled) {
    background: var(--surface-2);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }
  button.primary:hover:not(:disabled) {
    filter: brightness(1.08);
    background: var(--accent);
  }
  button.danger {
    color: var(--bad);
  }
  button.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--fg-2);
  }
  button.ghost:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--fg);
  }
  button.small {
    padding: 3px 8px;
    font-size: 12px;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  input[type='text'],
  input[type='search'],
  input[type='number'],
  select {
    font: inherit;
    font-size: 13px;
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: 5px 8px;
    min-width: 0;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    padding: 3px 6px;
    border-radius: 999px;
    white-space: nowrap;
    background: var(--surface-3);
    color: var(--fg-2);
  }
  .badge.queued {
    background: var(--queued-soft);
    color: var(--queued);
  }
  .badge.skipped {
    background: var(--skipped-soft);
    color: var(--skipped);
  }
  .badge.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .badge.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .badge.bad {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .badge.accent {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .muted {
    color: var(--fg-3);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
`;
