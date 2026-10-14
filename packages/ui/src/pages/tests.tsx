import { ATTACHMENT_BITS, type TestOutcome } from '@beacon-report/shared';
import type { TestDetail } from '@beacon-report/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCamera,
  IconChevronDown,
  IconFile,
  IconSearch,
  IconTrace,
  IconVideo,
} from '../components/icons';
import { TestPreview } from '../components/test-preview';
import { loadChunk } from '../lib/beacon-data';
import { OUTCOME_DOT, OUTCOME_LABEL, formatDuration } from '../lib/format';
import { type TestRow, useManifest, useRows } from '../lib/hooks';
import { useFilteredIndexes } from '../lib/use-filter';

const OUTCOME_FILTERS: TestOutcome[] = ['expected', 'unexpected', 'flaky', 'skipped'];

type DisplayItem =
  | { kind: 'header'; file: string; count: number; depth?: number; treeKey?: string }
  | { kind: 'row'; row: TestRow };
type GroupBy = 'tree' | 'file' | 'suite' | 'project' | 'tag';
const GROUP_KEYS: Record<Exclude<GroupBy, 'tree'>, (row: TestRow) => string> = {
  file: (r) => r.file,
  // Describe chain — for playwright-bdd this is the Feature (and Scenario Outline).
  suite: (r) => r.suite || 'no suite',
  project: (r) => r.project || 'default',
  tag: (r) => (r.tags.length > 0 ? r.tags.join(' ') : 'untagged'),
};

const GROUPS = ['tree', 'file', 'suite', 'project', 'tag'] as const;

function isGroup(value: string | undefined): value is GroupBy {
  return GROUPS.includes(value as GroupBy);
}

