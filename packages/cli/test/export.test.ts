import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportSingleFile } from '../src/export';
import { generateFromEvents } from '../src/generate';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../reporter/test/fixtures/demo-suite.json',
);

async function makeReport(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'beacon-export-'));
  // copyUi true: export needs the report's index.html + hashed bundle.
  await generateFromEvents(FIXTURE, dir, { copyUi: true });
  return dir;
}

describe('beacon export', () => {
  it('bundles a report into one self-contained html file', async () => {
    const reportDir = await makeReport();
    const out = path.join(reportDir, 'single.html');
    const { bytes, inlinedAttachments } = await exportSingleFile(reportDir, out);

    expect((await stat(out)).size).toBe(bytes);
    const html = await readFile(out, 'utf8');
    expect(html).toContain('window.__BEACON_SINGLE_FILE__ = true');
    expect(html).toContain('window.__BEACON__.push("manifest"');
    expect(html).toContain('window.__BEACON__.push("index/chunk-0"');
    expect(html).toContain('window.__BEACON__.push("details/chunk-0"');
    expect(html).not.toContain("window.__BEACON_VARIANT__ = 'failures'");
    // The demo fixture carries PNG attachments — at least those inline.
    expect(inlinedAttachments).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(50 * 1024 * 1024);
  });

  it('failures-only variant strips passing tests but keeps run stats', async () => {
    const reportDir = await makeReport();
    const out = path.join(reportDir, 'failures.html');
    await exportSingleFile(reportDir, out, { failuresOnly: true });

    const html = await readFile(out, 'utf8');
    expect(html).toContain("window.__BEACON_VARIANT__ = 'failures'");
    const indexChunk = html.match(/push\("index\/chunk-0", (.+?)\);<\/script>/)?.[1];
    expect(indexChunk).toBeTruthy();
    const chunk = JSON.parse(indexChunk ?? '{}') as { outcome: number[] };
    // Only unexpected (1) / flaky (2) rows survive.
    expect(chunk.outcome.length).toBeGreaterThan(0);
    expect(chunk.outcome.every((o) => o === 1 || o === 2)).toBe(true);
    // Full-run counts stay in the manifest.
    const manifest = html.match(/push\("manifest", (.+?)\);<\/script>/)?.[1];
    const counts = (JSON.parse(manifest ?? '{}') as { counts: { total: number } }).counts;
    expect(counts.total).toBeGreaterThan(chunk.outcome.length / 1);
  });
});
