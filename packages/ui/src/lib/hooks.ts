import type {
  CompareData,
  HistoryData,
  Manifest,
  TestDetail,
  TestOutcome,
  TestStatus,
  TimelineData,
} from '@beacon-report/shared';
import { TEST_OUTCOMES, TEST_STATUSES } from '@beacon-report/shared';
import { useQuery } from '@tanstack/react-query';
import { loadChunk, loadManifest, sampleManifest } from './beacon-data';

export interface ManifestState {
  manifest: Manifest;
  sample: boolean;
}

export function useManifest() {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: async (): Promise<ManifestState> => {
      try {
        return { manifest: await loadManifest(), sample: false };
      } catch {
        // No data/ directory (`pnpm dev` in this package) — render sample data.
        return { manifest: sampleManifest, sample: true };
      }
    },
  });
}

/** Trends/deltas chunk — absent when history is disabled or this is a first run. */
export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: async (): Promise<HistoryData | null> => {
      try {
        return await loadChunk<HistoryData>('history', 3000);
      } catch {
        return null;
      }
    },
  });
}

/** Baseline diffs chunk — absent until at least two runs exist in history. */
export function useCompare() {
  return useQuery({
    queryKey: ['compare'],
    queryFn: async (): Promise<CompareData | null> => {
      try {
        return await loadChunk<CompareData>('compare', 3000);
      } catch {
        return null;
      }
    },
  });
}

/** Worker lanes: own chunk in new reports, manifest aggregate in old ones. */
export function useTimeline(state: ManifestState | undefined) {
  return useQuery({
    queryKey: ['timeline'],
    enabled: state !== undefined,
    queryFn: async (): Promise<TimelineData> => {
      try {
        return await loadChunk<TimelineData>('timeline', 3000);
      } catch {
        const aggregates = state?.manifest.aggregates;
        return {
          entries: aggregates?.timeline ?? [],
          truncated: aggregates?.timelineTruncated,
        };
      }
    },
  });
}

/** One flattened row per test, decoded from the columnar index chunks. */
export interface TestRow {
  caseId: string;
  title: string;
  status: TestStatus;
  outcome: TestOutcome;
  duration: number;
  project: string;
  file: string;
  tags: string[];
  /** Describe chain (BDD Feature / Scenario Outline), '' when none. */
  suite: string;
  retries: number;
  hasAttachments: number;
  detailsChunk: number;
}

export function useRows(state: ManifestState | undefined) {
  return useQuery({
    queryKey: ['rows'],
    enabled: state !== undefined,
    queryFn: async (): Promise<TestRow[]> => {
      if (!state || state.sample) return [];
      const { manifest } = state;
      const rows: TestRow[] = [];
      for (let i = 0; i < manifest.chunks.index; i++) {
        const chunk = await loadChunk<{
          caseIds: string[];
          titles: string[];
          status: number[];
          outcome: number[];
          duration: number[];
          project: number[];
          file: number[];
          tags: number[][];
          suite?: number[];
          retries: number[];
          hasAttachments: number[];
          detailsChunk: number[];
        }>(`index/chunk-${i}`);
        for (let row = 0; row < chunk.caseIds.length; row++) {
          rows.push({
            caseId: chunk.caseIds[row] ?? '',
            title: chunk.titles[row] ?? '',
            status: TEST_STATUSES[chunk.status[row] ?? 0] ?? 'skipped',
            outcome: TEST_OUTCOMES[chunk.outcome[row] ?? 0] ?? 'expected',
            duration: chunk.duration[row] ?? 0,
            project: manifest.projects[chunk.project[row] ?? 0]?.name ?? '',
            file: manifest.files[chunk.file[row] ?? 0] ?? '',
            tags: (chunk.tags[row] ?? []).map((t) => manifest.tags[t] ?? ''),
            suite: manifest.suites?.[chunk.suite?.[row] ?? 0] ?? '',
            retries: chunk.retries[row] ?? 0,
            hasAttachments: chunk.hasAttachments[row] ?? 0,
            detailsChunk: chunk.detailsChunk[row] ?? 0,
          });
        }
      }
      return rows;
    },
  });
}

export function useTestDetail(caseId: string) {
  const manifest = useManifest();
  const rows = useRows(manifest.data);
  const row = rows.data?.find((r) => r.caseId === caseId);
  const detail = useQuery({
    queryKey: ['detail', caseId],
    enabled: row !== undefined,
    queryFn: async (): Promise<TestDetail | undefined> => {
      if (!row) return undefined;
      const chunk = await loadChunk<TestDetail[]>(`details/chunk-${row.detailsChunk}`);
      return chunk.find((d) => d.caseId === caseId);
    },
  });
  return {
    detail: detail.data,
    isPending: manifest.isPending || rows.isPending || (row !== undefined && detail.isPending),
    missing: !manifest.isPending && !rows.isPending && row === undefined,
  };
}
