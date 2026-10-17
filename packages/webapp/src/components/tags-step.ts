// Step 3, Tags & names (design doc, sections 7.2 and 9.4). Tags are stored per
// file but edited per tag: each tag found in the Job is one row with one value for
// every file, and "Per file" opens the files that have it, to change one. Below,
// the new names the server worked out.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { AnalysedFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { columnsOf, effectiveValue, groupByFolder, hasCellValue, type TagColumn, tagKey } from '../lib/draft.ts';
import { base, buttons, fields, tags } from '../styles/shared.ts';
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
    tags,
    css`
      :host {
        display: grid;
        gap: 28px;
      }
      .label {
        margin-bottom: 10px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .label span {
        text-transform: none;
        letter-spacing: 0;
        font-weight: 400;
        font-size: 14px;
      }
      .list {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
      }
      .tag-row,
      .file-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 100px 18px 220px 130px;
        gap: 14px;
        align-items: center;
        min-height: 54px;
        padding: 6px 16px;
        border-top: 1px solid var(--line);
      }
      .list > .item:first-child > .tag-row {
        border-top: none;
      }
      .source {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 13.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .source.plain {
        font-family: var(--font-ui);
        font-weight: 600;
      }
      .n {
        color: var(--muted);
        font-size: 13px;
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .to {
        width: 14px;
        height: 14px;
        color: var(--faint);
      }
      input.value {
        width: 100%;
        font-family: var(--font-mono);
        font-size: 13.5px;
      }
      input.value.changed {
        border-color: var(--primary-line);
        background: var(--primary-soft);
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
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
      }
      .per-file {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        height: 32px;
        padding: 0 8px;
        border-radius: var(--radius);
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .per-file:hover {
        color: var(--fg);
        background: var(--surface-3);
      }
      .per-file svg {
        width: 12px;
        height: 12px;
      }
      .per-file.open svg {
        transform: rotate(90deg);
      }
      .per-file .changed {
        color: var(--on-primary-container);
      }
      .file-row {
        background: var(--bg);
        padding-left: 36px;
      }
      .file-row .fname {
        grid-column: 1 / 3;
        color: var(--fg-2);
        font-family: var(--font-mono);
        font-size: 12.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file-row input {
        grid-column: 4;
      }
      .names .folder {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 42px;
        padding: 0 16px;
        background: var(--surface-2);
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .names .folder:first-child {
        border-top: none;
      }
      .names .folder svg {
        width: 13px;
        height: 13px;
      }
      .name-row {
        padding: 10px 16px 10px 36px;
        border-top: 1px solid var(--line);
      }
      .new {
        color: var(--fg);
        font-family: var(--font-mono);
        font-size: 13.5px;
        overflow-wrap: anywhere;
      }
      .old {
        color: var(--faint);
        font-family: var(--font-mono);
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .problem,
      .warning {
        display: flex;
        gap: 5px;
        align-items: center;
        font-size: 12px;
      }
      .problem {
        color: var(--bad);
      }
      .warning {
        color: var(--warn);
        font-size: 11px;
      }
      .problem svg,
      .warning svg {
        width: 12px;
        height: 12px;
      }
      .dup {
        color: var(--warn);
        background: var(--warn-soft);
        padding: 0 2px;
        font-weight: 700;
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    return html`
      <div>
        <div class="label">Tags <span>· one value for every file; an empty value drops the tag</span></div>
        <div class="list">${columnsOf(draft.files).map((col) => this.renderTag(col))} ${this.renderGroups()}</div>
      </div>
      <div>
        <div class="label">New names <span>· worked out by the server</span></div>
        ${this.renderNames()}
      </div>
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
      <div class="item">
        <div class="tag-row">
          <span class="source" title=${col.sources.join(', ')}>${col.sources.join(' · ')}</span>
          <span class="n">
            ${col.count === draft.files.length ? 'all files' : `${col.count} of ${draft.files.length}`}
            ${col.known
              ? nothing
              : html`<span class="tag dim" title="Not in the known-tags file: kept as it is">?</span>`}
          </span>
          ${icon('arrow', 'to')}
          <input
            type="text"
            class="value ${set ? 'changed' : ''} ${value === null ? 'dropped' : ''}"
            aria-label=${`${col.sources[0]} becomes`}
            placeholder="dropped"
            .value=${value ?? ''}
            @input=${(e: Event) => store.setColumn(col.key, toValue((e.target as HTMLInputElement).value))}
          />
          <span class="tools">
            <button class="icon-btn" title="Drop this tag" ?disabled=${value === null} @click=${() =>
              store.setColumn(col.key, null)}>${icon('x')}</button>
            <button class="icon-btn" title="Back to the known-tags value" ?disabled=${!set} @click=${() =>
              store.setColumn(col.key, undefined)}>${icon('undo')}</button>
            <button class="per-file ${open ? 'open' : ''}" aria-expanded=${open} @click=${() => this.toggle(col.key)}>
              ${icon('chev')} Files${own ? html`<span class="changed">·${own}</span>` : nothing}
            </button>
          </span>
        </div>
        ${open
          ? files.map((f) => {
            const tag = f.tags.find((t) => tagKey(t) === col.key);
            if (!tag) return nothing;
            const v = effectiveValue(draft, f.path, tag);
            const changed = hasCellValue(draft, f.path, col.key);
            return html`
              <div class="file-row">
                <span class="fname" title=${f.path}>${this.shortName(f)}</span>
                <input
                  type="text"
                  class="value ${changed ? 'changed' : ''} ${v === null ? 'dropped' : ''}"
                  aria-label=${`${tag.source} in ${f.path}`}
                  placeholder="dropped"
                  .value=${v ?? ''}
                  @input=${(e: Event) => store.setCell(f.path, col.key, toValue((e.target as HTMLInputElement).value))}
                />
                <span class="tools">
                  <button class="icon-btn" title="Back to the value for every file" ?disabled=${!changed}
                    @click=${() => store.setCell(f.path, col.key, undefined)}>${icon('undo')}</button>
                </span>
              </div>
            `;
          })
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
      <div class="item">
        <div class="tag-row">
          <span class="source plain">Release groups</span>
          <span class="n">${common === null ? 'differ' : 'all files'}</span>
          ${icon('arrow', 'to')}
          <input
            type="text"
            class="value"
            aria-label="Release groups for every file"
            placeholder=${common === null ? 'set for every file…' : 'none'}
            .value=${common ?? ''}
            @change=${(e: Event) => store.setAllGroups(splitGroups((e.target as HTMLInputElement).value))}
          />
          <span class="tools">
            <button class="per-file ${open ? 'open' : ''}" aria-expanded=${open} @click=${() => this.toggle(GROUPS)}>
              ${icon('chev')} Files
            </button>
          </span>
        </div>
        ${open
          ? draft.files.map(
            (f) =>
              html`
                <div class="file-row">
                  <span class="fname" title=${f.path}>${this.shortName(f)}</span>
                  <input
                    type="text"
                    class="value"
                    aria-label=${`Release groups in ${f.path}`}
                    placeholder="none"
                    .value=${(draft.groups[f.path] ?? []).join(', ')}
                    @change=${(e: Event) => store.setGroups(f.path, splitGroups((e.target as HTMLInputElement).value))}
                  />
                  <span></span>
                </div>
              `,
          )
          : nothing}
      </div>
    `;
  }

  private renderNames() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    return html`<div class="list names">
      ${
      groupByFolder(draft.files).map(
        ([folder, files]) =>
          html`<div class="folder">${icon('folder')} ${folder || '(top level)'}</div>
          ${
            files.map((f) => {
              const p = draft.preview?.files.find((x) => x.path === f.path);
              return html`<div class="name-row">
              ${
                !p
                  ? html`<div class="old">working out the name…</div>`
                  : p.error
                  ? html`<div class="problem">${icon('alert')} ${p.error}</div>`
                  : html`<div class="new">${renderNewName(p.newPath?.split('/').pop() ?? '')}</div>`
              }
              <div class="old">${f.path.slice(f.path.lastIndexOf('/') + 1)}</div>
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
    return `S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')}  ${name}`;
  }

  private toggle(key: string): void {
    const next = new Set(this.open);
    next.has(key) ? next.delete(key) : next.add(key);
    this.open = next;
  }
}
