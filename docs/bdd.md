# BDD with playwright-bdd

Beacon has first-class support for [playwright-bdd](https://github.com/vitalets/playwright-bdd), which compiles Gherkin `.feature` files into Playwright tests — so the entire report (history, flakiness, compare, everything) works unchanged.

> **Version note:** use `playwright-bdd@^9`. v8 crashes against Playwright ≥ 1.60 (an internal ESM-loader API changed).

## Setup

Nothing Beacon-specific — a standard playwright-bdd config with the Beacon reporter attached:

```ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  reporter: [
    ['beacon-reporter', {
      dashboard: { cards: ['outcomes', 'suites', 'tags', 'files'] },
    }],
    ['list'],
  ],
});
```

## What you get in the report

- **Feature grouping** — the Tests page's "Suite" and "Tree" groupings organize scenarios under their Feature; Scenario Outlines nest as `Feature › Outline name` with each example row a test.
- **`suites` dashboard card** — pass rate per Feature.
- **Gherkin-styled steps** — `Given`/`When`/`Then`/`And`/`But` keywords are bolded in the step tree, with example values resolved (`Given a cart totalling 200 euros`).
- **Feature source panel** — the test detail page shows the original `.feature` scenario (tags included), not the generated spec file.
- **Tags** — `@smoke` etc. flow through as ordinary Playwright tags: filter chips, rollups, grouping.

## What about cucumber-js?

Not supported, by design: cucumber-js runs its own runner, and Beacon is a Playwright reporter. playwright-bdd exists precisely to run Gherkin through the Playwright runner — that's the supported path. If your cucumber-js setup emits [CTRF](https://ctrf.io), `beacon generate --from-ctrf` can still render its results.
