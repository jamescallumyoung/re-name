// Step 3, Tags & names (design doc, sections 7.2 and 9.4). Tags are stored per
// file but edited per tag: each tag found in the Job is one row with one value for
// every file, and "Per file" opens the files that have it, to change one. Below,
// the new names the server worked out.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { AnalysedFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { columnsOf, effectiveValue, groupByFolder, hasCellValue, type TagColumn, tagKey } from '../lib/draft.ts';
import { base, buttons, fields, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import { renderNewName } from './new-name.ts';

/** An empty value drops the tag. */
const toValue = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const splitGroups = (s: string) => s.split(/[,\s]+/).map((g) => g.replace(/^-/, '')).filter(Boolean);
const GROUPS = 'groups';

@customElement('tags-step')
export class TagsStep extends LitElement {
  private readonly c = new StoreController(this);
  /** Tags whose files are shown: view state only. */
  @state()
  accessor open = new Set<string>();

  static override styles = [
    base,
    buttons,
    fields,
    pills,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }
      h2 {
        margin: 0 0 0.3rem;
        color: var(--fg);
        font-size: 1.15rem;
      }
      .note {
        color: var(--muted);
        font-size: 0.875rem;
        margin: 0 0 1rem;
      }
      .list {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.8rem;
        overflow: hidden;
      }
      .tag {
        border-top: 1px solid var(--line-soft);
      }
      .tag:first-child {
        border-top: none;
      }
      .tag-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 1.25rem minmax(9rem, 14rem) 12rem;
        gap: 0.9rem;
        align-items: center;
        padding: 0.7rem 1rem;
      }
      .source {
        min-width: 0;
      }
      .source .text {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 0.85rem;
      }
      .source .meta {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        color: var(--muted);
        font-size: 0.78rem;
        margin-top: 0.15rem;
      }
      .to {
        width: 1.1rem;
        height: 1.1rem;
        color: var(--faint);
      }
      input.value {
        width: 100%;
        font-family: var(--font-mono);
        font-size: 0.82rem;
      }
      input.value.changed {
        border-color: var(--accent-line);
        background: var(--accent-soft);
      }
      input.value.dropped {
        text-decoration: line-through;
      }
      input.value::placeholder {
        color: var(--faint);
        font-style: italic;
      }
      .tools {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        justify-content: flex-end;
      }
      .icon-btn {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.4rem;
        color: var(--muted);
      }
      .icon-btn:hover:not(:disabled) {
        color: var(--fg);
        background: var(--panel-2);
      }
      .icon-btn:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .icon-btn svg {
        width: 1rem;
        height: 1rem;
      }
      .per-file {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.35rem 0.55rem;
        border-radius: 0.4rem;
      }
      .per-file:hover {
        color: var(--fg);
        background: var(--panel-2);
      }
      .per-file svg {
        width: 0.95rem;
        height: 0.95rem;
        transition: transform 0.15s;
      }
      .per-file.open svg {
        transform: rotate(90deg);
      }
      .per-file .n {
        color: var(--accent-text);
      }
      .files {
        background: var(--bg);
        border-top: 1px solid var(--line-soft);
        padding: 0.4rem 0;
      }
      .file-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(9rem, 14rem) 2rem;
        gap: 0.9rem;
        align-items: center;
        padding: 0.35rem 1rem 0.35rem 2.2rem;
      }
      .file-row .name {
        color: var(--fg-2);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .names {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.8rem;
        padding: 0.5rem 0;
      }
      .folder {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.6rem 1rem 0.3rem;
      }
      .folder svg {
        width: 0.95rem;
        height: 0.95rem;
      }
      .name-row {
        padding: 0.45rem 1rem 0.45rem 2.2rem;
      }
      .name-row .new {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 0.8rem;
        overflow-wrap: anywhere;
      }
      .name-row .old {
        color: var(--faint);
        font-family: var(--font-mono);
        font-size: 0.7rem;
        overflow-wrap: anywhere;
      }
      .name-row .problem {
        color: var(--bad-text);
        font-size: 0.82rem;
        display: flex;
        gap: 0.35rem;
        align-items: center;
      }
      .name-row .problem svg,
      .name-row .warning svg {
        width: 0.9rem;
        height: 0.9rem;
      }
      .name-row .warning {
        color: var(--warn-text);
        font-size: 0.75rem;
        display: flex;
        gap: 0.35rem;
        align-items: center;
      }
      .dup {
        color: var(--warn-text);
        background: var(--warn-soft);
        border-radius: 0.25rem;
        padding: 0 0.2rem;
        font-weight: 700;
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const columns = columnsOf(draft.files);
    return html`
      <section>
        <h2>Tags</h2>
        <p class="note">
          Each tag found in the file names, and what it becomes. Change a value for every file here, or open
          <b>Per file</b> to change one. An empty value drops the tag.
        </p>
        <div class="list">
          ${columns.map((col) => this.renderTag(col))} ${this.renderGroups()}
        </div>
      </section>
      <section>
        <h2>New names</h2>
        <p class="note">Worked out by the server, in the order and format your media server expects.</p>
        ${this.renderNames()}
      </section>
    `;
  }

  private renderTag(col: TagColumn) {
    const store = this.c.store;
    const draft = store.draft;
    if (!draft) return nothing;
    const set = col.key in draft.columns;
    const value = set ? draft.columns[col.key] ?? null : col.defaultValue;
    const files = draft.files.filter((f) => f.tags.some((t) => tagKey(t) === col.key));
    const own = files.filter((f) => hasCellValue(draft, f.path, col.key)).length;
    const open = this.open.has(col.key);
    return html`
      <div class="tag">
        <div class="tag-row">
          <div class="source">
            <div class="text">${col.sources.join(' · ')}</div>
            <div class="meta">
              ${col.count === draft.files.length ? 'every file' : `${col.count} of ${draft.files.length} files`}
              ${col.known
                ? nothing
                : html`<span class="pill dim" title="Not in the known-tags file: kept as it is">unknown</span>`}
            </div>
          </div>
          ${icon('arrow', 'to')}
          <input
            type="text"
            class="value ${set ? 'changed' : ''} ${value === null ? 'dropped' : ''}"
            aria-label=${`${col.sources[0]} becomes`}
            placeholder="dropped"
            .value=${value ?? ''}
            @input=${(e: Event) => store.setColumn(col.key, toValue((e.target as HTMLInputElement).value))}
          />
          <div class="tools">
            <button class="icon-btn" title="Drop this tag" ?disabled=${value === null} @click=${() =>
              store.setColumn(col.key, null)}>${icon('x')}</button>
            <button class="icon-btn" title="Back to the known-tags value" ?disabled=${!set} @click=${() =>
              store.setColumn(col.key, undefined)}>${icon('undo')}</button>
            <button class="per-file ${open ? 'open' : ''}" aria-expanded=${open} @click=${() => this.toggle(col.key)}>
              ${icon('chev')} Per file${own
                ? html`
                  <span class="n">· ${own} changed</span>
                `
                : nothing}
            </button>
          </div>
        </div>
        ${open
          ? html`<div class="files">
            ${
            files.map((f) => {
              const tag = f.tags.find((t) => tagKey(t) === col.key);
              if (!tag) return nothing;
              const v = effectiveValue(draft, f.path, tag);
              const changed = hasCellValue(draft, f.path, col.key);
              return html`
                <div class="file-row">
                  <span class="name" title=${f.path}>${this.shortName(f)}</span>
                  <input
                    type="text"
                    class="value ${changed ? 'changed' : ''} ${v === null ? 'dropped' : ''}"
                    aria-label=${`${tag.source} in ${f.path}`}
                    placeholder="dropped"
                    .value=${v ?? ''}
                    @input=${(e: Event) =>
                      store.setCell(f.path, col.key, toValue((e.target as HTMLInputElement).value))}
                  />
                  <button class="icon-btn" title="Back to the value for every file" ?disabled=${!changed}
                    @click=${() => store.setCell(f.path, col.key, undefined)}>${icon('undo')}</button>
                </div>
              `;
            })
          }
          </div>`
          : nothing}
      </div>
    `;
  }

  private renderGroups() {
    const store = this.c.store;
    const draft = store.draft;
    if (!draft) return nothing;
    const all = new Set(draft.files.map((f) => (draft.groups[f.path] ?? []).join(', ')));
    const common = all.size === 1 ? [...all][0] ?? '' : null;
    const open = this.open.has(GROUPS);
    return html`
      <div class="tag">
        <div class="tag-row">
          <div class="source">
            <div class="text">Release groups</div>
            <div class="meta">${common === null ? 'they differ between files' : 'the same in every file'}</div>
          </div>
          ${icon('arrow', 'to')}
          <input
            type="text"
            class="value"
            aria-label="Release groups for every file"
            placeholder=${common === null ? 'set for every file…' : 'none'}
            .value=${common ?? ''}
            @change=${(e: Event) => store.setAllGroups(splitGroups((e.target as HTMLInputElement).value))}
          />
          <div class="tools">
            <button class="per-file ${open ? 'open' : ''}" aria-expanded=${open} @click=${() => this.toggle(GROUPS)}>
              ${icon('chev')} Per file
            </button>
          </div>
        </div>
        ${open
          ? html`<div class="files">
            ${
            draft.files.map(
              (f) =>
                html`
                  <div class="file-row">
                    <span class="name" title=${f.path}>${this.shortName(f)}</span>
                    <input
                      type="text"
                      class="value"
                      aria-label=${`Release groups in ${f.path}`}
                      placeholder="none"
                      .value=${(draft.groups[f.path] ?? []).join(', ')}
                      @change=${(e: Event) =>
                        store.setGroups(f.path, splitGroups((e.target as HTMLInputElement).value))}
                    />
                    <span></span>
                  </div>
                `,
            )
          }
          </div>`
          : nothing}
      </div>
    `;
  }

  private renderNames() {
    const store = this.c.store;
    const draft = store.draft;
    if (!draft) return nothing;
    return html`<div class="names">
      ${
      groupByFolder(draft.files).map(
        ([folder, files]) =>
          html`<div class="folder">${icon('folder')} ${folder || `${store.session?.sourceName}/`}</div>
          ${
            files.map((f) => {
              const p = draft.preview?.files.find((x) => x.path === f.path);
              return html`<div class="name-row">
              ${
                !p
                  ? html`<div class="old">Working out the name…</div>`
                  : p.error
                  ? html`<div class="problem">${icon('alert')} ${p.error}</div>`
                  : html`<div class="new">${renderNewName(p.newPath?.split('/').pop() ?? '')}</div>`
              }
              <div class="old">was ${f.path.slice(f.path.lastIndexOf('/') + 1)}</div>
              ${p?.warnings.map((w) => html`<div class="warning">${icon('alert')} ${w}</div>`)}
            </div>`;
            })
          }`,
      )
    }
    </div>`;
  }

  /** For TV, the episode code is the quickest way to tell files apart. */
  private shortName(f: AnalysedFile): string {
    const e = this.c.store.draft?.episodes[f.path];
    const name = f.path.slice(f.path.lastIndexOf('/') + 1);
    if (this.c.store.draft?.match?.type !== 'tv' || !e || e.season === null || e.episode === null) return name;
    return `S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')} · ${name}`;
  }

  private toggle(key: string): void {
    const next = new Set(this.open);
    next.has(key) ? next.delete(key) : next.add(key);
    this.open = next;
  }
}
