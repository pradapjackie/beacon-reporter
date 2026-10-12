# Beacon Report

> A beautiful, fast, static HTML reporter for [Playwright](https://playwright.dev). Allure-grade analytics and better-than-Allure UX — one `npm install`, no servers, no Java, smooth at 50,000 tests.

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [['beacon-reporter'], ['list']],
});
```

Run your tests, then open the report:

```sh
npx beacon open beacon-report
```

That's it. Everything below is optional.

## Why Beacon

| | Built-in HTML | Allure | **Beacon** |
|---|---|---|---|
| Setup | zero | Java CLI + two-step generate | one npm package |
| History & trends | ✗ | manual file shuffling | automatic (`.beacon-history`) |
| Flaky analytics | ✗ | basic | EWMA flakiness board + quarantine commands |
| Run-over-run compare | ✗ | ✗ | built-in `/compare` page |
| Failure categories | ✗ | ✅ (its best feature) | ✅ regex rules + built-ins |
| 50k tests | sluggish | struggles | 2s generate, virtualized UI, worker-thread search |
| Works on `file://` | ✅ | ✗ (needs a server) | ✅ (data ships as script chunks) |

- **Dashboard** with 24 configurable, rearrangeable cards: outcomes, trends, slowest tests & actions, failure categories, incidents (one root cause → many tests), severity/owner rollups, suite health score, retry waste, duration budgets & percentiles, custom metrics, failure heatmap, accessibility rollup, suite treemap, and more.
- **Tests page**: virtualized list, tree/file/suite/project/tag grouping, split-view preview pane, full-text search including *inside error messages*, deep-linkable filters.
- **Test detail**: step tree & waterfall, ANSI-preserved code frames, retry tabs + attempt diff, per-test history strips, visual-diff viewer (slider/onion-skin/pixel), video player, trace link-out to trace.playwright.dev, HAR & axe viewers, source snippet, copy-as-bug-report.
- **History without a server**: a directory of compact JSON files; trends, transitions (fixed/regressed/new), compare view and flakiness scores are computed at generate time and embedded — every report stays self-contained.
- **First-class BDD**: [playwright-bdd](https://github.com/vitalets/playwright-bdd) suites group by Feature/Scenario Outline, Gherkin keywords are styled, and source panels show the original `.feature` scenario. ([guide](docs/bdd.md))
- **CLI toolkit**: `open`, `merge` (shards), `export` (single-file HTML), `gate` (CI thresholds), `summarize` (Markdown for PR comments/AI agents), `convert` (JUnit/CTRF/CSV), `generate --from-ctrf` (import *any* framework's CTRF results), `quarantine`, `diff`, `notify` (Slack/Teams), `archive`, `history`. ([reference](docs/cli.md))
- **Live mode**: set `watch: true` (or `BEACON_WATCH=1`) and the open report updates itself while tests run — a pulsing "Running" pill, counts and cards refreshing until the final write. Works with `beacon open` or any static server.
- **Embedded trace viewer**: open traces inside the report (trace.playwright.dev in an overlay), or in a new tab, or download.
- **Plugin API**: enrich tests and add custom dashboard cards from your Playwright config. ([guide](docs/plugins.md))
- **Code coverage & requirements**: ingest an istanbul coverage summary into a coverage card with trend, and trace `requirement: REQ-123` annotations into a traceability matrix.
- **Visual regression hub**: every `toHaveScreenshot` baseline with expected/actual/diff side by side and a copyable `--update-snapshots` command.
- **White-labeling**: your logo and accent color via one config option.

## Install

```sh
npm i -D beacon-reporter
# or: pnpm add -D / yarn add -D
```

One package ships everything: the reporter, the report UI, and the `beacon` CLI — run it with `npx beacon …` (or `npm i -g beacon-reporter` for a global `beacon` command). Works on macOS, Windows, and Linux; requires `@playwright/test` ≥ 1.40 and Node ≥ 20.

## Configure

```ts
export default defineConfig({
  reporter: [
    ['beacon-reporter', {
      outputFolder: 'beacon-report',
      title: 'Checkout suite',
      dashboard: { cards: ['outcomes', 'trend', 'slowest', 'failing', 'categories'] },
      environment: { app: 'shop 2.4.1', env: 'staging' },
      links: { issue: 'https://github.com/you/repo/issues/{}' },
      categories: [{ name: 'Payment gateway', messageRegex: 'ECONNREFUSED.*:9443' }],
    }],
    ['list'],
  ],
});
```

Every option is documented in **[docs/options.md](docs/options.md)**; conventions (metrics, budgets, severity, axe scans…) in **[docs/conventions.md](docs/conventions.md)**; CI recipes (history caching, quality gates, PR comments, sharding) in **[docs/ci.md](docs/ci.md)**.

## The 60-second tour

1. **Dashboard** — pass rate donut, trend across retained runs, and whichever cards you enabled. Click any bar to jump to the filtered test list. `Customize` lets viewers drag/hide cards.
2. **Tests** — type `/` to search (toggle "in errors" to search failure text), filter by outcome/project/tag chips, group by tree/file/suite/project/tag, click a row for the preview pane, `j`/`k` to walk tests.
3. **Compare** — pick any retained run as baseline: regressed, fixed, new, removed, slower, faster.
4. **Flaky** — recency-weighted flakiness per test, with a copyable `--grep-invert` quarantine command.
5. **Trends** — full pass-rate history with a run-by-run table, a run calendar, and per-metric trend charts.
6. **Timeline** — per-worker Gantt with utilization; drag to zoom.
7. **Media** — every screenshot/video in one filterable gallery.

Press `?` in the report for all keyboard shortcuts.

## Scale

Benchmarked in CI (`pnpm bench`): a 50,000-test run generates in ~2s / 330 MB RSS and the report stays at 60fps — columnar index chunks, Web Worker filtering, LRU detail loading, all aggregation done at generate time. The browser only renders.

## Monorepo layout

| Path | What |
|---|---|
| `packages/shared` | Versioned report data model (Zod) — the reporter↔UI contract |
| `packages/reporter` | The Playwright reporter (published as `beacon-reporter`) |
| `packages/ui` | The React SPA, prebuilt and shipped inside the package |
| `packages/cli` | The `beacon` CLI |
| `fixtures/demo-suite` | Dogfood Playwright suite exercising every feature |
| `fixtures/bdd-suite` | playwright-bdd suite validating BDD support |

## Development

```sh
pnpm install
pnpm build        # turbo: shared → ui → reporter/cli
pnpm test         # vitest across packages
pnpm lint         # biome
pnpm demo         # run the fixture suite with beacon attached
pnpm bench        # 50k-test synthetic benchmark with enforced budgets
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Architecture and the full phased plan live in [ROADMAP.md](ROADMAP.md).

## Contact

[Pradap Pandiyan](https://github.com/pradapjackie)

- Email: [pradapjackie@gmail.com](mailto:pradapjackie@gmail.com)
- GitHub: [github.com/pradapjackie](https://github.com/pradapjackie)
- LinkedIn: [linkedin.com/in/pradap-pandiyan](https://www.linkedin.com/in/pradap-pandiyan)
- Website: [pradappandiyan.medium.com](https://pradappandiyan.medium.com/)

## License

[MIT](LICENSE)
