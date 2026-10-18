# re-name server: behaviour spec

What `packages/server` must do, as numbered statements. Tests cite them (for example `N2.3`), and code comments refer to them. The reasons behind them are in [`design-doc.md`](design-doc.md) (cited as "§n"), and the contract with the webapp is `packages/protocol/mod.ts`.

Conventions:

- **Paths** sent to or from the webapp are relative to the source (or the target, for new paths), with `/` separators, whatever the OS.
- **Functions that can fail** return `[true, value]` or `[false, reason]`. RPC handlers signal failure by throwing an `HttpError` (status and body), which the HTTP layer turns into a response.
- **Sizes** are bytes, and **times** are milliseconds since the epoch.

---

## C. The command line and start-up (§4)

- **C1.1** `re-name [source] [--target <dir>] [--no-open] [--port <n>] [--dry-run] [--version] [--help]`. `source` defaults to the current folder, and `--target` to `<source>/processed`.
- **C1.2** `--help` prints the usage, and `--version` the version, then exit with status 0. An unknown flag, a second positional argument or a bad `--port` prints the problem and the usage, then exits with status 2.
- **C1.3** The source must be an existing folder. The target may not exist yet. Its nearest existing parent must be on the same drive as the source: same `dev` from `Deno.stat`, or on Windows (where `dev` may be missing), the same volume root of the real paths. Otherwise, exit with status 1 and say why.
- **C1.4** Start-up runs in this order: arguments (C1), config (F1), lock (L1), state, HTTP server (H1). Then the browser opens at the launch URL unless `--no-open`, and the URL is printed either way.

## F. Config folders and `.env` (§5)

- **F1.1** Folders by OS:

  | OS | Config | State | Cache |
  |---|---|---|---|
  | Linux | `$XDG_CONFIG_HOME/re-name`, else `~/.config/re-name` | `$XDG_STATE_HOME/re-name`, else `~/.local/state/re-name` | `$XDG_CACHE_HOME/re-name`, else `~/.cache/re-name` |
  | macOS | `~/Library/Application Support/re-name` | the same | `~/Library/Caches/re-name` |
  | Windows | `%APPDATA%\re-name` | `%LOCALAPPDATA%\re-name` | `%LOCALAPPDATA%\re-name\Cache` |

- **F1.2** The config folder is created if needed. If it can't be created or written to, start-up fails, naming the folder and the reason.
- **F1.3** If `.env` is missing, it's created with every variable and its default: an empty `TMDB_API_KEY`, `RENAME_FLAVOUR=plex` and `RENAME_TITLE_LANGUAGE=en-US`, each with a comment. On macOS and Linux it gets mode `0600`. An existing `.env` is never changed.
- **F1.4** `.env` is loaded without overwriting variables already in the environment.
- **F1.5** If `TMDB_API_KEY` is missing or blank, start-up fails, naming the `.env` file and the variable.
- **F1.6** `RENAME_FLAVOUR` must be `plex`, `jellyfin` or `emby`. Anything else fails start-up, saying which values are allowed. `RENAME_TITLE_LANGUAGE` is `original` or a language code such as `en-US`, and isn't otherwise checked.
- **F1.7** If `known-tags.json` is missing from the config folder, it's created with the built-in defaults. It's then loaded. Invalid JSON, an entry without a valid `pattern`, `value` and `category`, or a pattern that isn't a valid regex fails start-up, naming the file and the entry.

## L. The lock (§5.2)

- **L1.1** Each run writes `locks/<pid>.json` in the state folder, containing `{ source, pid, updatedAt }` with the source's real path, and refreshes `updatedAt` every 30 seconds.
- **L1.2** Before writing, start-up reads the other lock files. A lock not refreshed for 2 minutes is stale: it's deleted and ignored. If any live lock's source contains this run's source, or is contained by it, start-up fails, naming that source and its process ID.
- **L1.3** The lock file is deleted when the run ends.

## S. Scanning the source (§7.1, §10)

