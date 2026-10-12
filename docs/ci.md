# CI recipes

## Keep history between runs (GitHub Actions)

History powers trends, compare, flakiness, and per-test strips. It's just a directory of small JSON files — cache it:

```yaml
- uses: actions/cache@v4
  with:
    path: .beacon-history
    key: beacon-history-${{ github.ref_name }}-${{ github.run_id }}
    restore-keys: beacon-history-${{ github.ref_name }}-

- run: npx playwright test

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: beacon-report
    path: beacon-report
```

Alternative: commit `.beacon-history` to your `gh-pages` branch next to published reports — that also gives PR-vs-base comparisons.

## Quality gate

```yaml
- run: npx beacon gate beacon-report --max-flaky 3 --min-pass-rate 98
```

Exits non-zero (fails the job) when thresholds are violated. With no flags it fails on any unexpected failure.

## PR comment

```yaml
- run: npx beacon summarize beacon-report --out summary.md
- uses: marocchino/sticky-pull-request-comment@v2
  if: always()
  with:
    path: summary.md
```

The digest includes counts, per-failure rerun commands, common-cause incidents, and most-failing tests — it's also readable by AI coding agents.

## Sharding

```yaml
strategy:
  matrix: { shard: [1, 2, 3, 4] }
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob
    env: { PLAYWRIGHT_BLOB_OUTPUT_DIR: blob-report-${{ matrix.shard }} }
  - uses: actions/upload-artifact@v4
    with: { name: blob-${{ matrix.shard }}, path: blob-report-${{ matrix.shard }} }
```

Then in a fan-in job, download all blob artifacts into one directory and:

```yaml
- run: npx beacon merge all-blobs --out beacon-report
```

Note: each shard needs its own `PLAYWRIGHT_BLOB_OUTPUT_DIR` — the blob reporter cleans its output folder per run.

## Pass-rate badge

Every report writes `badge.svg` next to `index.html` — embed it in your README once reports are published somewhere stable.

## Notify a channel

```yaml
- run: npx beacon notify beacon-report --webhook ${{ secrets.SLACK_WEBHOOK }} --format slack
  if: always()
```

## Report archive

Publishing every run's report to the same host? `npx beacon archive ./reports` writes a static index page over all of them.
