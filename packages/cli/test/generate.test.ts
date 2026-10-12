import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateFromEvents } from '../src/generate';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../reporter/test/fixtures/demo-suite.json',
);

describe('beacon generate', () => {
  it('rebuilds a report from a recorded event stream', async () => {
    // The expected test count comes from the fixture itself, so the assertion
    // stays valid as the demo suite grows.
    const fixture = JSON.parse(await readFile(FIXTURE, 'utf8')) as {
      events: Array<{ type: string; test?: { projectName: string; titlePath: string[] } }>;
    };
    const unique = new Set(
      fixture.events
        .filter((e) => e.type === 'onTestEnd' && e.test)
        .map((e) => `${e.test?.projectName}:${e.test?.titlePath.join('/')}`),
    );

    const out = await mkdtemp(path.join(tmpdir(), 'beacon-generate-'));
    const { tests } = await generateFromEvents(FIXTURE, out, { copyUi: false });
    expect(tests).toBe(unique.size);
    expect(tests).toBeGreaterThan(0);

    const raw = await readFile(path.join(out, 'data/manifest.js'), 'utf8');
    const manifest = JSON.parse(raw.slice(raw.indexOf(', ') + 2, raw.lastIndexOf(');')));
    expect(manifest.counts.total).toBe(unique.size);
    expect(manifest.chunks.details).toBeGreaterThan(0);
  });

  it('rejects files that are not event recordings', async () => {
    const out = await mkdtemp(path.join(tmpdir(), 'beacon-generate-'));
    const bogus = path.join(out, 'bogus.json');
    await import('node:fs/promises').then((fs) => fs.writeFile(bogus, '{"hello":1}', 'utf8'));
    await expect(generateFromEvents(bogus, out)).rejects.toThrow('not a beacon event recording');
  });
});
