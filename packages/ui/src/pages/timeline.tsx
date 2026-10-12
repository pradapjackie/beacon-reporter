import { TEST_OUTCOMES } from '@beacon-report/shared';
import { useRef, useState } from 'react';
import { formatDuration } from '../lib/format';
import { useManifest, useTimeline } from '../lib/hooks';

/** Bar fill per TEST_OUTCOMES index (expected, unexpected, flaky, skipped). */
const OUTCOME_FILL = ['var(--passed)', 'var(--failed)', 'var(--flaky)', 'var(--skipped)'];

const LEGEND = [
  { label: 'Passed', dot: 'bg-passed' },
  { label: 'Failed', dot: 'bg-failed' },
  { label: 'Flaky', dot: 'bg-flaky' },
  { label: 'Skipped', dot: 'bg-skipped' },
];

const PLOT_W = 1000;
const LABEL_W = 84;
const ROW_H = 34;
const BAR_H = 18;
const AXIS_H = 26;

export function TimelinePage() {
  const { data, isPending } = useManifest();
  const lanes = useTimeline(data);
  const svgRef = useRef<SVGSVGElement>(null);
  /** Zoom window [fromMs, toMs] — null shows the full run. */
  const [range, setRange] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  if (isPending || !data || lanes.isPending) {
    return <div className="py-16 text-center text-ink-3">Loading…</div>;
  }

  const timeline = lanes.data?.entries ?? [];
  if (timeline.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-edge p-10 text-center text-ink-3">
        No timeline data in this report.
      </div>
    );
  }

  const workers = [...new Set(timeline.map((e) => e.workerIndex))].sort((a, b) => a - b);
  const total = Math.max(...timeline.map((e) => e.start + e.duration), 1);
  const busy = timeline.reduce((s, e) => s + e.duration, 0);
  const utilization = Math.min(100, Math.round((busy / (total * workers.length)) * 100));

  const [w0, w1] = range ?? [0, total];
  const span = Math.max(1, w1 - w0);
  const height = workers.length * ROW_H + AXIS_H;
  const x = (ms: number) => LABEL_W + ((ms - w0) / span) * PLOT_W;
  const laneOf = new Map(workers.map((w, i) => [w, i]));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => w0 + f * span);
  const visible = timeline.filter((e) => e.start < w1 && e.start + e.duration > w0);

  // Per-lane busy share inside the current window — idle workers stand out.
  const laneBusy = new Map<number, number>();
  for (const entry of visible) {
    const overlap = Math.min(entry.start + entry.duration, w1) - Math.max(entry.start, w0);
    laneBusy.set(entry.workerIndex, (laneBusy.get(entry.workerIndex) ?? 0) + Math.max(0, overlap));
  }

  /** clientX → run milliseconds, via the rendered svg's box. */
  const msAt = (clientX: number): number => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return w0;
    const vx = ((clientX - box.left) / box.width) * (LABEL_W + PLOT_W + 34);
    return Math.max(w0, Math.min(w1, w0 + ((vx - LABEL_W) / PLOT_W) * span));
  };

  const finishDrag = () => {
    if (drag) {
      const [from, to] = drag.from <= drag.to ? [drag.from, drag.to] : [drag.to, drag.from];
      // A sub-1% selection is a click, not a zoom.
      if (to - from > span * 0.01) setRange([from, to]);
    }
    setDrag(null);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-display text-lg font-bold">Worker timeline</h1>
          <p className="text-xs text-ink-3">
            {timeline.length} attempts across {workers.length} workers · {formatDuration(total)}{' '}
            wall clock · {utilization}% worker utilization
            {data.manifest.aggregates.speedup &&
              data.manifest.aggregates.speedup.factor > 1 &&
              ` · ${data.manifest.aggregates.speedup.factor}× parallel speedup`}
            {lanes.data?.truncated && ' · truncated to the first 5,000 attempts'}
            {' · drag to zoom'}
          </p>
        </div>
        {range && (
          <button
            type="button"
            onClick={() => setRange(null)}
            className="rounded-lg border border-edge bg-card px-3 py-1.5 text-xs text-brand-text"
          >
            Reset zoom ({formatDuration(w0)}–{formatDuration(w1)})
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-ink-2">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-[2px] ${l.dot}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-edge bg-card p-4">
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${LABEL_W + PLOT_W + 34} ${height}`}
          // biome-ignore lint/a11y/useSemanticElements: an svg chart cannot be a <fieldset>; group names the link-bearing chart
          role="group"
          aria-label={`Worker timeline: ${timeline.length} test attempts across ${workers.length} workers`}
          style={{ minWidth: 700, cursor: drag ? 'col-resize' : undefined }}
          onMouseMove={(e) => drag && setDrag({ from: drag.from, to: msAt(e.clientX) })}
          onMouseUp={finishDrag}
          onMouseLeave={finishDrag}
        >
          {workers.map((w, i) => {
            const share = Math.round(((laneBusy.get(w) ?? 0) / span) * 100);
            return (
              <g key={w}>
                {i % 2 === 1 && (
                  <rect
                    x={LABEL_W}
                    y={i * ROW_H}
                    width={PLOT_W}
                    height={ROW_H}
                    fill="var(--edge-2)"
                    opacity={0.45}
                  />
                )}
                <text
                  x={LABEL_W - 10}
                  y={i * ROW_H + ROW_H / 2}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--ink-3)"
                >
                  worker {w}
                </text>
                <text
                  x={LABEL_W - 10}
                  y={i * ROW_H + ROW_H / 2 + 12}
                  textAnchor="end"
                  fontSize={9}
                  fill={share < 40 ? 'var(--flaky-text)' : 'var(--ink-4)'}
                >
                  {share}% busy
                </text>
              </g>
            );
          })}

          {/* Brush layer: drag on empty plot area selects a zoom window. */}
          <rect
            x={LABEL_W}
            y={0}
            width={PLOT_W}
            height={height - AXIS_H}
            fill="transparent"
            onMouseDown={(e) => {
              const at = msAt(e.clientX);
              setDrag({ from: at, to: at });
            }}
          />

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                y1={0}
                x2={x(t)}
                y2={height - AXIS_H + 6}
                stroke="var(--edge)"
                strokeWidth={1}
              />
              <text x={x(t)} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
                {formatDuration(t)}
              </text>
            </g>
          ))}

          {visible.map((entry) => {
            const lane = laneOf.get(entry.workerIndex) ?? 0;
            const left = Math.max(x(entry.start), LABEL_W);
            const right = Math.min(x(entry.start + entry.duration), LABEL_W + PLOT_W);
            const width = Math.max(3, right - left);
            return (
              <a
                key={`${entry.caseId}:${entry.retry}`}
                href={`#/tests/${entry.caseId}`}
                aria-label={`${entry.title} (${entry.projectName})`}
              >
                <rect
                  x={left}
                  y={lane * ROW_H + (ROW_H - BAR_H) / 2}
                  width={width}
                  height={BAR_H}
                  rx={4}
                  fill={OUTCOME_FILL[entry.outcome] ?? 'var(--skipped)'}
                  stroke="var(--card)"
                  strokeWidth={1}
                >
                  <title>
                    {`${entry.title} · ${entry.projectName}${entry.retry > 0 ? ` · retry ${entry.retry}` : ''} · ${formatDuration(entry.duration)} · ${TEST_OUTCOMES[entry.outcome] ?? ''}`}
                  </title>
                </rect>
              </a>
            );
          })}

          {drag && (
            <rect
              x={Math.min(x(drag.from), x(drag.to))}
              y={0}
              width={Math.abs(x(drag.to) - x(drag.from))}
              height={height - AXIS_H}
              fill="var(--brand)"
              opacity={0.15}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
