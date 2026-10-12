import { readFile } from 'node:fs/promises';
import path from 'node:path';
import BeaconReporter from 'beacon-reporter';
import { type RecordedFixture, replayFixture } from 'beacon-reporter/replay';

/**
 * CTRF import: render any framework's results (Jest, Cypress, WebdriverIO,
 * Mocha… — anything emitting Common Test Report Format) as a Beacon report.
 * The CTRF file is translated into a recorded event stream and replayed
 * through the ordinary reporter, so every downstream feature (chunks,
 * aggregates, history) works unchanged. Step trees, attachments and retries
 * beyond CTRF's schema are simply absent.
 */

interface CtrfTest {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'other';
  duration?: number;
  start?: number;
  stop?: number;
  suite?: string;
  filePath?: string;
  line?: number;
  message?: string;
  trace?: string;
  flaky?: boolean;
  retries?: number;
  tags?: string[];
  browser?: string;
}

interface CtrfReport {
  results?: {
    tool?: { name?: string };
    summary?: { tests?: number; start?: number; stop?: number };
    tests?: CtrfTest[];
  };
}

export async function generateFromCtrf(
  fromFile: string,
  outDir: string,
): Promise<{ tests: number; tool: string }> {
  const parsed = JSON.parse(await readFile(fromFile, 'utf8')) as CtrfReport;
  const tests = parsed.results?.tests;
  if (!Array.isArray(tests)) {
    throw new Error(`${fromFile} is not a CTRF report (expected results.tests[])`);
  }
  const tool = parsed.results?.tool?.name ?? 'ctrf';
  const runStart = parsed.results?.summary?.start ?? Date.now();

  const fixture: RecordedFixture = {
    recorderVersion: 1,
    recordedAt: new Date().toISOString(),
    events: [
      {
        type: 'onBegin',
        config: {
          workers: 1,
          fullyParallel: false,
          projectNames: [...new Set(tests.map((t) => t.browser ?? ''))],
        },
      },
      ...tests.map((test) => toTestEnd(test, tool, runStart)),
      {
        type: 'onEnd',
        status: tests.some((t) => t.status === 'failed') ? 'failed' : 'passed',
      } as const,
    ],
  };

  const reporter = new BeaconReporter({
    outputFolder: path.resolve(outDir),
    title: `${tool} results`,
    // Imported results have no source tree to read from.
    embedSource: false,
  });
  await replayFixture(reporter, fixture, process.cwd());
  return { tests: tests.length, tool };
}

function toTestEnd(
  test: CtrfTest,
  tool: string,
  runStart: number,
): RecordedFixture['events'][number] {
  const file = test.filePath ?? (test.suite ? slug(test.suite) : `${slug(tool)}.results`);
  const failed = test.status === 'failed';
  const passedFlaky = test.status === 'passed' && (test.flaky || (test.retries ?? 0) > 0);
  const outcome = failed
    ? 'unexpected'
    : test.status === 'passed'
      ? passedFlaky
        ? 'flaky'
        : 'expected'
      : 'skipped';
  const duration = test.duration ?? (test.stop && test.start ? test.stop - test.start : 0);
  const startTime = test.start ?? runStart;
  const errors =
    failed && (test.message || test.trace)
      ? [{ message: test.message ?? 'failed', stack: test.trace }]
      : [];

  const finalResult = {
    retry: passedFlaky ? (test.retries ?? 1) : 0,
    workerIndex: 0,
    parallelIndex: 0,
    startTime,
    duration,
    status: failed ? 'failed' : test.status === 'passed' ? 'passed' : 'skipped',
    errors,
    stdout: [],
    stderr: [],
    attachments: [],
    steps: [],
  };

  return {
    type: 'onTestEnd',
    test: {
      title: test.name,
      titlePath: ['', test.browser ?? '', file, ...(test.suite ? [test.suite] : []), test.name],
      file,
      line: test.line ?? 1,
      column: 1,
      projectName: test.browser ?? '',
      tags: test.tags ?? [],
      annotations: [],
      timeout: 0,
      outcome,
    },
    result: finalResult,
  };
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'suite'
  );
}
