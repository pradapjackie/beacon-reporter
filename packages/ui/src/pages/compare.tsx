import { type CompareBaseline, TEST_OUTCOMES } from '@beacon-report/shared';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { MasonryCell } from '../components/masonry';
import { formatDateTime, formatDuration } from '../lib/format';
import { type TestRow, useCompare, useManifest, useRows } from '../lib/hooks';

/**
 * Run-over-run diff: the current run against any retained history baseline.
 * All diffs are precomputed at generate time (data/compare.js) — this page
 * only renders and resolves caseIds to titles via the index rows.
 */
export function ComparePage() {
  const manifest = useManifest();
  const rows = useRows(manifest.data);
  const compare = useCompare();
  const search = useSearch({ from: '/compare' });
  const navigate = useNavigate({ from: '/compare' });

  const baselines = compare.data?.baselines ?? [];
  const baseline: CompareBaseline | undefined =
    baselines.find((b) => b.runId === search.base) ?? baselines[baselines.length - 1];

  const rowOf = useMemo(() => {
    const map = new Map<string, TestRow>();
    for (const row of rows.data ?? []) map.set(row.caseId, row);
    return map;
  }, [rows.data]);

  if (compare.isPending || manifest.isPending) {
    return <div className="py-16 text-center text-sm text-ink-3">Loading…</div>;
  }
  if (!baseline) {
    return (
      <div className="flex flex-col gap-5">
        <div className="mx-auto max-w-lg rounded-[14px] border border-edge bg-card px-8 py-14 text-center">
          <div className="text-sm font-semibold">No history baselines yet</div>
          <p className="mt-2 text-[13px] text-ink-3">
            Keep the <span className="font-mono">.beacon-history</span> directory between runs and
            this page diffs the current run against any retained baseline — or compare against
            another report folder below.
          </p>
        </div>
        <ExternalCompare rowOf={rowOf} />
      </div>
    );
  }

  const counts = manifest.data?.manifest.counts;
  const tiles: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Regressed', value: baseline.regressed.length, tone: 'text-failed-text' },
    { label: 'Fixed', value: baseline.fixed.length, tone: 'text-passed-text' },
    { label: 'New tests', value: baseline.added.length, tone: 'text-ink' },
    { label: 'Removed', value: baseline.removed.length, tone: 'text-ink-3' },
    { label: 'Slower', value: baseline.slower.length, tone: 'text-flaky-text' },
    { label: 'Faster', value: baseline.faster.length, tone: 'text-passed-text' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Compare</h1>
        <span className="text-[13px] text-ink-3">current run vs</span>
        <select
          aria-label="Baseline run"
          value={baseline.runId}
          onChange={(e) => navigate({ search: { base: e.target.value }, replace: true })}
          className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-[13px] text-ink"
        >
          {[...baselines].reverse().map((b, i) => (
            <option key={b.runId} value={b.runId}>
              {formatDateTime(b.startTime)}
              {i === 0 ? ' (previous run)' : ''}
            </option>
          ))}
        </select>
        {counts && (
          <span className="ml-auto text-[13px] text-ink-3">
            {baseline.counts.total} tests then · {counts.total} now
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[14px] border border-edge bg-card px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {tile.label}
            </div>
            <div className={`mt-1 font-display text-3xl font-bold ${tile.tone}`}>{tile.value}</div>
          </div>
        ))}
      </div>

      <div className="grid auto-rows-[8px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
        <MasonryCell>
          <CaseList title="Regressed" tone="failed" caseIds={baseline.regressed} rowOf={rowOf} />
        </MasonryCell>
        <MasonryCell>
          <CaseList title="Fixed" tone="passed" caseIds={baseline.fixed} rowOf={rowOf} />
        </MasonryCell>
        <MasonryCell>
          <CaseList title="New tests" tone="ink" caseIds={baseline.added} rowOf={rowOf} />
        </MasonryCell>
        <MasonryCell>
          <DeltaList title="Slower" entries={baseline.slower} rowOf={rowOf} slower />
        </MasonryCell>
        <MasonryCell>
          <DeltaList title="Faster" entries={baseline.faster} rowOf={rowOf} />
        </MasonryCell>
        {baseline.removed.length > 0 && (
          <MasonryCell>
            <div className="rounded-[14px] border border-edge bg-card p-5">
              <div className="text-sm font-semibold">Removed</div>
              <div className="text-xs text-ink-3">in the baseline, not in this run</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {baseline.removed.slice(0, 40).map((caseId) => (
                  <span
                    key={caseId}
                    className="rounded-full bg-edge-2 px-2 py-0.5 font-mono text-[11px] text-ink-3"
                    title="Removed tests keep only their stable id"
                  >
                    {caseId.slice(0, 10)}
                  </span>
                ))}
                {baseline.removed.length > 40 && (
                  <span className="text-[11px] text-ink-3">
                    +{baseline.removed.length - 40} more
                  </span>
                )}
              </div>
            </div>
          </MasonryCell>
        )}
      </div>

      <ExternalCompare rowOf={rowOf} />
    </div>
  );
}

