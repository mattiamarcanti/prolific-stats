# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Prolific Stats is a single-page, client-side dashboard for the CSV export of a Prolific participant's submission history (`my_prolific_submission_history.csv`). It converts every amount (£, $, €) into euros and shows totals, monthly stats, per-study and per-researcher tables and a filterable history. The CSV is parsed in the browser and never uploaded. The only network calls are to the Frankfurter API for ECB exchange rates, and they send just a date range.

## Running

There is no build step, package manager, linter or test suite. The files are served as-is: `index.html`, `styles.css`, `app.js`, plus `vendor/chart.umd.min.js` and `img/prolific.png` (the favicon, 512×512).

```bash
python -m http.server 8000
```

Then open http://localhost:8000 and drop one of the files in `examples/` onto the page. The three samples differ on purpose: mixed £/$ amounts, and the third has an extra `Applicable Terms` column. Use them to check parsing changes.

Unlike the sibling projects described in the parent workspace `CLAUDE.md`, this one does **not** use Bootstrap, Bootstrap Icons or Font Awesome. Icons are inline SVG, and Chart.js 4 is the only library. The font stack (`--font` in `styles.css`, also read by the charts) is Prolific's: "New Hero" first, then system fonts. New Hero is a commercial font and is not loaded from any CDN, so on a machine where it is not installed the page shows the first system font in the list (Segoe UI on Windows). At the same font size New Hero renders about 10% larger than Segoe UI, measured on Prolific's own texts. That is why `body` sets `font-size-adjust: 0.55`: the fallback font is scaled up to match New Hero's look, while the `px` sizes in the CSS stay the nominal ones. Canvas text in the charts is not affected. The repo has no `.github` deploy workflow.

## Conventions

- **The UI is in Italian** (`lang="it"`, `Intl` formatters set to `it-IT`, Italian month and weekday arrays in `app.js`). Code comments and section headers are Italian too. New user-facing strings must be Italian.
- `app.js` is one IIFE split into sections by `// ------------- <nome>` comment banners (CSV, tassi di cambio, conversione, filtri, aggregazione, one section per tab, eventi, avvio). Add code to the matching section.
- Small helpers at the top (`$`, `$$`, `esc`, `eur`, `store`, `dkey`/`mkey`, …) are used everywhere. Always pass interpolated data through `esc()`, because every view is built with template strings and `innerHTML`.

## Architecture

### Data pipeline

```
CSV text → parseCSV() → ingest() → RAW → convert() → DATA → render<Tab>(panel, rows)
                                                          └ only Storico: applyFilters(DATA)
```

- **Filters exist only in the Storico (history) tab.** `renderActive()` hides `#filterbar` and `#chips` on every other tab and passes them the full `DATA`. `setTab()` resets the filters whenever you switch to another tab. In the other tabs, anything that used to filter (clicking a week, a day, a status, a currency, a study, a researcher, a period tile in Riepilogo (`data-thist`), or "Vedi nello storico" on a card) calls `openHistory(patch)`, which resets `F`, applies the patch (e.g. `{ from, to }`, `{ statuses: new Set([...]) }`) and switches to Storico. Jumps use exact matches: `F.study` for a study (shown as the "Studio:" chip), and `F.researcher` with `F.researcherExact = true` for a researcher. The search box (`F.q`) and the text field of the Ricercatore filter stay partial matches, which would also catch longer names that contain the one you typed.
- **Filters must not move the page.** The Storico filter pills have fixed widths with an ellipsis. `#chips` is a single line of fixed height, with a "Nessun filtro attivo" placeholder. The Riepilogo period bar always shows the Dal/Al dates and the "Azzera" button, which is disabled when the period is "Tutto". `html` uses `overflow-y: scroll`, so the scrollbar is always there. Do not use `scrollbar-gutter: stable` instead: it leaves an empty grey strip next to the nav on short pages. When you add a filter control, keep its size independent of the value it shows.
- Riepilogo: the summary card and the tiles always use all the data. The "Guadagno mensile" and "Guadagno mese migliore" tiles (`data-tmonth`) open the month's card in the Mensile tab (`setTab('monthly')` and then `goToMonth(k, true)`); the other tiles open Storico. Tiles for the period in progress (today, this week, this month) show their amount in `--live` yellow. The "Andamento dei guadagni" card has its own period bar, which is not a filter and does not touch `F`. **It affects only that chart and the table under it.** The other four charts in the section (status, amount buckets, weekday, hour) always use all the data. The bar's state lives in `OVP`: the presets come from `overviewPeriods()`, `'custom'` uses dal/al dates, and clicking a chip (`data-ovp`) re-renders the tab. The bar sits inside the card (passed as `vizCard(…, { toolbar })`) and is not sticky (`.mtool.mtool-inline`), so it scrolls away with the page. The table under the chart has a single row for the period (`bracketTable(…, { noFoot: true })`), and clicking it opens Storico for that period. The bar reuses the `.mtool` styles of the monthly toolbar. `scrollToEl()` therefore takes the sticky offset only from a `.mtool` in the visible panel that is actually sticky.
- Studi and Ricercatori tabs work the same way. The `TOP_CARDS` (30) most profitable items get an infographic card (`infoCard(kind, …)`, with `kind` either `'study'` or `'researcher'`). Each card has the id `st-<rank>` or `rs-<rank>`, reuses the month-card CSS plus the `.infocard` class, and has a monthly chart drawn lazily by `drawInfoChart()`. What differs per kind (words, prefix, Storico filter) lives in `INFO`. In the ranking chart and in the table, clicking one of these items scrolls to its card (`pickInfo()` → `goToInfo()`), and any other item opens Storico. Clicking a bar of a card's monthly chart opens Storico for that item and month.

