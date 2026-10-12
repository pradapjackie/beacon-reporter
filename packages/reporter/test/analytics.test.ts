import type { TestDetail } from '@beacon-report/shared';
import { describe, expect, it } from 'vitest';
import {
  computeIncidents,
  computeSlowedDown,
  failingStreakOf,
  normalizeErrorMessage,
} from '../src/analytics';

function detail(title: string, outcome: TestDetail['outcome'], message?: string): TestDetail {
  return {
    caseId: title,
    title,
    titlePath: [title],
    location: { file: 'a.spec.ts', line: 1, column: 1 },
    projectName: 'demo',
    tags: [],
    annotations: [],
    outcome,
    timeout: 30000,
    slow: false,
    results: [
      {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        startTime: 0,
        duration: 100,
        status: outcome === 'unexpected' ? 'failed' : 'passed',
        errors: message ? [{ message }] : [],
        stdio: [],
        attachments: [],
        steps: [],
        visualDiffs: [],
      },
    ],
  };
}

describe('normalizeErrorMessage', () => {
  it('collapses ids, numbers and durations so equivalent errors cluster', () => {
    expect(normalizeErrorMessage('Timed out 5000ms waiting for user 123')).toBe(
      normalizeErrorMessage('Timed out 30000ms waiting for user 456'),
    );
    expect(normalizeErrorMessage('boom at 0xdeadbeef')).toBe(
      normalizeErrorMessage('boom at 0x1234abcd'),
    );
  });
});

describe('computeIncidents', () => {
  it('groups 2+ failures with the same normalized error', () => {
    const details = [
      detail('a', 'unexpected', 'connect ECONNREFUSED 127.0.0.1:5432'),
      detail('b', 'unexpected', 'connect ECONNREFUSED 127.0.0.1:5433'),
      detail('c', 'unexpected', 'something else entirely'),
      detail('d', 'expected'),
    ];
    const incidents = computeIncidents(details);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.tests.map((t) => t.title)).toEqual(['a', 'b']);
  });
});

describe('computeSlowedDown', () => {
  it('flags tests at 1.5x their prior median, ignores noise', () => {
    const d = detail('slowpoke', 'expected');
    const perCase = new Map([
      // prior runs 100,120 (median 110) → current 300 = 2.7x
      ['slowpoke', { outcomes: [0, 0, 0], durations: [100, 120, 300] }],
    ]);
    const slowed = computeSlowedDown([d], perCase);
    expect(slowed).toHaveLength(1);
    expect(slowed[0]?.factor).toBeCloseTo(2.7, 1);

    // sub-50ms medians are noise
    const noisy = new Map([['slowpoke', { outcomes: [0, 0, 0], durations: [10, 12, 40] }]]);
    expect(computeSlowedDown([d], noisy)).toHaveLength(0);
  });
});

describe('failingStreakOf', () => {
  it('counts trailing unexpected runs, skipping gaps', () => {
    expect(failingStreakOf([0, 1, 1], 1)).toBe(2);
    expect(failingStreakOf([1, -1, 1], 1)).toBe(2);
    expect(failingStreakOf([1, 0], 1)).toBe(0);
    expect(failingStreakOf([0, 0, 0], 1)).toBe(0);
  });
});

import { computeHealth } from '../src/analytics';

describe('computeHealth', () => {
  it('scores a clean run 100 and penalizes instability', () => {
    expect(computeHealth({ total: 10, expected: 10, unexpected: 0, flaky: 0 }).score).toBe(100);
    const demo = computeHealth({ total: 12, expected: 8, unexpected: 0, flaky: 2 });
    expect(demo.score).toBeGreaterThan(60);
    expect(demo.score).toBeLessThan(90);
    const bad = computeHealth({ total: 10, expected: 2, unexpected: 8, flaky: 0 });
    expect(bad.score).toBeLessThan(30);
  });
});

import { computeFlakiness, computeSlowestSteps, normalizeStepTitle } from '../src/analytics';

