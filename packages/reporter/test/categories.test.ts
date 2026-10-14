import type { TestDetail } from '@beacon-report/shared';
import { describe, expect, it } from 'vitest';
import { categorize } from '../src/categories';

function failing(message: string, outcome: TestDetail['outcome'] = 'unexpected'): TestDetail {
  return {
    caseId: message,
    title: message,
    titlePath: [message],
    location: { file: 'a.spec.ts', line: 1, column: 1 },
    projectName: 'demo',
    tags: [],
    annotations: [],
    outcome,
    timeout: 30000,
    slow: false,
    results: [
      {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        startTime: 0,
        duration: 1,
        status: 'failed',
        errors: [{ message }],
        stdio: [],
        attachments: [],
        steps: [],
        visualDiffs: [],
      },
    ],
  };
}

describe('categorize', () => {
  it('applies built-in rules to failing tests', () => {
    const details = [
      failing('Timed out 5000ms waiting for locator'),
      failing(
        'Error: expect(locator).toHaveText(expected) failed\nTimeout: 5000ms\nReceived: "Wrong title"',
      ),
      failing('expect(received).toBe(expected)'),
      failing('strict mode violation: locator resolved to 3 elements'),
      failing('Screenshot comparison failed: 120 pixels differ'),
      failing('something exploded'),
    ];
    categorize(details);
    expect(details.map((d) => d.category)).toEqual([
      'Timeout',
      'Assertion',
      'Assertion',
      'Selector not found',
      'Visual diff',
      'Other failures',
    ]);
  });

  it('user rules win over built-ins, passing tests untouched', () => {
    const passed = { ...failing('expect boom'), outcome: 'expected' as const };
    const details = [failing('payment gateway declined the card'), passed];
    categorize(details, [{ name: 'Payment', messageRegex: 'payment|gateway' }]);
    expect(details[0]?.category).toBe('Payment');
    expect(details[1]?.category).toBeUndefined();
  });

  it('matches category rules against the unscrubbed error text', () => {
    const detail = failing('[SECRET]');
    categorize(
      [detail],
      [{ name: 'Leaked secret', messageRegex: 'secret-' }],
      new Map([[detail.caseId, 'expect(token=secret-abc123xyz)']]),
    );
    expect(detail.category).toBe('Leaked secret');
  });
});
