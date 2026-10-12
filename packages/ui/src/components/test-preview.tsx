import type { TestDetail } from '@beacon-report/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { OUTCOME_BADGE, OUTCOME_DOT, OUTCOME_LABEL, formatDuration } from '../lib/format';
import { useTestDetail } from '../lib/hooks';
import { CopyChip } from './copy-chip';
import { IconCross, IconExternal } from './icons';
import { TestHistory } from './test-history';
import { ResultView, RetryTabs } from './test-result-view';

/** Right-hand preview pane on the tests page — the detail view, compact. */
export function TestPreview({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const { detail, isPending, missing } = useTestDetail(caseId);

  return (
    <div className="p-4">
      {isPending && <div className="py-12 text-center text-ink-3">Loading…</div>}
      {!isPending && (missing || !detail) && (
        <div className="py-12 text-center text-ink-3">Test not found in this report.</div>
      )}
      {detail && <PreviewBody key={caseId} detail={detail} onClose={onClose} />}
    </div>
  );
}

function PreviewBody({ detail, onClose }: { detail: TestDetail; onClose: () => void }) {
  const [retry, setRetry] = useState(detail.results.length - 1);
  const selected = Math.min(retry, detail.results.length - 1);
  const result = detail.results[selected];
  const totalDuration = detail.results.reduce((sum, r) => sum + r.duration, 0);

  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${OUTCOME_DOT[detail.outcome]}`}
        />
        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/tests/$caseId"
              params={{ caseId: detail.caseId }}
              className="truncate font-display text-[15px] font-bold text-ink hover:text-brand-text"
            >
              {detail.title}
            </Link>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${OUTCOME_BADGE[detail.outcome]}`}
            >
              {OUTCOME_LABEL[detail.outcome]}
            </span>
            {detail.category && (
              <span className="rounded-full bg-failed-tint px-2 py-0.5 text-[11px] text-failed-text">
                {detail.category}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-3">
            <span>
              {detail.location.file}:{detail.location.line}
            </span>
            <span>{detail.projectName || 'default'}</span>
            <span>{formatDuration(totalDuration)}</span>
            <CopyChip
              label="rerun"
              value={`npx playwright test ${detail.location.file}:${detail.location.line}${detail.projectName ? ` --project=${detail.projectName}` : ''}`}
            />
          </div>
        </div>
        <Link
          to="/tests/$caseId"
          params={{ caseId: detail.caseId }}
          aria-label="Open full view"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-edge text-ink-3 hover:text-brand-text"
        >
          <IconExternal size={13} />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-edge text-ink-3 hover:text-failed-text"
        >
          <IconCross size={13} />
        </button>
      </div>

      <TestHistory detail={detail} />

      <RetryTabs results={detail.results} selected={selected} onSelect={setRetry} />
      {result && <ResultView detail={detail} result={result} compact />}
    </div>
  );
}
