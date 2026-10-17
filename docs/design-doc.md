# re-name: design document

**Status:** design agreed on 2026-10-17. No code exists yet. Items marked **Open** are not decided. Everything else is.

re-name renames and reorganises movie and TV episode files so that Plex, Jellyfin and Emby can identify them. Files are matched to The Movie Database (TMDB). You run it from a terminal and use it in your browser: a local server does the file work, and a web page provides the interface.

This document is for the project's owner and for anyone, human or agent, continuing the work. It records what was decided and why. The feature, component and library docs (with numbered statements for tests to cite) will be written from it.

---

## 1. Why a local server, not a web page alone

The first idea was a web page using the browser's File System Access API, as in the reference project, Loadout (`../xbox-360-xcontent/packages/loadout`). That doesn't work for re-name: **Chromium can't move or rename directories.** `move()` exists only on `FileSystemFileHandle`, never on directory handles ([crbug 40198034](https://issues.chromium.org/issues/40198034); MDN's compatibility data, 2026-10-15). Renaming folders is central to re-name.

So re-name is a **local application**. A server process, started from the terminal, does every file operation through the file system. A web page it serves is the interface. Because of this, none of Loadout's browser-only machinery is needed: no folder handles, permission prompts, Reconnect, IndexedDB session or service worker.

## 2. Runtime and tooling

| Area | Decision |
|---|---|
| Runtime | **Deno, the current LTS line** (2.9; the LTS channel was at v2.9.3 on 2026-10-17, supported until 2027-01-31). Follow the LTS channel (`deno upgrade lts`). |
| Experimental features | **None are used.** This rules out `deno desktop` and `deno bundle`. |
| Webapp | **Lit 3 web components** with standard decorators (`accessor` fields), as in Loadout. No component library. |
| Webapp bundling | **esbuild** (`npm:esbuild`), because `deno bundle` is experimental. Switch to `deno bundle` once it's stable. |
| HTTP server | `Deno.serve` (fetch-style `Request` → `Response`). No framework. Routing uses `URLPattern`. |
| Tests | `deno test`, against **real temporary folders** (no in-memory file system). |
| Linting and formatting | `deno lint` and `deno fmt`. This is weaker than Loadout's ESLint with type-aware rules, and that's accepted. ESLint may be added later. |
| Dependencies | As few as possible. Prefer what Deno and the web platform provide. |
| Packaging | `deno compile`, with the built webapp embedded through `--include`. |

Installing Deno's LTS version on macOS (Homebrew only provides the stable channel, and its build has `deno upgrade` disabled):

```fish
curl -fsSL https://deno.land/install.sh | sh -s -- -y (curl -fsSL https://dl.deno.land/release-lts-latest.txt)
fish_add_path ~/.deno/bin
```

### 2.1 Why Deno, not Node

Node 26 was considered. Its single-executable feature (`node --build-sea`, from 25.5) is native but still under active development, and it builds for one platform at a time. Deno was chosen because:

- `deno compile --target` **cross-compiles every platform from one machine**.
- `Deno.serve` is a fetch-style server, and WebSockets are built in.
- Deno's own test runner, linter, formatter and compiler replace most dev dependencies.

The costs, which were accepted: weaker linting, and LTS lines that last about six months instead of Node's two and a half years.

### 2.2 Verified on Deno 2.9 (2026-10-17, macOS arm64)

A throwaway trial, outside the repo, confirmed:

- **Lit 3 standard decorators**, including `accessor` fields, bundle into browser-ready code. The component rendered and updated in headless Chrome. (This was tested with `deno bundle`; esbuild is the engine underneath it.)
- **A compiled binary serves its embedded webapp.** Files embedded with `--include` are read with `Deno.readFile(join(import.meta.dirname, …))`; inside the binary, `import.meta.dirname` points into an embedded virtual folder.
- **`.env` loads at run time** with either `process.loadEnvFile(path)` or `@std/dotenv` `load({ envPath, export: true })`, including in the compiled binary.
- **`deno compile --env-file` embeds the variables in the binary when building.** It must **never** be used, or secrets would ship in releases.
- **Cross-compiling from macOS arm64** to Windows x64, Linux x64 and arm64, and macOS x64 all succeeded. Sizes are about 68 to 105 MB, or 29 to 34 MB gzipped. The Linux and Windows builds were not run.
- **`Deno.rename` renames directories.**
- **Disconnect detection:** when a client drops, the server notices within about 1 ms, through an SSE stream's `cancel` or a WebSocket's `close`. Don't use `request.signal` on streamed responses: Deno warns that its behaviour there is deprecated.