export function TestsPage() {
  const manifest = useManifest();
  const rows = useRows(manifest.data);
  const search = useSearch({ from: '/tests' });
  const navigate = useNavigate({ from: '/tests' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = search.selected;
  const groupBy: GroupBy = isGroup(search.group) ? search.group : 'file';
  const [searchErrors, setSearchErrors] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const closePreview = () =>
    navigate({ search: (prev) => ({ ...prev, selected: undefined }), replace: true });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'Escape' && selected) closePreview();
      // j/k: walk the visible rows, opening each in the preview pane.
      if (e.key === 'j' || e.key === 'k') {
        const rowIds = itemsRef.current;
        if (rowIds.length === 0) return;
        const at = selected ? rowIds.indexOf(selected) : -1;
        const next =
          e.key === 'j' ? Math.min(at + 1, rowIds.length - 1) : Math.max(at <= 0 ? 0 : at - 1, 0);
        const caseId = rowIds[next];
        if (caseId) {
          navigate({ search: (prev) => ({ ...prev, selected: caseId }), replace: true });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const activeOutcomes = useMemo(
    () => new Set((search.outcome ?? '').split(',').filter(Boolean) as TestOutcome[]),
    [search.outcome],
  );
  const activeTags = useMemo(
    () => new Set((search.tag ?? '').split(',').filter(Boolean)),
    [search.tag],
  );

  const all = rows.data ?? [];

  const outcomeCounts = useMemo(() => {
    const counts: Record<TestOutcome, number> = {
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    };
    for (const row of all) counts[row.outcome] += 1;
    return counts;
  }, [all]);

  const params = useMemo(
    () => ({
      q: search.q ?? '',
      outcomes: [...activeOutcomes],
      project: search.project ?? '',
      tags: [...activeTags],
    }),
    [search.q, search.project, activeOutcomes, activeTags],
  );
  // Large suites filter in a Web Worker so typing stays smooth (Phase 4).
  const filteredIndexes = useFilteredIndexes(all, searchErrors ? { ...params, q: '' } : params);

  // "Search in errors": prefer the generate-time data/errors.js index (a plain
  // map lookup at any suite size); older reports fall back to a capped scan.
  const errorIndex = useQuery({
    queryKey: ['errorIndex'],
    enabled: searchErrors,
    queryFn: async (): Promise<Map<string, string>> => {
      try {
        const index = await loadChunk<Record<string, string>>('errors', 3000);
        return new Map(Object.entries(index));
      } catch {
        // Report written before the errors chunk existed.
      }
      const map = new Map<string, string>();
      const chunks = Math.min(manifest.data?.manifest.chunks.details ?? 0, 20);
      for (let i = 0; i < chunks; i++) {
        const details = await loadChunk<TestDetail[]>(`details/chunk-${i}`);
        for (const d of details) {
          const text = d.results
            .flatMap((r) => r.errors)
            .map((e) => `${e.message}\n${e.stack ?? ''}`)
            .join('\n')
            .toLowerCase();
          if (text) map.set(d.caseId, text);
        }
      }
      return map;
    },
  });

  const items = useMemo<DisplayItem[]>(() => {
    const q = (search.q ?? '').trim().toLowerCase();
    const rowsFiltered = filteredIndexes
      .map((index) => all[index])
      .filter((r): r is TestRow => r !== undefined)
      .filter((r) => {
        if (!searchErrors || !q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.file.toLowerCase().includes(q) ||
          (errorIndex.data?.get(r.caseId)?.includes(q) ?? false)
        );
      });

    const rank: Record<TestOutcome, number> = { unexpected: 0, flaky: 1, skipped: 2, expected: 3 };
    const bySort = (a: TestRow, b: TestRow) => {
      if (search.sort === 'duration') return b.duration - a.duration;
      if (search.sort === 'name') return a.title.localeCompare(b.title);
      if (search.sort === 'status') return rank[a.outcome] - rank[b.outcome];
      return 0;
    };

    if (search.sort) {
      const result: DisplayItem[] = [];
      for (const row of [...rowsFiltered].sort(bySort)) result.push({ kind: 'row', row });
      return result;
    }

    if (groupBy === 'tag') {
      const buckets = new Map<string, TestRow[]>();
      for (const row of rowsFiltered) {
        const tags = row.tags.length > 0 ? row.tags : ['untagged'];
        for (const tag of tags) {
          const list = buckets.get(tag) ?? [];
          list.push(row);
          buckets.set(tag, list);
        }
      }
      const result: DisplayItem[] = [];
      for (const tag of [...buckets.keys()].sort((a, b) => a.localeCompare(b))) {
        const tagged = [...(buckets.get(tag) ?? [])].sort(bySort);
        result.push({ kind: 'header', file: tag, count: tagged.length });
        for (const row of tagged) result.push({ kind: 'row', row });
      }
      return result;
    }

    // Tree mode: collapsible file → describe/Feature hierarchy.
    if (groupBy === 'tree') {
      const sorted = [...rowsFiltered].sort(
        (a, b) => a.file.localeCompare(b.file) || a.suite.localeCompare(b.suite) || bySort(a, b),
      );
      const result: DisplayItem[] = [];
      let fileHeader: DisplayItem | undefined;
      let suiteHeader: DisplayItem | undefined;
      let currentFile = '\u0000';
      let currentSuite = '\u0000';
      for (const row of sorted) {
        if (row.file !== currentFile) {
          currentFile = row.file;
          currentSuite = '\u0000';
          suiteHeader = undefined;
          fileHeader = {
            kind: 'header',
            file: row.file,
            count: 0,
            depth: 0,
            treeKey: `f:${row.file}`,
          };
          result.push(fileHeader);
        }
        if (fileHeader?.kind === 'header') fileHeader.count += 1;
        const fileCollapsed = collapsed.has(`f:${row.file}`);
        if (row.suite !== currentSuite) {
          currentSuite = row.suite;
          suiteHeader = undefined;
          if (row.suite && !fileCollapsed) {
            suiteHeader = {
              kind: 'header',
              file: row.suite,
              count: 0,
              depth: 1,
              treeKey: `s:${row.file}:${row.suite}`,
            };
            result.push(suiteHeader);
          }
        }
        if (suiteHeader?.kind === 'header') suiteHeader.count += 1;
        if (fileCollapsed || (row.suite && collapsed.has(`s:${row.file}:${row.suite}`))) continue;
        result.push({ kind: 'row', row });
      }
      return result;
    }

    const keyOf = GROUP_KEYS[groupBy];
    const sorted =
      groupBy === 'file'
        ? rowsFiltered
        : [...rowsFiltered].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    const result: DisplayItem[] = [];
    let currentKey = '\u0000';
    let headerIndex = -1;
    for (const row of sorted) {
      const key = keyOf(row);
      if (key !== currentKey) {
        currentKey = key;
        result.push({ kind: 'header', file: key, count: 0 });
        headerIndex = result.length - 1;
      }
      const header = result[headerIndex];
      if (header?.kind === 'header') header.count += 1;
      result.push({ kind: 'row', row });
    }
    return result;
  }, [
    all,
    filteredIndexes,
    groupBy,
    search.q,
    search.sort,
    searchErrors,
    errorIndex.data,
    collapsed,
  ]);

  const shown = items.filter((i) => i.kind === 'row').length;
  const itemsRef = useRef<string[]>([]);
  itemsRef.current = items.flatMap((i) => (i.kind === 'row' ? [i.row.caseId] : []));

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i]?.kind === 'header' ? 38 : 56),
    overscan: 14,
  });

  const toggleOutcome = (outcome: TestOutcome) => {
    const next = new Set(activeOutcomes);
    next.has(outcome) ? next.delete(outcome) : next.add(outcome);
    navigate({ search: (prev) => ({ ...prev, outcome: [...next].join(',') }) });
  };

  const toggleTag = (tag: string) => {
    const next = new Set(activeTags);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    navigate({ search: (prev) => ({ ...prev, tag: [...next].join(',') }) });
  };

  if (manifest.isPending || rows.isPending) {
    return <div className="py-16 text-center text-ink-3">Loading…</div>;
  }
  if (all.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-edge p-10 text-center text-ink-3">
        No test data found in this report.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative block">
          <IconSearch size={14} className="absolute left-3 top-[11px] text-ink-3" />
          <span className="sr-only">Search tests</span>
          <input
            type="text"
            data-search
            value={search.q ?? ''}
            onChange={(e) =>
              navigate({ search: (prev) => ({ ...prev, q: e.target.value }), replace: true })
            }
            placeholder="Search tests, files, tags…"
            className="h-9 w-72 rounded-[10px] border border-edge bg-card pl-[34px] pr-3 text-[13px] text-ink outline-none placeholder:text-ink-4 focus:border-brand"
          />
        </label>
        <label className="flex h-9 items-center gap-1.5 rounded-[10px] border border-edge bg-card px-2.5 text-xs text-ink-3">
          <input
            type="checkbox"
            checked={searchErrors}
            onChange={(e) => setSearchErrors(e.target.checked)}
            className="accent-(--brand)"
          />
          in errors
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
              <span className={active ? 'opacity-70' : 'text-ink-3'}>{outcomeCounts[outcome]}</span>
            </button>
          );
        })}
        <label className="relative block">
          <span className="sr-only">Filter by project</span>
          <select
            value={search.project ?? ''}
            onChange={(e) => navigate({ search: (prev) => ({ ...prev, project: e.target.value }) })}
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
        {(manifest.data?.manifest.tags ?? []).slice(0, 10).map((tag) => {
          const active = activeTags.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`h-9 rounded-full border px-3 text-xs transition-colors ${
                active
                  ? 'border-brand bg-brand-soft font-semibold text-brand-text'
                  : 'border-edge bg-card text-ink-3'
              }`}
            >
              {tag}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-2.5">
          <span className="flex gap-0.5 rounded-lg border border-edge p-0.5">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() =>
                  navigate({
                    search: (prev) => ({ ...prev, group: g === 'file' ? undefined : g }),
                  })
                }
                className={`rounded-md px-2 py-1 text-[11px] capitalize ${
                  groupBy === g ? 'bg-brand-soft font-semibold text-brand-text' : 'text-ink-3'
                }`}
              >
                {g}
              </button>
            ))}
          </span>
          <label className="relative block">
            <span className="sr-only">Sort tests</span>
            <select
              value={search.sort ?? ''}
              onChange={(e) =>
                navigate({
                  search: (prev) => ({ ...prev, sort: e.target.value || undefined }),
                })
              }
              className="h-8 appearance-none rounded-lg border border-edge bg-card pl-2.5 pr-7 text-[11px] text-ink-2 outline-none focus:border-brand"
            >
              <option value="">Sort</option>
              <option value="duration">Duration</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </label>
          <span className="text-[13px] text-ink-3">
            <span className="font-semibold text-ink">{shown}</span> of {all.length} tests
          </span>
        </span>
      </div>

      <h1 className="sr-only">Tests</h1>
      <div className="flex items-start gap-4">
        <div
          ref={scrollRef}
          className={`h-[calc(100vh-15rem)] overflow-auto rounded-[14px] border border-edge bg-card ${
            selected ? 'hidden min-w-0 lg:block lg:w-[52%]' : 'w-full'
          }`}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const item = items[v.index];
              if (!item) return null;
              const style = {
                top: 0,
                height: v.size,
                transform: `translateY(${v.start}px)`,
              } as const;
              if (item.kind === 'header') {
                const treeKey = item.treeKey;
                const isCollapsed = treeKey !== undefined && collapsed.has(treeKey);
                const header = (
                  <>
                    {treeKey !== undefined && (
                      <span className="w-3 text-[10px] text-ink-3">{isCollapsed ? '▸' : '▾'}</span>
                    )}
                    <IconFile size={12} className="text-ink-3" />
                    <span className="font-mono text-xs text-ink-2">{item.file}</span>
                    <span className="rounded-full bg-edge-2 px-[7px] py-px text-[11px] text-ink-3">
                      {item.count}
                    </span>
                  </>
                );
                const padding = item.depth === 1 ? 'pl-10 pr-[18px]' : 'px-[18px]';
                if (treeKey !== undefined) {
                  return (
                    <button
                      type="button"
                      key={`h:${treeKey}`}
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(treeKey)) next.delete(treeKey);
                          else next.add(treeKey);
                          return next;
                        })
                      }
                      className={`absolute inset-x-0 flex items-center gap-2 border-b border-edge-2 bg-card-2 text-left ${padding} hover:bg-edge-2/60`}
                      style={style}
                    >
                      {header}
                    </button>
                  );
                }
                return (
                  <div
                    key={`h:${item.file}`}
                    className={`absolute inset-x-0 flex items-center gap-2 border-b border-edge-2 bg-card-2 ${padding}`}
                    style={style}
                  >
                    {header}
                  </div>
                );
              }
              const { row } = item;
              return (
                <Link
                  key={row.caseId}
                  to="/tests"
                  search={(prev) => ({ ...prev, selected: row.caseId })}
                  replace
                  className={`absolute inset-x-0 flex items-center gap-3 border-b border-edge-2 px-[18px] text-ink ${
                    selected === row.caseId
                      ? 'bg-brand-soft/60 shadow-[inset_3px_0_0_var(--brand)]'
                      : 'hover:bg-card-2'
                  }`}
                  style={style}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${OUTCOME_DOT[row.outcome]}`}
                  />
                  <span className="min-w-0 grow">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block truncate font-mono text-[11px] text-ink-3">
                      {row.project || 'default'}
                    </span>
                  </span>
                  {row.retries > 0 && (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-flaky-tint px-2 py-0.5 text-[11px] font-semibold text-flaky-text">
                      {row.retries} {row.retries === 1 ? 'retry' : 'retries'}
                    </span>
                  )}
                  {row.tags.map((tag) => (
                    <span
                      key={tag}
                      className="hidden rounded-full bg-edge-2 px-2 py-0.5 text-[11px] text-ink-2 md:inline"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5 text-ink-4">
                    {(row.hasAttachments & ATTACHMENT_BITS.screenshot) !== 0 && (
                      <IconCamera size={14} />
                    )}
                    {(row.hasAttachments & ATTACHMENT_BITS.video) !== 0 && <IconVideo size={14} />}
                    {(row.hasAttachments & ATTACHMENT_BITS.trace) !== 0 && <IconTrace size={14} />}
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-ink-2">
                    {formatDuration(row.duration)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {selected && (
          <aside className="h-[calc(100vh-15rem)] w-full overflow-auto rounded-[14px] border border-edge bg-card lg:w-[48%] lg:shrink-0">
            <TestPreview caseId={selected} onClose={closePreview} />
          </aside>
        )}
      </div>
    </div>
  );
}
