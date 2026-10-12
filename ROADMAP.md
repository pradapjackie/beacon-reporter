# Beacon Report — Roadmap

> **Name (updated 2026-10-12):** **`beacon-reporter`** — unscoped on npm, for the software testing community. CLI bin is `beacon` (shipped inside the package); the generated output folder stays `beacon-report`. Publish-time prerequisites: verify the unscoped name is still free on npm, and confirm the license owner for the LICENSE copyright line.

## Vision

**Allure-grade analytics and better-than-Allure UX, 100% Playwright-native, one npm package, static output that stays smooth at 50k tests, with history and PR summaries built in.**

A custom Playwright reporter published to npm. You add one line to `playwright.config.ts`, run your tests, and get a beautiful, fast, static HTML report — dashboard, charts, trends, flaky analytics, visual-diff viewer, worker timeline — with zero servers and zero Java.

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [['beacon-reporter', { outputFolder: 'beacon-report' }], ['list']],
});
```

### The three moats

Every phase decision protects these:

1. **Full-fidelity capture** of the entire Playwright Reporter API — verified by recorded event fixtures per Playwright minor version.
2. **Static-only speed at scale** — perf budgets enforced in CI (50k tests → TTI < 2 s, filter < 150 ms).
3. **CI-native history / PR-delta workflow** — the GitHub Action + PR comment loop nobody else closes.

---

## Architecture

### Three parts, one published package

```
User's machine / CI                npm package `beacon-reporter` (published dist)
┌──────────────────────────┐              ┌─────────────────────────────────────────┐
│ playwright test          │              │ dist/reporter   (Reporter API impl)     │
│  └─ Reporter (Node)      │──writes──▶   │ dist/cli        (bin: beacon)           │
│     collector + writer   │   report/    │ dist/ui/        (prebuilt React SPA)    │
└──────────────────────────┘              └─────────────────────────────────────────┘
```

- **Reporter core (Node)** implements the full Playwright `Reporter` interface. Three jobs: (a) collect events into an in-memory model (spill to disk above threshold), (b) stream attachments into a content-addressed store *as tests finish* (never buffer), (c) at `onEnd`, compute **all** aggregates — dashboard stats, per-project/per-tag rollups, worker timeline lanes, slowest tests, flaky sets, trend merge — and emit chunked data files + copy the prebuilt SPA. **All expensive computation happens at generate time, never in the browser.**
- **Report UI (React SPA)** is built once at package-publish time and shipped as static assets in the npm package. It contains zero run data; it boots from `data/manifest.js` and lazy-loads everything else.
- **CLI (`beacon`)** — `open` (static server with gzip + CORS + browser open), `generate` (rebuild a report from a blob zip / raw events without rerunning tests), `merge` (shards), `history` (prune/show), `export` (CTRF/JUnit, Phase 5).

### Report output layout

```
report/
├── index.html                 ← copied from dist/ui, relative asset paths
├── assets/*.js|css            ← the SPA bundle (identical every run)
├── data/                      ← run-specific, chunked, lazy-loaded
│   ├── manifest.js            ← summary, aggregates, chunk index, config snapshot (~100 KB)
│   ├── index/chunk-N.js       ← columnar test-list index (5k tests/chunk, ~40–60 B/test)
│   ├── details/chunk-N.js     ← full TestDetail records (~50 tests/chunk, grouped by file)
│   └── history.js             ← merged trend data
└── attachments/<sha256>.<ext> ← content-addressed store
```

### Key decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Data file format | **`.js` chunks, not `.json`** — each calls `window.__BEACON__.push(key, data)`; the SPA loads them by injecting `<script>` tags | `fetch()` of local JSON is blocked on `file://`. Script tags work on `file://`, localhost, and any static host alike. Removes the entire "report doesn't open" bug class. Gzip comes free from hosting / the CLI server |
| Schema | **Versioned (`schemaVersion: 1`)** Zod + TS types in `packages/shared` | Single contract between reporter and UI; UI refuses higher majors; additive = minor |
| Attachments | **Content-addressed by sha256**; modes `copy` (default) / `move` / `reference`; per-type size caps → visible `omitted` stubs | Dedupes identical screenshots across retries/shards for free; streaming hash-copy in one pass, never `readFileSync` |
| Single-file HTML | **Opt-in export, never the primary format.** Inline images under a 10 MB budget; videos/traces become download stubs; hard warning at 50 MB | Browsers degrade badly past ~50 MB. Single-file-as-flagship is monocart's trap |
| Routing | **Hash history**, filters live in URL search params | Only strategy that works on `file://` and dumb static hosts; shareable deep links to any test/attachment |
| Aggregation | At generate time in Node, never in the browser | Dashboard renders from one ~100 KB manifest → first paint < 500 ms |

### Staying fast at 50k tests

- Test list: **TanStack Virtual** over a **columnar index** (parallel arrays + string tables); chunks load progressively.
- Filtering/search runs in a **Web Worker** over the columnar arrays — int comparisons and string-table lookups, no per-test objects until render.
- Detail chunks (~50 tests, grouped by spec file so "click through a spec" hits one chunk) load on demand, LRU-capped.
- Charts consume precomputed aggregate series from the manifest — never raw test arrays.

**Perf budget (CI-enforced from Phase 4):** 50k tests → TTI < 2 s served, list scroll 60 fps, filter < 150 ms, reporter generate < 30 s / < 512 MB RSS.

---

## Playwright coverage matrix (the "everything" contract)

| Playwright feature | Capture | Render | Phase |
|---|---|---|---|
| Full lifecycle: `onBegin` `onTestBegin` `onStepBegin` `onStepEnd` `onTestEnd` `onEnd` `onError` `onStdOut` `onStdErr` `onExit`, `printsToStdio` | Reporter | — | 1 |
| Nested `test.step` trees w/ category (hook / expect / pw:api / fixture), step-level errors & attachments | Reporter | Step tree | 1–2 |
| Attachments: screenshot, video, trace, custom (contentType-aware) | Store | Lightbox / player / viewer | 1–2 |
| `toHaveScreenshot` visual diffs — `expected/actual/diff` triples detected at collect time (`visualDiff` structure, no UI string-matching) | Reporter | Slider + onion-skin + pixel-diff viewer | 2 |
| Annotations (skip/fixme/slow/custom, incl. result-level), tags | Reporter | Badges + filters | 1–2 |
| Projects (multi-browser/device) | Reporter | Breakdown + filter | 1 |
| Retries → expected / unexpected / flaky / skipped outcomes | Reporter | Retry tabs, flaky badge | 1 |
| Serial / parallel / fullyParallel modes, shard info, config snapshot | Reporter | Config page | ✅ (/config, JSON-safe FullConfig excerpt) |
| Sharding: blob reporter + `merge-reports` workflow, shard provenance per test | Reporter/CLI | — | ✅ (`beacon merge`; shard badge on single-shard runs — merged blobs expose no per-test shard in the Reporter API) |
| Global setup/teardown errors, `onError` run-level errors | Reporter | Dashboard warnings | 2 |
| stdout/stderr per test, in order | Reporter | Tabs | 1 |
| Error stacks with ANSI-preserved code frames (render Playwright's own `error.snippet` — don't rebuild code-frame) | Reporter | Error panel | 1 |
| Test location / source excerpt (opt-in) | Reporter | Source tab | ✅ (source panel: failures always, all tests ≤2k; BDD maps to the .feature scenario; `embedSource: false` opts out) |
| Worker timeline (`workerIndex` / `parallelIndex` Gantt) | Reporter | Timeline view | 2 |
| Timeouts, slow tests, `testInfo` metadata | Reporter | Badges + panel | 2 |
| CI env auto-capture (branch / sha / PR / provider) | Reporter | Run header | 1 |

**Exit criterion for Phase 2:** every field in the Reporter API types is captured, rendered, and covered by a replay test.

---

## Tech stack

| Slot | Pick | Why |
|---|---|---|
| Language | TypeScript strict, ESM-first (CJS shim for the reporter entry — Playwright loads reporters via `require` in some setups) | Typed schema shared Node ↔ browser |
| Monorepo | pnpm workspaces + Turborepo + Changesets | Cached `shared → ui → reporter/cli` pipeline; versioned publish of one public package |
| Node build | tsup | Fast, dual-format ESM+CJS, no config sprawl |
| UI build | Vite + React | The bar is "snappy React SPA"; hashed assets, `base: './'` relative output |
| Routing | TanStack Router, **hash history** | Typed routes; filters in URL = shareable deep links; works on `file://` |
| Data loading | TanStack Query wrapping the script-tag chunk loader | Cache, dedupe, suspense |
| UI state | Zustand (theme, panels); everything durable goes in URL params | Tiny |
| Virtualization | TanStack Virtual | Headless, variable-height rows for the grouped list |
| Charts | Apache ECharts via `echarts/core` modular imports (canvas renderer) | Smooth at trend-series scale; treemap/heatmap/Gantt-style customs; tree-shakes to ~180 KB |
| Styling | Tailwind CSS v4 + shadcn/ui (vendored) + Radix; dark/light via CSS variables + `prefers-color-scheme` + persisted toggle | Fast path to a genuinely polished look |
| ANSI / errors | Small ANSI→spans renderer over Playwright's own snippets | Don't rebuild Babel code-frame |
| Testing | Vitest units (reporter/schema/CLI, replaying recorded Reporter-API event fixtures) + **dogfooding**: the repo's own Playwright suites run with beacon as reporter, then a second Playwright project e2e-tests the generated report UI; that report publishes to gh-pages as the living demo | The event-fixture corpus per Playwright minor is the compatibility safety net |
| Lint/format | Biome | One tool, fast |
| CI | GitHub Actions: lint → typecheck → build → test → demo; later a matrix over Playwright 1.40 → latest and Node 20/22, plus a perf-budget job with a synthetic 50k-test blob | |

---

## Phases (~13–16 engineer-weeks to 1.0 for one engineer)

### Phase 0 — Foundations (~1.5 weeks) ← *scaffold done, in progress*

- [x] Monorepo scaffold: `packages/shared | reporter | ui | cli`, `fixtures/demo-suite`, Turbo, Biome, Changesets, CI
- [x] Schema v1 first draft in `packages/shared` (manifest, columnar index, TestDetail, steps, attachments, visual diffs, history)
- [x] Reporter skeleton with every lifecycle method typed; minimal manifest written at `onEnd`
- [x] UI shell: hash router, `__BEACON__` chunk loader, dark/light theme, dashboard/list/detail routes
- [x] CLI skeleton: `beacon open` static server (gzip + CORS), `generate` stub
- [x] Demo fixture suite: pass / expected-fail / flaky / skip / slow / steps / attachments / two projects
- [ ] **Draft schema v1 end-to-end** — the reporter should capture *everything* from day one so old reports gain features with UI upgrades
- [x] Event-fixture recorder (`beacon-reporter/fixture-recorder`): serializes raw Reporter-API calls to JSON; `pnpm record-fixtures` regenerates, replay tests verify manifests against the recorded stream
- [ ] Reserve the npm name; pick license (recommend MIT)

### Phase 1 — MVP, first publishable alpha `0.1.0-alpha` (~3–4 weeks)

Narrow but *feels* premium:

- Reporter: full lifecycle capture, attachment store, chunked writer, CI env detection
- UI: dashboard (status donut, duration stat tiles, project breakdown); virtualized test list with status/project/text filter; test detail (step tree with durations, error with code frame, screenshot lightbox, stdout/stderr tabs, retry tabs)
- CLI: `open`, `generate`
- Docs site = the dogfooded demo report
- Explicitly deferred and documented: history, traces, sharding

### Phase 2 — Full Playwright coverage, `0.x` betas (~4–6 weeks)

- Visual regression viewer: expected/actual/diff with slider + onion-skin + pixel-diff toggle
- Video player; trace handling: download + link-out to `trace.playwright.dev` (see Risks §5)
- Blob / `merge-reports` support incl. per-test shard provenance
- Step-level annotations/tags/attachments; tag & annotation filters
- Worker timeline (Gantt); config snapshot page; global setup/teardown + `onError` on dashboard
- Timeout & slow badges; `testInfo` metadata panel; source-code tab (opt-in)
- Playwright version matrix in CI goes live
- **Exit criterion:** every Reporter API field captured + rendered + replay-tested

### Phase 3 — Allure parity: analytics, `1.0.0` (~4–5 weeks)

- History & trends (see below): pass-rate trend, duration trend, per-test sparkline, regressed / fixed / new / still-failing deltas vs previous run
- [x] Flakiness analytics: EWMA flaky score per test, /flaky board with quarantine copy-chip
- [x] Docs: README, options/conventions/CLI/CI/BDD guides, CONTRIBUTING, LICENSE, npm README
- [x] CTRF import (`beacon generate --from-ctrf`) — render any framework's results
- [x] Tests tree view, timeline zoom + lane utilization, attempt diff, error-search index chunk, duration percentiles, storage dedupe stats, new-vs-known failures, prev/next + `?` help, Slack/Teams notify formats, `beacon history show|prune`
- [x] Timeline lanes moved to their own chunk (manifest at 50k tests: 828 KB → 19 KB)
- [x] Per-metric trend sparklines (history run files record per-metric means)
- [x] Real-browser demo project (chromium, video + trace on) — the sample report carries genuine media
- [x] Accessibility audit: axe clean (0 violations) across all 8 pages in both themes — labeled selects, focusable code frames, landmarks, sr-only h1s, AA-contrast token adjustments
- [x] **Watch/live mode**: reporter option `watch` (or BEACON_WATCH=1) writes throttled, atomic interim reports flagged `meta.inProgress`; the UI polls, drops chunk caches and refreshes itself with a pulsing "Running" pill until the final write. Works on any static server — no sockets.
- [x] **Plugin API v1**: `plugins: [{ name, enrich?(detail), card?(details) }]` — enrichment feeds every aggregate; cards render after the built-ins. Broken plugins are skipped. (docs/plugins.md)
- [x] **Embedded trace viewer**: traces open in a trace.playwright.dev overlay inside the report (new-tab and download remain).
- [x] **Trends page**: full pass-rate chart, run-by-run table with deltas, per-metric trend charts.
- i18n: stays post-1.0 — needs string externalization plus community translators to be worthwhile.
- Worker-thread writer + memory spill: **deliberately not built** — benchmarks hold 50k → 2.0s / 350 MB and 100k → well under the 30s / 1 GB budgets single-threaded; revisit only if real suites exceed that
- **Categories** — user-defined failure classification via regex/matcher rules (message/stack/step patterns → named category) plus built-ins (timeout, selector-not-found, assertion, visual-diff, network). Allure's most-loved feature; nobody in the Playwright niche does it well
- Suite treemap, duration histogram, slowest-tests board
- 1.0 = schema frozen at v1, docs complete

### Phase 4 — Scale & perf hardening (~3 weeks)

- [x] Synthetic 50k/100k benchmark with enforced budgets — `pnpm bench`: 50k → 2.0s generate / 317MB RSS; 100k → 3.7s / 555MB (budgets pass; CI wiring waits for the GitHub phase)
- [x] Web Worker list filtering above 3k rows; LRU-capped detail-chunk cache
- [x] Single-file export + failures-only variant (`beacon export [--failures-only]`); keyboard shortcuts (d/t/w/l//)
- Remaining: worker-thread writer, memory spill for step-heavy tests, Lighthouse/a11y pass, manifest trimming at 50k+ (timeline cap leaves manifest ~825KB)

### Phase 5 — Ecosystem (ongoing; first wave ~6–8 weeks)

- **GitHub Action**: upload to Pages/artifacts + rich PR comment — delta vs base branch using history data (regressed/fixed/new/flaky table with deep links)
- CTRF and JUnit XML export; Slack/Teams webhook notifier
- **Live/watch mode**: `beacon open --watch` — reporter streams events over a local WebSocket into the same SPA via a live chunk-loader adapter
- **Plugin API**: (a) data enrichers — Node-side hooks `(testDetail, ctx) => patch` (e.g. Jira links from annotations); (b) UI panels — declarative manifest-registered panels first, arbitrary JS later
- Opt-in embedded trace viewer (vendored Playwright trace-viewer bundle) for air-gapped users

---

## History & trends without a server

Allure's model, but automated and CI-native. **A history directory the reporter reads at `onEnd` and appends to after writing the report:**

```
.beacon-history/                 (option `historyDir`; default in project root)
├── meta.json                    # schemaVersion, retention policy
└── runs/
    └── 2026-09-24T09-30-12Z_<runId>.json    # one compact file per run
```

- Each run file: run summary (counts, duration, git sha/branch, CI run URL) + a map `caseId → {outcome, status, duration, retries, categoryId}` — compact ints, ~15–25 bytes/test → 50k tests ≈ 1 MB/run, 30 runs ≈ 30 MB retained.
- At `onEnd` the reporter: (1) reads up to `retainRuns` (default 30) newest run files, (2) computes trend series + per-test histories + run-over-run deltas **at generate time**, (3) embeds the merged result into the report's `data/history.js` — **the generated report is fully self-contained; history travels inside it**, (4) appends the current run file and prunes.
- **Stable `caseId`** = sha1(projectName + relative file + titlePath) — our own hash, not Playwright's internal id, so identity survives Playwright upgrades. A rename is "removed + new" in v1; heuristic rename detection is a stated non-goal until post-1.0.
- **Sharding safety:** only the merge step (or a single non-sharded run) writes history; run files are written temp-file + atomic rename with runId in the name, so parallel branch jobs on a shared cache can't corrupt each other.
- **CI persistence recipes** (automated by the Phase 5 Action): restore/save `historyDir` via `actions/cache` keyed on branch, or commit it to the `gh-pages` branch alongside published reports — preferred, since it's then also the cross-branch source for PR-vs-base comparison.

---

## Risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Playwright peer-range strategy (top risk).** Reporter API is stable but grows (step attachments, result annotations, blob format tweaks) | `peerDependencies: { "@playwright/test": ">=1.40 <2" }`; **runtime feature detection** (probe field presence, never version-sniff); recorded event-fixture corpus per minor in CI; support statement "latest 8 minors tested, best-effort older". Blob format is the sharpest edge: prefer `merge-reports --reporter` (Playwright parses its own blobs); native blob parsing stays experimental fallback |
| 2 | **Huge attachments** (videos/traces can be GBs) | Streaming hash-copy, dedupe, per-type caps with visible `omitted` stubs, `reference` mode. Open: `attachmentBaseUrl` rewrite to S3/artifacts (Phase 5) |
| 3 | **Blob-merge edge cases** | Dedicated fixtures in Phase 2 for: per-shard config divergence (record all, warn), duplicate caseId under `--repeat-each` (disambiguate with repeatEachIndex), stdout attribution loss for global output, crashed-shard partial blobs (surface as run-level warning, never silent absence) |
| 4 | **Single-file size limits** (browsers choke past ~50–100 MB) | Locked: capped export format, never primary; enforce inline budget; print what was omitted |
| 5 | **Trace viewer.** `trace.playwright.dev?trace=<url>` needs an HTTPS/localhost trace URL **with CORS** | `beacon open` serves `Access-Control-Allow-Origin: *` so link-out Just Works locally; works on CORS-friendly static hosts (GitHub Pages). On `file://` / non-CORS hosts: degrade to download button + one-line instructions. Embedding the viewer deferred to opt-in Phase 5 |

**Open questions to resolve early:** final npm name + scope; license (recommend MIT); publish `@beacon-report/shared` schema standalone for third-party tooling (recommend yes, at 1.0); minimum Node (recommend 18 until Playwright drops it); component-testing and Playwright-.NET/Python blob compatibility (out of scope for v1 — say so).

---

## Competitive landscape

| Competitor | What it does well | Gap we win on |
|---|---|---|
| **Built-in Playwright HTML** | Trace integration, zero setup, trustworthy | Single-run only: no history/trends/flaky analytics, no categories, minimal dashboard, sluggish filtering at 10k+, no PR-delta story. We are "the report you graduate to without leaving Playwright" |
| **allure-playwright / Allure** | Rich dashboard, history, categories, brand recognition | Two-step generate with a separate CLI (classic = Java; Allure 3 is JS but framework-generic), lossy mapping of Playwright concepts (steps, traces, visual diffs, projects), manual history folder shuffling, heavyweight. We match the analytics with one npm install, native fidelity, automated history |
| **monocart-reporter** | Deep data capture, coverage integration, merge support | Grid-first UX (a data table, not a product), dated visuals, no trend/history analytics or categories, single-file-centric size pain. We win on UX polish, dashboard-first IA, analytics depth, chunked+virtualized scale architecture |
| **ortoni-report** | Attractive styling, easy start | Loads all data upfront (falls over before 10k tests), thin features (no shard/merge, shallow steps/trace/diff, minimal history), no ecosystem hooks. We win on scale, completeness, CI integration |

---

## Feature parity appendix — Allure Report & ExtentReports

Full inventory researched 2026-09-24 (Allure 2 + Allure 3 + allure-playwright; ExtentReports Spark + Klov). Status: ✅ done in Beacon · P*n* planned phase · ✳ adopted into roadmap from this analysis · ✗ deliberately skipped.

| Concept (deduped across both tools) | Source | Beacon |
|---|---|---|
| Status donut w/ pass rate, stat tiles | Allure, Extent | ✅ |
| Per-group rollup bars (suites/tags/authors/devices) | Allure, Extent | ✅ tags/files/projects cards |
| Configurable + rearrangeable dashboard (view order, draggable widgets) | Allure 2/3, Extent viewOrder | ✅ config `dashboard.cards` + viewer customize mode |
| Worker timeline / Gantt | Allure Timeline, Extent Timeline | ✅ |
| Screenshot pixel-diff viewer (expected/actual/diff, slider/overlay) | Allure 3 | ✅ |
| Trace → Trace Viewer link | allure-playwright | ✅ |
| Retries/attempts per test, flaky badges | Allure, PW-native | ✅ |
| Search + status/tag/project filters, URL deep links | Allure, Extent anchors | ✅ |
| Dark/light theme | Extent, Allure 3 | ✅ |
| Offline self-contained report | Extent offlineMode | ✅ (bundled fonts/assets) |
| Sharded/multistage merge | Allure 3, PW blob | ✅ `beacon merge` |
| Environment/system-info card (`environment` reporter option + auto os/node/PW) | Allure env widget, Extent setSystemInfo | ✅ |
| Executor/CI card with build links | Allure executor.json | ✅ meta strip; card ✳ P2 |
| Duration distribution histogram | Allure Graphs | ✅ |
| Assertion diff view (expected vs actual, side-by-side) | Allure 3 | ✳ P2 detail |
| Description (Markdown) + links (issue/TMS via URL templates) + severity/owner labels — all via annotation conventions + reporter `links` option | Allure labels/links | links ✅ · severity card ✅ (annotation convention) · owner/description P3 |
| Parallel speedup coefficient (serialized vs wall-clock) | Allure 3 Durations Dynamics | ✅ (timeline header) |
| Failure categories (regex rules on message/stack) + exception-type grouping | Allure categories.json, Extent Exception view | ✅ (`categories` option + built-ins) |
| History store + pass-rate/duration/retries trends | Allure history, Klov | ✅ (.beacon-history + data/history.js + duration/retry sparklines) |
| Status transitions: new/fixed/regressed badges + trend | Allure 3 | badges/chips ✅ · transition trend chart P3 |
| Per-test history tab (prior runs of this test) | Allure | P3 |
| "Most-failing tests" / status age ("failing for N runs") | Klov, Allure 3 | most-failing ✅ · status age P3 |
| Test base growth (added/removed tests per run) | Allure 3 | new-tests chip ✅ · growth chart P3 |
| Behaviors tree (epic/feature/story) + groupable test tree | Allure | ✳ P3 (via tag/annotation convention) |
| Single-file HTML export; failures-only report variant | Allure 3, Extent statusFilter | ✅ `beacon export [--failures-only]` |
| Keyboard shortcuts (view/filter/theme) | Extent | ✅ (d/t/w nav · l theme · / search) |
| Quality gate (exit code on thresholds: max failures/flaky %) | Allure 3 | ✅ `beacon gate` |
| Watch/real-time mode | Allure 3 `allure watch` | P5 |
| CSV/metrics export (+ CTRF/JUnit already planned) | Allure 3 | ✅ `beacon convert --format junit|ctrf|csv` |
| AI agent mode (Markdown summary of the report for coding agents) | Allure 3 | ✅ `beacon summarize` |
| Plugin architecture (custom cards/outputs) | Allure 3, Extent | P5 |
| Report server with cross-build DB (Klov, Allure self-hosted) | Klov | ✗ for now — static-first; note as possible future service tier |
| Java Packages tree, POJO/markup helpers, Gherkin classes, 30+ framework adapters | Allure/Extent | ✗ meaningless for Playwright (file tree covers Packages) |
| BDD/Gherkin view | Extent | ✅ first-class playwright-bdd support: suite column groups tests by Feature/Scenario Outline (Tests page "Suite" grouping), `suites` dashboard card, bolded Given/When/Then step keywords, tags flow through; validated against a real playwright-bdd fixture (`fixtures/bdd-suite`). cucumber-js (non-PW runner) unsupported by design |
| i18n UI | Allure | backlog post-1.0 |

## Versioning & release policy

- **Changesets** drives versioning/publish; one public package `beacon-reporter` (internal `@beacon-report/*` packages bundled in or private).
- **Schema versioning:** `schemaVersion` in every manifest; UI refuses higher majors; additive fields = minor; `beacon migrate` ships if v2 ever does.
- **Peer range:** `@playwright/test >=1.40 <2`, feature-detected at runtime, minor-version fixture corpus in CI.
- Alpha (`0.1.0-alpha`) after Phase 1 → betas through Phase 2 → `1.0.0` at the end of Phase 3 with schema v1 frozen.