## 3. Repository and packages

- A Deno workspace with **at least a `server` package and a `webapp` package**, so the webapp's internals stay separate from the server's. Shared packages are added as needed, for example `protocol`, which holds the `Rpc` contract and shared types.
- re-name is an **application, not a library**. It isn't published to npm or JSR. (The npm name `re-name` is taken anyway.) Builds are published to the repo's **GitHub Releases**.
- Code style follows Loadout where Deno allows: strict TypeScript, functions that can fail return `[true, value] | [false, reason]`, and docs-first work with numbered statements cited by tests.

## 4. Running re-name

```
re-name [source] [--target <dir>] [--no-open] [--port <n>] [--dry-run] [--version] [--help]
```

| Argument | Default | Meaning |
|---|---|---|
| `source` | the current folder | The folder whose video files are shown and renamed. |
| `--target` | `<source>/processed` | Where renamed files are moved. It must be on **the same drive** as the source. |
| `--no-open` | off | Print the URL instead of opening the browser. |
| `--port` | a random free port | A fixed port. |
| `--dry-run` | off | Applying the Queue reports what it would do, and changes nothing. |
| `--version`, `--help` | | |

Arguments are parsed with `parseArgs` (from `node:util`, or `@std/cli`).

On start, the server:

1. resolves `source` and `target`, and checks they're on the same drive
2. makes sure the config folder exists and can be written to, creates `.env` with the defaults if there isn't one, then loads it (§5.2). If the config folder can't be created or written to, or the TMDB credential is missing, re-name exits straight away and says why
3. takes the lock (§5.2)
4. starts the HTTP server on `127.0.0.1`
5. opens the browser at `http://127.0.0.1:<port>/?t=<launch token>`

## 5. Configuration and local files

### 5.1 Folders

Each OS's **native** location is used. macOS does **not** use XDG.

| OS | Config (`.env`, known tags) | State (logs, undo, lock) | Cache (TMDB) |
|---|---|---|---|
| Linux | `$XDG_CONFIG_HOME/re-name` (default `~/.config/re-name`) | `$XDG_STATE_HOME/re-name` (default `~/.local/state/re-name`) | `$XDG_CACHE_HOME/re-name` (default `~/.cache/re-name`) |
| macOS | `~/Library/Application Support/re-name` | `~/Library/Application Support/re-name` | `~/Library/Caches/re-name` |
| Windows 10 and 11 | `%APPDATA%\re-name` | `%LOCALAPPDATA%\re-name` | `%LOCALAPPDATA%\re-name\Cache` |

Paths are worked out from the home folder and environment variables, with no dependency. On macOS and Linux, `.env` holds a secret, so when re-name creates it, it uses `0600` permissions (readable and writable by the owner only).

### 5.2 Files

- **`.env`** is loaded **at run time** from the config folder. Real environment variables take precedence over it.
  - **If there's no `.env`, re-name creates one with the defaults**, with every variable in §5.3 written out, so the user can see the defaults and what to change. An existing `.env` is never modified.
  - **If the native config folder can't be created or written to, re-name exits early**, before starting the server, with a message that names the folder and the reason (for example, permission denied).
  - **If the TMDB credential is missing or empty** in both the environment and `.env` (as it will be in a newly created `.env`), **re-name exits early**, before starting the server. Its message says the credential is missing and names the `.env` file to edit, or the environment variable to set.
- **The known-tags file** lives in the config folder (§9.4).
- **The lock file** lives in the state folder. It records the source folders currently open, so two runs can't work on overlapping folders on this machine. **Open:** whether an overlap is refused or only warned about.
- **Apply logs and undo history** live in the state folder, never in the library.
- **The TMDB cache** lives in the cache folder.

### 5.3 Environment variables

| Variable (**Open:** final names) | Meaning |
|---|---|
| `TMDB_API_KEY` | The TMDB credential. **Open:** a v3 API key or a v4 read access token. |
| `RENAME_FLAVOUR` | The default flavour: `plex`, `jellyfin` or `emby`. |
| `RENAME_TITLE_LANGUAGE` | `original`, or any language code TMDB supports (such as `en-US`, `en-GB`, `pt-BR`). Used for movie, show **and** episode names. A name missing in that language falls back to the original language. **Open:** the default. |

