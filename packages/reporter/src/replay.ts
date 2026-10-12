import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';
import type {
  RecordedEvent,
  RecordedFixture,
  RecordedResult,
  RecordedTest,
} from './fixture-recorder';

export type { RecordedFixture } from './fixture-recorder';

/**
 * Replays a recorded fixture (see fixture-recorder.ts) through any Reporter
 * implementation, reconstructing just enough of the Playwright object shapes
 * from the serialized events. Recorded paths are relative, so fixtures replay
 * rooted at any directory. Powers both the replay test suite and
 * `beacon generate --from <events.json>`.
 */
export async function replayFixture(
  reporter: Reporter,
  fixture: RecordedFixture,
  rootDir: string,
): Promise<void> {
  for (const event of fixture.events) {
    await replayEvent(reporter, event, rootDir);
  }
}

async function replayEvent(
  reporter: Reporter,
  event: RecordedEvent,
  rootDir: string,
): Promise<void> {
  switch (event.type) {
    case 'onBegin': {
      const config = {
        rootDir,
        configFile: path.join(rootDir, 'playwright.config.ts'),
        workers: event.config.workers,
        fullyParallel: event.config.fullyParallel,
        shard: event.config.shard ?? null,
        version: event.config.playwrightVersion,
        projects: event.config.projectNames.map((name) => ({ name })),
      } as unknown as FullConfig;
      reporter.onBegin?.(config, {} as Suite);
      break;
    }
    case 'onTestEnd':
      reporter.onTestEnd?.(fakeTest(event.test, rootDir), fakeResult(event.result));
      break;
    case 'onStdOut':
      reporter.onStdOut?.(chunkValue(event.chunk));
      break;
    case 'onStdErr':
      reporter.onStdErr?.(chunkValue(event.chunk));
      break;
    case 'onError':
      reporter.onError?.(event.error as TestError);
      break;
    case 'onEnd':
      await reporter.onEnd?.({ status: event.status } as FullResult);
      break;
  }
}

function chunkValue(chunk: { text: string } | { base64: string }): string | Buffer {
  return 'text' in chunk ? chunk.text : Buffer.from(chunk.base64, 'base64');
}

function fakeTest(recorded: RecordedTest, rootDir: string): TestCase {
  return {
    title: recorded.title,
    titlePath: () => recorded.titlePath,
    location: {
      file: path.join(rootDir, recorded.file),
      line: recorded.line,
      column: recorded.column,
    },
    outcome: () => recorded.outcome,
    parent: { project: () => ({ name: recorded.projectName }) },
    tags: recorded.tags,
    annotations: recorded.annotations,
    timeout: recorded.timeout,
    results: [],
  } as unknown as TestCase;
}

function fakeResult(recorded: RecordedResult): TestResult {
  return {
    retry: recorded.retry,
    workerIndex: recorded.workerIndex,
    parallelIndex: recorded.parallelIndex,
    startTime: new Date(recorded.startTime),
    duration: recorded.duration,
    status: recorded.status,
    errors: recorded.errors,
    stdout: recorded.stdout.map(chunkValue),
    stderr: recorded.stderr.map(chunkValue),
    attachments: recorded.attachments.map((a) => ({
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      body: a.bodyBase64 ? Buffer.from(a.bodyBase64, 'base64') : undefined,
    })),
    steps: recorded.steps.map(fakeStep),
  } as unknown as TestResult;
}

function fakeStep(recorded: RecordedResult['steps'][number]): unknown {
  return {
    ...recorded,
    startTime: new Date(recorded.startTime),
    steps: recorded.steps.map(fakeStep),
  };
}
