# re-name webapp: UI proof of concept

A clickable proof of concept of re-name's web interface, built to get a feel for the workflow in
[`docs/design-doc.md`](../../docs/design-doc.md) before the real thing is built. **There's no server yet:** every API
call goes to a mock server that runs in the page.

## Running it

From `packages/webapp`, with Deno 2.9 (LTS):

```sh
deno install       # once: fetches Lit and esbuild
deno task dev      # http://localhost:3000, rebuilt on change
```

Other tasks: `deno task build` (into `dist/`), `deno task test` and `deno task check` (type-check, lint and format
check).

## What to try

There are two views: the **overview** (Files, then the Queue) and the **draft Job**, a near-full-page modal over it.

1. **Choose the options** in the modal that opens first: the media server (Plex, Jellyfin, Emby) and episode names. The
   widget in the top app bar reopens it.
2. **Select files**: click, shift-click a range, or tick a folder. Samples, multi-episode files and split parts are
   dimmed with a chip.
3. **Create Job**, the button at the bottom right, opens the draft: pick a TMDB match (or search), check the seasons for
   TV, then the tags. Names come from the (mock) server. **Minimise** (or Escape) hides the draft and keeps it; the
   button then says **Resume draft**.
4. **Add to Queue**. The Job's files are dimmed and tagged with its title, and the Queue lists it; open a Job to see its
   tree of changes. Try queuing _Blade Runner 2049_: a file with that name is already in `processed/`, so it gets a
   `DUP-1` tag.
5. **Edit** or remove a Job, or change the options from the app bar, and watch the names change.
6. **Apply the Queue** with the banner below it: the confirm dialog lists the settings it will use, then shows progress
   and a result.

**POC controls**, at the bottom left, drive the mock server: latency, a failing apply, files changed on disk,
`--dry-run`, another tab holding the session, Ctrl-C, the server going quiet (the app bar then shows **Reconnecting…**),
and a reset. The mock server's state survives a reload (as the real server's would); the draft Job doesn't (as
designed). In DevTools, `reNamePoc.store` and `reNamePoc.server` are available.

## How it's built

Loosely Material 3 (tonal surfaces, filled and text buttons, an extended FAB), with tighter corners. The palette is
built from one seed colour, yellow `#f2c14e`, which also fills every header; its secondary role is sand (`#4d4430`) and
its tertiary is sage (`#aed0b2`). The same stack as the real webapp will use: Lit 3 web components with standard
decorators, TypeScript, esbuild (through Deno), `deno test`, `deno lint` and `deno fmt`.

- `../protocol/`: the `Rpc` contract and shared types, as the server will use them.
- `src/api/client.ts`: the real RPC client (`POST /rpc/<command>`, HTTP statuses, the Queue's `ETag` and `If-Match`),
  with the transport injected.
- `src/app/store.ts`: the single store; components are views over it.
- `src/lib/`: pure logic (the draft Job, its tag list and the names it sends, the file tree), with tests.
- `src/components/`: the views.
- `src/mock/`: **POC only.** The mock server, sample data, and stand-ins for the server's name parsing, known tags and
  naming rules. These are simplified versions of what the server will do.
- `src/poc/`: **POC only.** The controls panel.

To run against a real server, `main.ts` would pass `browserTransport` to the client instead of the mock, and drop the
POC panel.
