import { describe, expect, it } from 'vitest';
import { computeCaseId } from '../src/ids';
import { SCHEMA_VERSION, manifestSchema, stepNodeSchema, testDetailSchema } from '../src/schema';

describe('schema v1', () => {
  it('accepts a minimal valid manifest', () => {
    const manifest = {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        beaconVersion: '0.0.0',
        generatedAt: Date.now(),
        startTime: Date.now() - 1000,
        duration: 1000,
        status: 'passed',
        config: {},
        errors: [],
      },
      counts: { total: 2, expected: 1, unexpected: 0, flaky: 1, skipped: 0 },
      projects: [{ name: 'chromium' }],
      files: ['tests/demo.spec.ts'],
      tags: ['@smoke'],
      chunks: { index: 0, details: 0 },
      aggregates: {},
    };
    expect(manifestSchema.parse(manifest)).toEqual(manifest);
  });

  it('rejects a manifest from a different schema version', () => {
    const result = manifestSchema.safeParse({
      meta: { schemaVersion: SCHEMA_VERSION + 1 },
    });
    expect(result.success).toBe(false);
  });

  it('parses recursive step trees', () => {
    const step = {
      title: 'outer',
      category: 'test.step',
      startTime: 0,
      duration: 10,
      attachments: [],
      steps: [
        {
          title: 'inner expect',
          category: 'expect',
          startTime: 1,
          duration: 2,
          attachments: [0],
          steps: [],
        },
      ],
    };
    expect(stepNodeSchema.parse(step)).toEqual(step);
  });

  it('parses a full test detail with retries', () => {
    const detail = {
      caseId: 'abc123',
      title: 'adds numbers',
      titlePath: ['demo.spec.ts', 'adds numbers'],
      location: { file: 'tests/demo.spec.ts', line: 3, column: 1 },
      projectName: 'chromium',
      tags: [],
      annotations: [{ type: 'slow' }],
      outcome: 'flaky',
      timeout: 30000,
      slow: false,
      results: [
        {
          retry: 0,
          workerIndex: 0,
          parallelIndex: 0,
          startTime: 0,
          duration: 5,
          status: 'failed',
          errors: [{ message: 'boom' }],
          stdio: [{ stream: 'stdout', text: 'hello' }],
          attachments: [],
          steps: [],
          visualDiffs: [],
        },
        {
          retry: 1,
          workerIndex: 1,
          parallelIndex: 0,
          startTime: 10,
          duration: 5,
          status: 'passed',
          errors: [],
          stdio: [],
          attachments: [],
          steps: [],
          visualDiffs: [],
        },
      ],
    };
    expect(testDetailSchema.parse(detail)).toEqual(detail);
  });
});

describe('computeCaseId', () => {
  it('is deterministic and project/file/title sensitive', () => {
    const a = computeCaseId('chromium', 'tests/a.spec.ts', ['suite', 'test']);
    expect(computeCaseId('chromium', 'tests/a.spec.ts', ['suite', 'test'])).toBe(a);
    expect(computeCaseId('firefox', 'tests/a.spec.ts', ['suite', 'test'])).not.toBe(a);
    expect(computeCaseId('chromium', 'tests/b.spec.ts', ['suite', 'test'])).not.toBe(a);
    expect(computeCaseId('chromium', 'tests/a.spec.ts', ['suite', 'other'])).not.toBe(a);
  });

  it('does not collide on ambiguous title joins', () => {
    expect(computeCaseId('p', 'f', ['a/b'])).not.toBe(computeCaseId('p', 'f', ['a', 'b']));
  });
});
