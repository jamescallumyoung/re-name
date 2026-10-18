# re-name webapp

re-name's web interface: Lit 3 web components, bundled by esbuild and served by the re-name server
([`packages/server`](../server)), which does all the work. The design is in
[`docs/design-doc.md`](../../docs/design-doc.md), section 7; the UI was settled by the proof of concept (POC v4.5, on
the `feature/webapp-ui-poc` branch).

## Developing

From `packages/webapp`, with Deno 2.9 (LTS):

```sh
deno install              # once: fetches Lit and esbuild
deno task dev ~/Downloads # rebuilds on change, and runs the server on port 3000
```

`deno task dev` passes its arguments to the server (`re-name --help` lists them), and prints the address to open. The
server needs a TMDB credential, like any run (see the [root README](../../README.md)). Reload the page after a change.

Other tasks: `deno task build` (into `dist/`, which the server serves and the compiled binary embeds), `deno task test`
and `deno task check` (type-check, lint and format check).

## How it's built

Loosely Material 3 (tonal surfaces, filled and text buttons, an extended FAB), with tighter corners. The palette is
built from one seed colour, yellow `#f2c14e`, which also fills every header; its secondary role is sand (`#4d4430`) and
its tertiary is sage (`#aed0b2`).

- `../protocol/`: the `Rpc` contract and shared types, used by the server too.
- `src/api/client.ts`: the RPC client (`POST /rpc/<command>`, HTTP statuses, the Queue's `ETag` and `If-Match`) and the
  event stream.
- `src/app/store.ts`: the single store; components are views over it.
- `src/app/re-name-app.ts`: the app shell: the overview, the modals and dialogs, and where focus goes when they open and
  close.
- `src/lib/`: pure logic (the draft Job, its tag list and the names it sends, the file tree and its keyboard moves),
  with tests.
- `src/components/`: the views.

The names themselves are worked out on the server: the webapp sends hints, and shows the previews it gets back.

## Accessibility

Modals make what's behind them `inert`, take focus when they open, and give it back when they close; Escape closes them
where that's allowed. The file tree follows the WAI-ARIA tree view pattern: the arrow keys move and expand, Shift+arrow
extends the selection, Home and End jump, and Space or Enter selects.
