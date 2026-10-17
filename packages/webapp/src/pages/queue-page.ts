// The Queue page (design doc, sections 7.1 and 11): one card per approved Job,
// collapsed to a summary until opened to show its changes, and Apply, which applies
// the whole Queue.

import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Job, PreviewFile } from '@re-name/protocol';
import { StoreController } from '../app/store-controller.ts';
import { base, buttons, pageStyles, pills } from '../styles/shared.ts';
import { icon } from '../styles/icons.ts';
import { renderNewName } from '../components/new-name.ts';
import '../components/poster-art.ts';

interface TreeFolder {
  name: string;
  folders: Map<string, TreeFolder>;
  files: PreviewFile[];
}

function treeOf(files: PreviewFile[]): TreeFolder {
  const root: TreeFolder = { name: '', folders: new Map(), files: [] };
  for (const f of files) {
    if (!f.newPath) continue;
    let folder = root;
    for (const name of f.newPath.split('/').slice(0, -1)) {
      let next = folder.folders.get(name);
      if (!next) folder.folders.set(name, next = { name, folders: new Map(), files: [] });
      folder = next;
    }
    folder.files.push(f);
  }
  return root;
}

@customElement('queue-page')
export class QueuePage extends LitElement {
  private readonly c = new StoreController(this);
  /** Which Jobs are open: view state only. */
  @state()
  accessor open = new Set<string>();

