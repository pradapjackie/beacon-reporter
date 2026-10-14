import type { StepNode, TestDetail, TestResultRecord } from '@beacon-report/shared';
import { useState } from 'react';
import { AnsiText, stripAnsi } from '../lib/ansi';
import { formatDuration } from '../lib/format';
import { AttachmentCard } from './attachment-card';
import { CopyChip } from './copy-chip';
import { IconAlert } from './icons';
import { VisualDiffViewer } from './visual-diff';

/**
 * One attempt's full rendering (steps, errors, visual diffs, attachments,
 * console) — shared by the test detail page and the list's preview pane.
 * `compact` stacks the panels vertically for narrow containers.
 */

export function firstLine(text: string): string {
  return text.split('\n')[0] ?? text;
}

export function RetryTabs({
  results,
  selected,
  onSelect,
}: {
  results: TestResultRecord[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (results.length <= 1) return null;
  return (
    <div className="flex gap-0.5 border-b border-edge">
      {results.map((r, i) => (
        <button
          key={r.retry}
          type="button"
          onClick={() => onSelect(i)}
          className={`flex items-center gap-[7px] border-b-2 px-4 py-[9px] text-[13px] ${
            i === selected
              ? 'border-brand font-semibold text-brand-text'
              : 'border-transparent text-ink-3'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              r.status === 'passed'
                ? 'bg-passed'
                : r.status === 'skipped'
                  ? 'bg-skipped'
                  : 'bg-failed'
            }`}
          />
          {i === 0 ? 'Attempt 1' : `Retry ${r.retry}`} · {r.status}
        </button>
      ))}
    </div>
  );
}

export function ResultView({
  detail,
  result,
  compact = false,
}: {
  detail: TestDetail;
  result: TestResultRecord;
  compact?: boolean;
}) {
  // Attachments that belong to a visual-diff triple render in the comparison
  // viewer, not in the generic attachment grid.
  const diffIndexes = new Set(
    result.visualDiffs.flatMap((d) =>
      [d.expected, d.actual, d.diff].filter((v): v is number => v !== undefined),
    ),
  );
  const genericAttachments = result.attachments
    .map((attachment, index) => ({ attachment, index }))
    .filter(({ index }) => !diffIndexes.has(index));

  return (
    <div className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-4 lg:flex-row'}>
      {result.steps.length > 0 && <StepsCard result={result} compact={compact} />}

      <div className="flex min-w-0 grow flex-col gap-4">
        {result.errors.length > 0 && (
          <div className="rounded-[14px] border border-edge bg-card p-[18px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-failed-text">
              <IconAlert size={14} />
              {result.errors.length === 1 ? 'Error' : `Errors (${result.errors.length})`}
              <span className="ml-auto">
                <CopyChip
                  label="Copy error"
                  value={stripAnsi(
                    result.errors.map((e) => e.snippet ?? e.stack ?? e.message).join('\n\n'),
                  )}
                />
              </span>
            </div>
            {result.errors.map((error, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: errors have no stable identity
              <div key={i} className="mt-2.5">
                <div className="font-mono text-xs text-failed-text">
                  <AnsiText text={firstLine(error.message)} surface="light" />
                </div>
                {(error.snippet || error.stack) && (
                  <pre
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions be keyboard-reachable
                    tabIndex={0}
                    className="mt-2.5 overflow-x-auto rounded-[10px] bg-code-bg p-3.5 font-mono text-xs leading-[1.7] text-code-ink"
                  >
                    <AnsiText text={error.snippet ?? error.stack ?? ''} />
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {result.visualDiffs.length > 0 && (
          <div className="rounded-[14px] border border-edge bg-card p-[18px]">
            <div className="text-sm font-semibold">Visual comparison</div>
            <div className="mt-2.5 flex flex-col gap-3">
              {result.visualDiffs.map((diff) => (
                <VisualDiffViewer key={diff.name} diff={diff} attachments={result.attachments} />
              ))}
            </div>
          </div>
        )}

        {genericAttachments.length > 0 && (
          <div className="rounded-[14px] border border-edge bg-card p-[18px]">
            <div className="text-sm font-semibold">Attachments</div>
            <div className="mt-2.5 flex flex-wrap gap-3">
              {genericAttachments.map(({ attachment, index }) => (
                <AttachmentCard key={index} attachment={attachment} />
              ))}
            </div>
          </div>
        )}

        {result.stdio.length > 0 && (
          <div className="rounded-[14px] border border-edge bg-card p-[18px]">
            <div className="text-sm font-semibold">Console output</div>
            <pre
              // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions be keyboard-reachable
              tabIndex={0}
              className="mt-2.5 overflow-x-auto rounded-[10px] bg-code-bg p-3.5 font-mono text-xs leading-[1.7] text-code-ink"
            >
              {result.stdio.map((chunk, i) => {
                const cls = chunk.stream === 'stderr' ? 'text-failed-text' : undefined;
                return chunk.base64 ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stdio chunks are positional
                  <span key={i} className="opacity-60">
                    [binary chunk]
                  </span>
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stdio chunks are positional
                  <span key={i} className={cls}>
                    <AnsiText text={chunk.text} />
                  </span>
                );
              })}
            </pre>
          </div>
        )}

        <div className="text-xs text-ink-4">
          worker {result.parallelIndex >= 0 ? result.parallelIndex : result.workerIndex} · started{' '}
          {new Date(result.startTime).toLocaleTimeString()} · {formatDuration(result.duration)} ·
          timeout {formatDuration(detail.timeout)}
        </div>
      </div>
    </div>
  );
}

function flattenSteps(
  steps: StepNode[],
  depth: number,
  out: Array<{ step: StepNode; depth: number }>,
): Array<{ step: StepNode; depth: number }> {
  for (const step of steps) {
    out.push({ step, depth });
    flattenSteps(step.steps, depth + 1, out);
  }
  return out;
}

function StepsCard({ result, compact }: { result: TestResultRecord; compact: boolean }) {
  const [view, setView] = useState<'tree' | 'waterfall'>('tree');
  const flat = flattenSteps(result.steps, 0, []);
  const start = result.startTime;
  const total = Math.max(
    result.duration,
    ...flat.map(({ step }) => step.startTime - start + step.duration),
    1,
  );
  return (
    <div
      className={`rounded-[14px] border border-edge bg-card p-3.5 ${
        compact ? '' : 'lg:w-[460px] lg:shrink-0 lg:self-start'
      }`}
    >
      <div className="flex items-center px-1.5 pb-2">
        <span className="text-sm font-semibold">Steps</span>
        <span className="ml-auto flex gap-0.5 rounded-lg border border-edge p-0.5">
          {(['tree', 'waterfall'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-2 py-0.5 text-[11px] capitalize ${
                view === v ? 'bg-brand-soft font-semibold text-brand-text' : 'text-ink-3'
              }`}
            >
              {v}
            </button>
          ))}
        </span>
      </div>
      {view === 'tree' &&
        result.steps.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
          <StepRow key={i} step={step} depth={0} />
        ))}
      {view === 'waterfall' && (
        <div className="flex flex-col gap-1">
          {flat.map(({ step, depth }, i) => {
            const left = Math.max(0, ((step.startTime - start) / total) * 100);
            const width = Math.max(1.5, (step.duration / total) * 100);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`w-36 shrink-0 truncate ${step.error ? 'text-failed-text' : 'text-ink-2'}`}
                  style={{ paddingLeft: `${depth * 10}px` }}
                  title={step.title}
                >
                  {step.title}
                </span>
                <span className="relative h-3.5 grow rounded-[3px] bg-edge-2">
                  <span
                    className="absolute inset-y-0 rounded-[3px]"
                    style={{
                      left: `${Math.min(left, 98)}%`,
                      width: `${Math.min(width, 100 - Math.min(left, 98))}%`,
                      background: step.error ? 'var(--failed)' : 'var(--brand)',
                    }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] text-ink-4">
                  {formatDuration(step.duration)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** BDD flavor: bolds Given/When/Then/And/But prefixes (playwright-bdd steps). */
const GHERKIN = /^(Given|When|Then|And|But)\s+/;
function GherkinTitle({ title }: { title: string }) {
  const match = GHERKIN.exec(title);
  if (!match) return <>{title}</>;
  return (
    <>
      <span className="font-semibold text-brand-text">{match[1]}</span>{' '}
      {title.slice(match[0].length)}
    </>
  );
}

const CATEGORY_CHIP: Record<string, string> = {
  'test.step': 'bg-brand-soft text-brand-text',
};

export function StepRow({ step, depth }: { step: StepNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = step.steps.length > 0;
  const failed = step.error !== undefined;
  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] ${
          failed ? 'bg-failed-tint text-failed-text' : 'text-ink-2 hover:bg-card-2'
        }`}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <span className="w-3 text-[10px] text-ink-4">{hasChildren ? (open ? '▾' : '▸') : ''}</span>
        <span
          className={`rounded-[5px] px-1.5 py-px font-mono text-[10px] ${
            failed ? 'bg-failed/15' : (CATEGORY_CHIP[step.category] ?? 'bg-edge-2 text-ink-3')
          }`}
        >
          {step.category}
        </span>
        <span className={`min-w-0 grow truncate ${failed ? 'font-medium' : ''}`}>
          <GherkinTitle title={step.title} />
        </span>
        <span className={`font-mono text-[11px] ${failed ? 'opacity-90' : 'text-ink-4'}`}>
          {formatDuration(step.duration)}
        </span>
      </button>
      {step.error && (
        <div
          // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions be keyboard-reachable
          tabIndex={0}
          className="mx-2 my-1 overflow-x-auto rounded-[7px] bg-failed-tint px-2.5 py-2 font-mono text-[11px] text-failed-text"
          style={{ marginLeft: `${depth * 1.25 + 1.75}rem` }}
        >
          <AnsiText text={firstLine(step.error.message)} surface="light" />
        </div>
      )}
      {open &&
        step.steps.map((child, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
          <StepRow key={i} step={child} depth={depth + 1} />
        ))}
    </div>
  );
}
