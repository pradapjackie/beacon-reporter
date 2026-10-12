# `beacon` CLI

Ships inside `beacon-reporter` — `npx beacon …` works after a local install, and `npm i -g beacon-reporter` gives a global `beacon` command. Cross-platform (macOS/Windows/Linux). Every command defaults `reportDir` to `./beacon-report`.

| Command | What it does |
|---|---|
| `beacon open [dir] [--port 4173]` | Serve a report (gzip + CORS — required for the trace-viewer link-out) and print the URL. |
| `beacon merge [blobDir] [--out dir]` | Merge sharded blob reports into one Beacon report (wraps `playwright merge-reports`). |
| `beacon export [dir] [--out report.html] [--failures-only]` | Single self-contained HTML file — images inlined up to 10 MB, videos/traces become stubs. `--failures-only` keeps just failed/flaky tests. |
| `beacon export [dir] --pdf [--out report.pdf]` | Print the dashboard to an A4 PDF via headless Chromium (uses your project's Playwright). |
| `beacon gate [dir] [--max-failed n] [--max-flaky n] [--min-pass-rate pct]` | Exit non-zero when thresholds are violated. No flags = fail on any unexpected failure. |
| `beacon summarize [dir] [--out file] [--html]` | Markdown digest — made for PR comments and AI agents: counts, failures with rerun commands, incidents, most-failing. |
| `beacon convert [dir] --format junit\|ctrf\|csv [--out file]` | Export results to other formats. |
| `beacon generate --from events.json [--out dir]` | Rebuild a report from a recorded Reporter API event stream (see `beacon-reporter/fixture-recorder`). |
| `beacon generate --from-ctrf ctrf.json [--out dir]` | **Import any framework's [CTRF](https://ctrf.io) results** — Jest, Cypress, WebdriverIO, Mocha… — and render them as a Beacon report (history, trends and compare included). |
| `beacon quarantine [dir] [--history dir] [--min-rate 0.5] [--min-runs 3] [--grep-invert] [--fixme]` | Flaky-quarantine candidates from run history; `--grep-invert` emits a regex for `playwright test --grep-invert`, `--fixme` emits `test.fixme` suggestions. |
| `beacon diff <a> <b>` | Compare two report directories (new/fixed/regressed/slower). |
| `beacon notify [dir] --webhook url [--format plain\|slack\|teams]` | Post the digest to a webhook — `slack` sends Block Kit, `teams` a MessageCard with status color. |
| `beacon archive <parentDir> [--out index.html]` | Static index page over a directory of reports. |
| `beacon history show [dir]` | Print the retained run table from `.beacon-history`. |
| `beacon history prune [dir] --retain n` | Keep only the newest n runs. |