- `ingest()` matches headers case-insensitively against English and Italian aliases. Only Study, Reward and Status are required. It produces `RAW` rows in their original currency. **Rows without a Started At date are dropped here** and appear in no statistic and not in Storico. They are only counted in `FILE.skipped`, which the Riepilogo note and the settings drawer show. Every row therefore has `when`, `dateKey` and `monthKey`.
- Dates in the CSV are **UTC**. `rateKey` (which exchange rate applies) is the UTC date. `dateKey` and `monthKey` (grouping and filtering) use the browser's local time.
- `convert()` builds `DATA` with euro fields and computes the earnings rules. These rules match Prolific's own totals; keep them consistent:
  - `APPROVED`: earned = reward + bonus
  - `SCREENED OUT`: earned = bonus only (the reward is not paid)
  - `AWAITING REVIEW`: counted as pending
  - everything else (returned, timed-out, rejected): counted as lost
  - `value` is the amount used by the amount filter and the history table.
- `agg(rows)` is the shared aggregator: balance (saldo), pending, counts, minutes, €/hour and amount-bucket counts. Buckets come from `S.thresholds`. `S.basis` decides whether buckets count approved-only or all paid studies.

### Exchange rates

`rateFor(cur, key)` returns euros per unit of foreign currency. With `S.historical` on, it binary-searches the cached ECB time series (`HIST`) for the closest date on or before the study's date; otherwise it uses the fixed `S.rates`. `refreshRates()` tries `api.frankfurter.dev`, falls back to `api.frankfurter.app`, and only re-downloads the series when the data's date range is no longer covered. After any change to rates or settings, call `convert()` and then re-render.

### Rendering model

- Global state is held in module-level variables: `S` (settings), `F` (filters), `TAB`, plus per-tab UI state (`HSORT`, `HLIMIT`, `MSEG`, `SSEG`, `RSEG`, `MVIEW`, `OVP`). A `<details data-keep="name">` remembers its open/closed state across re-renders in `KEEP_OPEN`.
- `renderActive()` re-renders the whole active `<section class="panel">` from scratch with `innerHTML`. It destroys every Chart.js instance (the `charts` array) and recreates them through `makeChart()`. `renderAll()` also refreshes the wallet, the filter pills and the filter chips. Nothing is updated incrementally, so a state change just mutates state and calls one of these two.
- **Events are fully delegated.** `bind()` registers one `click`, one `input` and one `change` listener on `document`, and dispatches on `data-*` attributes (`data-tab`, `data-preset`, `data-seg`, `data-fstudy`, `data-hsort`, …). A new interactive element needs a `data-*` hook in its markup and a branch in `bind()`. Do not attach listeners to elements inside panels, because they are thrown away on the next render. The one exception is `bracketTable()`, which returns a DOM node that owns its own sort, expand and pick listeners.
- Monthly tab exceptions: the month-card toolbar ("Mostra" chips, "Vai a") calls `applyMonthView()`, which only toggles `hidden` on the cards instead of re-rendering; collapsing a card (`data-mtoggle`, or "Riduci tutte" via `data-mcollapse`) only toggles the `collapsed` class, and the set of collapsed months lives in `MCOLLAPSED`. Clicking a month in the chart or tables calls `goToMonth()`, which scrolls to the card `#m-YYYY-MM` and expands it; clicking a year in the yearly summary calls `goToYearTable()`. Clicking a week or a day inside a card calls `openHistory({ from, to })` (weeks are clamped to the card's month). The daily charts are created lazily by an `IntersectionObserver` (`LAZY`) watching each `.chart-box`, disconnected in `destroyCharts()`. With more than 12 months the "Mese per mese" chart goes full width and its table is split by year.
- `vizCard()` and `bracketTable()` are the reusable building blocks. `vizCard` is a chart card with a collapsible table. `bracketTable` is a sortable table of groups with heatmap bucket columns and Somma/Media footer rows. Both are used by every tab.
- Four custom Chart.js plugins are registered once at startup: `tipLabels`, `endLabel`, `crosshair` and `yearAxis` (year separators and labels under a month axis). Per-chart value formatters are passed to `makeChart(id, cfg, fmt)` and stored in a `WeakMap` keyed by canvas. `tipLabels` calls `fmt(value, index, compact)`: when the labels are wider than a column it retries with `compact = true`, and hides them if they still do not fit.

### Theming

Colors are CSS custom properties on `:root` in `styles.css`. Dark values are defined **twice**: once in `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and once in `:root[data-theme="dark"]`. Edit both together. `applyTheme()` sets `data-theme` on `<html>`, or removes it for "auto".

Charts read colors at render time with `tok('--name')`, which is why a theme change triggers `renderActive()`. The amount-bucket ramp exists both as `--ramp-*` in CSS and as `RAMP_LIGHT`/`RAMP_DARK` in `app.js`; keep them aligned.

### Persistence

All `localStorage` access goes through the `store` wrapper, which catches errors from unavailable storage. The keys are:

| Key | Contents |
|-----|----------|
| `ps.csv` | raw CSV text, reloaded on startup |
| `ps.fileinfo` | file name, row count, load time |
| `ps.settings` | `S`, merged over `DEFAULTS` in `loadSettings()` |
| `ps.hist` | cached ECB time series |
| `ps.tab` | last active tab |

When you add a setting, add its default to `DEFAULTS` so older saved settings still load.

### Chart.js loading

`index.html` loads the vendored `vendor/chart.umd.min.js` and falls back to the cdnjs Chart.js 4.4.1 build if `window.Chart` is missing. `makeChart()` shows a placeholder message if Chart.js is unavailable, so the rest of the app keeps working.
