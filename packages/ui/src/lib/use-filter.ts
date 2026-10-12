import { useEffect, useMemo, useRef, useState } from 'react';
import { type FilterParams, filterRowIndexes } from './filtering';
import type { TestRow } from './hooks';

/** Suites above this size filter in a Web Worker; below it, sync is faster. */
const WORKER_THRESHOLD = 3000;

/**
 * Filtered row indexes. Small suites filter synchronously; large suites go
 * through the worker, falling back to sync when workers are unavailable
 * (e.g. file:// blocks module workers).
 */
export function useFilteredIndexes(rows: TestRow[], params: FilterParams): number[] {
  const useWorker = rows.length >= WORKER_THRESHOLD;
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  const [workerResult, setWorkerResult] = useState<{ seq: number; indexes: number[] } | null>(null);
  const [workerBroken, setWorkerBroken] = useState(false);

  useEffect(() => {
    if (!useWorker || workerBroken) return;
    try {
      const worker = new Worker(new URL('./filter.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e: MessageEvent<{ seq: number; indexes: number[] }>) =>
        setWorkerResult(e.data);
      worker.onerror = () => setWorkerBroken(true);
      worker.postMessage({ type: 'rows', rows });
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      setWorkerBroken(true);
      return;
    }
  }, [rows, useWorker, workerBroken]);

  useEffect(() => {
    if (!useWorker || workerBroken || !workerRef.current) return;
    seqRef.current += 1;
    workerRef.current.postMessage({ type: 'filter', seq: seqRef.current, params });
  }, [params, useWorker, workerBroken]);

  const syncIndexes = useMemo(
    () => (!useWorker || workerBroken ? filterRowIndexes(rows, params) : null),
    [rows, params, useWorker, workerBroken],
  );

  if (syncIndexes) return syncIndexes;
  // Worker path: show the latest answer (stale answers are dropped by seq).
  if (workerResult && workerResult.seq === seqRef.current) return workerResult.indexes;
  return workerResult?.indexes ?? rows.map((_, i) => i);
}
