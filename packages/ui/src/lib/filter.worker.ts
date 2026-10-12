/// <reference lib="webworker" />
import { type FilterParams, filterRowIndexes } from './filtering';
import type { TestRow } from './hooks';

declare const self: DedicatedWorkerGlobalScope;

/**
 * Filtering worker: receives the row set once, then answers filter requests
 * by index list. `seq` lets the main thread drop stale answers.
 */

let rows: TestRow[] = [];

type Incoming =
  | { type: 'rows'; rows: TestRow[] }
  | { type: 'filter'; seq: number; params: FilterParams };

self.onmessage = (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === 'rows') {
    rows = message.rows;
    return;
  }
  self.postMessage({ seq: message.seq, indexes: filterRowIndexes(rows, message.params) });
};
