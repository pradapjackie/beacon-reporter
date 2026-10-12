import { TEST_OUTCOMES, type TestDetail } from '@beacon-report/shared';
import { OUTCOME_FILL, formatDuration } from '../lib/format';
import { useHistory } from '../lib/hooks';

/**
 * Per-test run history: outcome strip (oldest → newest, tooltip carries the
 * run date, outcome and duration) plus a duration sparkline and the
 * New/Fixed/Regressed transition badge. Shared by the detail page and the
 * preview pane; renders nothing until 2+ runs of history exist.
 */
export function TestHistory({ detail }: { detail: TestDetail }) {
  const history = useHistory();
  const outcomes = detail.history ?? [];
  if (outcomes.length < 2) return null;

  const runs = history.data?.runs ?? [];
  const durations = detail.historyDurations ?? [];
  const transitions = history.data?.transitions;
  const transition = transitions?.regressed.includes(detail.caseId)
    ? { label: 'Regressed', className: 'bg-failed-tint text-failed-text' }
    : transitions?.fixed.includes(detail.caseId)
      ? { label: 'Fixed', className: 'bg-passed-tint text-passed-text' }
      : transitions?.added.includes(detail.caseId)
        ? { label: 'New', className: 'bg-brand-soft text-brand-text' }
        : undefined;

  const seen = durations.filter((d, i) => (outcomes[i] ?? -1) >= 0 && d > 0);
  const maxDuration = Math.max(...seen, 1);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-ink-3">History</span>
        {outcomes.map((outcome, i) => {
          const date = runs[i]
            ? new Date(runs[i]?.startTime ?? 0).toLocaleString()
            : `run ${i + 1}`;
          const label =
            outcome >= 0
              ? `${date} · ${TEST_OUTCOMES[outcome] ?? ''} · ${formatDuration(durations[i] ?? 0)}`
              : `${date} · not in run`;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: run strip is positional
              key={i}
              title={label}
              className="h-3 w-3 rounded-[3px]"
              style={
                outcome >= 0
                  ? { background: OUTCOME_FILL[outcome] }
                  : { border: '1px dashed var(--edge)' }
              }
            />
          );
        })}
        <span className="text-[10px] text-ink-4">oldest → newest</span>
      </div>

      {seen.length > 1 && (
        <div className="flex items-center gap-1.5" title="Duration per run">
          <span className="text-[11px] text-ink-3">Duration</span>
          <svg width={outcomes.length * 9 + 4} height="16" aria-hidden="true">
            {durations.map((d, i) =>
              (outcomes[i] ?? -1) >= 0 ? (
                <rect
                  // biome-ignore lint/suspicious/noArrayIndexKey: run strip is positional
                  key={i}
                  x={2 + i * 9}
                  y={14 - Math.max(2, (d / maxDuration) * 12)}
                  width="6"
                  height={Math.max(2, (d / maxDuration) * 12)}
                  rx="1"
                  fill="var(--ink-4)"
                />
              ) : null,
            )}
          </svg>
          <span className="font-mono text-[10px] text-ink-3">
            {formatDuration(durations[durations.length - 1] ?? 0)}
          </span>
        </div>
      )}

      {detail.failingStreak && detail.failingStreak >= 2 && (
        <span className="rounded-full bg-failed-tint px-2 py-0.5 text-[11px] font-semibold text-failed-text">
          failing {detail.failingStreak} runs
        </span>
      )}
      {transition && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${transition.className}`}
        >
          {transition.label}
        </span>
      )}
    </div>
  );
}
