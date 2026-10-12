import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { manifestSchema, testIndexChunkSchema } from '@beacon-report/shared';
import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { describe, expect, it } from 'vitest';
import { BeaconReporter } from '../src/reporter';

function fakeTest(rootDir: string, overrides: Partial<Record<string, unknown>> = {}): TestCase {
  return {
    title: 'adds numbers',
    titlePath: () => ['', 'demo', 'demo.spec.ts', 'adds numbers'],
    location: { file: path.join(rootDir, 'tests/demo.spec.ts'), line: 3, column: 1 },
    outcome: () => 'expected',
    parent: { project: () => ({ name: 'demo' }) },
    tags: ['@smoke'],
    annotations: [],
    timeout: 30000,
    results: [],
    ...overrides,
  } as unknown as TestCase;
}

function fakeResult(overrides: Partial<Record<string, unknown>> = {}): TestResult {
  return {
    retry: 0,
    workerIndex: 0,
    parallelIndex: 0,
    startTime: new Date(),
    duration: 5,
    status: 'passed',
    errors: [],
    stdout: ['hello'],
    stderr: [],
    attachments: [{ name: 'greeting', contentType: 'text/plain', body: Buffer.from('hi beacon') }],
    steps: [],
    ...overrides,
  } as unknown as TestResult;
}

function extractChunk(raw: string): unknown {
  return JSON.parse(raw.slice(raw.indexOf(', ') + 2, raw.lastIndexOf(');')));
}

describe('BeaconReporter', () => {
  it('runs the full lifecycle and writes a schema-valid chunked report', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'beacon-'));
    const reporter = new BeaconReporter({ outputFolder: 'report-out', copyUi: false });
    const config = {
      rootDir,
      configFile: path.join(rootDir, 'playwright.config.ts'),
      workers: 2,
      fullyParallel: true,
    } as unknown as FullConfig;

    reporter.onBegin(config, {} as Suite);
    reporter.onTestEnd(fakeTest(rootDir), fakeResult());
    const flaky = fakeTest(rootDir, {
      title: 'flaky one',
      titlePath: () => ['', 'demo', 'demo.spec.ts', 'flaky one'],
      outcome: () => 'flaky',
    });
    reporter.onTestEnd(flaky, fakeResult({ status: 'failed', errors: [{ message: 'boom' }] }));
    reporter.onTestEnd(flaky, fakeResult({ retry: 1 }));
    await reporter.onEnd({ status: 'passed' } as FullResult);

    const out = path.join(rootDir, 'report-out');
    const manifest = manifestSchema.parse(
      extractChunk(await readFile(path.join(out, 'data/manifest.js'), 'utf8')),
    );
    expect(manifest.counts).toEqual({ total: 2, expected: 1, unexpected: 0, flaky: 1, skipped: 0 });
    expect(manifest.projects).toEqual([{ name: 'demo' }]);
    expect(manifest.files).toEqual(['tests/demo.spec.ts']);
    expect(manifest.tags).toEqual(['@smoke']);
    expect(manifest.chunks).toEqual({ index: 1, details: 1 });

    const index = testIndexChunkSchema.parse(
      extractChunk(await readFile(path.join(out, 'data/index/chunk-0.js'), 'utf8')),
    );
    expect(index.caseIds).toHaveLength(2);
    const flakyRow = index.titles.indexOf('flaky one');
    expect(index.retries[flakyRow]).toBe(1);

    const details = extractChunk(
      await readFile(path.join(out, 'data/details/chunk-0.js'), 'utf8'),
    ) as Array<{ title: string; results: Array<{ attachments: Array<{ sha256?: string }> }> }>;
    expect(details).toHaveLength(2);
    const stored = details[0]?.results[0]?.attachments[0];
    expect(stored?.sha256).toMatch(/^[0-9a-f]{64}$/);

    // Content-addressed attachment landed on disk.
    const attachmentFile = await readFile(
      path.join(out, 'attachments', `${stored?.sha256}.txt`),
      'utf8',
    );
    expect(attachmentFile).toBe('hi beacon');
  });

  it('does not print to stdio', () => {
    expect(new BeaconReporter().printsToStdio()).toBe(false);
  });

  it('watch mode writes throttled interim reports flagged inProgress', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'beacon-watch-'));
    const reporter = new BeaconReporter({
      outputFolder: 'report-out',
      copyUi: false,
      watch: true,
      watchIntervalMs: 10,
      history: false,
    });
    const config = {
      rootDir,
      configFile: path.join(rootDir, 'playwright.config.ts'),
      workers: 1,
      fullyParallel: false,
    } as unknown as FullConfig;
    reporter.onBegin(config, {} as Suite);
    reporter.onTestEnd(fakeTest(rootDir), fakeResult());

    // Wait past the throttle so the interim write lands.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const interim = manifestSchema.parse(
      extractChunk(await readFile(path.join(rootDir, 'report-out/data/manifest.js'), 'utf8')),
    );
    expect(interim.meta.inProgress).toBe(true);
    expect(interim.counts.total).toBe(1);

    reporter.onTestEnd(
      fakeTest(rootDir, {
        title: 'second',
        titlePath: () => ['', 'demo', 'demo.spec.ts', 'second'],
      }),
      fakeResult(),
    );
    await reporter.onEnd({ status: 'passed' } as FullResult);
    const final = manifestSchema.parse(
      extractChunk(await readFile(path.join(rootDir, 'report-out/data/manifest.js'), 'utf8')),
    );
    expect(final.meta.inProgress).toBeUndefined();
    expect(final.counts.total).toBe(2);
  });

  it('plugins enrich tests and contribute custom cards; broken plugins are skipped', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'beacon-plugin-'));
    const reporter = new BeaconReporter({
      outputFolder: 'report-out',
      copyUi: false,
      plugins: [
        {
          name: 'enricher',
          enrich: (detail) => {
            detail.metrics = { ...detail.metrics, pluginScore: 7 };
          },
          card: (details) => ({
            id: 'hygiene',
            title: 'Hygiene',
            rows: [{ label: 'Tests seen', value: String(details.length) }],
          }),
        },
        {
          name: 'broken',
          card: () => {
            throw new Error('plugin bug');
          },
        },
      ],
      history: false,
    });
    const config = {
      rootDir,
      configFile: path.join(rootDir, 'playwright.config.ts'),
      workers: 1,
      fullyParallel: false,
    } as unknown as FullConfig;
    reporter.onBegin(config, {} as Suite);
    reporter.onTestEnd(fakeTest(rootDir), fakeResult());
    await reporter.onEnd({ status: 'passed' } as FullResult);

    const manifest = manifestSchema.parse(
      extractChunk(await readFile(path.join(rootDir, 'report-out/data/manifest.js'), 'utf8')),
    );
    expect(manifest.ui?.customCards).toEqual([
      { id: 'hygiene', title: 'Hygiene', rows: [{ label: 'Tests seen', value: '1' }] },
    ]);
    expect(manifest.aggregates.metrics).toEqual([
      { name: 'pluginScore', count: 1, avg: 7, max: 7 },
    ]);
  });
});
