# Contributing to Beacon

Thanks for helping! This is a pnpm + Turborepo monorepo; Node ≥ 20 and pnpm ≥ 9 required.

## Getting started

```sh
pnpm install
pnpm build        # turbo: shared → ui → reporter/cli (order matters)
pnpm test         # vitest across packages
pnpm lint         # biome check (pnpm lint:fix to autofix)
pnpm demo         # run fixtures/demo-suite with the reporter attached
npx beacon open fixtures/demo-suite/beacon-report
```

## How the pieces fit

- `packages/shared` — the versioned Zod schema. **This is the contract**: the reporter validates everything it writes against it, and the UI types come from it. Schema changes must be additive (optional fields) within a major version.
- `packages/reporter` — collects Playwright Reporter API events, streams attachments into a content-addressed store, and computes *all* aggregates at `onEnd`. The browser never aggregates.
- `packages/ui` — the React SPA (Vite, TanStack Router/Query/Virtual, Tailwind). Built once, shipped inside the npm package, copied next to the data at generate time.
- `packages/cli` — the `beacon` bin.

## Rules of the road

1. **Feature-detect, never version-sniff.** Playwright fields that appeared in later minors are checked for existence (`peerDependencies: >=1.40 <2`).
2. **All aggregation at generate time.** If the UI needs a number, the writer computes it into the manifest or a chunk.
3. **Data files are `.js` chunks** (`window.__BEACON__.push(...)`) so reports work on `file://`. Never switch to fetch/JSON.
4. **Validate what you write.** `manifestSchema.parse(...)` before writing is not optional.
5. **Perf budgets are enforced.** `pnpm bench` synthesizes 50k tests and fails over 30s / 1 GB RSS. Run it when touching the writer.
6. **Replay fixtures are the compatibility net.** `pnpm record-fixtures` re-records the demo suite's event stream; the replay tests reconstruct a report from it. Recorded configs are trimmed — reporter code must survive missing fields.
7. **Visual changes get screenshots.** Serve a fixture report and eyeball it (both themes) before and after.

## Tests

- Unit tests live in each package's `test/` (vitest).
- `fixtures/demo-suite` exercises every feature and doubles as the sample-report source; `fixtures/bdd-suite` covers playwright-bdd.
- New reporter capture logic needs a unit test; new aggregates need one in `analytics.test.ts` or `writer`-level assertions in `replay.test.ts`.

## Releasing

Versioning goes through [Changesets](https://github.com/changesets/changesets): `pnpm changeset` with your PR, describing the change from a user's perspective.