## 6. Terms

| Term | Meaning |
|---|---|
| **Source** | The folder re-name reads video files from. |
| **Target** | The folder renamed files are moved into. By default `<source>/processed`. It's hidden from the overview. |
| **Flavour** | The media server the names are made for: Plex, Jellyfin or Emby. |
| **Job** | The changes to a set of files that all belong to **one TMDB movie or TV show**. For TV, a Job can span seasons. A Job's state is `draft` or `approved`. There can be many Jobs. |
| **Draft Job** | A Job being prepared. **At most one** exists, held **only in the webapp's memory** until the webapp asks the server to add it to the Queue. |
| **Approved Job** | A Job the server has accepted into the Queue. |
| **Queue** | The one list of approved Jobs, held by the server. It's **applied all at once**; a Job is never applied outside the Queue. |
| **Tag** | A piece of release information found in a file name, such as `1080p`, `WEB-DL` or `x265`. |
| **Release group** | The group that made a release, such as `ELiTE`. A file can have several. |

## 7. Workflow

```
re-name [source] [--target]
   │
   ▼
Options (shown first): flavour (default from .env), include episode names
   │
   ▼
┌─ OVERVIEW ──────────────────────────────────────────────────────────────┐
│  File explorer of the source: video files only                          │
│   · multi-select, shift-click ranges, select all and deselect all       │
│   · selecting a folder selects every video file in it, recursively      │
│   · files in approved Jobs are greyed out and can't be selected         │
│   · skipped files are greyed out differently, with the reason shown     │
│  Queue: one entry per approved Job, each with a tree of its changes     │
│  [New Job from selection]                       [Confirm: apply Queue]  │
└─────────────────────────────────────────────────────────────────────────┘
   │ selection
   ▼
DRAFT JOB:  1. Match  →  2. Seasons and episodes (TV only)  →  3. Tags
   │ add to Queue (the server checks it and returns the updated Queue)
   ▼
back to the overview  …  Confirm  →  check against disk  →  move and rename  →  log
```

### 7.1 Overview

- A file explorer of the source folder, showing **video files only**, recognised by extension (§10). Subtitles and every other file are left out.
- **Selection:** multi-select. Shift-click selects a range. Select all and deselect all are offered. Selecting a folder selects every video file inside it, recursively.
- **Files in approved Jobs** are greyed out and can't be selected.
- **Skipped files** are greyed out with a visible reason, and must look different from queued files. Skipped files are:
  - **samples** (a false positive needs the user to rename or move it by hand)
  - **files with several episodes** (`S01E01-E02`, `S01E01E02`)
  - **split parts** (`cd1`, `pt1`, `part1`, `disc1` and so on)
- The **target folder is hidden**.
- **The Queue** is shown with each approved Job's changes, for example as a tree of folders and new names per Job. Each approved Job can be **edited** or **removed**.
- **Confirm** applies the whole Queue (§8.4).

### 7.2 Draft Job

The selected files become the draft Job. There's only one draft. Trying to start or edit a Job while a draft exists asks whether to **discard** the current draft. **Reloading the page loses the draft.** The page warns before it unloads while a draft has unsaved work. No browser storage is used.

**1. Match.** Matching happens **once per Job**.
- The server suggests **5 TMDB matches** from the most common title and year parsed from the Job's files, searching movies and TV.
- Each match shows its **title, year, TMDB ID, type (movie or TV) and cover art**. Clicking one selects it.
- A **manual search** box covers cases where every suggestion is wrong.

**2. Seasons and episodes (TV only).**
- Each file has its own **season dropdown**, pre-set to the most likely season, which is usually read from `SxxEyy`. Files in the same subfolder are grouped visually.
- TMDB's episode names are shown, and numbers TMDB doesn't know are flagged.
- **Specials** (season 0) are supported.

**3. Tags.**
- The tags found in each file name are shown with their **transformed value** (§9.4). The user can **override** any value, or drop it.
- Tags are **stored per file**, because files from one folder can come from different releases. But editing must be fast: clicking "continue" for every file isn't acceptable.
- The starting design is **one grid per Job**: a row per file and a column per tag. A column header sets the value for every file in that column, and a cell overrides it for one file. **Open:** this will need a few design iterations.
- New names are shown as a **preview**, worked out by the server (§8.2).

