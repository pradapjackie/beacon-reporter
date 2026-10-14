# beacon-reporter

> A beautiful, fast, static HTML reporter for Playwright — Allure-grade analytics, one npm install, no servers, smooth at 50k tests.

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [['beacon-reporter'], ['list']],
});
```

```sh
npx playwright test
npx beacon open beacon-report
```

**Highlights**

- Dashboard with 24 configurable cards: outcomes, trends, flakiness, failure categories, incidents, severity/owners, health score, retry waste, duration budgets & percentiles, custom metrics, accessibility rollup, and more.
- Run history with zero infrastructure: trends, run-over-run **compare view**, a **flaky-tests board** with quarantine commands, per-test history strips.
- Test detail: step tree & waterfall, ANSI code frames, retry **attempt diff**, visual-diff viewer, video player, trace-viewer link-out, HAR & axe viewers, source snippets, copy-as-bug-report.
- The folder report opens with `beacon open` or any static host. Chromium blocks it on `file://`; `beacon export` writes one HTML file that does open from disk.
- CLI: `merge` (shards), `export` (single-file), `gate`, `summarize` (PR comments), `convert` (JUnit/CTRF/CSV), CTRF **import** from any framework, `quarantine`, `diff`, `notify`, `archive`.
- First-class [playwright-bdd](https://github.com/vitalets/playwright-bdd) support and white-labeling (`branding: { logo, accentColor }`).

**Docs**: [options](https://github.com/pradapjackie/beacon-reporter/blob/main/docs/options.md) · [conventions](https://github.com/pradapjackie/beacon-reporter/blob/main/docs/conventions.md) · [CLI](https://github.com/pradapjackie/beacon-reporter/blob/main/docs/cli.md) · [CI recipes](https://github.com/pradapjackie/beacon-reporter/blob/main/docs/ci.md) · [BDD](https://github.com/pradapjackie/beacon-reporter/blob/main/docs/bdd.md) · [plugins](https://github.com/pradapjackie/beacon-reporter/blob/main/docs/plugins.md)

Requires `@playwright/test` ≥ 1.40 and Node ≥ 20.

## Contact

[Pradap Pandiyan](https://github.com/pradapjackie)

- Email: [pradapjackie@gmail.com](mailto:pradapjackie@gmail.com)
- GitHub: [github.com/pradapjackie](https://github.com/pradapjackie)
- LinkedIn: [linkedin.com/in/pradap-pandiyan](https://www.linkedin.com/in/pradap-pandiyan)
- Website: [www.pradappandiyan.com](https://www.pradappandiyan.com)

## License

[MIT](https://github.com/pradapjackie/beacon-reporter/blob/main/LICENSE)
