import { formatDateTime, formatDuration } from '../lib/format';
import { useHistory, useManifest } from '../lib/hooks';

/**
 * Dedicated trends view: a full-width pass-rate chart plus the run-by-run
 * table behind it, and per-metric trend lines. All data comes from the
 * embedded history chunk — the dashboard cards show the digest, this page
 * shows everything.
 */
export function TrendsPage() {
  const manifest = useManifest();
  const history = useHistory();
  const runs = history.data?.runs ?? [];

  if (manifest.isPending || history.isPending) {
    return <div className="py-16 text-center text-sm text-ink-3">Loading…</div>;
  }
  if (runs.length < 2) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] border border-edge bg-card px-8 py-14 text-center">
        <div className="text-sm font-semibold">Not enough history yet</div>
        <p className="mt-2 text-[13px] text-ink-3">
          Trends appear once two or more runs are retained — keep the{' '}
          <span className="font-mono">.beacon-history</span> directory between runs.
        </p>
      </div>
    );
  }

  const passRates = runs.map((run) =>
    run.counts.total === 0
      ? 100
      : ((run.counts.expected + run.counts.flaky) / run.counts.total) * 100,
  );
  const metricTrends = history.data?.metricTrends ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-lg font-bold">Trends</h1>
        <p className="text-xs text-ink-3">
          {runs.length} retained runs · {formatDateTime(runs[0]?.startTime ?? 0)} →{' '}
          {formatDateTime(runs[runs.length - 1]?.startTime ?? 0)}
        </p>
      </div>

      <div className="rounded-[14px] border border-edge bg-card p-5">
        <div className="text-sm font-semibold">Pass rate</div>
        <PassRateChart runs={runs} passRates={passRates} />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-edge bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-edge-2 text-left text-[11px] uppercase tracking-wide text-ink-3">
              <th className="px-5 py-3 font-semibold">Run</th>
              <th className="px-3 py-3 text-right font-semibold">Tests</th>
              <th className="px-3 py-3 text-right font-semibold">Passed</th>
              <th className="px-3 py-3 text-right font-semibold">Failed</th>
              <th className="px-3 py-3 text-right font-semibold">Flaky</th>
              <th className="px-3 py-3 text-right font-semibold">Skipped</th>
              <th className="px-3 py-3 text-right font-semibold">Retries</th>
              <th className="px-3 py-3 text-right font-semibold">Duration</th>
              <th className="px-5 py-3 text-right font-semibold">Pass rate</th>
            </tr>
          </thead>
          <tbody>
            {[...runs]
              .map((run, i) => ({ run, rate: passRates[i] ?? 0, prev: passRates[i - 1] }))
              .reverse()
              .map(({ run, rate, prev }, i) => {
                const delta = prev === undefined ? undefined : rate - prev;
                return (
                  <tr key={run.runId} className="border-b border-edge-2 last:border-0">
                    <td className="px-5 py-2.5">
                      {formatDateTime(run.startTime)}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-text">
                          current
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                      {run.counts.total}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-passed-text">
                      {run.counts.expected}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-failed-text">
                      {run.counts.unexpected}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-flaky-text">
                      {run.counts.flaky}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink-3">
                      {run.counts.skipped}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink-3">
                      {run.retries ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                      {formatDuration(run.duration)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-[12px]">
                      {rate.toFixed(1)}%
                      {delta !== undefined && Math.abs(delta) >= 0.05 && (
                        <span
                          className={`ml-1.5 text-[11px] ${delta > 0 ? 'text-passed-text' : 'text-failed-text'}`}
                        >
                          {delta > 0 ? '▲' : '▼'}
                          {Math.abs(delta).toFixed(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="rounded-[14px] border border-edge bg-card p-5">
        <div className="text-sm font-semibold">Run calendar</div>
        <div className="text-xs text-ink-3">worst pass rate per day across retained runs</div>
        <RunCalendar runs={runs} passRates={passRates} />
      </div>

      {metricTrends.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
          {metricTrends.map((trend) => (
            <div key={trend.name} className="rounded-[14px] border border-edge bg-card p-5">
              <div className="font-mono text-sm font-semibold">{trend.name}</div>
              <div className="text-xs text-ink-3">mean per run</div>
              <MetricChart values={trend.values} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** GitHub-contribution-style grid: one cell per day, colored by that day's worst run. */
function RunCalendar({
  runs,
  passRates,
}: {
  runs: Array<{ startTime: number; counts: { total: number; unexpected: number } }>;
  passRates: number[];
}) {
  // day start (local) → { count, worst }
  const days = new Map<number, { count: number; worst: number }>();
  runs.forEach((run, i) => {
    const date = new Date(run.startTime);
    date.setHours(0, 0, 0, 0);
    const key = date.getTime();
    const entry = days.get(key) ?? { count: 0, worst: 100 };
    entry.count += 1;
    entry.worst = Math.min(entry.worst, passRates[i] ?? 100);
    days.set(key, entry);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start 12 weeks back, aligned to Monday.
  const start = new Date(today.getTime() - 83 * DAY_MS);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const weeks: Array<Array<{ time: number; entry?: { count: number; worst: number } }>> = [];
  for (let t = start.getTime(); t <= today.getTime(); ) {
    const week: Array<{ time: number; entry?: { count: number; worst: number } }> = [];
    for (let d = 0; d < 7; d++, t += DAY_MS) {
      week.push({ time: t, entry: days.get(t) });
    }
    weeks.push(week);
  }

  const toneOf = (entry?: { worst: number }) => {
    if (!entry) return 'bg-edge-2';
    if (entry.worst >= 100) return 'bg-passed';
    if (entry.worst >= 90) return 'bg-passed opacity-50';
    if (entry.worst >= 75) return 'bg-flaky';
    return 'bg-failed';
  };

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-[3px] pr-1 text-right text-[9px] text-ink-4">
          {DAY_LABELS.map((label, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday slots
            <span key={i} className="h-3.5 leading-[14px]">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.time} className="grid grid-rows-7 gap-[3px]">
            {week.map((day) => (
              <div
                key={day.time}
                className={`h-3.5 w-3.5 rounded-[3px] ${day.time > today.getTime() ? '' : toneOf(day.entry)}`}
                title={`${new Date(day.time).toLocaleDateString()}${day.entry ? ` · ${day.entry.count} ${day.entry.count === 1 ? 'run' : 'runs'} · worst ${day.entry.worst.toFixed(1)}%` : ' · no runs'}`}
              />
            ))}
          </div>
        ))}
        <div className="ml-2 flex items-end gap-2 text-[10px] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-[3px] bg-passed" /> 100%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-[3px] bg-flaky" /> ≥75%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-[3px] bg-failed" /> &lt;75%
          </span>
        </div>
      </div>
    </div>
  );
}

function PassRateChart({
  runs,
  passRates,
}: {
  runs: Array<{ startTime: number }>;
  passRates: number[];
}) {
  const W = 1000;
  const H = 180;
  const PAD = { left: 40, right: 16, top: 12, bottom: 24 };
  const min = Math.max(0, Math.floor((Math.min(...passRates) - 5) / 10) * 10);
  const x = (i: number) =>
    PAD.left + (i / Math.max(1, passRates.length - 1)) * (W - PAD.left - PAD.right);
  const y = (rate: number) =>
    PAD.top + (1 - (rate - min) / Math.max(1, 100 - min)) * (H - PAD.top - PAD.bottom);
  const points = passRates.map((rate, i) => `${x(i).toFixed(1)},${y(rate).toFixed(1)}`).join(' ');
  const gridLines = [min, (min + 100) / 2, 100];
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Pass rate across ${passRates.length} runs`}
      className="mt-2"
    >
      {gridLines.map((rate) => (
        <g key={rate}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(rate)}
            y2={y(rate)}
            stroke="var(--edge)"
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={y(rate) + 3} textAnchor="end" fontSize={10} fill="var(--ink-3)">
            {Math.round(rate)}%
          </text>
        </g>
      ))}
      <polygon
        points={`${PAD.left},${y(min)} ${points} ${x(passRates.length - 1)},${y(min)}`}
        fill="var(--brand)"
        opacity={0.08}
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {passRates.map((rate, i) => (
        <circle key={`${runs[i]?.startTime}`} cx={x(i)} cy={y(rate)} r={2.5} fill="var(--brand)">
          <title>{`${formatDateTime(runs[i]?.startTime ?? 0)} · ${rate.toFixed(1)}%`}</title>
        </circle>
      ))}
      <text x={PAD.left} y={H - 6} fontSize={10} fill="var(--ink-3)">
        {formatDateTime(runs[0]?.startTime ?? 0)}
      </text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={10} fill="var(--ink-3)">
        {formatDateTime(runs[runs.length - 1]?.startTime ?? 0)}
      </text>
    </svg>
  );
}

function MetricChart({ values }: { values: Array<number | null> }) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) {
    return <div className="mt-3 text-[13px] text-ink-3">Needs two runs with this metric.</div>;
  }
  const W = 400;
  const H = 90;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const spread = max - min;
  const x = (i: number) => 4 + (i / Math.max(1, values.length - 1)) * (W - 8);
  const y = (v: number) => (spread === 0 ? H / 2 : H - 8 - ((v - min) / spread) * (H - 16));
  const points = values
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter((p): p is string => p !== null)
    .join(' ');
  return (
    <div className="mt-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Metric trend">
        <polyline
          points={points}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between font-mono text-[11px] text-ink-3">
        <span>min {min}</span>
        <span>latest {present[present.length - 1]}</span>
        <span>max {max}</span>
      </div>
    </div>
  );
}