**Adding to the Queue.** The webapp asks the server to add the draft. The server checks it and answers with the updated Queue, or with an error. The user then returns to the overview and can prepare the next Job. The user doesn't have to process every file in the source.

**Editing an approved Job.** The Job is loaded into the webapp as the draft, with its files and choices filled in, so only small changes are needed. **It stays in the Queue** until the edited draft replaces it. Cancelling the edit changes nothing.

### 7.3 What the webapp sends

A sparse description of the draft. Anything the server can get from TMDB by ID (titles, years, episode names), it fills in itself. Tag order doesn't matter: the server decides it (§9.3). Per file, for example:

```json
{
  "path": "TV/Ted Lasso S04/Ted.Lasso.S04E03.1080p.web-dl.appleVT.265-ELiTE.mkv",
  "season": 4,
  "episode": 3,
  "tags": [
    { "source": "1080p", "value": "1080p" },
    { "source": "web-dl", "value": "WEB-DL" },
    { "source": "265", "value": "x265" },
    { "source": "appleVT", "value": null }
  ],
  "groups": ["ELiTE"]
}
```

…along with the Job's `type` (`movie` or `tv`) and `tmdbId`. `path` is relative to the source, since names can repeat across folders. `value: null` drops a tag.

## 8. Communication between server and webapp

### 8.1 Where state lives

- **The server holds the domain state:** the options, the source file tree and the Queue.
- **The webapp holds:** the single draft Job, in memory, and **view state**, such as the selection, expanded folders, filters and the current screen. View state belongs in the URL where that's useful.
- The webapp sends requests, and the server answers with the changed content to confirm or display.

### 8.2 Transport

- **Every command and query** is a `fetch` with a JSON body, in **RPC style**: `POST /rpc/<namespace>.<command>`.
- **Real HTTP status codes** are used for errors. **Not JSON-RPC**, which answers every request with `200` and hides errors in the body.
- **One Server-Sent Events stream**, `GET /events`, carries the few things the server pushes, and tells the server the page is still open.
- **One shared TypeScript interface is the contract.** It's in a shared package, and both sides are checked against it:

```ts
export interface Rpc {
  'queue.addJob': { params: { draft: DraftJob }; result: Queue };
  // …one entry per command
}
```

**Why not a WebSocket?** Almost every interaction is a request with a response. The browser is the only thing that changes the server's state, so the response to a request is the whole change. The server only needs to push a handful of things. Fetch plus SSE gives request IDs, status codes, `curl` debugging and simple tests for free, and needs no request-ID scheme or reconnect protocol of our own.

### 8.3 Commands

Names are **commands** (a verb, plus a noun where it helps). `search` is fine as it is.

| Command | Body | Answer | Notable statuses |
|---|---|---|---|
| `session.claim` | `{ tabId }`, plus the launch token the first time | session cookie, options, Queue + `ETag` | `403` bad token, `409` another tab |
| `session.end` | `{}` | `204` | |
| `options.get` / `options.set` | `{ flavour, includeEpisodeName }` | options | `422` invalid |
| `tree.get` | `{}` | the source's video files, each `available`, `queued (jobId)` or `skipped (reason)` | |
| `tmdb.getSuggestions` | `{ files }` | 5 suggested matches | `502` TMDB unreachable |
| `tmdb.search` | `{ query, type? }` | matches | `502` |
| `tmdb.getDetails` | `{ type, tmdbId }` | details; for TV, seasons and episodes | `404` unknown ID |
| `job.analyseFiles` | `{ files }` | per file: parsed fields, tags found and their transformed values, season and episode guesses | `422` a file is skipped or already queued |
| `job.getPreview` | `{ draft }` | per file: the new path, any `DUP-{n}`, warnings and errors | `422` invalid draft |
| `queue.get` | `{}` | Queue + `ETag` | |
| `queue.addJob` | `{ draft }` + `If-Match` | Queue + `ETag` | `409` files already queued, `412` stale, `422` invalid |
| `queue.replaceJob` | `{ jobId, draft }` + `If-Match` | Queue + `ETag` | `404`, `412`, `422` |
| `queue.removeJob` | `{ jobId }` + `If-Match` | Queue + `ETag` | `404`, `412` |
| `queue.apply` | `{}` + `If-Match` | `202` started; progress arrives over SSE | `409` already applying, `412` stale, `422` the check against the disk failed |

