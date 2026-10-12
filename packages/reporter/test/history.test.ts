import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FullConfig, FullResult, Suite, TestResult } from '@playwright/test/reporter';
import { describe, expect, it } from 'vitest';
import { BeaconReporter } from '../src/reporter';

function fakeTest(rootDir: string, title: string, outcome: string) {
  return {
    title,
    titlePath: () => ['', 'demo', 'demo.spec.ts', title],
    location: { file: path.join(rootDir, 'tests/demo.spec.ts'), line: 3, column: 1 },
    outcome: () => outcome,
    parent: { project: () => ({ name: 'demo' }) },
    tags: [],
    annotations: [],
    timeout: 30000,
    results: [],
    // biome-ignore lint/suspicious/noExplicitAny: test double
  } as any;
}

function fakeResult(status: string): TestResult {
  return {
    retry: 0,
    workerIndex: 0,
    parallelIndex: 0,
    startTime: new Date(),
    duration: 5,
    status,
    errors: status === 'failed' ? [{ message: 'expect(received).toBe(expected)' }] : [],
    stdout: [],
    stderr: [],
    attachments: [],
    steps: [],
  } as unknown as TestResult;
}

async function run(rootDir: string, outcomes: Record<string, 'expected' | 'unexpected'>) {
  const reporter = new BeaconReporter({
    outputFolder: 'report-out',
    copyUi: false,
    history: { dir: 'hist', retain: 5 },
  });
  const config = {
    rootDir,
    configFile: path.join(rootDir, 'playwright.config.ts'),
    workers: 1,
    fullyParallel: false,
  } as unknown as FullConfig;
  reporter.onBegin(config, {} as Suite);
  for (const [title, outcome] of Object.entries(outcomes)) {
    reporter.onTestEnd(
      fakeTest(rootDir, title, outcome),
      fakeResult(outcome === 'unexpected' ? 'failed' : 'passed'),
    );
  }
  await reporter.onEnd({ status: 'passed' } as FullResult);
  const raw = await readFile(path.join(rootDir, 'report-out/data/history.js'), 'utf8');
  return JSON.parse(raw.slice(raw.indexOf(', ') + 2, raw.lastIndexOf(');')));
}

describe('history', () => {
  it('accumulates runs, computes transitions and most-failing', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'beacon-hist-'));

    const first = await run(rootDir, { alpha: 'expected', beta: 'unexpected' });
    expect(first.runs).toHaveLength(1);
    expect(first.transitions).toEqual({ added: [], fixed: [], regressed: [] });
    expect(first.mostFailing).toHaveLength(1);
    expect(first.mostFailing[0].title).toBe('beta');

    const second = await run(rootDir, {
      alpha: 'unexpected', // regressed
      beta: 'expected', // fixed
      gamma: 'expected', // new
    });
    expect(second.runs).toHaveLength(2);
    expect(second.transitions.regressed).toHaveLength(1);
    expect(second.transitions.fixed).toHaveLength(1);
    expect(second.transitions.added).toHaveLength(1);

    // Category from built-in assertion rule made it onto the failing test.
    const details = await readFile(
      path.join(rootDir, 'report-out/data/details/chunk-0.js'),
      'utf8',
    );
    expect(details).toContain('"category":"Assertion"');

    // One run file per run persisted.
    const files = (await readdir(path.join(rootDir, 'hist/runs'))).filter((f) =>
      f.endsWith('.json'),
    );
    expect(files).toHaveLength(2);
  });
});
