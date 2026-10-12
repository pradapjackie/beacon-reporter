import type { AttachmentRef, TestDetail, TestOutcome } from '@beacon-report/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { CopyChip } from '../components/copy-chip';
import { IconChevronDown, IconSearch } from '../components/icons';
import { attachmentHref } from '../lib/attachments';
import { loadChunk } from '../lib/beacon-data';
import { OUTCOME_DOT, OUTCOME_LABEL } from '../lib/format';
import { useManifest } from '../lib/hooks';

/** Every image attachment in the run, as a filterable grid. */

const CHUNK_CAP = 20;
const OUTCOME_FILTERS: TestOutcome[] = ['expected', 'unexpected', 'flaky', 'skipped'];

interface GalleryItem {
  href: string;
  name: string;
  caseId: string;
  title: string;
  projectName: string;
  outcome: TestOutcome;
}

/** One toHaveScreenshot baseline: expected/actual/diff triple + rerun info. */
interface VisualItem {
  name: string;
  caseId: string;
  title: string;
  projectName: string;
  outcome: TestOutcome;
  file: string;
  line: number;
  expected?: string;
  actual?: string;
  diff?: string;
}

export function GalleryPage() {
  const manifest = useManifest();
  const search = useSearch({ from: '/gallery' });
  const navigate = useNavigate({ from: '/gallery' });
  const chunkCount = manifest.data?.manifest.chunks.details ?? 0;
  const capped = chunkCount > CHUNK_CAP;

  const gallery = useQuery({
    queryKey: ['gallery'],
    enabled: chunkCount > 0,
    queryFn: async (): Promise<{ images: GalleryItem[]; visuals: VisualItem[] }> => {
      const images: GalleryItem[] = [];
      const visuals: VisualItem[] = [];
      for (let i = 0; i < Math.min(chunkCount, CHUNK_CAP); i++) {
        const details = await loadChunk<TestDetail[]>(`details/chunk-${i}`);
        for (const detail of details) {
          for (const result of detail.results) {
            const attachments = result.attachments as AttachmentRef[];
            for (const attachment of attachments) {
              const href = attachmentHref(attachment);
              if (!href || !attachment.contentType.startsWith('image/')) continue;
              images.push({
                href,
                name: attachment.name,
                caseId: detail.caseId,
                title: detail.title,
                projectName: detail.projectName,
                outcome: detail.outcome,
              });
            }
            for (const visualDiff of result.visualDiffs ?? []) {
              const hrefOf = (index: number | undefined) =>
                index === undefined
                  ? undefined
                  : attachmentHref(attachments[index] as AttachmentRef);
              visuals.push({
                name: visualDiff.name,
                caseId: detail.caseId,
                title: detail.title,
                projectName: detail.projectName,
                outcome: detail.outcome,
                file: detail.location.file,
                line: detail.location.line,
                expected: hrefOf(visualDiff.expected),
                actual: hrefOf(visualDiff.actual),
                diff: hrefOf(visualDiff.diff),
              });
            }
          }
        }
      }
      return { images, visuals };
    },
  });

  const [mode, setMode] = useState<'media' | 'visual'>('media');
  const all = gallery.data?.images ?? [];
  const visuals = gallery.data?.visuals ?? [];
  const activeOutcomes = useMemo(
    () => new Set((search.outcome ?? '').split(',').filter(Boolean) as TestOutcome[]),
    [search.outcome],
  );

  const outcomeCounts = useMemo(() => {
    const counts: Record<TestOutcome, number> = {
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    };
    for (const item of all) counts[item.outcome] += 1;
    return counts;
  }, [all]);

  const items = useMemo(() => {
    const q = (search.q ?? '').trim().toLowerCase();
    return all.filter((item) => {
      if (activeOutcomes.size > 0 && !activeOutcomes.has(item.outcome)) return false;
      if (search.project && item.projectName !== search.project) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    });
  }, [all, search.q, search.project, activeOutcomes]);

  const toggleOutcome = (outcome: TestOutcome) => {
    const next = new Set(activeOutcomes);
    next.has(outcome) ? next.delete(outcome) : next.add(outcome);
    navigate({ search: (prev) => ({ ...prev, outcome: [...next].join(',') }) });
  };

  if (manifest.isPending || gallery.isPending) {
    return <div className="py-16 text-center text-ink-3">Loading…</div>;
  }
  if (all.length === 0 && visuals.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-edge p-10 text-center text-ink-3">
        No image attachments in this report.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-end gap-4">
        <div>
          <h1 className="font-display text-lg font-bold">Media</h1>
          <p className="text-xs text-ink-3">
            {mode === 'media'
              ? `${items.length} of ${all.length} images`
              : `${visuals.length} screenshot ${visuals.length === 1 ? 'baseline' : 'baselines'}`}
            {capped ? ` · first ${CHUNK_CAP} chunks scanned` : ''}
          </p>
        </div>
        <span className="ml-auto flex gap-0.5 rounded-lg border border-edge p-0.5">
          {(['media', 'visual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-[12px] ${
                mode === m ? 'bg-brand-soft font-semibold text-brand-text' : 'text-ink-3'
              }`}
            >
              {m === 'media' ? 'All media' : `Visual baselines (${visuals.length})`}
            </button>
          ))}
        </span>
      </div>

      {mode === 'visual' ? (
        <VisualHub visuals={visuals} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative block">
              <IconSearch size={14} className="absolute left-3 top-[11px] text-ink-3" />
              <span className="sr-only">Search images</span>
              <input
                type="text"
                data-search
                value={search.q ?? ''}
                onChange={(e) =>
                  navigate({ search: (prev) => ({ ...prev, q: e.target.value }), replace: true })
                }
                placeholder="Search test or attachment name…"
                className="h-9 w-72 rounded-[10px] border border-edge bg-card pl-[34px] pr-3 text-[13px] text-ink outline-none placeholder:text-ink-4 focus:border-brand"
              />
            </label>
            {OUTCOME_FILTERS.map((outcome) => {
              const active = activeOutcomes.has(outcome);
              return (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => toggleOutcome(outcome)}
                  className={`flex h-9 items-center gap-[7px] rounded-full border px-3.5 text-[13px] transition-colors ${
                    active
                      ? 'border-brand bg-brand-soft font-semibold text-brand-text'
                      : 'border-edge bg-card text-ink-2'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${OUTCOME_DOT[outcome]}`} />
                  {OUTCOME_LABEL[outcome]}
                  <span className={active ? 'opacity-70' : 'text-ink-3'}>
                    {outcomeCounts[outcome]}
                  </span>
                </button>
              );
            })}
            <label className="relative block">
              <span className="sr-only">Filter by project</span>
              <select
                value={search.project ?? ''}
                onChange={(e) =>
                  navigate({ search: (prev) => ({ ...prev, project: e.target.value }) })
                }
                className="h-9 appearance-none rounded-[10px] border border-edge bg-card pl-3 pr-8 text-[13px] text-ink-2 outline-none focus:border-brand"
              >
                <option value="">All projects</option>
                {manifest.data?.manifest.projects.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name || 'default'}
                  </option>
                ))}
              </select>
              <IconChevronDown
                size={11}
                className="pointer-events-none absolute right-3 top-[13px] text-ink-3"
              />
            </label>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-edge p-10 text-center text-ink-3">
              No images match the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-4">
              {items.map((item, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: attachments can repeat by sha
                  key={i}
                  className="overflow-hidden rounded-[12px] border border-edge bg-card"
                >
                  <a href={item.href} target="_blank" rel="noreferrer">
                    <img
                      src={item.href}
                      alt={item.name}
                      loading="lazy"
                      className="h-40 w-full bg-edge-2 object-contain"
                    />
                  </a>
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${OUTCOME_DOT[item.outcome]}`}
                      />
                      <Link
                        to="/tests/$caseId"
                        params={{ caseId: item.caseId }}
                        className="block truncate text-[13px] font-medium text-ink hover:text-brand-text"
                      >
                        {item.title}
                      </Link>
                    </div>
                    <div className="truncate font-mono text-[11px] text-ink-3">
                      {item.name} · {item.projectName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Visual regression hub: every toHaveScreenshot baseline with its latest
 * expected/actual/diff, plus a copyable --update-snapshots rerun per test.
 */
function VisualHub({ visuals }: { visuals: VisualItem[] }) {
  if (visuals.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-edge p-10 text-center text-ink-3">
        No <code className="font-mono">toHaveScreenshot</code> comparisons in this run.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {visuals.map((item) => (
        <div
          key={`${item.caseId}:${item.name}`}
          className="rounded-[14px] border border-edge bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${OUTCOME_DOT[item.outcome]}`} />
            <Link
              to="/tests/$caseId"
              params={{ caseId: item.caseId }}
              className="text-sm font-semibold hover:text-brand-text"
            >
              {item.title}
            </Link>
            <span className="font-mono text-[11px] text-ink-3">
              {item.name} · {item.projectName || 'default'}
            </span>
            <span className="ml-auto">
              <CopyChip
                label="Copy update-snapshots command"
                value={`npx playwright test ${item.file}:${item.line}${item.projectName ? ` --project=${item.projectName}` : ''} --update-snapshots`}
              />
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ['Expected', item.expected],
                ['Actual', item.actual],
                ['Diff', item.diff],
              ] as const
            ).map(([label, href]) => (
              <div key={label}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  {label}
                </div>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    <img
                      src={href}
                      alt={`${label} — ${item.name}`}
                      loading="lazy"
                      className="h-36 w-full rounded-[10px] border border-edge bg-edge-2 object-contain"
                    />
                  </a>
                ) : (
                  <div className="grid h-36 place-items-center rounded-[10px] border border-dashed border-edge text-xs text-ink-4">
                    not captured
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
