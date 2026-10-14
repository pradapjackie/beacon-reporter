import type { TestResult } from '@playwright/test/reporter';
import { describe, expect, it } from 'vitest';
import type { AttachmentStore } from '../src/attachments';
import { type Scrubber, toResultRecord } from '../src/collect';

const scrub: Scrubber = Object.assign(
  (text: string) => text.replace(/secret-[a-z0-9]+/g, '[SECRET]'),
  {
    active: true,
  },
);

describe('scrub', () => {
  it('redacts step errors and text attachment bodies', async () => {
    const seen: Array<{ body?: Buffer; path?: string }> = [];
    const store = {
      put: async (attachment: { body?: Buffer; path?: string }) => {
        seen.push(attachment);
        return {
          name: 'error-context',
          contentType: 'text/markdown',
          ext: 'md',
          mode: 'stored' as const,
        };
      },
    };
    const result = await toResultRecord(
      {
        retry: 0,
        workerIndex: 10,
        parallelIndex: 1,
        startTime: new Date(0),
        duration: 5,
        status: 'failed',
        errors: [{ message: 'token=secret-abc123xyz' }],
        stdout: [],
        stderr: [],
        attachments: [
          {
            name: 'error-context',
            contentType: 'text/markdown',
            body: Buffer.from('saw secret-abc123xyz in the spec'),
          },
        ],
        steps: [
          {
            title: 'expect',
            category: 'expect',
            startTime: new Date(0),
            duration: 1,
            steps: [],
            error: { message: 'secret-abc123xyz', stack: 'at secret-abc123xyz' },
          },
        ],
      } as unknown as TestResult,
      store as unknown as AttachmentStore,
      scrub,
    );

    expect(result.errors[0]?.message).toBe('token=[SECRET]');
    expect(result.steps[0]?.error?.message).toBe('[SECRET]');
    expect(result.steps[0]?.error?.stack).toBe('at [SECRET]');
    expect(seen[0]?.body?.toString('utf8')).toBe('saw [SECRET] in the spec');
    expect(seen[0]?.path).toBeUndefined();
  });
});
