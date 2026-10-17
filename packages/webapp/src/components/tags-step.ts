// Step 3, Tags & names (design doc, sections 7.2 and 9.4): one grid per Job, a row
// per file and a column per tag. A column header sets every file's value; a cell
// sets one file's. Under each row, the new name the server worked out.
// This is the first of the grid designs the doc expects to iterate on.

import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { AnalysedFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { columnsOf, effectiveValue, groupByFolder, hasCellValue, type TagColumn, tagKey } from '../lib/draft.ts';
import { shared } from '../styles/shared.ts';
import { renderNewName } from './new-name.ts';

/** An empty value drops the tag. */
const toValue = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const splitGroups = (s: string) => s.split(/[,\s]+/).map((g) => g.replace(/^-/, '')).filter(Boolean);

@customElement('tags-step')
export class TagsStep extends LitElement {
  private readonly c = new StoreController(this);

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        padding: 16px 18px 24px;
      }
      .intro {
        font-size: 14px;
        margin: 0 0 6px;
      }
      .help {
        font-size: 12px;
        color: var(--fg-3);
        margin: 0 0 14px;
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }
      .scroll {
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        max-height: calc(100vh - 330px);
      }
      table {
        border-collapse: separate;
        border-spacing: 0;
        font-size: 12px;
        min-width: 100%;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border-strong);
        padding: 8px;
        text-align: left;
        vertical-align: bottom;
        font-weight: 600;
      }
      th.file,
      td.file {
        position: sticky;
        left: 0;
        z-index: 1;
        background: var(--surface);
        min-width: 220px;
        max-width: 280px;
        border-right: 1px solid var(--border);
      }
      thead th.file {
        z-index: 3;
        background: var(--surface-2);
      }
      .col-head {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 110px;
      }
      .sources {
        font-family: var(--font-mono);
        font-weight: 500;
        color: var(--fg-2);
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .sources .badge {
        font-family: var(--font-ui);
      }
      .control {
        display: flex;
        gap: 2px;
        align-items: center;
      }
      .control input {
        width: 100%;
        min-width: 70px;
        padding: 3px 6px;
        font-family: var(--font-mono);
        font-size: 12px;
      }
      .control input.set {
        border-color: var(--accent);
        background: var(--accent-soft);
      }
      .control input.dropped {
        text-decoration: line-through;
      }
      .control input.dropped::placeholder {
        color: var(--bad);
        font-style: italic;
        text-decoration: none;
      }
      .icon {
        border: none;
        background: none;
        padding: 2px 4px;
        color: var(--fg-3);
        font-size: 12px;
      }
      .icon:hover:not(:disabled) {
        color: var(--fg);
        background: var(--surface-3);
      }
      td {
        padding: 6px 8px;
        border-top: 1px solid var(--border);
        vertical-align: middle;
      }
      td.empty {
        color: var(--fg-3);
        text-align: center;
      }
      tr.folder td {
        background: var(--surface-2);
        font-family: var(--font-mono);
        font-weight: 600;
        font-size: 11px;
        color: var(--fg-2);
        padding: 5px 8px;
      }
      td.file .name {
        font-family: var(--font-mono);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
      }
      tr.preview td {
        border-top: none;
        padding-top: 0;
        padding-bottom: 8px;
      }
      .new {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ok);
        white-space: nowrap;
      }
      .new.error {
        color: var(--bad);
        font-family: var(--font-ui);
      }
      .warn {
        color: var(--warn);
        font-family: var(--font-ui);
        margin-left: 8px;
      }
      .dup {
        background: var(--warn-soft);
        color: var(--warn);
        border-radius: 3px;
        padding: 0 3px;
        font-weight: 700;
      }
    `,
  ];

  override render() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const columns = columnsOf(draft.files);
    const span = columns.length + 2;
    return html`
      <p class="intro">Check the tags each file will keep. The server orders them and builds each name.</p>
      <p class="help">
        <span><b>Header</b>: sets the value for every file with that tag.</span>
        <span><b>Cell</b>: sets one file’s value.</span>
        <span><b>Empty</b> or ✕: the tag is dropped.</span>
        <span>↺ goes back.</span>
      </p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="file">File</th>
              ${columns.map((col) => html`<th>${this.renderHeader(col)}</th>`)}
              <th>${this.renderGroupsHeader()}</th>
            </tr>
          </thead>
          <tbody>
            ${groupByFolder(draft.files).map(
              ([folder, files]) =>
                html`
                  <tr class="folder"><td colspan=${span}>📁 ${folder ||
                    `${this.c.store.session?.sourceName}/`}</td></tr>
                  ${files.map((f) => this.renderRow(f, columns, span))}
                `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderHeader(col: TagColumn) {
    const store = this.c.store;
    const draft = store.draft;
    if (!draft) return nothing;
    const set = col.key in draft.columns;
    const value = set ? draft.columns[col.key] ?? null : col.defaultValue;
    return html`
      <div class="col-head">
        <span class="sources" title=${col.known
          ? 'In the known-tags file'
          : 'Not in the known-tags file: kept as it is'}>
          ${col.sources.join(' / ')}
          ${col.known ? nothing : html`<span class="badge">unknown</span>`}
        </span>
        <span class="muted" style="font-weight:400">${col.count} file${col.count === 1 ? '' : 's'}</span>
        <span class="control">
          <input
            type="text"
            aria-label=${`Value for ${col.sources[0]} in every file`}
            class="${set ? 'set' : ''} ${value === null ? 'dropped' : ''}"
            placeholder="dropped"
            .value=${value ?? ''}
            @input=${(e: Event) => store.setColumn(col.key, toValue((e.target as HTMLInputElement).value))}
          />
          <button class="icon" title="Drop from every file" ?disabled=${value === null} @click=${() =>
            store.setColumn(col.key, null)}>✕</button>
          <button class="icon" title="Back to the known-tags value" ?disabled=${!set} @click=${() =>
            store.setColumn(col.key, undefined)}>↺</button>
        </span>
      </div>
    `;
  }

  private renderGroupsHeader() {
    const draft = this.c.store.draft;
    if (!draft) return nothing;
    const all = new Set(draft.files.map((f) => (draft.groups[f.path] ?? []).join(', ')));
    const common = all.size === 1 ? [...all][0] ?? '' : '';
    return html`
      <div class="col-head">
        <span class="sources">Release groups</span>
        <span class="muted" style="font-weight:400">${all.size === 1
          ? 'the same in every file'
          : 'differ by file'}</span>
        <span class="control">
          <input
            type="text"
            aria-label="Release groups for every file"
            placeholder=${all.size === 1 ? 'none' : 'set for all…'}
            .value=${common}
            @change=${(e: Event) => this.c.store.setAllGroups(splitGroups((e.target as HTMLInputElement).value))}
          />
        </span>
      </div>
    `;
  }

  private renderRow(file: AnalysedFile, columns: TagColumn[], span: number) {
    const store = this.c.store;
    const draft = store.draft;
    if (!draft) return nothing;
    const preview = draft.preview?.files.find((f) => f.path === file.path);
    const name = file.path.slice(file.path.lastIndexOf('/') + 1);
    return html`
      <tr>
        <td class="file"><span class="name" title=${file.path}>${name}</span></td>
        ${columns.map((col) => {
          const tag = file.tags.find((t) => tagKey(t) === col.key);
          if (!tag) return html`<td class="empty">·</td>`;
          const value = effectiveValue(draft, file.path, tag);
          const own = hasCellValue(draft, file.path, col.key);
          return html`
            <td>
              <span class="control">
                          <input
                            type="text"
                            aria-label=${`${tag.source} in ${name}`}
                            class="${own ? 'set' : ''} ${value === null ? 'dropped' : ''}"
                            placeholder="dropped"
                            title=${tag.source}
                            .value=${value ?? ''}
                            @input=${(e: Event) =>
                              store.setCell(file.path, col.key, toValue((e.target as HTMLInputElement).value))}
                          />
                          ${own
                            ? html`<button class="icon" title="Back to the column’s value" @click=${() =>
                              store.setCell(file.path, col.key, undefined)}>↺</button>`
                            : nothing}
                        </span>
            </td>
          `;
        })}
        <td>
          <span class="control">
            <input
              type="text"
              aria-label=${`Release groups in ${name}`}
              placeholder="none"
              .value=${(draft.groups[file.path] ?? []).join(', ')}
              @change=${(e: Event) => store.setGroups(file.path, splitGroups((e.target as HTMLInputElement).value))}
            />
          </span>
        </td>
      </tr>
      <tr class="preview">
        <td colspan=${span}>
          ${!preview
            ? html`<span class="muted">…</span>`
            : preview.error
            ? html`<span class="new error">✕ ${preview.error}</span>`
            : html`<span class="new">→ ${renderNewName(preview.newPath ?? '')}</span>${
              preview.warnings.map((w) => html`<span class="warn">⚠ ${w}</span>`)
            }`}
        </td>
      </tr>
    `;
  }
}