- **S1.1** The tree lists the source's folders and video files. Video files are recognised by extension, ignoring case: `mkv mp4 m4v avi mov wmv ts m2ts webm mpg mpeg`. Folders with no video files anywhere inside are left out.
- **S1.2** Hidden entries (names starting with `.`) are skipped, as is the target folder when it's inside the source, and symbolic links whose real path is outside the source. A symbolic link inside the source is followed only to a file: following linked folders could loop.
- **S1.3** Each file gets its size and its status:
  - `skipped` with reason `sample`, `multi-episode` or `split-part` (P1.6)
  - else `queued` with its Job ID, if it's in an approved Job
  - else `available`
- **S1.4** Folders come before files, and each is sorted by name (`localeCompare`).
- **S1.5** Each scan records every video file's size and modified time, which A1.1 compares against.
- **S1.6** A path from the webapp is accepted only if it's relative, has no `.` or `..` segments, and is a video file in the last scan. Otherwise it's a `422` naming the path.

## P. Parsing names and tags (§9.3, §9.4)

- **P1.1** A file name (without its extension) is read as: a title, then a year or `SxxEyy`, then tags, then release groups.
- **P1.2** `SxxEyy` (case-insensitive, 1–2 digit season, 1–3 digit episode) gives the season and episode. The title ends where it starts.
- **P1.3** The year is the last year-like number (1900–2099) before the first tag or the episode, and not the first token. `Blade.Runner.2049.2017…` is from 2017.
- **P1.4** Known tags are matched **longest first** against whole dot-separated tokens, so a known tag can span tokens (`DDP5.1.Atmos`). Text after the episode code and before the first known tag is an episode name, and isn't a tag. Other tokens after the first known tag are **unknown tags**, kept as they are.
- **P1.5** Release groups are the trailing `-NAME` parts: one (`-NTb`), several (`-GGEZ-RARBG`), or bracketed (`-NTb[rartv]`, giving `NTb` then `rartv`), in order. A trailing part that completes a known tag (`WEB` + `-DL`) belongs to the tags.
- **P1.6** Skip rules:
  - **sample:** `sample` as a word in the name, or anywhere under a folder called `Sample`
  - **split-part:** `cd`, `pt`, `part`, `disc`, `disk` or `dvd`, then a number, as a word
  - **multi-episode:** a second episode number after the first (`S01E01E02`, `S01E01-E02`)
- **P1.7** Each found tag has its `source` text, its `value` from the known-tags file (`null` drops it), and whether it's `known`.

## N. Names (§9)

- **N1.1** ID tags: Plex `{tmdb-ID}`, Jellyfin `[tmdbid-ID]`, Emby `[tmdbid=ID]`.
- **N1.2** A movie's folder is `Title (Year) ID`. Its file name is:
  - Plex: `Title (Year)`, a space, then the brackets
  - Jellyfin and Emby: the folder name, ` - `, then the brackets
- **N1.3** An episode's folders are `Title (Year) ID/Season NN`. Its file name is `Title (Year) - SNNENN`, then ` - Episode Name` when there is one, then the brackets: after a space for Plex, after ` - ` for Jellyfin and Emby. Season and episode numbers are padded to at least 2 digits.
- **N1.4** The brackets hold the non-dropped tags, then `DUP-{n}` if any, then each group with its own `-`, separated by spaces. Tags are ordered by their category (resolution, source, service, HDR, audio, codec, other), keeping the original order within a category. Unknown tags count as `other`. With nothing to show there are no brackets, and no separator before them.
- **N1.5** The episode name is left out when TMDB has only a placeholder (`Episode n`, `Épisode n`, `Folge n`, `Episodio n`, `Aflevering n`, `Avsnitt n`, where n is the episode number), or when the "include episode name" option is off.
- **N1.6** In every name, the characters `< > : " / \ | ? *` and control characters are each replaced with `_`.
- **N1.7** If a name would be longer than 255 UTF-8 bytes, the episode name is left out first, with a warning. If it's still too long, the file can't be named (an error).
- **N1.8** A name ending in `.` or a space, or whose part before the first `.` is a reserved Windows name (`CON`, `PRN`, `AUX`, `NUL`, `COM0`–`COM9`, `LPT0`–`LPT9`), can't be named (an error).
- **N1.9** `DUP-{n}`: names are compared ignoring case. Existing files in the target keep their names, then the Queue's Jobs are named in order, each file taking the lowest `n` (starting with no tag) that's free.
- **N1.10** A TV file with no season or no episode can't be named. A season or episode TMDB doesn't know gives a warning, and the file is named without an episode name.

