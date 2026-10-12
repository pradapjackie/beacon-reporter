import type { TestRow } from './hooks';

/**
 * Pure row filtering shared by the main thread (small suites) and the
 * Web Worker (large suites) — the worker keeps 50k-row filtering off the
 * UI thread so typing in the search box stays at 60 fps.
 */

export interface FilterParams {
  q: string;
  outcomes: string[];
  project: string;
  tags: string[];
}

export function filterRowIndexes(rows: TestRow[], params: FilterParams): number[] {
  const q = params.q.trim().toLowerCase();
  const outcomes = new Set(params.outcomes);
  const tags = new Set(params.tags);
  const out: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (outcomes.size > 0 && !outcomes.has(row.outcome)) continue;
    if (params.project && row.project !== params.project) continue;
    if (tags.size > 0 && !row.tags.some((t) => tags.has(t))) continue;
    if (
      q &&
      !(
        row.title.toLowerCase().includes(q) ||
        row.file.toLowerCase().includes(q) ||
        row.suite.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.tags.some((t) => t.toLowerCase().includes(q))
      )
    )
      continue;
    out.push(i);
  }
  return out;
}
