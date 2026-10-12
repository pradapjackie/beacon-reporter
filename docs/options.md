# Reporter options

Every option, with its default. All paths resolve against the directory containing your Playwright config file.

```ts
reporter: [['beacon-reporter', { /* options */ }]]
```

| Option | Type | Default | What it does |
|---|---|---|---|
| `outputFolder` | `string` | `'beacon-report'` | Where the report is written. `BEACON_OUTPUT_FOLDER` env var overrides it (used by `beacon merge`, where reporter options can't be passed). |
| `title` | `string` | — | Report title shown in the header and browser tab. |
| `copyUi` | `boolean` | `true` | Copy the prebuilt report UI next to the data. Disable only if you serve the UI separately. |
| `dashboard.cards` | `string[]` | `['outcomes', 'trend', 'slowest', 'projects']` | Which dashboard cards to show, in order. Unknown ids warn and are dropped. See the full list below. |
| `dashboard.slowest` | `number` | `5` | How many entries the "Slowest tests" card holds. |
| `environment` | `Record<string, string>` | — | Extra key-values on the Environment card (`os` and `node` are added automatically). |
| `links` | `Record<string, string>` | — | URL template per annotation type; `{}` is replaced by the annotation description. E.g. `{ issue: 'https://jira.example.com/browse/{}' }` turns `issue: PROJ-123` annotations into links. |
| `categories` | `Array<{ name, messageRegex?, stackRegex? }>` | — | Failure classification rules, checked before the built-ins (Timeout / Selector not found / Visual diff / Assertion). First match wins. |
| `history` | `false \| { dir?, retain? }` | `{ dir: '.beacon-history', retain: 30 }` | Run history powering trends, compare, flakiness, and per-test strips. `false` disables. Keep the directory between runs (see [CI recipes](ci.md)). |
| `editorLinks` | `boolean` | `false` | Render `vscode://` open-in-editor links. Records the absolute project root into the report — enable for local reports only. |
| `scrub` | `Array<{ pattern, flags?, replacement? }>` | — | Regexes applied to error text, stdio, and embedded source before anything is written. Default replacement: `[redacted]`. |
| `embedSource` | `boolean` | `true` | Embed a source snippet per test (failures always; every test when the run has ≤ 2000 tests). BDD tests embed the original `.feature` scenario. |
| `watch` | `boolean` | `false` | **Live mode**: write throttled interim reports while tests run; an open report shows a pulsing "Running" pill and refreshes itself every ~2.5s until the final write. Also enabled by `BEACON_WATCH=1`. History records only finished runs. |
| `watchIntervalMs` | `number` | `1500` | Interim write throttle for watch mode. |
| `plugins` | `BeaconPlugin[]` | — | Enrich tests and/or add custom dashboard cards — see [plugins.md](plugins.md). |
| `coverage` | `string` | — | Path to an istanbul `coverage-summary.json` (jest/nyc emit this) — fills the Code coverage card and the coverage trend across runs. |
| `branding.logo` | `string` | — | Path to an svg/png/jpg/webp ≤ 64 KB, shown in the report header (inlined as a data URI, so single-file exports keep it). |
| `branding.accentColor` | `string` | — | Hex color replacing the indigo accent throughout the UI. |

## Dashboard card ids

`outcomes` · `trend` · `slowest` · `projects` · `tags` · `files` · `suites` · `categories` · `failing` · `durations` · `environment` · `treemap` · `severity` · `slowed` · `incidents` · `owners` · `health` · `waste` · `budgets` · `metrics` · `heatmap` · `steps` · `a11y` · `percentiles` · `coverage` · `requirements`

Cards that need history (`trend`, `failing`, `slowed`, `heatmap`, compare/flaky pages) show an explanatory empty state until at least two runs are retained. Viewers can rearrange and hide cards in the report itself (`Customize`); the config order is the default.

## Full example

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['beacon-reporter', {
      outputFolder: 'beacon-report',
      title: 'Checkout suite',
      dashboard: {
        cards: ['outcomes', 'health', 'trend', 'slowest', 'failing', 'categories',
                'incidents', 'severity', 'waste', 'percentiles'],
        slowest: 10,
      },
      environment: { app: 'shop 2.4.1', env: 'staging' },
      links: { issue: 'https://github.com/you/repo/issues/{}' },
      categories: [
        { name: 'Payment gateway down', messageRegex: 'ECONNREFUSED.*:9443' },
      ],
      history: { retain: 50 },
      scrub: [{ pattern: 'Bearer [\\w.-]+', replacement: '[token]' }],
      branding: { logo: './assets/logo.svg', accentColor: '#0e7490' },
    }],
    ['list'],
  ],
});
```
