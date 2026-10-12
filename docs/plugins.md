# Plugins

A deliberately small v1 surface: a plugin can **enrich** each test before anything is written, and/or contribute a **custom dashboard card**. Plugins run in the reporter at the end of the run; a plugin that throws is skipped with a warning and never breaks the report.

```ts
import type { BeaconPlugin } from 'beacon-reporter';

const hygiene: BeaconPlugin = {
  name: 'hygiene',
  // Mutate each test: add metrics, annotations, tags…
  enrich(detail) {
    if (detail.tags.length === 0) {
      detail.annotations.push({ type: 'needs-tag' });
    }
  },
  // Contribute a dashboard card (rendered after the built-in cards).
  card(details) {
    return {
      id: 'hygiene',
      title: 'Test hygiene',
      subtitle: 'tags & ownership coverage',
      rows: [
        { label: 'Total tests', value: String(details.length) },
        { label: 'Untagged', value: String(details.filter((d) => d.tags.length === 0).length) },
        {
          label: 'With an owner',
          value: String(details.filter((d) => d.annotations.some((a) => a.type === 'owner')).length),
        },
      ],
    };
  },
};

export default defineConfig({
  reporter: [['beacon-reporter', { plugins: [hygiene] }]],
});
```

## What enrichment can do

`enrich(detail)` receives the full `TestDetail` (typed, exported from the package) after the run finishes and may mutate it. Useful tricks:

- `detail.metrics = { ...detail.metrics, score: 42 }` — values flow into the Metrics card, metric trends, and per-test chips exactly like `beacon:metrics` attachments.
- Push annotations (`severity`, `owner`, `issue`, or your own types) — they get badges, rollup cards, and `links` templating.
- Both sync and async (`Promise`) functions are supported.

## Custom cards

`card(details)` returns `{ id, title, subtitle?, rows: [{ label, value }] }` (or `undefined` to skip). Cards render after the built-in dashboard cards. Keep `id` stable — it's the card's identity.

## Notes

- Plugins live in your Playwright config, so they can import anything from your project.
- Order matters: plugins run in array order; later plugins see earlier enrichments.
- Enrichment happens before aggregation — plugin-added metrics/annotations are included in every rollup and analytics pass.
