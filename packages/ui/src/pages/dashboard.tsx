import {
  DEFAULT_DASHBOARD_CARDS,
  type GroupRollup,
  type HistoryData,
  type Manifest,
  type RunCounts,
  type TestOutcome,
} from '@beacon-report/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { IconCross, IconGrip, IconSliders } from '../components/icons';
import { MasonryCell } from '../components/masonry';
import { FileTreemap } from '../components/treemap';
import { applyOrder, useDashboardLayout } from '../lib/dashboard-layout';
import { formatDuration } from '../lib/format';
import { useHistory, useManifest } from '../lib/hooks';

const TILES: Array<{ key: keyof RunCounts & TestOutcome; label: string; tone: string }> = [
  { key: 'expected', label: 'Passed', tone: 'text-passed-text' },
  { key: 'unexpected', label: 'Failed', tone: 'text-failed-text' },
  { key: 'flaky', label: 'Flaky', tone: 'text-flaky-text' },
  { key: 'skipped', label: 'Skipped', tone: 'text-skipped-text' },
];

/** Donut segment order deliberately avoids red↔amber adjacency (CVD). */
const DONUT_ORDER: Array<{ key: keyof RunCounts; color: string }> = [
  { key: 'expected', color: 'var(--passed)' },
  { key: 'unexpected', color: 'var(--failed)' },
  { key: 'skipped', color: 'var(--skipped)' },
  { key: 'flaky', color: 'var(--flaky)' },
];

const LEGEND: Array<{ key: keyof RunCounts; label: string; dot: string }> = [
  { key: 'expected', label: 'Passed', dot: 'bg-passed' },
  { key: 'unexpected', label: 'Failed', dot: 'bg-failed' },
  { key: 'flaky', label: 'Flaky', dot: 'bg-flaky' },
  { key: 'skipped', label: 'Skipped', dot: 'bg-skipped' },
];