/**
 * Cross-report compare: pick ANY other Beacon report folder (e.g. a run from
 * another branch) and diff it against this one — parsed entirely client-side
 * from the folder's data chunks, so it works without a server.
 */
function ExternalCompare({ rowOf }: { rowOf: Map<string, TestRow> }) {
  const [external, setExternal] = useState<{
    label: string;
    rows: Map<string, { title: string; outcome: string; duration: number }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseChunk = (text: string): unknown =>
    JSON.parse(text.slice(text.indexOf(', ') + 2, text.lastIndexOf(');')));

  const onPick = async (files: FileList | null) => {
    setError(null);
    setExternal(null);
    if (!files || files.length === 0) return;
    try {
      const byName = [...files];
      const manifestFile = byName.find((f) => f.webkitRelativePath.endsWith('data/manifest.js'));
      const indexFiles = byName.filter((f) =>
        /data\/index\/chunk-\d+\.js$/.test(f.webkitRelativePath),
      );
      if (!manifestFile || indexFiles.length === 0) {
        setError('That folder has no data/manifest.js — pick a Beacon report folder.');
        return;
      }
      const manifest = parseChunk(await manifestFile.text()) as {
        ui?: { title?: string };
        meta: { startTime: number };
      };
      const rows = new Map<string, { title: string; outcome: string; duration: number }>();
      for (const file of indexFiles) {
        const chunk = parseChunk(await file.text()) as {
          caseIds: string[];
          titles: string[];
          outcome: number[];
          duration: number[];
        };
        chunk.caseIds.forEach((caseId, i) => {
          rows.set(caseId, {
            title: chunk.titles[i] ?? caseId,
            outcome: TEST_OUTCOMES[chunk.outcome[i] ?? 0] ?? 'expected',
            duration: chunk.duration[i] ?? 0,
          });
        });
      }
      setExternal({
        label: `${manifest.ui?.title ?? 'External report'} · ${formatDateTime(manifest.meta.startTime)} · ${rows.size} tests`,
        rows,
      });
    } catch (err) {
      setError(`Could not read that report: ${err instanceof Error ? err.message : err}`);
    }
  };

  const diff = useMemo(() => {
    if (!external) return null;
    const regressed: string[] = [];
    const fixed: string[] = [];
    const added: string[] = [];
    const removed: Array<{ caseId: string; title: string }> = [];
    const slower: Array<{ caseId: string; from: number; to: number }> = [];
    const faster: Array<{ caseId: string; from: number; to: number }> = [];
    for (const [caseId, row] of rowOf) {
      const other = external.rows.get(caseId);
      if (!other) {
        added.push(caseId);
        continue;
      }
      const wasFailing = other.outcome === 'unexpected';
      const isFailing = row.outcome === 'unexpected';
      if (!wasFailing && isFailing) regressed.push(caseId);
      else if (wasFailing && !isFailing && row.outcome !== 'skipped') fixed.push(caseId);
      if (other.duration > 0 && row.duration > 0) {
        if (row.duration >= other.duration * 1.25 && row.duration - other.duration >= 50) {
          slower.push({ caseId, from: other.duration, to: row.duration });
        } else if (row.duration <= other.duration * 0.8 && other.duration - row.duration >= 50) {
          faster.push({ caseId, from: other.duration, to: row.duration });
        }
      }
    }
    for (const [caseId, row] of external.rows) {
      if (!rowOf.has(caseId)) removed.push({ caseId, title: row.title });
    }
    slower.sort((a, b) => b.to - b.from - (a.to - a.from));
    faster.sort((a, b) => b.from - b.to - (a.from - a.to));
    return { regressed, fixed, added, removed, slower, faster };
  }, [external, rowOf]);

  return (
    <div className="rounded-[14px] border border-dashed border-edge bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold">Compare with another report</div>
          <div className="text-xs text-ink-3">
            pick any Beacon report folder (another branch, another machine) — read locally, nothing
            uploaded
          </div>
        </div>
        <label className="ml-auto cursor-pointer rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand-text hover:bg-brand-soft">
          Choose report folder…
          <input
            type="file"
            className="hidden"
            onChange={(e) => void onPick(e.target.files)}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-[13px] text-failed-text">{error}</p>}
      {external && diff && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="text-[13px] text-ink-2">
            vs <span className="font-medium">{external.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6 text-center">
            {(
              [
                ['Regressed', diff.regressed.length, 'text-failed-text'],
                ['Fixed', diff.fixed.length, 'text-passed-text'],
                ['New', diff.added.length, 'text-ink'],
                ['Removed', diff.removed.length, 'text-ink-3'],
                ['Slower', diff.slower.length, 'text-flaky-text'],
                ['Faster', diff.faster.length, 'text-passed-text'],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="rounded-[10px] border border-edge px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                  {label}
                </div>
                <div className={`font-display text-xl font-bold ${tone}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className="grid auto-rows-[8px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
            <MasonryCell>
              <CaseList title="Regressed" tone="failed" caseIds={diff.regressed} rowOf={rowOf} />
            </MasonryCell>
            <MasonryCell>
              <CaseList title="Fixed" tone="passed" caseIds={diff.fixed} rowOf={rowOf} />
            </MasonryCell>
            <MasonryCell>
              <DeltaList title="Slower" entries={diff.slower} rowOf={rowOf} slower />
            </MasonryCell>
            <MasonryCell>
              <DeltaList title="Faster" entries={diff.faster} rowOf={rowOf} />
            </MasonryCell>
          </div>
        </div>
      )}
    </div>
  );
}

const TONE_DOT: Record<string, string> = {
  failed: 'bg-failed',
  passed: 'bg-passed',
  ink: 'bg-skipped',
};

function CaseList({
  title,
  tone,
  caseIds,
  rowOf,
}: {
  title: string;
  tone: string;
  caseIds: string[];
  rowOf: Map<string, TestRow>;
}) {
  return (
    <div className="rounded-[14px] border border-edge bg-card p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-ink-3">{caseIds.length} tests</div>
      <div className="mt-3 flex flex-col gap-1">
        {caseIds.length === 0 && <div className="text-[13px] text-ink-3">None.</div>}
        {caseIds.slice(0, 12).map((caseId) => {
          const row = rowOf.get(caseId);
          return (
            <Link
              key={caseId}
              to="/tests/$caseId"
              params={{ caseId }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-card-2"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
              <span className="truncate">{row?.title ?? caseId}</span>
              {row?.project && (
                <span className="ml-auto font-mono text-[11px] text-ink-4">{row.project}</span>
              )}
            </Link>
          );
        })}
        {caseIds.length > 12 && (
          <div className="px-2 text-[11px] text-ink-3">+{caseIds.length - 12} more</div>
        )}
      </div>
    </div>
  );
}

function DeltaList({
  title,
  entries,
  rowOf,
  slower,
}: {
  title: string;
  entries: Array<{ caseId: string; from: number; to: number }>;
  rowOf: Map<string, TestRow>;
  slower?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-edge bg-card p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-ink-3">
        {slower ? '≥1.25× and ≥50ms over the baseline' : '≤0.8× of the baseline'}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {entries.length === 0 && <div className="text-[13px] text-ink-3">None.</div>}
        {entries.slice(0, 12).map((entry) => {
          const row = rowOf.get(entry.caseId);
          return (
            <Link
              key={entry.caseId}
              to="/tests/$caseId"
              params={{ caseId: entry.caseId }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-card-2"
            >
              <span className="truncate">{row?.title ?? entry.caseId}</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3">
                {formatDuration(entry.from)} →{' '}
                <span className={slower ? 'text-flaky-text' : 'text-passed-text'}>
                  {formatDuration(entry.to)}
                </span>
              </span>
            </Link>
          );
        })}
        {entries.length > 12 && (
          <div className="px-2 text-[11px] text-ink-3">+{entries.length - 12} more</div>
        )}
      </div>
    </div>
  );
}
