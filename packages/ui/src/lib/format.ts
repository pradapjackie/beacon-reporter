import type { TestOutcome } from '@beacon-report/shared';

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`;
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const OUTCOME_LABEL: Record<TestOutcome, string> = {
  expected: 'Passed',
  unexpected: 'Failed',
  flaky: 'Flaky',
  skipped: 'Skipped',
};

export const OUTCOME_DOT: Record<TestOutcome, string> = {
  expected: 'bg-passed',
  unexpected: 'bg-failed',
  flaky: 'bg-flaky',
  skipped: 'bg-skipped',
};

export const OUTCOME_TEXT: Record<TestOutcome, string> = {
  expected: 'text-passed-text',
  unexpected: 'text-failed-text',
  flaky: 'text-flaky-text',
  skipped: 'text-skipped-text',
};

/** Fill per TEST_OUTCOMES index (expected, unexpected, flaky, skipped). */
export const OUTCOME_FILL = ['var(--passed)', 'var(--failed)', 'var(--flaky)', 'var(--skipped)'];

export const OUTCOME_BADGE: Record<TestOutcome, string> = {
  expected: 'bg-passed-tint text-passed-text',
  unexpected: 'bg-failed-tint text-failed-text',
  flaky: 'bg-flaky-tint text-flaky-text',
  skipped: 'bg-skipped-tint text-skipped-text',
};
