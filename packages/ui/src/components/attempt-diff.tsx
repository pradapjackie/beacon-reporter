import type { TestResultRecord } from '@beacon-report/shared';
import { useState } from 'react';
import { stripAnsi } from '../lib/ansi';
import { formatDuration } from '../lib/format';

const STATUS_TONE: Record<string, string> = {
  passed: 'bg-passed-tint text-passed-text',
  failed: 'bg-failed-tint text-failed-text',
  timedOut: 'bg-failed-tint text-failed-text',
};

/**
 * Side-by-side retry comparison — the "what changed between attempt 1 and 2"
 * view that explains a flake. Error lines unique to one side are highlighted.
 */
export function AttemptDiff({ results }: { results: TestResultRecord[] }) {
  const firstFailing = Math.max(
    0,
    results.findIndex((r) => r.errors.length > 0),
  );
  const [left, setLeft] = useState(firstFailing);
  const [right, setRight] = useState(results.length - 1);
  const a = results[Math.min(left, results.length - 1)];
  const b = results[Math.min(right, results.length - 1)];
  if (!a || !b) return null;

  const aLines = errorLines(a);
  const bLines = errorLines(b);
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);

  return (
    <div className="rounded-[14px] border border-edge bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-edge-2 px-5 py-3">
        <span className="text-sm font-semibold">Attempt diff</span>
        <span className="text-xs text-ink-3">what changed between retries</span>
        <span className="ml-auto flex items-center gap-2 text-[12px] text-ink-3">
          <AttemptSelect label="First attempt" results={results} value={left} onChange={setLeft} />
          vs
          <AttemptSelect
            label="Second attempt"
            results={results}
            value={right}
            onChange={setRight}
          />
        </span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-edge-2 md:grid-cols-2 md:divide-x md:divide-y-0">
        {[
          { result: a, lines: aLines, other: bSet },
          { result: b, lines: bLines, other: aSet },
        ].map(({ result, lines, other }, side) => (
          <div key={side === 0 ? 'left' : 'right'} className="min-w-0 p-4">
            <div className="flex items-center gap-2.5 text-[13px]">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[result.status] ?? 'bg-skipped-tint text-skipped-text'}`}
              >
                {result.status}
              </span>
              <span className="font-mono text-[11px] text-ink-3">
                attempt {result.retry + 1} · {formatDuration(result.duration)} · worker{' '}
                {result.workerIndex}
              </span>
            </div>
            {lines.length === 0 ? (
              <div className="mt-3 text-[13px] text-passed-text">No errors.</div>
            ) : (
              <pre className="mt-3 overflow-x-auto font-mono text-[12px] leading-[1.6] text-ink-2">
                {lines.map((line, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static error lines
                    key={i}
                    className={other.has(line) ? '' : 'bg-failed-tint text-failed-text'}
                  >
                    {line || ' '}
                  </div>
                ))}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttemptSelect({
  label,
  results,
  value,
  onChange,
}: {
  label: string;
  results: TestResultRecord[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-edge bg-card px-2 py-1 text-[12px] text-ink"
    >
      {results.map((result, i) => (
        <option key={result.retry} value={i}>
          attempt {result.retry + 1} ({result.status})
        </option>
      ))}
    </select>
  );
}

function errorLines(result: TestResultRecord): string[] {
  return result.errors
    .map((e) => stripAnsi(e.message))
    .join('\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .slice(0, 40);
}
