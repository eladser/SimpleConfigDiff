# Changelog

## 2.0.0 — 2026-06-11

Full rework. The tool does the same job, but the stack, the interface, and the project setup were rebuilt.

### Interface
- New dark, terminal-style interface. Color now only carries meaning: teal for interactive state, green/red/amber for added/removed/changed.
- Editable side-by-side code editors (CodeMirror) with syntax highlighting, line numbers, and format auto-detection with manual override. Type or paste directly — no upload step required.
- The diff runs live as you type, debounced. The Compare button is gone.
- Character-level highlighting inside changed values, so `api.staging.internal` → `api.example.com` marks only the part that differs.
- Per-row actions: copy path, copy value, and "ignore this key" which adds an ignore rule and recompares in one click.
- Swap sides, sample data to try instantly, drag a file anywhere on the page (left half → left pane), Ctrl+Enter jumps to results.
- Installable as an offline app (PWA).
- Light mode removed. One theme, done properly.
- Side-by-side view groups changes by parent path, with inline filter counts and search. The separate "Enhanced Mode" toggle is gone — there's one side-by-side view now.
- Flat metric strip instead of stat cards; one toolbar instead of stacked control panels.

### Stack
- React 18 → 19, Vite 5 → 8 (Rolldown), Tailwind 3 → 4, TypeScript 5 → 6, ESLint flat config.
- TOML parsing moved from the unmaintained `@iarna/toml` to `smol-toml`.
- Removed ~7,000 lines of dead components and utilities that were never wired in (directory comparison, GitHub integration, batch processing).

### Fixes
- The CLI now actually parses YAML, TOML, XML and INI. It previously fell back to `JSON.parse` for everything and silently produced wrong results for non-JSON formats.
- CLI `--watch` actually watches now. It used to exit after the first comparison, and only monitored the left file's directory; it now survives parse errors mid-write and watches both files.
- `**` glob patterns in path rules matched nothing due to broken regex construction; `*.key`, `a.**`, and `**.password` all work now.
- CSV export escapes embedded quotes per RFC 4180 and no longer drops `0`/`false` values.
- Fonts are self-hosted instead of loaded from Google Fonts — no external requests at all, and the app is fully usable offline.
- User-supplied regex transforms are skipped on values over 10k characters so a backtracking pattern can't freeze the tab.
- Search input no longer crashes the diff view when the query contains regex characters like `[` or `(`.
- Content-based format detection no longer misreads JSON containing a `|` character as a Jinja2 template.
- Parse errors keep their original cause attached.

### Project
- MIT license file added (the README claimed MIT; the file didn't exist).
- `package-lock.json` is committed now; CI uses `npm ci` on Node 22.
- CLI and web header read the version from `package.json` instead of hardcoding it.
- Proper branding: logo, wordmark, app icons (including maskable for PWA install), and a social preview card.

### Breaking
- Light mode is gone.
- The standalone directory-comparison and GitHub-integration modules were removed. They were unreachable from the UI, but if you imported them directly, they no longer exist.

## 1.0.0 — 2025-07

First release: browser-based structural diff for JSON, YAML, TOML, XML, INI, ENV, properties, HCL and CSV, with side-by-side/tree/unified views, export to JSON/CSV/HTML/patch, and a Node CLI.
