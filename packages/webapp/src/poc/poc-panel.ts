// POC ONLY: a floating panel to drive the mock server, to try the situations that
// are hard to cause by hand. The real webapp has no such panel.

import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MockControls, MockServer } from '../mock/server.ts';
import { shared } from '../styles/shared.ts';

@customElement('poc-panel')
export class PocPanel extends LitElement {
  @property({ attribute: false })
  accessor server: MockServer | null = null;
  @state()
  accessor open = false;
  @state()
  accessor controls: MockControls | null = null;

  static override styles = [
    shared,
    css`
      :host {
        position: fixed;
        top: 9px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 70;
        display: flex;
        flex-direction: column-reverse;
        align-items: center;
        font-size: 13px;
      }
      .fab {
        background: var(--warn);
        border-color: var(--warn);
        color: #fff;
        font-weight: 700;
        box-shadow: var(--shadow);
      }
      .panel {
        width: 300px;
        background: var(--surface);
        border: 2px dashed var(--warn);
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        padding: 14px;
        margin-top: 8px;
      }
      h3 {
        margin: 0 0 4px;
        font-size: 14px;
      }
      p {
        margin: 0 0 12px;
        color: var(--fg-3);
        font-size: 12px;
      }
      h4 {
        margin: 12px 0 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--fg-3);
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
                          html`<button class="small ${c.latency === l ? 'primary' : ''}" @click=${() =>
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
              <button class="small" @click=${() => this.server?.push({ type: 'shutting-down' })}>Ctrl-C</button>
              <button class="small" @click=${() => this.server?.push({ type: 'taken-over' })}>Taken over</button>
            </div>
            <h4>Mock server</h4>
            <div class="row">
              <button class="small danger" @click=${() => this.reset()}>Reset everything</button>
            </div>
          </div>
        `
        : ''}
      <button class="fab" @click=${() => this.toggle()}>${this.open ? 'Close' : 'POC'}</button>
    `;
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