function Donut({ counts }: { counts: RunCounts }) {
  const C = 2 * Math.PI * 70;
  let start = 0;
  const segments = DONUT_ORDER.flatMap(({ key, color }) => {
    const value = counts[key];
    if (value === 0) return [];
    const len = (value / Math.max(1, counts.total)) * C;
    const seg = { color, dash: Math.max(1, len - 3), offset: -start };
    start += len;
    return [seg];
  });
  const passRate =
    counts.total === 0 ? 100 : Math.round(((counts.expected + counts.flaky) / counts.total) * 100);
  return (
    <div className="relative h-[186px] w-[186px] shrink-0">
      <svg
        width="186"
        height="186"
        viewBox="0 0 186 186"
        role="img"
        aria-label={`Outcome donut: ${counts.expected} passed, ${counts.unexpected} failed, ${counts.skipped} skipped, ${counts.flaky} flaky`}
      >
        <g transform="rotate(-90 93 93)">
          {counts.total === 0 && (
            <circle cx="93" cy="93" r="70" fill="none" stroke="var(--edge-2)" strokeWidth="22" />
          )}
          {segments.map((seg) => (
            <circle
              key={seg.color}
              cx="93"
              cy="93"
              r="70"
              fill="none"
              stroke={seg.color}
              strokeWidth="22"
              strokeDasharray={`${seg.dash} ${C}`}
              strokeDashoffset={seg.offset}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold">{passRate}%</span>
        <span className="text-[11px] text-ink-3">pass rate</span>
      </div>
    </div>
  );
}

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-[14px] border border-edge bg-card p-5 ${className}`}>{children}</div>
  );
}

function StackedBar({ rollup }: { rollup: GroupRollup }) {
  const parts = [
    { value: rollup.expected, color: 'var(--passed)' },
    { value: rollup.unexpected, color: 'var(--failed)' },
    { value: rollup.skipped, color: 'var(--skipped)' },
    { value: rollup.flaky, color: 'var(--flaky)' },
  ].filter((p) => p.value > 0);
  return (
    <div className="flex h-2 gap-[2px]">
      {parts.map((p, i) => (
        <div
          key={p.color}
          style={{
            flexGrow: p.value,
            background: p.color,
            borderRadius:
              parts.length === 1
                ? 4
                : i === 0
                  ? '4px 0 0 4px'
                  : i === parts.length - 1
                    ? '0 4px 4px 0'
                    : 0,
          }}
        />
      ))}
    </div>
  );
}

function passRateOf(rollup: GroupRollup): string {
  return rollup.total === 0
    ? '—'
    : `${Math.round(((rollup.expected + rollup.flaky) / rollup.total) * 100)}%`;
}

function GroupRows({
  rollups,
  linkFor,
  mono = false,
}: {
  rollups: GroupRollup[];
  linkFor: (name: string) => { to: string; search: Record<string, string> };
  mono?: boolean;
}) {
  if (rollups.length === 0)
    return <div className="mt-3 text-[13px] text-ink-3">Nothing recorded.</div>;
  return (
    <div className="mt-3 flex flex-col gap-3.5">
      {rollups.map((rollup) => {
        const link = linkFor(rollup.name);
        return (
          <div key={rollup.name} className="flex flex-col gap-1.5 text-[13px]">
            <div className="flex items-baseline gap-2">
              <Link
                to={link.to}
                search={link.search}
                className={`truncate text-ink-2 hover:text-brand-text ${mono ? 'font-mono text-xs' : ''}`}
              >
                {rollup.name || 'default'}
              </Link>
              <span className="shrink-0 text-xs text-ink-3">{rollup.total} tests</span>
              {rollup.duration !== undefined && (
                <span className="shrink-0 text-xs text-ink-4">
                  {formatDuration(rollup.duration)}
                </span>
              )}
              <span className="ml-auto shrink-0 font-mono text-xs">{passRateOf(rollup)}</span>
            </div>
            <StackedBar rollup={rollup} />
          </div>
        );
      })}
    </div>
  );
}

function OutcomesCard({ manifest }: { manifest: Manifest }) {
  const { counts } = manifest;
  return (
    <Card>
      <div className="text-sm font-semibold">Outcomes</div>
      <div className="text-xs text-ink-3">
        {counts.total} tests · {formatDuration(manifest.meta.duration)}
      </div>
      <div className="mt-2 flex items-center gap-6">
        <Donut counts={counts} />
        <div className="flex grow flex-col gap-2.5 text-[13px]">
          {LEGEND.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <span className={`h-[9px] w-[9px] rounded-[3px] ${row.dot}`} />
              <span className="grow text-ink-2">{row.label}</span>
              <span className="font-mono font-medium">{counts[row.key]}</span>
              <span className="w-11 text-right text-ink-3">
                {counts.total === 0 ? '0' : ((counts[row.key] / counts.total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function passRatePct(counts: RunCounts): number {
  return counts.total === 0 ? 100 : ((counts.expected + counts.flaky) / counts.total) * 100;
}

function Sparkline({ label, values, latest }: { label: string; values: number[]; latest: string }) {
  const W = 170;
  const H = 34;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => 2 + (i / Math.max(1, values.length - 1)) * (W - 4);
  const y = (v: number) => H - 5 - ((v - min) / Math.max(1, max - min)) * (H - 10);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 text-[11px] text-ink-3">{label}</span>
      <svg width={W} height={H} aria-hidden="true">
        <polyline
          fill="none"
          stroke="var(--ink-4)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        <circle
          cx={x(values.length - 1)}
          cy={y(values[values.length - 1] ?? 0)}
          r="2.5"
          fill="var(--brand)"
        />
      </svg>
      <span className="font-mono text-[11px] text-ink-2">{latest}</span>
    </div>
  );
}

function TrendCard({ history }: { history: HistoryData | null | undefined }) {
  const runs = history?.runs ?? [];
  if (runs.length < 2) {
    return (
      <Card className="flex flex-col">
        <div className="flex items-baseline gap-2.5">
          <div className="text-sm font-semibold">Pass rate</div>
          <div className="text-xs text-ink-3">across runs</div>
          <Link to="/trends" className="ml-auto text-xs text-brand-text hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3 grid grow place-items-center rounded-[10px] border border-dashed border-edge px-6 py-10 text-center">
          <div>
            <div className="text-sm font-medium text-ink-2">Trend appears with run history</div>
            <div className="mt-1 text-xs text-ink-3">
              {history === null
                ? 'This run has history disabled or is the first recorded run — rerun to start the trend.'
                : 'Loading…'}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const W = 620;
  const H = 150;
  const rates = runs.map((r) => passRatePct(r.counts));
  const min = Math.max(0, Math.min(...rates) - 5);
  const x = (i: number) => 8 + (i / Math.max(1, runs.length - 1)) * (W - 30);
  const y = (rate: number) => 10 + ((100 - rate) / Math.max(1, 100 - min)) * (H - 20);
  const points = rates.map((r, i) => `${x(i).toFixed(1)},${y(r).toFixed(1)}`).join(' ');
  const last = rates[rates.length - 1] ?? 100;
  const t = history?.transitions;

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <div className="text-sm font-semibold">Pass rate</div>
        <div className="text-xs text-ink-3">last {runs.length} runs</div>
        <span className="ml-auto flex gap-2 text-[11px]">
          {t && t.fixed.length > 0 && (
            <span className="rounded-full bg-passed-tint px-2 py-0.5 font-semibold text-passed-text">
              {t.fixed.length} fixed
            </span>
          )}
          {t && t.regressed.length > 0 && (
            <span className="rounded-full bg-failed-tint px-2 py-0.5 font-semibold text-failed-text">
              {t.regressed.length} regressed
            </span>
          )}
          {t && t.added.length > 0 && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-text">
              {t.added.length} new
            </span>
          )}
        </span>
      </div>
      <div className="mt-3 grow">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H + 18}`}
          role="img"
          aria-label={`Pass rate trend over ${runs.length} runs, currently ${Math.round(last)} percent`}
        >
          <line x1="8" y1="10" x2={W - 8} y2="10" stroke="var(--edge-2)" strokeWidth="1" />
          <line x1="8" y1={H - 10} x2={W - 8} y2={H - 10} stroke="var(--edge-2)" strokeWidth="1" />
          <polygon
            fill="var(--brand-soft)"
            points={`${points} ${x(runs.length - 1).toFixed(1)},${H - 10} 8,${H - 10}`}
          />
          <polyline
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points}
          />
          <circle cx={x(runs.length - 1)} cy={y(last)} r="4" fill="var(--brand)" />
          <text
            x={x(runs.length - 1) - 8}
            y={y(last) - 8}
            textAnchor="end"
            fontSize="11"
            fontWeight="600"
            fill="var(--ink)"
          >
            {Math.round(last)}%
          </text>
          <text x="8" y={H + 12} fontSize="10" fill="var(--ink-3)">
            {new Date(runs[0]?.startTime ?? 0).toLocaleDateString()}
          </text>
          <text x={W - 8} y={H + 12} textAnchor="end" fontSize="10" fill="var(--ink-3)">
            {new Date(runs[runs.length - 1]?.startTime ?? 0).toLocaleDateString()}
          </text>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 border-t border-edge-2 pt-2.5">
        <Sparkline
          label="Duration"
          values={runs.map((r) => r.duration)}
          latest={formatDuration(runs[runs.length - 1]?.duration ?? 0)}
        />
        <Sparkline
          label="Retries"
          values={runs.map((r) => r.retries ?? 0)}
          latest={String(runs[runs.length - 1]?.retries ?? 0)}
        />
      </div>
    </Card>
  );
}

