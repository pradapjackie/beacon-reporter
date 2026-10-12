import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestSchema } from '@beacon-report/shared';
import { describe, expect, it } from 'vitest';
import type { RecordedFixture } from '../src/fixture-recorder';
import { replayFixture } from '../src/replay';
import { BeaconReporter } from '../src/reporter';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixtures(): Array<[string, RecordedFixture]> {
  let entries: string[] = [];
  try {
    entries = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    // No fixtures recorded yet — the guard test below fails with instructions.
  }
  return entries.map((name) => [
    name,
    JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as RecordedFixture,
  ]);
}

const fixtures = loadFixtures();

describe('replaying recorded Reporter API fixtures', () => {
  it('has at least one recorded fixture (run: pnpm record-fixtures)', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)('%s replays into a schema-valid, consistent manifest', async (_, fixture) => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'beacon-replay-'));
    const reporter = new BeaconReporter({ outputFolder: 'report-out', copyUi: false });
    await replayFixture(reporter, fixture, rootDir);

    const raw = await readFile(path.join(rootDir, 'report-out/data/manifest.js'), 'utf8');
    const manifest = manifestSchema.parse(
      JSON.parse(raw.slice(raw.indexOf(', ') + 2, raw.lastIndexOf(');'))),
    );

    // Chunk files exist and re-parse: every test lands in exactly one index row.
    let indexedTests = 0;
    for (let i = 0; i < manifest.chunks.index; i++) {
      const chunkRaw = await readFile(
        path.join(rootDir, `report-out/data/index/chunk-${i}.js`),
        'utf8',
      );
      const chunk = JSON.parse(
        chunkRaw.slice(chunkRaw.indexOf(', ') + 2, chunkRaw.lastIndexOf(');')),
      );
      indexedTests += chunk.caseIds.length;
      // Suite column (describe chain / BDD feature) resolves against the table.
      expect(chunk.suite).toHaveLength(chunk.caseIds.length);
      for (const s of chunk.suite) {
        expect(manifest.suites?.[s]).toBeDefined();
      }
    }
    expect(indexedTests).toBe(manifest.counts.total);

    // Expected counts derived from the fixture itself: last onTestEnd per
    // unique (project, titlePath) carries the final outcome.
    const finalOutcomes = new Map<string, string>();
    for (const event of fixture.events) {
      if (event.type !== 'onTestEnd') continue;
      finalOutcomes.set(
        `${event.test.projectName}\u0000${event.test.titlePath.join('\u0000')}`,
        event.test.outcome,
      );
    }
    const expected = {
      total: finalOutcomes.size,
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    };
    for (const outcome of finalOutcomes.values()) {
      expected[outcome as 'expected' | 'unexpected' | 'flaky' | 'skipped'] += 1;
    }
    expect(manifest.counts).toEqual(expected);

    const endEvent = fixture.events.find((e) => e.type === 'onEnd');
    expect(manifest.meta.status).toBe(endEvent && 'status' in endEvent ? endEvent.status : '');

    const beginEvent = fixture.events.find((e) => e.type === 'onBegin');
    if (beginEvent && 'config' in beginEvent) {
      expect(manifest.meta.playwrightVersion).toBe(beginEvent.config.playwrightVersion);
    }
  });
});