  static override styles = [
    base,
    buttons,
    pills,
    pageStyles,
    css`
      .jobs {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .job {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.8rem;
        overflow: hidden;
      }
      .job.editing {
        border-color: rgba(234, 179, 8, 0.5);
      }
      .summary {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 1rem;
      }
      .summary poster-art {
        width: 3rem;
        flex: none;
      }
      .info {
        flex: 1;
        min-width: 0;
      }
      .title {
        color: var(--fg);
        font-weight: 700;
        font-size: 1.05rem;
      }
      .title .year {
        color: var(--muted);
        font-weight: 500;
      }
      .meta {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        margin-top: 0.35rem;
        flex-wrap: wrap;
      }
      .actions {
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 600;
        padding: 0.3rem 0.5rem;
        border-radius: 0.4rem;
      }
      .toggle:hover {
        color: var(--fg);
        background: var(--panel-2);
      }
      .toggle svg {
        width: 1rem;
        height: 1rem;
        transition: transform 0.15s;
      }
      .toggle.open svg {
        transform: rotate(90deg);
      }
      .changes {
        border-top: 1px solid var(--line);
        background: var(--bg);
        padding: 1rem 1.25rem 1.1rem;
        font-size: 0.82rem;
        line-height: 1.5;
      }
      .tf {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: var(--fg);
        font-weight: 600;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        padding: 0.15rem 0;
      }
      .tf svg {
        width: 0.95rem;
        height: 0.95rem;
        color: var(--muted);
      }
      .nested {
        margin-left: 0.45rem;
        padding-left: 1rem;
        border-left: 1px solid var(--line);
      }
      .file {
        padding: 0.3rem 0;
      }
      .new {
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--fg-2);
        overflow-wrap: anywhere;
      }
      .old {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--faint);
        overflow-wrap: anywhere;
      }
      .warning {
        color: var(--warn-text);
        font-size: 0.75rem;
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
    const store = this.c.store;
    const { queue, session, apply } = store;
    const files = queue.jobs.reduce((n, j) => n + j.draft.files.length, 0);
    return html`
      <div class="page-title">
        <div>
          <h1>Queue</h1>
          <div class="sub">
            ${queue.jobs.length
              ? html`${queue.jobs.length} Job${queue.jobs.length === 1 ? '' : 's'} · ${files} file${
                files === 1 ? '' : 's'
              } to rename and move into <span class="mono">${session?.targetName}/</span>`
              : 'Approved Jobs wait here until you apply the Queue.'}
          </div>
        </div>
      </div>
      ${queue.jobs.length === 0
        ? html`<div class="panel empty-state">
          ${icon('queue')}
          <b>The Queue is empty</b>
          <span>Select the files of a movie or show on the Files page, then start a Job.</span>
          <button class="btn" @click=${() => store.goTo('files')}>Go to Files</button>
        </div>`
        : html`<div class="jobs">${queue.jobs.map((j) => this.renderJob(j))}</div>`}
      ${queue.jobs.length
        ? html`
          <div class="action-bar">
            <span class="summary">
                      ${session?.dryRun
                        ? html`
                          <span class="pill warn">Dry run</span>
                        `
                        : nothing}
                      <b>${files} file${files === 1 ? '' : 's'}</b> · anything not in a Job stays where it is
                    </span>
            <button class="btn primary" ?disabled=${apply !== null} @click=${() => store.askApply()}>
                      ${icon('play')} ${session?.dryRun ? 'Dry-run the Queue' : 'Apply the Queue'}
                    </button>
          </div>
        `
        : nothing}
    `;
  }

  private renderJob(job: Job) {
    const store = this.c.store;
    const open = this.open.has(job.id);
    const editing = store.draft?.editingJobId === job.id;
    const dups = job.preview.files.filter((f) => f.dup !== null).length;
    const warnings = job.preview.files.filter((f) => f.warnings.length).length;
    return html`
      <article class="job ${editing ? 'editing' : ''}">
        <div class="summary">
          <poster-art label=${job.match.title} year=${job.match.year} type=${job.match.type} tmdb-id=${job.match
            .tmdbId}></poster-art>
          <div class="info">
            <div class="title">${job.match.title} <span class="year">(${job.match.year})</span></div>
            <div class="meta">
              <span class="pill">${icon(job.match.type === 'tv' ? 'tv' : 'film')} ${job.match.type === 'tv'
                ? 'TV'
                : 'Movie'}</span>
              <span class="pill">${job.draft.files.length} file${job.draft.files.length === 1 ? '' : 's'}</span>
              ${dups
                ? html`<span class="pill warn" title="Clashing names get a DUP tag">${dups} duplicate${
                  dups === 1 ? '' : 's'
                }</span>`
                : nothing}
              ${warnings ? html`<span class="pill warn">${icon('alert')} ${warnings}</span>` : nothing}
              ${editing ? html`<span class="pill warn">${icon('edit')} Being edited</span>` : nothing}
            </div>
          </div>
          <div class="actions">
            <button class="toggle ${open ? 'open' : ''}" aria-expanded=${open} @click=${() => this.toggle(job.id)}>
              ${icon('chev')} ${open ? 'Hide' : 'Changes'}
            </button>
            <button class="btn sm" @click=${() => store.editJob(job.id)}>${icon('edit')} Edit</button>
            <button class="btn sm ghost" title="Remove from the Queue" @click=${() => store.askRemoveJob(job)}>
              ${icon('trash')}
            </button>
          </div>
        </div>
        ${open ? html`<div class="changes">${this.renderTree(treeOf(job.preview.files))}</div>` : nothing}
      </article>
    `;
  }

  private renderTree(folder: TreeFolder): unknown {
    return html`
      ${[...folder.folders.values()].map(
        (f) =>
          html`
            <div class="tf">${icon('folder')} ${f.name}/</div>
            <div class="nested">${this.renderTree(f)}</div>
          `,
      )}
      ${folder.files.map(
        (f) =>
          html`<div class="file">
            <div class="new">${renderNewName(f.newPath?.split('/').pop() ?? '')}</div>
            <div class="old">was ${f.path}</div>
            ${f.warnings.map((w) => html`<div class="warning">${w}</div>`)}
          </div>`,
      )}
    `;
  }

  private toggle(id: string): void {
    const next = new Set(this.open);
    next.has(id) ? next.delete(id) : next.add(id);
    this.open = next;
  }
}
