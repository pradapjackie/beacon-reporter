import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * Fixture recorder — a meta-reporter that serializes the raw Reporter API
 * event stream to JSON. Recorded fixtures are replayed through BeaconReporter
 * in unit tests (see test/replay-harness.ts), giving us Playwright-version
 * compatibility coverage without rerunning real suites.
 *
 * Record with: RECORD_FIXTURES=1 pnpm demo   (see fixtures/demo-suite config)
 */

export const RECORDER_VERSION = 1;

/** Text chunks stay text; binary chunks become base64. */
export type RecordedChunk = { text: string } | { base64: string };

export interface RecordedError {
  message?: string;
  stack?: string;
  snippet?: string;
  location?: { file: string; line: number; column: number };
}

export interface RecordedAttachment {
  name: string;
  contentType: string;
  /** Relative to rootDir when inside it, absolute otherwise. */
  path?: string;
  size?: number;
  /** Inline bodies are kept only up to 64 KiB. */
  bodyBase64?: string;
}

export interface RecordedStep {
  title: string;
  category: string;
  startTime: number;
  duration: number;
  error?: RecordedError;
  steps: RecordedStep[];
}

export interface RecordedTest {
  title: string;
  titlePath: string[];
  /** location.file relative to rootDir, so replays can re-root it anywhere. */
  file: string;
  line: number;
  column: number;
  projectName: string;
  tags: string[];
  annotations: Array<{ type: string; description?: string }>;
  timeout: number;
  /** outcome() at the time of this event (final event carries the final outcome). */
  outcome: string;
}

export interface RecordedResult {
  retry: number;
  workerIndex: number;
  parallelIndex: number;
  startTime: number;
  duration: number;
  status: string;
  errors: RecordedError[];
  stdout: RecordedChunk[];
  stderr: RecordedChunk[];
  attachments: RecordedAttachment[];
  steps: RecordedStep[];
}

export interface RecordedConfig {
  workers: number;
  fullyParallel: boolean;
  shard?: { current: number; total: number };
  playwrightVersion?: string;
  projectNames: string[];
}

export type RecordedEvent =
  | { type: 'onBegin'; config: RecordedConfig }
  | { type: 'onTestEnd'; test: RecordedTest; result: RecordedResult }
  | { type: 'onStdOut' | 'onStdErr'; chunk: RecordedChunk; testTitlePath?: string[] }
  | { type: 'onError'; error: RecordedError }
  | { type: 'onEnd'; status: string };

export interface RecordedFixture {
  recorderVersion: number;
  recordedAt: string;
  playwrightVersion?: string;
  events: RecordedEvent[];
}

const MAX_INLINE_BODY = 64 * 1024;

export interface FixtureRecorderOptions {
  /** Output JSON path, resolved against the Playwright config directory. */
  outputFile?: string;
}

export default class FixtureRecorder implements Reporter {
  private readonly options: Required<FixtureRecorderOptions>;
  private config!: FullConfig;
  private events: RecordedEvent[] = [];

  constructor(options: FixtureRecorderOptions = {}) {
    this.options = { outputFile: options.outputFile ?? 'beacon-fixture.json' };
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.config = config;
    this.events.push({
      type: 'onBegin',
      config: {
        workers: config.workers,
        fullyParallel: config.fullyParallel,
        shard: config.shard ?? undefined,
        playwrightVersion: readVersion(config),
        projectNames: config.projects.map((p) => p.name),
      },
    });
  }

  onStdOut(chunk: string | Buffer, test?: TestCase): void {
    this.events.push({
      type: 'onStdOut',
      chunk: serializeChunk(chunk),
      testTitlePath: test?.titlePath(),
    });
  }

  onStdErr(chunk: string | Buffer, test?: TestCase): void {
    this.events.push({
      type: 'onStdErr',
      chunk: serializeChunk(chunk),
      testTitlePath: test?.titlePath(),
    });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.events.push({
      type: 'onTestEnd',
      test: this.serializeTest(test),
      result: serializeResult(result, this.config.rootDir),
    });
  }

  onError(error: TestError): void {
    this.events.push({ type: 'onError', error: serializeError(error) });
  }

  async onEnd(result: FullResult): Promise<void> {
    this.events.push({ type: 'onEnd', status: result.status });
    const fixture: RecordedFixture = {
      recorderVersion: RECORDER_VERSION,
      recordedAt: new Date().toISOString(),
      playwrightVersion: readVersion(this.config),
      events: this.events,
    };
    const baseDir = this.config.configFile ? path.dirname(this.config.configFile) : process.cwd();
    const outputFile = path.resolve(baseDir, this.options.outputFile);
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  }

  private serializeTest(test: TestCase): RecordedTest {
    return {
      title: test.title,
      titlePath: test.titlePath(),
      file: path.relative(this.config.rootDir, test.location.file).split(path.sep).join('/'),
      line: test.location.line,
      column: test.location.column,
      projectName: test.parent?.project?.()?.name ?? '',
      tags: (test as { tags?: string[] }).tags ?? [],
      annotations: test.annotations.map((a) => ({ type: a.type, description: a.description })),
      timeout: test.timeout,
      outcome: test.outcome(),
    };
  }
}

function readVersion(config: FullConfig): string | undefined {
  const version = (config as { version?: unknown }).version;
  return typeof version === 'string' ? version : undefined;
}

function serializeChunk(chunk: string | Buffer): RecordedChunk {
  return Buffer.isBuffer(chunk) ? { base64: chunk.toString('base64') } : { text: chunk };
}

function serializeError(error: TestError): RecordedError {
  return {
    message: error.message,
    stack: error.stack,
    snippet: error.snippet,
    location: error.location,
  };
}

function serializeStep(step: TestStep): RecordedStep {
  return {
    title: step.title,
    category: step.category,
    startTime: step.startTime.getTime(),
    duration: step.duration,
    error: step.error ? serializeError(step.error) : undefined,
    steps: step.steps.map(serializeStep),
  };
}

function serializeResult(result: TestResult, rootDir: string): RecordedResult {
  return {
    retry: result.retry,
    workerIndex: result.workerIndex,
    parallelIndex: result.parallelIndex,
    startTime: result.startTime.getTime(),
    duration: result.duration,
    status: result.status,
    errors: result.errors.map(serializeError),
    stdout: result.stdout.map(serializeChunk),
    stderr: result.stderr.map(serializeChunk),
    attachments: result.attachments.map((a) => ({
      name: a.name,
      contentType: a.contentType,
      path: a.path?.startsWith(rootDir) ? path.relative(rootDir, a.path) : a.path,
      size: a.body?.length,
      bodyBase64:
        a.body && a.body.length <= MAX_INLINE_BODY ? a.body.toString('base64') : undefined,
    })),
    steps: result.steps.map(serializeStep),
  };
}