function SlowestCard({ manifest }: { manifest: Manifest }) {
  const slowest = manifest.aggregates.slowest ?? [];
  const maxSlow = slowest[0]?.duration ?? 1;
  return (
    <Card>
      <div className="flex items-baseline">
        <div className="text-sm font-semibold">Slowest tests</div>
        <Link to="/tests" className="ml-auto text-xs text-brand-text">
          View all
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-[13px]">
        {slowest.map((t) => (
          <div key={t.caseId} className="mb-1.5">
            <Link
              to="/tests/$caseId"
              params={{ caseId: t.caseId }}
              className="flex items-center gap-2.5 text-ink"
            >
              <span className="grow truncate">
                {t.title} <span className="text-ink-3">· {t.projectName}</span>
              </span>
              <span className="font-mono text-xs text-ink-2">{formatDuration(t.duration)}</span>
            </Link>
            <div className="mt-1 h-1.5 rounded-[3px] bg-edge-2">
              <div
                className="h-1.5 rounded-[3px] bg-brand"
                style={{ width: `${Math.max(4, (t.duration / maxSlow) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {slowest.length === 0 && <div className="text-ink-3">No timing data.</div>}
      </div>
    </Card>
  );
}

function ProjectsCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Projects</div>
      <GroupRows
        rollups={manifest.aggregates.projects ?? []}
        linkFor={(name) => ({ to: '/tests', search: { project: name } })}
      />
    </Card>
  );
}

function TagsCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Tags</div>
      <div className="text-xs text-ink-3">outcome by marker group</div>
      <GroupRows
        rollups={(manifest.aggregates.tags ?? []).slice(0, 8)}
        linkFor={(name) => ({ to: '/tests', search: { tag: name } })}
      />
    </Card>
  );
}

function FilesCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Spec files</div>
      <div className="text-xs text-ink-3">worst first</div>
      <GroupRows
        mono
        rollups={(manifest.aggregates.files ?? []).slice(0, 8)}
        linkFor={(name) => ({ to: '/tests', search: { q: name } })}
      />
    </Card>
  );
}

function SuitesCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Suites &amp; features</div>
      <div className="text-xs text-ink-3">describe blocks &amp; BDD features, worst first</div>
      <GroupRows
        rollups={(manifest.aggregates.suites ?? []).slice(0, 8)}
        linkFor={(name) => ({ to: '/tests', search: { q: name } })}
      />
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function PercentilesCard({ manifest }: { manifest: Manifest }) {
  const percentiles = manifest.aggregates.percentiles;
  if (!percentiles) return null;
  const rows = [{ name: 'all tests', ...percentiles.overall }, ...percentiles.projects];
  const max = Math.max(1, ...rows.map((r) => r.p95));
  return (
    <Card>
      <div className="text-sm font-semibold">Duration percentiles</div>
      <div className="text-xs text-ink-3">p50 / p90 / p95 — averages lie</div>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className="truncate">{row.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3">
                {formatDuration(row.p50)} / {formatDuration(row.p90)} /{' '}
                <span className="text-ink-2">{formatDuration(row.p95)}</span>
              </span>
            </div>
            <div className="relative mt-1 h-1.5 rounded-full bg-edge-2">
              <div
                className="absolute h-1.5 rounded-full bg-brand opacity-40"
                style={{ width: `${Math.max(2, (row.p95 / max) * 100)}%` }}
              />
              <div
                className="absolute h-1.5 rounded-full bg-brand opacity-70"
                style={{ width: `${Math.max(2, (row.p90 / max) * 100)}%` }}
              />
              <div
                className="absolute h-1.5 rounded-full bg-brand"
                style={{ width: `${Math.max(2, (row.p50 / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CoverageCard({
  manifest,
  history,
}: {
  manifest: Manifest;
  history: HistoryData | null | undefined;
}) {
  const coverage = manifest.aggregates.coverage;
  const trend = (history?.runs ?? [])
    .map((run) => run.coverage)
    .filter((v): v is number => v !== undefined);
  return (
    <Card>
      <div className="flex items-baseline gap-2.5">
        <div className="text-sm font-semibold">Code coverage</div>
        <div className="text-xs text-ink-3">istanbul summary</div>
        {coverage && (
          <span className="ml-auto font-display text-xl font-bold">{coverage.lines}%</span>
        )}
      </div>
      {!coverage ? (
        <div className="mt-3 text-[13px] text-ink-3">
          Point the <code className="font-mono">coverage</code> option at a{' '}
          <code className="font-mono">coverage-summary.json</code> to track coverage here.
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {(
              [
                ['lines', coverage.lines],
                ['statements', coverage.statements],
                ['functions', coverage.functions],
                ['branches', coverage.branches],
              ] as const
            ).map(([label, pct]) => (
              <div key={label} className="flex items-center gap-2.5 text-[13px]">
                <span className="w-20 text-ink-3">{label}</span>
                <div className="h-1.5 grow rounded-full bg-edge-2">
                  <div
                    className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-passed' : pct >= 50 ? 'bg-flaky' : 'bg-failed'}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-xs">{pct}%</span>
              </div>
            ))}
          </div>
          {trend.length >= 2 && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-3">
              trend
              <MetricSparkline values={trend} />
              <span className="font-mono">{trend[trend.length - 1]}%</span>
            </div>
          )}
          {coverage.files.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">
                least covered
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                {coverage.files.slice(0, 5).map((file) => (
                  <div key={file.name} className="flex items-baseline gap-2 text-[12px]">
                    <span className="truncate font-mono text-ink-2">{file.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-failed-text">
                      {file.lines}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function RequirementsCard({ manifest }: { manifest: Manifest }) {
  const rollups = manifest.aggregates.requirements ?? [];
  return (
    <Card>
      <div className="flex items-baseline gap-2.5">
        <div className="text-sm font-semibold">Requirements</div>
        <div className="text-xs text-ink-3">
          from <code className="font-mono">requirement</code> annotations
        </div>
        {rollups.length > 0 && (
          <Link to="/requirements" className="ml-auto text-xs text-brand-text hover:underline">
            View matrix
          </Link>
        )}
      </div>
      {rollups.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">
          Annotate tests with{' '}
          <code className="font-mono">{'{ type: "requirement", description: "REQ-123" }'}</code> to
          trace coverage here.
        </div>
      ) : (
        <GroupRows
          rollups={rollups.slice(0, 8)}
          linkFor={() => ({ to: '/requirements', search: {} })}
        />
      )}
    </Card>
  );
}

function StepsCard({ manifest }: { manifest: Manifest }) {
  const steps = manifest.aggregates.slowestSteps ?? [];
  const max = Math.max(1, ...steps.map((s) => s.totalMs));
  return (
    <Card>
      <div className="text-sm font-semibold">Slowest actions</div>
      <div className="text-xs text-ink-3">leaf pw:api/expect steps by total time</div>
      <div className="mt-3 flex flex-col gap-2">
        {steps.length === 0 && <div className="text-[13px] text-ink-3">No step data.</div>}
        {steps.slice(0, 8).map((step) => (
          <div key={`${step.category}:${step.title}`}>
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className="truncate font-mono text-[12px]">{step.title}</span>
              <span className="rounded-full bg-edge-2 px-1.5 text-[10px] text-ink-3">
                {step.category}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3">
                {step.count}× · avg {formatDuration(step.avgMs)} ·{' '}
                <span className="text-ink-2">{formatDuration(step.totalMs)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-edge-2">
              <div
                className="h-1.5 rounded-full bg-brand"
                style={{ width: `${Math.max(2, (step.totalMs / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const IMPACT_TONE: Record<string, string> = {
  critical: 'bg-failed-tint text-failed-text',
  serious: 'bg-failed-tint text-failed-text',
  moderate: 'bg-flaky-tint text-flaky-text',
  minor: 'bg-skipped-tint text-skipped-text',
};

function A11yCard({ manifest }: { manifest: Manifest }) {
  const a11y = manifest.aggregates.a11y;
  return (
    <Card>
      <div className="text-sm font-semibold">Accessibility</div>
      <div className="text-xs text-ink-3">
        axe violations across {a11y?.testsScanned ?? 0} scanned tests
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {!a11y && (
          <div className="text-[13px] text-ink-3">
            Attach axe results as a JSON attachment named{' '}
            <span className="font-mono">axe-scan</span> to populate this card.
          </div>
        )}
        {a11y?.violations.length === 0 && (
          <div className="text-[13px] text-passed-text">No violations found.</div>
        )}
        {(a11y?.violations ?? []).slice(0, 8).map((violation) => (
          <div key={violation.id} className="flex items-center gap-2 text-[13px]">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_TONE[violation.impact] ?? 'bg-edge-2 text-ink-3'}`}
            >
              {violation.impact}
            </span>
            <span className="truncate font-mono text-[12px]">{violation.id}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3">
              {violation.nodes} nodes · {violation.tests} tests
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CategoriesCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Failure categories</div>
      <div className="text-xs text-ink-3">failing tests grouped by cause</div>
      <GroupRows
        rollups={(manifest.aggregates.categories ?? []).slice(0, 8)}
        linkFor={() => ({ to: '/tests', search: { outcome: 'unexpected,flaky' } })}
      />
      {(manifest.aggregates.categories ?? []).length === 0 && null}
    </Card>
  );
}

function FailingCard({
  history,
  manifest,
}: {
  history: HistoryData | null | undefined;
  manifest: Manifest;
}) {
  const rows = history?.mostFailing ?? [];
  const freshness = manifest.aggregates.failureFreshness;
  return (
    <Card>
      <div className="text-sm font-semibold">Most failing</div>
      <div className="text-xs text-ink-3">across retained runs</div>
      {freshness && freshness.fresh + freshness.known > 0 && (
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-failed-tint px-2 py-0.5 text-[11px] font-semibold text-failed-text">
            {freshness.fresh} new {freshness.fresh === 1 ? 'failure' : 'failures'}
          </span>
          <span className="rounded-full bg-edge-2 px-2 py-0.5 text-[11px] text-ink-2">
            {freshness.known} still failing
          </span>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">
          {history ? 'No repeat offenders — nice.' : 'Appears with run history.'}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          {rows.slice(0, 6).map((row) => (
            <div key={row.caseId}>
              <Link
                to="/tests/$caseId"
                params={{ caseId: row.caseId }}
                className="flex items-center gap-2.5 text-ink"
              >
                <span className="grow truncate">
                  {row.title} <span className="text-ink-3">· {row.projectName}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-failed-text">
                  {row.failures}/{row.runs} runs
                </span>
              </Link>
              <div className="mt-1 h-1.5 rounded-[3px] bg-edge-2">
                <div
                  className="h-1.5 rounded-[3px] bg-failed"
                  style={{ width: `${Math.max(6, (row.failures / Math.max(1, row.runs)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DurationsCard({ manifest }: { manifest: Manifest }) {
  const buckets = manifest.aggregates.durations ?? [];
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Card>
      <div className="text-sm font-semibold">Durations</div>
      <div className="text-xs text-ink-3">tests per duration bucket</div>
      <div className="mt-3 flex flex-col gap-2 text-[13px]">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-2.5">
            <span className="w-20 shrink-0 font-mono text-xs text-ink-3">{bucket.label}</span>
            <div className="h-2 grow rounded-[3px] bg-edge-2">
              <div
                className="h-2 rounded-[3px] bg-brand"
                style={{ width: `${(bucket.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs">{bucket.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const SEVERITY_ORDER = ['blocker', 'critical', 'normal', 'minor', 'trivial'];

function SeverityCard({ manifest }: { manifest: Manifest }) {
  const rollups = [...(manifest.aggregates.severity ?? [])].sort(
    (a, b) =>
      (SEVERITY_ORDER.indexOf(a.name) + 1 || 99) - (SEVERITY_ORDER.indexOf(b.name) + 1 || 99),
  );
  return (
    <Card>
      <div className="text-sm font-semibold">Severity</div>
      <div className="text-xs text-ink-3">
        from <code className="font-mono">severity</code> annotations
      </div>
      {rollups.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">
          No severity annotations — add{' '}
          <code className="font-mono text-xs">
            {'{'} type: 'severity', description: 'critical' {'}'}
          </code>{' '}
          to tests.
        </div>
      ) : (
        <GroupRows rollups={rollups} linkFor={() => ({ to: '/tests', search: {} })} />
      )}
    </Card>
  );
}

function TreemapCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Suite map</div>
      <div className="text-xs text-ink-3">area = tests · color = pass rate</div>
      <FileTreemap files={manifest.aggregates.files ?? []} />
    </Card>
  );
}

function SlowedCard({ manifest }: { manifest: Manifest }) {
  const rows = manifest.aggregates.slowedDown ?? [];
  return (
    <Card>
      <div className="text-sm font-semibold">Slowed down</div>
      <div className="text-xs text-ink-3">vs each test's history median</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">No duration regressions detected.</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          {rows.slice(0, 6).map((row) => (
            <Link
              key={row.caseId}
              to="/tests/$caseId"
              params={{ caseId: row.caseId }}
              className="flex items-center gap-2.5 text-ink"
            >
              <span className="grow truncate">
                {row.title} <span className="text-ink-3">· {row.projectName}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-flaky-text">
                {formatDuration(row.median)} → {formatDuration(row.current)} ({row.factor}×)
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function IncidentsCard({ manifest }: { manifest: Manifest }) {
  const incidents = manifest.aggregates.incidents ?? [];
  return (
    <Card>
      <div className="text-sm font-semibold">Probable common causes</div>
      <div className="text-xs text-ink-3">failures sharing one normalized error</div>
      {incidents.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">No correlated failures.</div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {incidents.map((incident) => (
            <div key={incident.message} className="rounded-[10px] border border-edge-2 p-2.5">
              <div className="font-mono text-xs text-failed-text">{incident.message}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {incident.tests.map((t) => (
                  <Link
                    key={t.caseId}
                    to="/tests/$caseId"
                    params={{ caseId: t.caseId }}
                    className="max-w-56 truncate rounded-full bg-edge-2 px-2 py-0.5 text-[11px] text-ink-2 hover:text-brand-text"
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OwnersCard({ manifest }: { manifest: Manifest }) {
  return (
    <Card>
      <div className="text-sm font-semibold">Owners</div>
      <div className="text-xs text-ink-3">
        from <code className="font-mono">owner</code> annotations
      </div>
      <GroupRows
        rollups={(manifest.aggregates.owners ?? []).slice(0, 8)}
        linkFor={() => ({ to: '/tests', search: {} })}
      />
    </Card>
  );
}

function HealthCard({ manifest }: { manifest: Manifest }) {
  const health = manifest.aggregates.health;
  if (!health) return null;
  const tone =
    health.score >= 90
      ? 'text-passed-text'
      : health.score >= 70
        ? 'text-flaky-text'
        : 'text-failed-text';
  return (
    <Card>
      <div className="text-sm font-semibold">Suite health</div>
      <div className="text-xs text-ink-3">pass rate minus flakiness & failure penalties</div>
      <div className="mt-3 flex items-center gap-6">
        <span className={`font-display text-[52px] font-bold leading-none ${tone}`}>
          {Math.round(health.score)}
        </span>
        <div className="flex flex-col gap-1 text-[13px] text-ink-2">
          <span>pass rate {(health.passRate * 100).toFixed(1)}%</span>
          <span>flaky share {(health.flakyShare * 100).toFixed(1)}%</span>
          <span>failure share {(health.failShare * 100).toFixed(1)}%</span>
        </div>
      </div>
    </Card>
  );
}

function WasteCard({ manifest }: { manifest: Manifest }) {
  const waste = manifest.aggregates.waste;
  if (!waste) return null;
  const rescueRate =
    waste.retriedTests === 0 ? null : Math.round((waste.rescued / waste.retriedTests) * 100);
  return (
    <Card>
      <div className="text-sm font-semibold">Retries & waste</div>
      <div className="text-xs text-ink-3">time spent on attempts that didn't count</div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        <span className="text-ink-3">retry time</span>
        <span className="font-mono">{formatDuration(waste.retryMs)}</span>
        <span className="text-ink-3">failed-test time</span>
        <span className="font-mono">{formatDuration(waste.failedMs)}</span>
        <span className="text-ink-3">retried tests</span>
        <span className="font-mono">{waste.retriedTests}</span>
        <span className="text-ink-3">rescued by retry</span>
        <span className="font-mono">
          {waste.rescued}
          {rescueRate !== null ? ` (${rescueRate}%)` : ''}
        </span>
      </div>
      {rescueRate !== null && rescueRate < 30 && waste.retriedTests >= 3 && (
        <div className="mt-3 rounded-[8px] bg-flaky-tint px-2.5 py-1.5 text-xs text-flaky-text">
          Retries rescue only {rescueRate}% of retried tests — consider lowering `retries`.
        </div>
      )}
    </Card>
  );
}

function BudgetsCard({ manifest }: { manifest: Manifest }) {
  const rows = manifest.aggregates.budgets ?? [];
  return (
    <Card>
      <div className="text-sm font-semibold">Over budget</div>
      <div className="text-xs text-ink-3">
        vs <code className="font-mono">budget</code> annotations
      </div>
      {rows.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">All budgeted tests are within budget.</div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          {rows.map((row) => (
            <Link
              key={row.caseId}
              to="/tests/$caseId"
              params={{ caseId: row.caseId }}
              className="flex items-center gap-2.5 text-ink"
            >
              <span className="grow truncate">
                {row.title} <span className="text-ink-3">· {row.projectName}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-failed-text">
                {formatDuration(row.duration)} / {formatDuration(row.budget)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function MetricsCard({
  manifest,
  history,
}: {
  manifest: Manifest;
  history: HistoryData | null | undefined;
}) {
  const rows = manifest.aggregates.metrics ?? [];
  const trendOf = new Map((history?.metricTrends ?? []).map((t) => [t.name, t.values]));
  return (
    <Card>
      <div className="text-sm font-semibold">Custom metrics</div>
      <div className="text-xs text-ink-3">
        from <code className="font-mono">beacon:metrics</code> attachments
        {trendOf.size > 0 && ' · trend across retained runs'}
      </div>
      {rows.length === 0 ? (
        <div className="mt-3 text-[13px] text-ink-3">
          Attach <code className="font-mono text-xs">beacon:metrics</code> JSON to tests to track
          numbers here.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-5 gap-y-1.5 text-[13px]">
          <span className="text-xs text-ink-4">metric</span>
          <span className="text-xs text-ink-4">trend</span>
          <span className="text-right text-xs text-ink-4">avg</span>
          <span className="text-right text-xs text-ink-4">max</span>
          <span className="text-right text-xs text-ink-4">tests</span>
          {rows.map((m) => (
            <MetricRow key={m.name} m={m} trend={trendOf.get(m.name)} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Tiny inline sparkline for a per-run metric series (nulls = gaps). */
function MetricSparkline({ values }: { values: Array<number | null> }) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return <span className="text-xs text-ink-4">—</span>;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const spread = max - min || 1;
  const W = 72;
  const H = 18;
  const points = values
    .map((v, i) =>
      v === null
        ? null
        : `${(i / Math.max(1, values.length - 1)) * W},${H - 2 - ((v - min) / spread) * (H - 4)}`,
    )
    .filter((p): p is string => p !== null)
    .join(' ');
  return (
    <svg width={W} height={H} aria-hidden="true" className="self-center">
      <polyline
        points={points}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricRow({
  m,
  trend,
}: {
  m: { name: string; avg: number; max: number; count: number };
  trend?: Array<number | null>;
}) {
  return (
    <>
      <span className="truncate font-mono text-xs">{m.name}</span>
      {trend ? <MetricSparkline values={trend} /> : <span className="text-xs text-ink-4">—</span>}
      <span className="text-right font-mono text-xs">{m.avg}</span>
      <span className="text-right font-mono text-xs">{m.max}</span>
      <span className="text-right font-mono text-xs text-ink-3">{m.count}</span>
    </>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapCard({ history }: { history: HistoryData | null | undefined }) {
  const runs = history?.runs ?? [];
  const cells = new Map<string, { failures: number; runs: number }>();
  for (const run of runs) {
    const date = new Date(run.startTime);
    const key = `${date.getDay()}:${date.getHours()}`;
    const cell = cells.get(key) ?? { failures: 0, runs: 0 };
    cell.runs += 1;
    cell.failures += run.counts.unexpected;
    cells.set(key, cell);
  }
  return (
    <Card>
      <div className="text-sm font-semibold">Failure heatmap</div>
      <div className="text-xs text-ink-3">failures by weekday × hour, across retained runs</div>
      {runs.length < 2 ? (
        <div className="mt-3 text-[13px] text-ink-3">Appears with run history.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="grid w-max grid-cols-[28px_repeat(24,14px)] gap-[2px] text-[9px] text-ink-4">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour axis
              <span key={h} className="text-center">
                {h % 6 === 0 ? h : ''}
              </span>
            ))}
            {DAY_NAMES.map((day, d) => (
              <HeatRow key={day} day={day} d={d} cells={cells} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function HeatRow({
  day,
  d,
  cells,
}: {
  day: string;
  d: number;
  cells: Map<string, { failures: number; runs: number }>;
}) {
  return (
    <>
      <span className="pr-1 text-right leading-[14px]">{day}</span>
      {Array.from({ length: 24 }, (_, h) => {
        const cell = cells.get(`${d}:${h}`);
        const background = !cell
          ? 'var(--edge-2)'
          : cell.failures === 0
            ? 'var(--passed)'
            : 'var(--failed)';
        const opacity = !cell
          ? 0.5
          : cell.failures === 0
            ? 0.55
            : Math.min(1, 0.4 + cell.failures * 0.2);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday-hour grid
            key={`c${d}:${h}`}
            title={cell ? `${day} ${h}:00 — ${cell.failures} failures in ${cell.runs} runs` : ''}
            className="h-[14px] w-[14px] rounded-[3px]"
            style={{ background, opacity }}
          />
        );
      })}
    </>
  );
}

function EnvironmentCard({ manifest }: { manifest: Manifest }) {
  const entries = Object.entries(manifest.environment ?? {});
  return (
    <Card>
      <div className="text-sm font-semibold">Environment</div>
      <div className="mt-3 flex flex-col gap-2 text-[13px]">
        {manifest.meta.playwrightVersion && (
          <div className="flex gap-3">
            <span className="w-32 shrink-0 text-ink-3">playwright</span>
            <span className="font-mono text-xs">{manifest.meta.playwrightVersion}</span>
          </div>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-3">
            <span className="w-32 shrink-0 truncate text-ink-3">{key}</span>
            <span className="min-w-0 truncate font-mono text-xs">{value}</span>
          </div>
        ))}
        <div className="flex gap-3">
          <span className="w-32 shrink-0 text-ink-3">workers</span>
          <span className="font-mono text-xs">{manifest.meta.config.workers ?? '—'}</span>
        </div>
        <div className="flex gap-3">
          <span className="w-32 shrink-0 text-ink-3">fullyParallel</span>
          <span className="font-mono text-xs">
            {String(manifest.meta.config.fullyParallel ?? false)}
          </span>
        </div>
        {manifest.aggregates.storage && manifest.aggregates.storage.count > 0 && (
          <div className="flex gap-3">
            <span className="w-32 shrink-0 text-ink-3">attachments</span>
            <span className="font-mono text-xs">
              {manifest.aggregates.storage.count} · {formatBytes(manifest.aggregates.storage.bytes)}
              {manifest.aggregates.storage.dedupedBytes > 0 &&
                ` (${formatBytes(manifest.aggregates.storage.dedupedBytes)} deduped)`}
            </span>
          </div>
        )}
        {manifest.meta.config.shard && (
          <div className="flex gap-3">
            <span className="w-32 shrink-0 text-ink-3">shard</span>
            <span className="font-mono text-xs">
              {manifest.meta.config.shard.current}/{manifest.meta.config.shard.total}
            </span>
          </div>
        )}
        <div className="flex gap-3">
          <span className="w-32 shrink-0 text-ink-3">started</span>
          <span className="font-mono text-xs">
            {new Date(manifest.meta.startTime).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-3">
          <span className="w-32 shrink-0 text-ink-3">beacon</span>
          <span className="font-mono text-xs">{manifest.meta.beaconVersion}</span>
        </div>
      </div>
    </Card>
  );
}

interface CardContext {
  manifest: Manifest;
  history: HistoryData | null | undefined;
}

const CARD_RENDERERS: Record<string, (ctx: CardContext) => React.ReactNode> = {
  outcomes: ({ manifest }) => <OutcomesCard manifest={manifest} />,
  trend: ({ history }) => <TrendCard history={history} />,
  slowest: ({ manifest }) => <SlowestCard manifest={manifest} />,
  projects: ({ manifest }) => <ProjectsCard manifest={manifest} />,
  tags: ({ manifest }) => <TagsCard manifest={manifest} />,
  files: ({ manifest }) => <FilesCard manifest={manifest} />,
  suites: ({ manifest }) => <SuitesCard manifest={manifest} />,
  categories: ({ manifest }) => <CategoriesCard manifest={manifest} />,
  failing: ({ history, manifest }) => <FailingCard history={history} manifest={manifest} />,
  durations: ({ manifest }) => <DurationsCard manifest={manifest} />,
  environment: ({ manifest }) => <EnvironmentCard manifest={manifest} />,
  treemap: ({ manifest }) => <TreemapCard manifest={manifest} />,
  severity: ({ manifest }) => <SeverityCard manifest={manifest} />,
  slowed: ({ manifest }) => <SlowedCard manifest={manifest} />,
  incidents: ({ manifest }) => <IncidentsCard manifest={manifest} />,
  owners: ({ manifest }) => <OwnersCard manifest={manifest} />,
  health: ({ manifest }) => <HealthCard manifest={manifest} />,
  waste: ({ manifest }) => <WasteCard manifest={manifest} />,
  budgets: ({ manifest }) => <BudgetsCard manifest={manifest} />,
  metrics: ({ manifest, history }) => <MetricsCard manifest={manifest} history={history} />,
  heatmap: ({ history }) => <HeatmapCard history={history} />,
  steps: ({ manifest }) => <StepsCard manifest={manifest} />,
  a11y: ({ manifest }) => <A11yCard manifest={manifest} />,
  percentiles: ({ manifest }) => <PercentilesCard manifest={manifest} />,
  coverage: ({ manifest, history }) => <CoverageCard manifest={manifest} history={history} />,
  requirements: ({ manifest }) => <RequirementsCard manifest={manifest} />,
};

const CARD_LABEL: Record<string, string> = {
  outcomes: 'Outcomes',
  trend: 'Pass rate trend',
  slowest: 'Slowest tests',
  projects: 'Projects',
  tags: 'Tags',
  files: 'Spec files',
  suites: 'Suites & features',
  categories: 'Failure categories',
  failing: 'Most failing',
  durations: 'Durations',
  environment: 'Environment',
  treemap: 'Suite map',
  severity: 'Severity',
  slowed: 'Slowed down',
  incidents: 'Common causes',
  owners: 'Owners',
  health: 'Suite health',
  waste: 'Retries & waste',
  budgets: 'Over budget',
  metrics: 'Custom metrics',
  heatmap: 'Failure heatmap',
  steps: 'Slowest actions',
  a11y: 'Accessibility',
  percentiles: 'Duration percentiles',
  coverage: 'Code coverage',
  requirements: 'Requirements',
};

function TileDelta({
  tile,
  current,
  previous,
}: {
  tile: keyof RunCounts & TestOutcome;
  current: number;
  previous: number | undefined;
}) {
  if (previous === undefined) return null;
  const delta = current - previous;
  if (delta === 0) return <div className="mt-0.5 text-xs text-ink-4">no change</div>;
  const improved = tile === 'expected' ? delta > 0 : tile === 'skipped' ? undefined : delta < 0;
  const tone =
    improved === undefined ? 'text-ink-3' : improved ? 'text-passed-text' : 'text-failed-text';
  return (
    <div className={`mt-0.5 text-xs ${tone}`}>
      {delta > 0 ? '+' : ''}
      {delta} vs last run
    </div>
  );
}

export function Dashboard() {
  const { data, isPending } = useManifest();
  const historyQuery = useHistory();
  const layout = useDashboardLayout();
  const [dragging, setDragging] = useState<string | null>(null);
  if (isPending || !data) return <div className="py-16 text-center text-ink-3">Loading…</div>;
  const { manifest, sample } = data;
  const history = historyQuery.data;
  const previousCounts = history?.runs[history.runs.length - 2]?.counts;

  // Config order is the team default; the viewer's saved order/hidden set
  // (localStorage, like the theme) layers on top.
  const configured = (manifest.ui?.cards ?? DEFAULT_DASHBOARD_CARDS).filter(
    (c) => CARD_RENDERERS[c] !== undefined,
  );
  const ordered = applyOrder(configured, layout.order);
  const hidden = layout.hidden.filter((c) => configured.includes(c));
  const visible = ordered.filter((c) => !hidden.includes(c));
  const customized = layout.order.length > 0 || hidden.length > 0;

  const dropOn = (target: string) => {
    if (!dragging || dragging === target) return;
    const next = ordered.filter((c) => c !== dragging);
    next.splice(next.indexOf(target), 0, dragging);
    layout.setOrder(next);
  };

  return (
    <div className="space-y-4">
      {sample && (
        <div className="rounded-lg border border-flaky/40 bg-flaky-tint px-4 py-2 text-sm text-flaky-text">
          Showing sample data — no report data found (dev mode).
        </div>
      )}
      {(manifest.meta.errors ?? []).length > 0 && (
        <div className="rounded-lg border border-failed/40 bg-failed-tint px-4 py-2.5 text-sm text-failed-text">
          <div className="font-semibold">
            {manifest.meta.errors.length === 1
              ? 'Run-level error (global setup/teardown)'
              : `${manifest.meta.errors.length} run-level errors (global setup/teardown)`}
          </div>
          {manifest.meta.errors.slice(0, 3).map((e) => (
            <div key={e.message} className="mt-1 truncate font-mono text-xs">
              {e.message.split('\n')[0]}
            </div>
          ))}
        </div>
      )}
      {window.__BEACON_VARIANT__ === 'failures' && (
        <div className="rounded-lg border border-brand/40 bg-brand-soft px-4 py-2 text-sm text-brand-text">
          Failures-only export — run stats reflect the full run; the test list contains only failing
          and flaky tests.
        </div>
      )}

      <h1 className="sr-only">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TILES.map((tile) => (
          <Card key={tile.key} className="px-[18px] py-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {tile.label}
            </div>
            <div className={`mt-1 font-display text-[34px] font-bold leading-none ${tile.tone}`}>
              {manifest.counts[tile.key]}
            </div>
            <TileDelta
              tile={tile.key}
              current={manifest.counts[tile.key]}
              previous={previousCounts?.[tile.key]}
            />
          </Card>
        ))}
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {layout.customizing ? (
          <>
            <span className="text-xs text-ink-3">Drag cards to reorder · hide with ✕</span>
            {hidden.map((card) => (
              <button
                key={card}
                type="button"
                onClick={() => layout.toggleHidden(card)}
                className="rounded-full border border-dashed border-edge px-3 py-1 text-xs text-ink-3 hover:border-brand hover:text-brand-text"
              >
                + {CARD_LABEL[card] ?? card}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2">
              {customized && (
                <button
                  type="button"
                  onClick={layout.reset}
                  className="text-xs text-ink-3 underline hover:text-brand-text"
                >
                  Reset to default
                </button>
              )}
              <button
                type="button"
                onClick={() => layout.setCustomizing(false)}
                className="rounded-lg bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand-text"
              >
                Done
              </button>
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => layout.setCustomizing(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5 text-xs text-ink-2 hover:text-brand-text"
          >
            <IconSliders size={12} />
            Customize{customized ? ' *' : ''}
          </button>
        )}
      </div>

      {/* Column count derives from available width — fills any screen, no breakpoint tiers.
          auto-rows-[8px] + MasonryCell row spans pack mixed-height cards tightly. */}
      <div className="grid auto-rows-[8px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
        {visible.map((card) => (
          <MasonryCell
            key={card}
            className={`min-w-0 ${
              layout.customizing
                ? `cursor-grab rounded-[15px] ring-1 ring-brand/40 ${dragging === card ? 'opacity-40' : ''}`
                : ''
            }`}
            draggable={layout.customizing}
            onDragStart={(e) => {
              setDragging(card);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (layout.customizing && dragging && dragging !== card) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(card);
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
          >
            {layout.customizing && (
              <div className="flex items-center gap-1.5 rounded-t-[15px] bg-brand-soft px-3 py-1 text-xs text-brand-text">
                <IconGrip size={12} />
                {CARD_LABEL[card] ?? card}
                <button
                  type="button"
                  onClick={() => layout.toggleHidden(card)}
                  aria-label={`Hide ${CARD_LABEL[card] ?? card}`}
                  className="ml-auto rounded p-0.5 hover:bg-brand/20"
                >
                  <IconCross size={11} />
                </button>
              </div>
            )}
            {CARD_RENDERERS[card]?.({ manifest, history })}
          </MasonryCell>
        ))}
        {(manifest.ui?.customCards ?? []).map((card) => (
          <MasonryCell key={card.id} className="min-w-0">
            <Card>
              <div className="text-sm font-semibold">{card.title}</div>
              {card.subtitle && <div className="text-xs text-ink-3">{card.subtitle}</div>}
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-[13px]">
                {card.rows.map((row) => (
                  <div key={row.label} className="contents">
                    <span className="truncate text-ink-2">{row.label}</span>
                    <span className="text-right font-mono text-xs">{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </MasonryCell>
        ))}
      </div>
    </div>
  );
}