## T. TMDB (§5.3, §9.4)

- **T1.1** Requests go to `https://api.themoviedb.org/3` (or `RENAME_TMDB_BASE_URL`, read only when set, for tests). A credential starting `eyJ` is sent as `Authorization: Bearer …`, and any other as the `api_key` query parameter.
- **T1.2** Every request carries `language` (the title language, or no parameter when it's `original`). With `original`, titles and names come from `original_title` and `original_name`.
- **T1.3** **Search** queries `search/movie` and `search/tv` in parallel and merges the results, keeping TMDB's order within each and alternating between them. A match has its type, ID, title, year (from `release_date` or `first_air_date`, else 0) and poster URL (`https://image.tmdb.org/t/p/w185<poster_path>`, or `null`).
- **T1.4** **Details** for a movie come from `movie/{id}`. For TV they come from `tv/{id}`, plus `tv/{id}/season/{n}` for each season it lists, giving each season's episodes with their names. Placeholder names (N1.5) become `null`.
- **T1.5** **Suggestions** use the most common parsed title and year among the files (ties go to the first file's). They search with that title, then rank the results: shared title words (most), then a matching year, then the right type (TV when the files have episode numbers). They return up to 5.
- **T1.6** At most 8 requests are in flight. A `429` waits for `Retry-After` seconds (default 1) and retries, up to 3 times.
- **T1.7** Successful responses are cached in the cache folder for 7 days, keyed by the request URL without the credential. A cached response is used instead of a request.
- **T1.8** A network failure, or a `5xx` after the retries, becomes a `502` with the message "TMDB can't be reached". A `404` for details becomes a `404`.

## H. HTTP, session and security (§8)

- **H1.1** The server listens on `127.0.0.1` only, on `--port` or a free port.
- **H1.2** The launch URL is `http://127.0.0.1:<port>/?t=<token>`, with a random token of 32 hex digits.
- **H1.3** `GET` for the page and its files serves `packages/webapp/dist`, needing no cookie. `index.html` is served for `/`. Unknown files get `404`.
- **H1.4** Every response sends `Content-Security-Policy`: `default-src 'self'`, images also from `https://image.tmdb.org`, styles also from `https://fonts.googleapis.com`, and fonts from `https://fonts.gstatic.com`.
- **H1.5** Every request whose `Host` isn't `127.0.0.1:<port>` or `localhost:<port>` gets `403`. Every `POST` whose `Origin` isn't one of those two (as `http://…`) gets `403`.
- **H1.6** `POST /rpc/<command>` runs that command with the JSON body. An unknown command gets `404`. Every command except `session.claim` needs the session cookie, or gets `403`.
- **H1.7** `session.claim` with the launch token sets the session cookie (`HttpOnly`, `SameSite=Strict`, `Path=/`). With the cookie and no token, it also works, for a reload. With neither, it's a `403`.
- **H1.8** Only one tab holds the session. A claim from the holding tab ID, or when none holds it, succeeds. A claim from another tab ID while the event stream is open gets `409`. A claim from another tab ID while the stream is closed takes over: the old tab ID is replaced.
- **H1.9** `GET /events` (with the cookie) opens the event stream, an SSE stream of JSON events. A newer stream replaces an older one, which first gets `taken-over`. A heartbeat event goes out every 5 seconds.
- **H1.10** When no stream has been open for 15 seconds, the run ends, unless an apply is running, in which case it ends once the apply finishes.
- **H1.11** On Ctrl-C (SIGINT, and SIGTERM where supported), `shutting-down` goes to the stream. Once any apply has finished, the run ends.
- **H1.12** Ending the run stops the server and the lock refresh, deletes the lock file, and exits with status 0.

## R. Commands (§8.3, §8.4)

- **R1.1** Responses are JSON. Errors are `{ error, message, details? }` with the status. Every response carries the Queue's `ETag`, `"q-<version>"`. The version starts at 1 and goes up with every change to the Queue or the options.
- **R1.2** `options.set`, `queue.addJob`, `queue.replaceJob`, `queue.removeJob` and `queue.apply` need `If-Match`. A missing one gets `428`, and a stale one `412`.
- **R2.1** `session.claim` returns the session (source and target names and full paths, `dryRun`, `optionsChosen`), the options and the Queue.
- **R2.2** `session.end` returns `204`. The stream closing does the rest (H1.10).
- **R3.1** `options.get` returns the options. They start as `RENAME_FLAVOUR` with episode names on.
- **R3.2** `options.set` with a valid flavour sets both options, sets `optionsChosen`, and returns the options and the Queue renamed under them. An invalid flavour gets `422`.
- **R4.1** `tree.get` scans the source again (S1) and returns its root.
- **R5.1** `tmdb.getSuggestions` (T1.5), `tmdb.search` (T1.3, an empty query giving `[]`) and `tmdb.getDetails` (T1.4) answer from TMDB.
- **R6.1** `job.analyseFiles` checks each path (S1.6). A skipped file, or one queued in a Job other than `forJobId`, gets `422`. It returns each file parsed (P1).
- **R6.2** `job.getPreview` names the draft (N1) as if it were the last Job in the Queue, or in place of `replacesJobId`. It returns each file's new path relative to the target, its `DUP-{n}`, warnings and error, and whether all can be named. An unknown TMDB title gets `422`.
- **R7.1** `queue.get` returns the Queue: each Job with its ID, draft, TMDB match and preview.
- **R7.2** `queue.addJob` needs at least one file, files not already queued (`409` listing them), valid paths (R6.1), and every file nameable (`422` listing the errors). It adds the Job at the end with a new ID (`job-<n>`) and returns the Queue.
- **R7.3** `queue.replaceJob` needs an existing Job (`404`), then the same checks as R7.2, ignoring that Job's own files. It replaces the draft in place, keeping the Job's ID and position.
- **R7.4** `queue.removeJob` needs an existing Job (`404`), removes it, and returns the Queue.
- **R7.5** `queue.apply` needs a non-empty Queue (`422`) and no apply running (`409`). It runs the check (A1.1), giving `422` with details if that fails, then starts the apply and returns `202 { started: true }`.

## A. Applying (§11)

- **A1.1** **Check:** each queued file must still exist with the size and modified time from the last scan, and no new path may already exist in the target (ignoring case). Problems are listed, and nothing moves.
- **A1.2** Files are moved in Queue order. Folders are created as needed, and existing ones reused. Each file is moved with `Deno.rename`.
- **A1.3** A rename that only changes the letter case of an existing path goes through a temporary name in the same folder.
- **A1.4** `EXDEV` (another drive) is an error, and nothing is ever copied. An existing file at the new path is an error, and nothing is overwritten.
- **A1.5** Before each file, an `apply-progress` event (Job ID, path, new path, index, total) is sent.
- **A1.6** The first error stops the apply. Moved files leave their Jobs, and Jobs left with no files leave the Queue. Everything else stays queued. With `--dry-run`, nothing is created or renamed, and the Queue is unchanged.
- **A1.7** A log is written to `logs/apply-<YYYY-MM-DDTHH-MM-SS>.json` in the state folder: when it ran, whether it was a dry run, the options, the source and target, each change with its outcome (`moved`, `would-move`, `failed` with the error, or `not-run`), and the Queue as it was before.
- **A1.8** At the end, the Queue's version goes up (unless it was a dry run), the source is scanned again, and `apply-done` is sent with the counts, any error, the log path, the Queue and its `ETag`.