describe('computeFlakiness', () => {
  const detailOf = (caseId: string) =>
    ({
      caseId,
      title: caseId,
      projectName: 'p',
      results: [],
    }) as unknown as Parameters<typeof computeFlakiness>[0][number];

  it('scores flaky and flipping tests, ignores stable ones', () => {
    // outcomes indexes: 0 expected · 1 unexpected · 2 flaky · -1 absent
    const perCase = new Map([
      ['stable', { outcomes: [0, 0, 0, 0], durations: [] }],
      ['flaky', { outcomes: [0, 2, 0, 2], durations: [] }],
      ['flipper', { outcomes: [0, 1, 0, 1], durations: [] }],
      ['hardfail', { outcomes: [1, 1, 1, 1], durations: [] }],
    ]);
    const out = computeFlakiness(['stable', 'flaky', 'flipper', 'hardfail'].map(detailOf), perCase);
    const byId = new Map(out.map((e) => [e.caseId, e]));
    expect(byId.has('stable')).toBe(false);
    // Consistently failing is not flaky — no flips, no flaky outcomes.
    expect(byId.has('hardfail')).toBe(false);
    expect(byId.get('flaky')?.flakyRuns).toBe(2);
    expect(byId.get('flaky')?.score).toBeGreaterThan(30);
    expect(byId.get('flipper')?.score).toBeGreaterThan(30);
  });
});

describe('normalizeStepTitle', () => {
  it('strips arguments and quoted strings', () => {
    expect(normalizeStepTitle('page.goto(http://localhost:3000/checkout)')).toBe('page.goto');
    expect(normalizeStepTitle('Expect "toBe"')).toBe('Expect "…"');
    expect(normalizeStepTitle("locator.click('#buy')")).toBe('locator.click');
  });
});

describe('computeSlowestSteps', () => {
  it('aggregates leaf pw:api/expect steps without double-counting parents', () => {
    const step = (title: string, category: string, duration: number, steps: unknown[] = []) => ({
      title,
      category,
      startTime: 0,
      duration,
      attachments: [],
      steps,
    });
    const detail = {
      results: [
        {
          steps: [
            step('outer', 'test.step', 100, [
              step('page.goto(http://a)', 'pw:api', 60),
              step('page.goto(http://b)', 'pw:api', 30),
            ]),
            step('Expect "toBe"', 'expect', 5),
          ],
        },
      ],
    } as unknown as Parameters<typeof computeSlowestSteps>[0][number];
    const out = computeSlowestSteps([detail]);
    expect(out[0]).toMatchObject({ title: 'page.goto', count: 2, totalMs: 90, maxMs: 60 });
    // The parent test.step (100ms) must not appear — its time lives in its leaves.
    expect(out.some((s) => s.title === 'outer')).toBe(false);
  });
});

import { mkdtemp as mkdtempCov, writeFile as writeFileCov } from 'node:fs/promises';
import { tmpdir as tmpdirCov } from 'node:os';
import pathCov from 'node:path';
import { readCoverageSummary } from '../src/coverage';

describe('readCoverageSummary', () => {
  it('parses istanbul summaries and surfaces worst files', async () => {
    const dir = await mkdtempCov(pathCov.join(tmpdirCov(), 'beacon-cov-'));
    const file = pathCov.join(dir, 'coverage-summary.json');
    await writeFileCov(
      file,
      JSON.stringify({
        total: {
          lines: { pct: 84.03 },
          statements: { pct: 82.9 },
          functions: { pct: 77.36 },
          branches: { pct: 72.43 },
        },
        '/app/src/a.ts': { lines: { pct: 95 } },
        '/app/src/b.ts': { lines: { pct: 40 } },
      }),
      'utf8',
    );
    const coverage = await readCoverageSummary(file);
    expect(coverage?.lines).toBe(84);
    expect(coverage?.branches).toBe(72.4);
    expect(coverage?.files[0]).toEqual({ name: 'app/src/b.ts', lines: 40 });
  });

  it('skips non-summary files without throwing', async () => {
    const dir = await mkdtempCov(pathCov.join(tmpdirCov(), 'beacon-cov-'));
    const file = pathCov.join(dir, 'not-coverage.json');
    await writeFileCov(file, '{"hello": 1}', 'utf8');
    expect(await readCoverageSummary(file)).toBeUndefined();
  });
});