- **`job.getPreview` sends the whole draft, and the server stores nothing.** New names are worked out **only on the server**, so there's one implementation of the naming rules. The preview also shows `DUP-{n}` clashes against the Queue and the target before the Job is added.
- **SSE events** are facts, not commands: `heartbeat`, `apply-progress`, `apply-done` (with the log path and the new Queue + `ETag`), `shutting-down`, `taken-over`.

### 8.4 Stale and duplicate requests

- **Every command checks its own preconditions.** A draft can't be added twice (`409`). A removed Job can't be removed again (`404`). The Queue can't be applied while it's being applied (`409`). The webapp also disables a button while its request is running.
- **The Queue carries an `ETag`.** Every response that includes the Queue sends `ETag`. Every command that changes the Queue must send `If-Match`. A stale value gets `412 Precondition Failed`, after which the webapp fetches the Queue again. A missing `If-Match` gets `428 Precondition Required`.

### 8.5 Session and lifecycle

1. The page opens with the launch token. It calls `session.claim` with a **tab ID** kept in `sessionStorage`, which survives a reload but differs between tabs. The server swaps the token for a session cookie (`HttpOnly`, `SameSite=Strict`).
2. **Only one tab can hold the session.** A claim with a different tab ID, while the session is held, gets **`409 Conflict`**, and the page shows that re-name is open in another tab. A claim with the **same** tab ID (a reload) takes the session back, even if the old connection hasn't closed yet. The claim must be a `fetch`, because `EventSource` and `WebSocket` can't read the HTTP status of a failed connection.
3. After claiming, the page opens `/events`.
4. **Closing the tab ends re-name.**
   - When the event stream closes, a **grace period** starts. If the same tab claims the session again in time (a reload), it continues. Otherwise the server releases the lock and exits.
   - The grace period counts **missed heartbeats**, not a single timer, so a computer waking from sleep doesn't end the session by mistake.
   - **Open:** the grace period and heartbeat interval (about 5 seconds was proposed).
5. **Ctrl-C ends re-name.** The server sends `shutting-down`, so the page shows that re-name has stopped, then exits.
6. **During an apply,** the server never exits in the middle of a rename. It reaches a safe point, writes the log, then exits.

### 8.6 Security

- The server binds to `127.0.0.1` only, on a random port unless `--port` is given.
- The launch token in the opened URL is swapped for an `HttpOnly`, `SameSite=Strict` cookie. Every request checks the cookie and the `Host` header (`127.0.0.1:<port>`). Writes also check `Origin`. This stops other websites, through cross-site requests or DNS rebinding, from asking the server to rename files.
- Every path is resolved and must stay inside the source or target. `..` and symbolic links that lead out are refused.

## 9. Naming rules

### 9.1 Flavours

Each flavour uses **its server's own documented format**. The servers might read each other's formats, but the user chooses.

| | Plex | Jellyfin | Emby |
|---|---|---|---|
| ID tag | `{tmdb-123}` (curly braces are required) | `[tmdbid-123]` | `[tmdbid=123]` |
| ID in the movie file name | No | **Yes**: version detection needs the file to start with the folder name, ID included | **Yes**: the file must start with the folder name |
| Before the brackets (movies and episodes) | a space | ` - ` | ` - ` |
| Season folders | `Season 01` | `Season 01` | `Season 01` |
| Specials | `Season 00` | `Season 00` | `Season 00` |
| ID in episode file names | No | No | No |

### 9.2 Templates

**Movie:**

```
Plex      Blade Runner 2049 (2017) {tmdb-335984}/
            Blade Runner 2049 (2017) [2160p BluRay HDR x265 -FraMeSToR].mkv
Jellyfin  Blade Runner 2049 (2017) [tmdbid-335984]/
            Blade Runner 2049 (2017) [tmdbid-335984] - [2160p BluRay HDR x265 -FraMeSToR].mkv
Emby      Blade Runner 2049 (2017) [tmdbid=335984]/
            Blade Runner 2049 (2017) [tmdbid=335984] - [2160p BluRay HDR x265 -FraMeSToR].mkv
```

**TV episode** (the flavours differ only in the ID tag and in what comes before the brackets):

