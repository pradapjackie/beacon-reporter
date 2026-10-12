// Phase 4 scale benchmark: synthesizes a large Reporter-API event stream,
// replays it through BeaconReporter, and asserts the generate-time budgets
// from ROADMAP.md (50k tests → generate < 30 s; RSS stays bounded).
// Usage: node packages/reporter/scripts/bench.mjs [testCount]
import { mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import BeaconReporter from '../dist/index.js';
import { replayFixture } from '../dist/replay.js';

const COUNT = Number(process.argv[2] ?? 50_000);
const FILES = 500;
const PROJECTS = ['chromium', 'firefox'];

function makeFixture(count) {
  const events = [
    {
      type: 'onBegin',
      config: {
        workers: 8,
        fullyParallel: true,
        playwrightVersion: '1.63.0',
        projectNames: PROJECTS,
      },
    },
  ];
  let clock = 0;
  for (let i = 0; i < count; i++) {
    const r = i % 200; // deterministic outcome mix
    const outcome = r === 0 ? 'unexpected' : r <= 6 ? 'flaky' : r === 7 ? 'skipped' : 'expected';
    const test = {
      title: `test case ${i} handles scenario ${i % 37}`,
      titlePath: ['', PROJECTS[i % 2], `specs/area${i % FILES}.spec.ts`, `test case ${i}`],
      file: `specs/area${i % FILES}.spec.ts`,
      line: (i % 90) + 1,
      column: 3,
      projectName: PROJECTS[i % 2],
      tags: i % 5 === 0 ? ['@smoke'] : i % 7 === 0 ? ['@regression'] : [],
      annotations: [],
      timeout: 30_000,
      outcome,
    };
    const result = (retry, status) => {
      clock += 13;
      return {
        retry,
        workerIndex: i % 8,
        parallelIndex: i % 8,
        startTime: 1_700_000_000_000 + clock,
        duration: 40 + (i % 900),
        status,
        errors:
          status === 'failed'
            ? [{ message: `expect(received).toBe(expected)\n\nExpected: ${i}\nReceived: ${i + 1}` }]
            : [],
        stdout: i % 11 === 0 ? [{ text: `log line for ${i}\n` }] : [],
        stderr: [],
        attachments: [],
        steps: [
          {
            title: 'setup',
            category: 'hook',
            startTime: 0,
            duration: 5,
            steps: [],
          },
          {
            title: `action ${i % 13}`,
            category: 'test.step',
            startTime: 5,
            duration: 20,
            steps: [{ title: 'assert', category: 'expect', startTime: 20, duration: 3, steps: [] }],
          },
        ],
      };
    };
    if (outcome === 'skipped') {
      events.push({
        type: 'onTestEnd',
        test,
        result: { ...result(0, 'skipped'), workerIndex: -1 },
      });
    } else if (outcome === 'flaky') {
      events.push({ type: 'onTestEnd', test, result: result(0, 'failed') });
      events.push({ type: 'onTestEnd', test, result: result(1, 'passed') });
    } else {
      events.push({
        type: 'onTestEnd',
        test,
        result: result(0, outcome === 'unexpected' ? 'failed' : 'passed'),
      });
    }
  }
  events.push({ type: 'onEnd', status: 'passed' });
  return { recorderVersion: 1, recordedAt: new Date().toISOString(), events };
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile())
      total += statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return total;
}

console.log(`[bench] synthesizing ${COUNT.toLocaleString()} tests…`);
const fixture = makeFixture(COUNT);
const out = mkdtempSync(path.join(tmpdir(), 'beacon-bench-'));

let peakRss = 0;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 200);

const reporter = new BeaconReporter({ outputFolder: out, copyUi: false, history: false });
const t0 = performance.now();
await replayFixture(reporter, fixture, out);
const elapsed = (performance.now() - t0) / 1000;
clearInterval(sampler);
peakRss = Math.max(peakRss, process.memoryUsage().rss);

const dataDir = path.join(out, 'data');
const indexChunks = readdirSync(path.join(dataDir, 'index')).length;
const detailChunks = readdirSync(path.join(dataDir, 'details')).length;
const manifestKb = statSync(path.join(dataDir, 'manifest.js')).size / 1024;
const totalMb = dirSize(dataDir) / 1024 / 1024;

console.log(`[bench] generate time : ${elapsed.toFixed(1)}s (budget 30s)`);
console.log(
  `[bench] peak RSS      : ${(peakRss / 1024 / 1024).toFixed(0)} MB (budget 1024 MB incl. synthetic events)`,
);
console.log(`[bench] manifest.js   : ${manifestKb.toFixed(0)} KB`);
console.log(`[bench] index chunks  : ${indexChunks} · detail chunks: ${detailChunks}`);
console.log(`[bench] data dir size : ${totalMb.toFixed(1)} MB`);
console.log(`[bench] output        : ${out}`);

const failures = [];
if (elapsed > 30) failures.push(`generate ${elapsed.toFixed(1)}s > 30s`);
if (peakRss > 1024 * 1024 * 1024)
  failures.push(`peak RSS ${(peakRss / 1e6).toFixed(0)}MB > 1024MB`);
if (failures.length > 0) {
  console.error(`[bench] BUDGET FAILED: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('[bench] budgets PASSED');
