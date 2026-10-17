// POC ONLY: a floating panel to drive the mock server, to try the situations that
// are hard to cause by hand. The real webapp has no such panel.

import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MockControls, MockServer } from '../mock/server.ts';
import { base, buttons } from '../styles/shared.ts';
import { applyPreset, currentPreset, HEADER_PRESETS } from './header-presets.ts';

@customElement('poc-panel')
export class PocPanel extends LitElement {
  @property({ attribute: false })
  accessor server: MockServer | null = null;
  @state()
  accessor open = false;
  @state()
  accessor preset = currentPreset();
  @state()
  accessor controls: MockControls | null = null;

  static override styles = [
    base,
    buttons,
    css`
      :host {
        position: fixed;
        left: 20px;
        bottom: 28px;
        z-index: 70;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .presets {
        display: flex;
        align-items: center;
        gap: 4px;
        height: 32px;
        padding: 0 6px 0 10px;
        border-radius: var(--radius);
        border: 1px dashed var(--warn);
        background: rgba(18, 17, 14, 0.92);
        color: var(--warn);
        font-size: 12px;
        font-weight: 600;
      }
      .presets > span:first-child {
        margin-right: 4px;
      }
      .preset {
        width: 24px;
        height: 24px;
        border-radius: var(--radius-sm);
        color: var(--fg-2);
        font-size: 12px;
        font-weight: 700;
      }
      .preset:hover {
        background: var(--surface-3);
      }
      .preset.on {
        background: var(--warn);
        color: #1a1208;
      }
      .presets .name {
        margin-left: 6px;
        color: var(--muted);
        font-weight: 500;
      }
      .fab {
        border-style: dashed;
        border-color: var(--warn);
        background: var(--warn-soft);
        color: var(--warn);
      }
      .panel {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 0;
        width: 280px;
        background: var(--surface);
        border: 1px dashed var(--warn);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
        padding: 12px;
        color: var(--fg-2);
      }
      h3 {
        margin: 0 0 4px;
        font-size: 14px;
      }
      p {
        margin: 0 0 12px;
        color: var(--muted);
        font-size: 12px;
      }
      h4 {
        margin: 12px 0 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
      }
      label {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 6px 0;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
    `,
  ];

  override render() {
    const c = this.controls;
    return html`
      ${this.open && c
        ? html`
          <div class="panel">
            <h3>POC controls</h3>
            <p>These drive the mock server. The real app has no such panel.</p>
            <h4>Latency</h4>
            <div class="row">
                      ${(['fast', 'normal', 'slow'] as const).map(
                        (l) =>
                          html`<button class="btn sm ${c.latency === l ? 'primary' : ''}" @click=${() =>
                            this.set({ latency: l })}>${l}</button>`,
                      )}
                    </div>
            <h4>Next apply</h4>
            <label><input type="checkbox" .checked=${c.failApplyAt !== null} @change=${(e: Event) =>
              this.set({
                failApplyAt: (e.target as HTMLInputElement).checked ? 2 : null,
              })} /> Fail at the 2nd file</label>
            <label><input type="checkbox" .checked=${c.diskChanged} @change=${(e: Event) =>
              this.set({ diskChanged: (e.target as HTMLInputElement).checked })} /> A file changed on disk</label>
            <h4>Restart re-name (reloads)</h4>
            <label><input type="checkbox" .checked=${c.dryRun} @change=${(e: Event) =>
              this.set({ dryRun: (e.target as HTMLInputElement).checked }, true)} /> With --dry-run</label>
            <label><input type="checkbox" .checked=${c.otherTab} @change=${(e: Event) =>
              this.set(
                { otherTab: (e.target as HTMLInputElement).checked },
                true,
              )} /> Another tab holds the session</label>
            <h4>Server events</h4>
            <div class="row">
              <button class="btn sm" @click=${() => this.server?.push({ type: 'shutting-down' })}>Ctrl-C</button>
              <button class="btn sm" @click=${() => this.server?.push({ type: 'taken-over' })}>Taken over</button>
            </div>
            <h4>Mock server</h4>
            <div class="row">
              <button class="btn sm danger" @click=${() => this.reset()}>Reset everything</button>
            </div>
          </div>
        `
        : ''}
      <div class="bar">
        <button class="btn sm fab" @click=${() => this.toggle()}>${this.open ? 'Close POC' : 'POC'}</button>
        <div class="presets" role="radiogroup" aria-label="Header colours">
          <span>Headers</span>
          ${HEADER_PRESETS.map(
            (p, i) =>
              html`
                <button
                  class="preset ${this.preset === p.id ? 'on' : ''}"
                  role="radio"
                  aria-checked=${this.preset === p.id}
                  title=${p.name}
                  @click=${() => this.choose(p.id)}
                >${i + 1}</button>
              `,
          )}
          <span class="name">${HEADER_PRESETS.find((p) => p.id === this.preset)?.name}</span>
        </div>
      </div>
    `;
  }

  private choose(id: (typeof HEADER_PRESETS)[number]['id']): void {
    applyPreset(id);
    this.preset = id;
  }

  private toggle(): void {
    this.controls = this.server?.controls ?? null;
    this.open = !this.open;
  }

  private set(change: Partial<MockControls>, reload = false): void {
    this.server?.setControls(change);
    this.controls = this.server?.controls ?? null;
    if (reload) location.reload();
  }

  private reset(): void {
    this.server?.reset();
    location.reload();
  }
}
