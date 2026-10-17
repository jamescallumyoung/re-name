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

1. **Choose the options** in the setup screen: the media server (Plex, Jellyfin, Emby) and episode names. They're asked
   for once, up front, and listed again in **Settings**.
2. **Select files** in the explorer: click, shift-click a range, or tick a folder. Samples, multi-episode files and
   split parts are greyed out with a reason.
3. **New Job** → pick a TMDB match (or search) → for TV, check the seasons → check the tags. Names under each row come
   from the (mock) server.
4. **Add to Queue**. Back on **Files**, the Job's files are dimmed and marked with their Job; the **Queue** page shows
   each Job's tree of changes. Try queuing _Blade Runner 2049_: a file with the same name is already in `processed/`, so
   it gets a `DUP-1` tag.
5. **Edit** or remove a Job on the Queue page, or change the options in Settings, and watch every name change.
6. **Apply the Queue**, with progress and a result.

**POC controls**, at the foot of the sidebar, open controls for the mock server: latency, a failing apply, files changed
on disk, `--dry-run`, another tab holding the session, Ctrl-C, and a reset. The mock server's state survives a reload
(as the real server's would); the draft Job doesn't (as designed). In DevTools, `reNamePoc.store` and `reNamePoc.server`
are available.

## How it's built

The look follows [Loadout](https://loadout.jych.io), with a red accent. The same stack as the real webapp will use: Lit
3 web components with standard decorators, TypeScript, esbuild (through Deno), `deno test`, `deno lint` and `deno fmt`.

- `../protocol/`: the `Rpc` contract and shared types, as the server will use them.
- `src/api/client.ts`: the real RPC client (`POST /rpc/<command>`, HTTP statuses, the Queue's `ETag` and `If-Match`),
  with the transport injected.
- `src/app/store.ts`: the single store; components are views over it.
- `src/lib/`: pure logic (the draft Job, the tag grid's columns, the tree).
- `src/pages/` and `src/components/`: the views.
- `src/mock/`: **POC only.** The mock server, sample data, and stand-ins for the server's name parsing, known tags and
  naming rules. These are simplified versions of what the server will do.
- `src/poc/`: **POC only.** The controls panel.

To run against a real server, `main.ts` would pass `browserTransport` to the client instead of the mock, and drop the
POC panel.
