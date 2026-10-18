# re-name: manual checks

What the automated tests can't cover. Go through this before a release, and note the date, versions and results in
the release notes. Use a copy of real downloads, never the only copy.

## 1. Real TMDB

Run a build with a real `TMDB_API_KEY` against a folder with a few movies and a TV season.

- [ ] Suggestions appear for each kind of file, and search finds a title the suggestions missed.
- [ ] Posters load (the content security policy allows `image.tmdb.org`).
- [ ] `RENAME_TITLE_LANGUAGE=de-DE` gives German titles and episode names; a title with no German name falls back to
      its original one; `original` gives original-language names.
- [ ] Both kinds of credential work: a v3 API key and a v4 read access token.
- [ ] A wrong credential shows an error that says TMDB refused it.
- [ ] The cache folder fills with one file per TMDB request, and a second run on the same files is faster.

## 2. Browsers

In Chrome, Safari and Firefox (current versions):

- [ ] The page opens from the terminal, and the token disappears from the address bar.
- [ ] A second tab says re-name is open elsewhere; closing the first and reloading the second takes over.
- [ ] Closing the tab stops re-name within about 15 seconds; reloading doesn't.
- [ ] Ctrl-C in the terminal shows "re-name has stopped" in the page.
- [ ] The file tree works with the keyboard alone: the arrow keys, Shift+arrow, Home, End, Space and Enter.
- [ ] Each modal and dialog takes focus when it opens, keeps Tab inside it, gives focus back when it closes, and
      closes on Escape (except the first-run settings and the apply progress).
- [ ] With a screen reader (VoiceOver, or NVDA on Windows), the tree reads its rows' levels and selection, and the
      dialogs read their titles.
- [ ] The apply banner's sweep plays, and doesn't with "reduce motion" turned on.

## 3. Operating systems

On macOS, Windows and Linux, from the release builds:

- [ ] The first run creates `.env` (with `0600` permissions on macOS and Linux) and `known-tags.json`, and says where.
- [ ] The browser opens by itself.
- [ ] A target on another drive is refused at start-up.
- [ ] On Windows: names with `:` or `?` in the title come out with `_`; long paths work.
- [ ] Running a second re-name on the same source (or a folder inside it) is refused, and on another folder is
      allowed.

## 4. Media servers

The formats in design doc §9 are from each server's documentation. Check that each server actually identifies them.

1. With `--dry-run` off, apply a Queue of at least two movies (one with a `DUP-1` copy), one TV show with two seasons
   (one episode with no episode name), and one file with a release group, to a fresh target, once for each flavour.
2. Add each target folder to a new library in the matching server, and scan.

- [ ] **Plex:** every movie and episode is matched to the right TMDB title, season and episode.
- [ ] **Jellyfin:** the same.
- [ ] **Emby:** the same.
- [ ] Each server shows the `DUP-1` copy as a version of the same movie (or as a separate file, which is acceptable),
      not as a different movie.
