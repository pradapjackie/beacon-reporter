import { Link } from '@tanstack/react-router';
import { CopyChip } from '../components/copy-chip';
import { useManifest } from '../lib/hooks';

/**
 * Flakiness board: per-test recency-weighted (EWMA) flakiness across retained
 * history runs, computed at generate time. High scorers come with a ready
 * quarantine command mirroring `beacon quarantine`.
 */
export function FlakyPage() {
  const manifest = useManifest();
  const entries = manifest.data?.manifest.aggregates.flakiness ?? [];
  const quarantine = entries.filter((e) => e.score >= 40);
  const titles = [
    ...new Set(quarantine.map((e) => e.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
  ];
  const grepInvert =
    titles.length === 0 ? '' : titles.length === 1 ? `^${titles[0]}$` : `^(?:${titles.join('|')})$`;

  if (manifest.isPending) {
    return <div className="py-16 text-center text-sm text-ink-3">Loading…</div>;
  }
  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] border border-edge bg-card px-8 py-14 text-center">
        <div className="text-sm font-semibold">No flakiness detected</div>
        <p className="mt-2 text-[13px] text-ink-3">
          Nothing flaked or flipped pass↔fail across the retained history window. Keep the{' '}
          <span className="font-mono">.beacon-history</span> directory between runs so this board
          has runs to learn from.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Flaky tests</h1>
        <span className="text-[13px] text-ink-3">
          recency-weighted score from flaky outcomes and pass↔fail flips across retained runs
        </span>
        {quarantine.length > 0 && (
          <span className="ml-auto">
            <CopyChip
              label={`Copy quarantine flag (${quarantine.length})`}
              value={`npx playwright test --grep-invert "${grepInvert}"`}
            />
          </span>
        )}
      </div>

      <div
        // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions be keyboard-reachable
        tabIndex={0}
        className="overflow-x-auto rounded-[14px] border border-edge bg-card"
      >
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-edge-2 text-left text-[11px] uppercase tracking-wide text-ink-3">
              <th className="px-5 py-3 font-semibold">Test</th>
              <th className="px-3 py-3 font-semibold">Project</th>
              <th className="w-56 px-3 py-3 font-semibold">Score</th>
              <th className="px-3 py-3 text-right font-semibold">Flaky</th>
              <th className="px-3 py-3 text-right font-semibold">Failed</th>
              <th className="px-5 py-3 text-right font-semibold">Runs</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.caseId}
                className="border-b border-edge-2 last:border-0 hover:bg-card-2"
              >
                <td className="px-5 py-2.5">
                  <Link
                    to="/tests/$caseId"
                    params={{ caseId: entry.caseId }}
                    className="hover:text-brand-text"
                  >
                    {entry.title}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-ink-3">
                  {entry.projectName || 'default'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 grow rounded-full bg-edge-2">
                      <div
                        className={`h-1.5 rounded-full ${entry.score >= 40 ? 'bg-flaky' : 'bg-skipped'}`}
                        style={{ width: `${Math.min(100, entry.score)}%` }}
                      />
                    </div>
                    <span className="w-7 text-right font-mono text-[12px] text-ink-2">
                      {entry.score}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-flaky-text">
                  {entry.flakyRuns}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-failed-text">
                  {entry.failedRuns}
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-[12px] text-ink-3">
                  {entry.runs}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-ink-4">
        Score ≥40 marks a quarantine candidate. `beacon quarantine` prints the same list from the
        CLI, with `--fixme` suggestions.
      </p>
    </div>
  );
}
