import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Flaky-quarantine candidates from the history directory: tests failing or
 * flaking in a large share of recent runs. `--grep-invert` prints a regex
 * usable directly with `playwright test --grep-invert`.
 */

interface HistoryRunFile {
  cases: Record<string, [number, number, number]>;
}

export interface QuarantineOptions {
  /** Minimum failing share of appearances (0..1, default 0.5). */
  minRate?: number;
  /** Minimum appearances before a test can qualify (default 3). */
  minRuns?: number;
}

export interface QuarantineCandidate {
  caseId: string;
  title: string;
  projectName: string;
  failures: number;
  runs: number;
  file?: string;
  line?: number;
}

const FAILING = new Set([1, 2]); // TEST_OUTCOMES: unexpected, flaky

export async function quarantineCandidates(
  historyDir: string,
  reportDir: string,
  options: QuarantineOptions = {},
): Promise<QuarantineCandidate[]> {
  const minRate = options.minRate ?? 0.5;
  const minRuns = options.minRuns ?? 3;

  const runsDir = path.join(historyDir, 'runs');
  const runs: HistoryRunFile[] = [];
  for (const name of (await readdir(runsDir)).filter((f) => f.endsWith('.json'))) {
    try {
      runs.push(JSON.parse(await readFile(path.join(runsDir, name), 'utf8')));
    } catch {
      // Skip corrupt run files.
    }
  }

  // Titles come from the current report's details.
  const titles = new Map<
    string,
    { title: string; projectName: string; file: string; line: number }
  >();
  const detailsDir = path.join(reportDir, 'data', 'details');
  for (const name of (await readdir(detailsDir)).filter((f) => f.endsWith('.js'))) {
    const raw = await readFile(path.join(detailsDir, name), 'utf8');
    const details = JSON.parse(raw.slice(raw.indexOf(', ') + 2, raw.lastIndexOf(');'))) as Array<{
      caseId: string;
      title: string;
      projectName: string;
      location: { file: string; line: number };
    }>;
    for (const d of details)
      titles.set(d.caseId, {
        title: d.title,
        projectName: d.projectName,
        file: d.location.file,
        line: d.location.line,
      });
  }

  const stats = new Map<string, { failures: number; runs: number }>();
  for (const run of runs) {
    for (const [caseId, entry] of Object.entries(run.cases ?? {})) {
      const s = stats.get(caseId) ?? { failures: 0, runs: 0 };
      s.runs += 1;
      if (FAILING.has(entry[0])) s.failures += 1;
      stats.set(caseId, s);
    }
  }

  return [...stats.entries()]
    .filter(
      ([caseId, s]) => titles.has(caseId) && s.runs >= minRuns && s.failures / s.runs >= minRate,
    )
    .map(([caseId, s]) => ({
      caseId,
      title: titles.get(caseId)?.title ?? caseId,
      projectName: titles.get(caseId)?.projectName ?? '',
      failures: s.failures,
      runs: s.runs,
      file: titles.get(caseId)?.file,
      line: titles.get(caseId)?.line,
    }))
    .sort((a, b) => b.failures / b.runs - a.failures / a.runs);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function toGrepInvert(candidates: QuarantineCandidate[]): string {
  const titles = [...new Set(candidates.map((c) => escapeRegex(c.title)))];
  return titles.length > 0 ? `(${titles.join('|')})` : '';
}

/** Suggested test.fixme edits, one block per candidate. */
export function toFixmeSuggestions(candidates: QuarantineCandidate[]): string {
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const c of candidates) {
    const key = `${c.file}:${c.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(
      [
        `// ${c.file}:${c.line} — failing ${c.failures}/${c.runs} recent runs`,
        '//   add inside the test:',
        "//   test.fixme(true, 'quarantined: flaky — see beacon report');",
      ].join('\n'),
    );
  }
  return blocks.join('\n\n');
}
