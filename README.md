# re-name

re-name renames and moves movie and TV files into the folders and names that **Plex**, **Jellyfin** and **Emby** expect,
matched against [The Movie Database (TMDB)](https://www.themoviedb.org). You start it in a terminal, and use it in your
browser.

```
Downloads/Severance.S01.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb/Severance.S01E01.Good.News.About.Hell.1080p.ATVP.WEB-DL.DDP5.1.H.264-NTb.mkv
  → processed/Severance (2022) {tmdb-95396}/Season 01/Severance (2022) - S01E01 - Good News About Hell [1080p WEB-DL ATVP DDP5.1 H.264 -NTb].mkv
```

Select files, pick the TMDB match, check the seasons and tags, and add the Job to the Queue. Nothing moves until you
apply the Queue. Then every file is checked against the disk first, files are only ever moved (never copied or
overwritten), and a log is written.

## Install

Download the build for your computer from the [latest release](https://github.com/jamescallumyoung/re-name/releases),
unzip it, rename it `re-name` (`re-name.exe` on Windows), and put it in a folder on your `PATH`. On macOS and Linux:

```sh
gunzip re-name-aarch64-apple-darwin.gz
chmod +x re-name-aarch64-apple-darwin
mv re-name-aarch64-apple-darwin /usr/local/bin/re-name
```

| Build                                | For                    |
| ------------------------------------ | ---------------------- |
| `re-name-aarch64-apple-darwin`       | macOS on Apple silicon |
| `re-name-x86_64-apple-darwin`        | macOS on Intel         |
| `re-name-x86_64-unknown-linux-gnu`   | Linux x64              |
| `re-name-aarch64-unknown-linux-gnu`  | Linux arm64            |
| `re-name-x86_64-pc-windows-msvc.exe` | Windows 10 and 11      |

**The builds aren't signed yet.** On macOS, the first run is blocked as "cannot be verified": allow it in System
Settings → Privacy & Security, or run `xattr -d com.apple.quarantine /usr/local/bin/re-name`. On Windows, SmartScreen
warns about an unrecognised app: choose **More info**, then **Run anyway**.

## First run

re-name needs a TMDB credential: either an API key or an API read access token, from
[your TMDB account's API settings](https://www.themoviedb.org/settings/api).

Run `re-name` once. It creates a `.env` file with every setting and its default, says where it is, and stops. Add your
credential to it as `TMDB_API_KEY`, then run `re-name` again. (Setting `TMDB_API_KEY` in your environment works too.)

| Setting                 | Meaning                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `TMDB_API_KEY`          | Your TMDB API key or read access token.                                                                       |
| `RENAME_FLAVOUR`        | The naming scheme to start with: `plex` (the default), `jellyfin` or `emby`. You can change it in the app.    |
| `RENAME_TITLE_LANGUAGE` | The language for titles and episode names, such as `en-GB` or `pt-BR`, or `original`. The default is `en-US`. |

The `.env` file is in `~/Library/Application Support/re-name` on macOS, `~/.config/re-name` on Linux, and
`%APPDATA%\re-name` on Windows. `known-tags.json`, next to it, lists the release tags re-name recognises (such as
`1080p` and `WEB-DL`) and how it writes them; edit it to add your own.

## Usage

```
re-name [source] [--target <dir>] [--no-open] [--port <n>] [--dry-run]
```

|                       |                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `source`              | The folder to rename files from. The default is the current folder.                                  |
| `--target <dir>`      | Where renamed files go. The default is `processed`, inside the source. It must be on the same drive. |
| `--no-open`           | Print the address instead of opening your browser.                                                   |
| `--port <n>`          | Listen on this port, instead of any free one.                                                        |
| `--dry-run`           | Applying the Queue reports what it would do, and moves nothing.                                      |
| `--version`, `--help` |                                                                                                      |

re-name runs until you close its browser tab, or press Ctrl-C. Only one tab can use it at a time. When you're happy with
what's in the target folder, move it into your media server's library.

Apply logs are kept in `~/Library/Application Support/re-name/logs` on macOS, `~/.local/state/re-name/logs` on Linux and
`%LOCALAPPDATA%\re-name\logs` on Windows.

## Developing

re-name is a [Deno](https://deno.com) workspace, on the LTS line (2.9): a server (`packages/server`), the web interface
(`packages/webapp`, Lit web components) and the contract between them (`packages/protocol`). The design is in
[`docs/design-doc.md`](docs/design-doc.md), and the server's behaviour in [`docs/server-spec.md`](docs/server-spec.md).

```sh
deno install                 # once
deno task dev ~/Downloads    # rebuilds the webapp on change, and runs the server on port 3000
deno task check              # type-check, lint and format check
deno task test
deno task compile            # every build into dist/ (or name the targets, such as aarch64-apple-darwin)
```

Pushing a `v*` tag builds the release. Before a release, go through [`docs/manual-checks.md`](docs/manual-checks.md).