```
Plex      Ted Lasso (2020) {tmdb-97546}/Season 04/
            Ted Lasso (2020) - S04E03 - <Episode Name> [1080p WEB-DL x265 -ELiTE].mkv
Jellyfin  Ted Lasso (2020) [tmdbid-97546]/Season 04/
            Ted Lasso (2020) - S04E03 - <Episode Name> - [1080p WEB-DL x265 -ELiTE].mkv
Emby      Ted Lasso (2020) [tmdbid=97546]/Season 04/
            Ted Lasso (2020) - S04E03 - <Episode Name> - [1080p WEB-DL x265 -ELiTE].mkv
```

Without an episode name, the brackets follow the episode code in the same way: `Ted Lasso (2020) - S04E03 [1080p …].mkv` for Plex, and `Ted Lasso (2020) - S04E03 - [1080p …].mkv` for Jellyfin and Emby.

- **Title:** TMDB's name in `RENAME_TITLE_LANGUAGE`, falling back to the original language.
- **Year:** a movie's release year. For TV, the first-air year, which every episode of a show shares.
- **Season and episode:** padded to at least 2 digits (`S04E03`; `S01E100` stays as it is).
- **Episode name:** TMDB's, in the chosen language with the original-language fallback. It's left out when it's only a **placeholder**: `Episode <n>` with the file's own episode number, plus a small built-in list of other languages' forms (`Épisode <n>`, `Folge <n>`, …). It's also left out when the "include episode name" option is off. The year in episode file names is **always** included.

### 9.3 Brackets: tags, `DUP-{n}` and groups

- **Tags are never invented.** The brackets hold only what was found:
  - tags and groups: `[1080p WEB-DL x265 -ELiTE]`
  - only tags: `[1080p WEB-DL x265]`
  - only groups: `[-ELiTE]`
  - neither: no brackets, and no separator before them

  This format isn't configurable.
- **Groups** come last, **each with its own `-`**, in their original order: `[1080p x265 -NTb -rartv]`. In source names, groups appear either separately or in the form `…-NTb[rartv]`.
- **`DUP-{n}`** is the **last tag, before the groups**: `[1080p WEB-DL x265 DUP-1 -ELiTE]`.
- **The order of tags is decided by the server.** **Open:** the order, for example resolution, source, HDR, audio, codec, then the rest.

### 9.4 Finding and transforming tags

- Tags are found with **regexes**, from a **known-tags config file** in the config folder. Each known tag has a pattern and a transformation (for example `265` → `x265`, `web-dl` → `WEB-DL`, `appleVT` → dropped).
- Dots separate tags, but **some tags contain dots** (`DDP5.1`, `H.264`, `DDP5.1.Atmos`). So known patterns are tried **longest first** against the name, and whatever's left is split on `.`.
- **Unknown tags are kept**, as they are, by default.
- The user can override any value per Job column or per file (§7.2).
- **Open:** the format of the known-tags file, and the built-in defaults.

### 9.5 Duplicates

When a new name clashes with a file already in the target, or with another approved Job's file, the **newer** file gets a `DUP-{n}` tag. A file already in the target keeps its name, and among approved Jobs, an earlier Job keeps the name. `n` counts from 1. The numbering is worked out again whenever a Job is added, replaced or removed, and is shown in previews.

All three servers treat names that differ only inside the brackets as **versions** of the same movie or episode, so a duplicate stays visible and playable.

### 9.6 Invalid characters, reserved names and length

- **Invalid characters:** the Windows set (`< > : " / \ | ? *` and control characters) applies on **every OS**. Each one is replaced with a single `_`. This keeps names valid on Windows and over SMB. Configurable replacements are out of scope for now.
- **Trailing dots and spaces, and reserved names** (`CON`, `NUL`, `COM1`, …) must never be produced. With these templates they can't be: every name ends with `)`, `}`, `]` or an extension, and starts with `Title (Year)`. The server still checks, and fails the Job if one would ever occur.
- **Length:** a name may be at most 255 bytes. If one is too long, **the episode name is dropped first**. If it's still too long, **the Job fails** with a clear error, shown in the preview.

### 9.7 Options per Queue

Chosen up front, they apply to every Job. Changing one recomputes every approved Job's preview.

| Option | Default |
|---|---|
| Flavour | `RENAME_FLAVOUR` |
| Include episode names | on |

## 10. Files

