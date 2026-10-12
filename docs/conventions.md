# Conventions

Beacon reads meaning from ordinary Playwright primitives — annotations, tags, and attachments — so nothing here needs an import.

## Annotations

```ts
test('checkout applies discount', async ({ page }, testInfo) => {
  testInfo.annotations.push(
    { type: 'severity', description: 'critical' },
    { type: 'owner', description: 'payments-team' },
    { type: 'issue', description: 'PROJ-123' },
    { type: 'budget', description: '2s' },
    { type: 'description', description: 'Applies WELCOME10 and checks the total.' },
  );
  // …
});
```

| Annotation | Effect |
|---|---|
| `severity: <level>` | Severity rollup card; badge on the test. Any labels work (`critical`, `normal`, …). |
| `owner: <name>` | Owners rollup card; badge on the test. |
| `issue: <id>` | Becomes a link when `links.issue` is configured (`{}` = the id). Works for any annotation type present in `links`. |
| `budget: <duration>` | Duration budget: `"2s"`, `"1500ms"`, or plain ms. Over-budget tests land on the Budgets card and get a red badge. |
| `description: <text>` | Rendered as a paragraph under the test title. |
| `requirement: <id>` | Requirements traceability: rollup card + the /requirements matrix page. Add `links.requirement` to link ids to your tracker. |

## Tags

Playwright tags (`test('title', { tag: '@smoke' }, …)` or `@smoke` in titles) become filter chips, a dashboard rollup ("marker groups"), and a grouping dimension on the Tests page.

## Attachments Beacon understands

| Attachment | Effect |
|---|---|
| `toHaveScreenshot` failures | The expected/actual/diff triple is detected at collect time and rendered in the visual-diff viewer (slider, onion-skin, pixel modes). |
| trace zips | "Open in Trace Viewer" → trace.playwright.dev (needs the report served, e.g. `beacon open`; falls back to download on `file://`). |
| videos / images | Player and lightbox; everything also lands on the Media page. |
| `beacon:metrics` (JSON) | Custom numeric metrics: `testInfo.attach('beacon:metrics', { body: JSON.stringify({ renderMs: 212 }), contentType: 'application/json' })`. Shown as chips on the test and aggregated (count/avg/max) on the Metrics card. Last attempt wins. |
| axe results (JSON, name matching `axe` / `a11y` / `accessibility`) | Standard axe `{ violations: [...] }` payloads are aggregated by rule and impact on the Accessibility card, and rendered per-test. |
| HAR files | Rendered as a request table on the test detail page. |
| JSON / CSV / text | Inline previews (CSV as a table). |

## Browser console capture

```ts
import { test as base } from '@playwright/test';
import { withBeaconConsole } from 'beacon-reporter/fixtures';

export const test = withBeaconConsole(base);
```

Attaches the page's console output to every test.

## Stable test identity

Tests are tracked across runs by `sha1(project + file + titlePath)` — renaming a test or moving its file starts a fresh history for it.
