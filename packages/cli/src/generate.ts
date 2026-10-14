import { readFile } from 'node:fs/promises';
import path from 'node:path';
import BeaconReporter from 'beacon-reporter';
import { type RecordedFixture, replayFixture } from 'beacon-reporter/replay';

export interface GenerateOptions {
  /** Copy the prebuilt UI next to the data (default true). */
  copyUi?: boolean;
  /** When set, history is written here. Otherwise generate does not touch history. */
  historyDir?: string;
}

/**
 * Rebuilds a report from a recorded Reporter API event stream (the JSON the
 * `beacon-reporter/fixture-recorder` meta-reporter writes) without
 * rerunning any tests — e.g. to regenerate an old run's report after a UI
 * upgrade. Blob-zip input lands in Phase 2 alongside merge support.
 */
export async function generateFromEvents(
  fromFile: string,
  outDir: string,
  options: GenerateOptions = {},
): Promise<{ tests: number }> {
  const raw = await readFile(fromFile, 'utf8');
  const fixture = JSON.parse(raw) as RecordedFixture;
  if (fixture.recorderVersion !== 1 || !Array.isArray(fixture.events)) {
    throw new Error(
      `${fromFile} is not a beacon event recording (expected recorderVersion 1 with an events array)`,
    );
  }

  const reporter = new BeaconReporter({
    outputFolder: path.resolve(outDir),
    copyUi: options.copyUi ?? true,
    history: options.historyDir ? { dir: path.resolve(options.historyDir) } : false,
  });
  await replayFixture(reporter, fixture, process.cwd());

  const tests = new Set<string>();
  for (const event of fixture.events) {
    if (event.type === 'onTestEnd') {
      tests.add(`${event.test.projectName}\u0000${event.test.titlePath.join('\u0000')}`);
    }
  }
  return { tests: tests.size };
}
