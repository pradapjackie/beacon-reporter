import type { Manifest, TestDetail } from '@beacon-report/shared';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { AttemptDiff } from '../components/attempt-diff';
import { CopyChip } from '../components/copy-chip';
import { IconBack, IconExternal } from '../components/icons';
import { TestHistory } from '../components/test-history';
import { ResultView, RetryTabs } from '../components/test-result-view';
import { stripAnsi } from '../lib/ansi';
import { OUTCOME_BADGE, OUTCOME_DOT, OUTCOME_LABEL, formatDuration } from '../lib/format';
import { useManifest, useRows, useTestDetail } from '../lib/hooks';

export function TestDetailPage() {
  const { caseId } = useParams({ from: '/tests/$caseId' });
  const { detail, isPending, missing } = useTestDetail(caseId);
  const manifest = useManifest();
  const rows = useRows(manifest.data);
  const [retry, setRetry] = useState(0);
  const at = rows.data?.findIndex((r) => r.caseId === caseId) ?? -1;
  const prev = at > 0 ? rows.data?.[at - 1] : undefined;
  const next = at >= 0 ? rows.data?.[at + 1] : undefined;
  const linkTemplates = manifest.data?.manifest.ui?.links ?? {};
  const rootDir = manifest.data?.manifest.ui?.editorLinks
    ? manifest.data?.manifest.meta.rootDir
    : undefined;

  if (isPending) return <div className="py-16 text-center text-ink-3">Loading…</div>;
  if (missing || !detail) {
    return (
      <div className="rounded-[14px] border border-dashed border-edge p-10 text-center text-ink-3">
        Test <code className="font-mono">{caseId}</code> not found in this report.{' '}
        <Link to="/tests" className="text-brand-text underline">
          Back to tests
        </Link>
      </div>
    );
  }

  const selected = Math.min(retry, detail.results.length - 1);
  const result = detail.results[selected];
  const totalDuration = detail.results.reduce((sum, r) => sum + r.duration, 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <Link
            to="/tests"
            className="inline-flex items-center gap-1.5 text-[13px] text-brand-text"
          >
            <IconBack size={12} />
            Tests
          </Link>
          <span className="ml-auto flex items-center gap-1.5 text-[12px]">
            {prev && (
              <Link
                to="/tests/$caseId"
                params={{ caseId: prev.caseId }}
                className="rounded-lg border border-edge px-2.5 py-1 text-ink-2 hover:text-brand-text"
                title={prev.title}
              >
                ← prev
              </Link>
            )}
            {next && (
              <Link
                to="/tests/$caseId"
                params={{ caseId: next.caseId }}
                className="rounded-lg border border-edge px-2.5 py-1 text-ink-2 hover:text-brand-text"
                title={next.title}
              >
                next →
              </Link>
            )}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${OUTCOME_DOT[detail.outcome]}`} />
          <h1 className="font-display text-[22px] font-bold">{detail.title}</h1>
          <span
            className={`rounded-full px-2.5 py-[3px] text-xs font-semibold ${OUTCOME_BADGE[detail.outcome]}`}
          >
            {OUTCOME_LABEL[detail.outcome]}
          </span>
          {detail.category && (
            <span className="rounded-full bg-failed-tint px-2 py-0.5 text-[11px] text-failed-text">
              {detail.category}
            </span>
          )}
          {detail.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-edge-2 px-2 py-0.5 text-[11px] text-ink-2">
              {tag}
            </span>
          ))}
          {detail.annotations
            .filter((a) => a.type !== 'description' && !detail.tags.includes(`@${a.type}`))
            .map((a) => {
              const template = a.description ? linkTemplates[a.type] : undefined;
              if (template) {
                return (
                  <a
                    key={`${a.type}:${a.description ?? ''}`}
                    href={template.replace('{}', encodeURIComponent(a.description ?? ''))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-text hover:underline"
                  >
                    {a.type}: {a.description}
                    <IconExternal size={9} />
                  </a>
                );
              }
              return (
                <span
                  key={`${a.type}:${a.description ?? ''}`}
                  title={a.description}
                  className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand-text"
                >
                  {a.type}
                </span>
              );
            })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-4 font-mono text-xs text-ink-3">
          <span>
            {detail.location.file}:{detail.location.line}
          </span>
          {rootDir && (
            <a
              href={`vscode://file/${rootDir}/${detail.location.file}:${detail.location.line}`}
              className="text-brand-text hover:underline"
              title="Open in VS Code"
            >
              open in editor
            </a>
          )}
          <span>{detail.projectName || 'default'}</span>
          <span>
            {detail.results.length} {detail.results.length === 1 ? 'attempt' : 'attempts'} ·{' '}
            {formatDuration(totalDuration)} total
          </span>
          <span>timeout {formatDuration(detail.timeout)}</span>
          {result && (
            <span>
              worker {result.parallelIndex >= 0 ? result.parallelIndex : result.workerIndex}
            </span>
          )}
          {detail.shard !== undefined && <span>shard {detail.shard}</span>}
          <CopyChip
            label="Copy rerun command"
            value={`npx playwright test ${detail.location.file}:${detail.location.line}${detail.projectName ? ` --project=${detail.projectName}` : ''}`}
          />
          <CopyChip
            label="Copy bug report"
            value={bugReportMarkdown(detail, manifest.data?.manifest)}
          />
        </div>
        {(detail.metrics || detail.budgetMs !== undefined) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {Object.entries(detail.metrics ?? {}).map(([name, value]) => (
              <span
                key={name}
                className="rounded-full bg-edge-2 px-2 py-0.5 font-mono text-[11px] text-ink-2"
              >
                {name}: {value}
              </span>
            ))}
            {detail.budgetMs !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  totalDuration > detail.budgetMs
                    ? 'bg-failed-tint text-failed-text'
                    : 'bg-passed-tint text-passed-text'
                }`}
              >
                budget {formatDuration(detail.budgetMs)} ·{' '}
                {totalDuration > detail.budgetMs ? 'over' : 'ok'}
              </span>
            )}
          </div>
        )}
        {detail.annotations.find((a) => a.type === 'description')?.description && (
          <p className="mt-2 max-w-3xl whitespace-pre-line text-[13px] text-ink-2">
            {detail.annotations.find((a) => a.type === 'description')?.description}
          </p>
        )}
        <div className="mt-2">
          <TestHistory detail={detail} />
        </div>
      </div>

      <RetryTabs results={detail.results} selected={selected} onSelect={setRetry} />

      {result && <ResultView detail={detail} result={result} />}

      {detail.results.length > 1 && <AttemptDiff results={detail.results} />}

      {detail.source && <SourceCard source={detail.source} />}
    </div>
  );
}

/** Source snippet embedded by the reporter — spec code, or the BDD scenario. */
function SourceCard({ source }: { source: NonNullable<TestDetail['source']> }) {
  return (
    <div className="rounded-[14px] border border-edge bg-card">
      <div className="flex items-baseline gap-2.5 border-b border-edge-2 px-5 py-3">
        <span className="text-sm font-semibold">Source</span>
        <span className="font-mono text-[11px] text-ink-3">{source.file}</span>
        {source.language === 'feature' && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-text">
            Gherkin
          </span>
        )}
      </div>
      <div
        // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions be keyboard-reachable
        tabIndex={0}
        className="overflow-x-auto px-3 py-3"
      >
        <pre className="text-[12.5px] leading-[1.65]">
          {source.lines.map((line, i) => {
            const lineNo = source.startLine + i;
            const highlighted = lineNo === source.highlightLine;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static snippet lines never reorder
                key={i}
                className={`flex ${highlighted ? 'bg-failed-tint' : ''}`}
              >
                <span className="w-11 shrink-0 select-none pr-3 text-right font-mono text-ink-4">
                  {lineNo}
                </span>
                <code className="whitespace-pre font-mono text-ink-2">{line || ' '}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

/** Ready-to-paste Markdown for any issue tracker — no integration required. */
function bugReportMarkdown(detail: TestDetail, manifest: Manifest | undefined): string {
  const error = detail.results.at(-1)?.errors[0];
  const env = Object.entries(manifest?.environment ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const rerun = `npx playwright test ${detail.location.file}:${detail.location.line}${detail.projectName ? ` --project=${detail.projectName}` : ''}`;
  return [
    `## ${detail.title}`,
    '',
    `- Outcome: ${detail.outcome}`,
    `- Project: ${detail.projectName || 'default'}`,
    `- Location: \`${detail.location.file}:${detail.location.line}\``,
    detail.category ? `- Category: ${detail.category}` : '',
    manifest?.meta.playwrightVersion ? `- Playwright: ${manifest.meta.playwrightVersion}` : '',
    '',
    error ? `### Error\n\n\`\`\`\n${stripAnsi(error.message)}\n\`\`\`` : '',
    error?.snippet ? `\`\`\`\n${stripAnsi(error.snippet)}\n\`\`\`` : '',
    `### Rerun\n\n\`\`\`sh\n${rerun}\n\`\`\``,
    env ? `### Environment\n\n${env}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