- **Video files only,** recognised by **extension**. **Open:** the final list (proposed: `mkv mp4 m4v avi mov wmv ts m2ts webm mpg mpeg`).
- **Subtitles are out of scope** for now. A later feature would need subtitles linked to a video, and their language and flags kept (`.en.forced.srt`).
- **Samples are hidden.** **Open:** the rule (for example `sample` as a word in the name).
- **Not supported:** files with several episodes and split parts. They're shown greyed out with the reason.
- **Files that aren't touched are left where they are.** This includes the rest of a release folder (`.nfo`, `.txt`, images, samples) and the folders emptied by moves.

## 11. Applying the Queue

1. **Check against the disk.** Every selected file must still exist, unchanged since it was read. No file may have appeared at a target name. Any change is an **error, and nothing is applied**. `DUP-{n}` is never renumbered silently.
2. **Move only.** Files are renamed into new folders in the target. **The target must be on the same drive as the source**, so a rename is instant. A target on another drive is refused, and re-name never copies.
3. **Merge, never overwrite.** Existing target folders are reused. Existing files are never replaced. Clashes are handled by `DUP-{n}` (§9.5).
4. **Case-only renames** (for example `the matrix` → `The Matrix` on a file system that ignores case) go through a temporary name.
5. **Stop at the first error.**
   - Finished Jobs leave the Queue.
   - A Job that half-applied is **split**: the files that moved leave the Job and are logged as done, and the rest stay queued.
   - Unfinished Jobs stay in the Queue, and **the Queue is written to a JSON log** in the state folder for the user to review.
6. **Progress** arrives over SSE. When the apply ends, the source tree is read again.
7. **`--dry-run`:** everything happens except the moves and renames, and the report says what would have been done.

The user moves the result from the target into the media server's library by hand.

## 12. Packaging and distribution

- **`deno compile`** for each target: Linux x64 and arm64, macOS arm64 and x64, Windows x64. Built in CI, published to GitHub Releases, gzipped (about 30 MB each).
- **macOS builds** only have an ad-hoc signature, so downloads hit Gatekeeper's "cannot be verified" warning until they're signed with a Developer ID and notarised. **Windows** shows a SmartScreen warning for unsigned binaries. **Open:** signing.
- The binary must be on the `PATH` for `re-name` to work as a command. **Open:** install instructions or an install script.

## 13. Open items

1. The tag grid's design (§7.2), which will need iterations.
2. The known-tags file format and its defaults, and the server's tag order (§9.3, §9.4).
3. Final environment variable names, the TMDB credential type, and the title-language default (§5.3).
4. The grace period and heartbeat interval (§8.5).
5. Overlapping runs: refuse or warn (§5.2).
6. TMDB images: loaded by the browser from `image.tmdb.org`, or proxied and cached by the server. This decides the page's content security policy.
7. TMDB rate limiting and how long the cache keeps entries.
8. The video extension list and the sample rule (§10).
9. Signing, notarisation and installation (§12).
10. Whether the file explorer refreshes on its own or only on request. The apply check catches changes either way (§11).
11. A manual check before release: a sample target folder scanned by real Plex, Jellyfin and Emby servers, to confirm the formats in §9.

## 14. Later features

- Subtitles, linked to their video, with their language and flags kept.
- Configurable replacements for invalid characters.
- Files with several episodes, and split parts.
- Undo from the apply logs.
- ESLint with type-aware rules.

## 15. Sources

- Plex: [TV naming](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/), [movie naming](https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/)
- Jellyfin: [movies](https://jellyfin.org/docs/general/server/media/movies/), [shows](https://jellyfin.org/docs/general/server/media/shows/), [metadata provider identifiers](https://jellyfin.org/docs/general/server/metadata/identifiers)
- Emby: [movie naming](https://emby.media/support/articles/Movie-Naming.html), [TV naming](https://emby.media/support/articles/TV-Naming.html)
- Chromium: [crbug 40198034](https://issues.chromium.org/issues/40198034), directory move and rename not implemented
- Deno: [compile](https://docs.deno.com/runtime/reference/cli/compile/), [bundle](https://docs.deno.com/runtime/reference/cli/bundle/), [environment variables](https://docs.deno.com/runtime/reference/env_variables/), [stability and releases](https://docs.deno.com/runtime/fundamentals/stability_and_releases/), [2.9 release post](https://deno.com/blog/v2.9)
- Node: [single executable applications](https://nodejs.org/api/single-executable-applications.html), [release schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule)
