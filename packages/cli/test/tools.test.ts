import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { convert } from '../src/convert';
import { gate } from '../src/gate';
import { generateFromEvents } from '../src/generate';
import { summarize } from '../src/summarize';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../reporter/test/fixtures/demo-suite.json',
);

async function makeReport(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'beacon-tools-'));
  await generateFromEvents(FIXTURE, dir, { copyUi: false });
  return dir;
}

describe('beacon gate', () => {
  it('passes the demo report with defaults (no unexpected failures)', async () => {
    const result = await gate(await makeReport(), {});
    expect(result.ok).toBe(true);
    expect(result.counts.unexpected).toBe(0);
  });

  it('fails on threshold violations', async () => {
    const dir = await makeReport();
    const flaky = await gate(dir, { maxFlaky: 0 });
    expect(flaky.ok).toBe(false);
    expect(flaky.violations[0]).toContain('flaky');
    const rate = await gate(dir, { minPassRate: 99 });
    expect(rate.ok).toBe(false);
  });
});

describe('beacon summarize', () => {
  it('emits a markdown digest with counts', async () => {
    const md = await summarize(await makeReport());
    expect(md).toContain('# Beacon');
    expect(md).toContain('| Passed | Failed | Flaky | Skipped |');
    expect(md).toContain('pass rate');
  });
});

describe('beacon convert', () => {
  it('writes junit, ctrf and csv', async () => {
    const dir = await makeReport();

    const junit = path.join(dir, 'r.xml');
    await convert(dir, 'junit', junit);
    const xml = await readFile(junit, 'utf8');
    expect(xml).toContain('<testsuites>');
    expect(xml).toContain('<skipped/>');

    const ctrf = path.join(dir, 'ctrf.json');
    await convert(dir, 'ctrf', ctrf);
    const parsed = JSON.parse(await readFile(ctrf, 'utf8'));
    expect(parsed.results.summary.tests).toBeGreaterThan(0);
    expect(parsed.results.tool.name).toBe('beacon-reporter');

    const csv = path.join(dir, 'r.csv');
    const { tests } = await convert(dir, 'csv', csv);
    const lines = (await readFile(csv, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(tests + 1);
    expect(lines[0]).toContain('caseId,title');
  });
});
