import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ErrorInfo, Manifest, TestDetail, TestOutcome } from '@beacon-report/shared';
import { computeCaseId } from '@beacon-report/shared/ids';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { parseBudget } from './analytics';
import { AttachmentStore } from './attachments';
import { type Scrubber, toErrorInfo, toResultRecord } from './collect';
import { writeReport } from './writer';

export interface BeaconReporterOptions {
  /** Report output folder, resolved against the Playwright config directory. */
  outputFolder?: string;
  /** Copy the prebuilt report UI next to the data (default true). */
  copyUi?: boolean;
  /** Report title shown in the header (default: none). */
  title?: string;
  /** Dashboard layout: which cards to show, in order, and card options. */
  dashboard?: {
    cards?: string[];
    slowest?: number;
  };
  /** Extra environment key-values shown on the dashboard (os/node auto-added). */
  environment?: Record<string, string>;
  /** URL templates per annotation type, `{}` = description (e.g. issue: "https://jira/browse/{}"). */
  links?: Record<string, string>;
  /** Failure category rules (run before built-ins; first match wins). */
  categories?: Array<{ name: string; messageRegex?: string; stackRegex?: string }>;
  /** Run history for trends/deltas; false disables (default: .beacon-history, keep 30). */
  history?: false | { dir?: string; retain?: number };
  /** Render open-in-editor (vscode://) links — records the absolute rootDir. */
  editorLinks?: boolean;
  /** PII scrubbing: regexes applied to error text and stdio before writing. */
  scrub?: Array<{ pattern: string; flags?: string; replacement?: string }>;
  /**
   * Embed a source snippet per test (failures always; every test when the run
   * has ≤2000 tests). Default true; false disables.
   */
  embedSource?: boolean;
  /** White-labeling: logo image path (resolved against the config dir) + accent hex. */
  branding?: { logo?: string; accentColor?: string };
  /**
   * Path to an istanbul `coverage-summary.json` (resolved against the config
   * dir) — ingested into the coverage card and the coverage trend.
   */
  coverage?: string;
  /**
   * Live mode: write interim reports while tests run (throttled). The report
   * UI polls `meta.inProgress` and refreshes itself until the final write.
   * Also enabled by BEACON_WATCH=1. History is only written at the end.
   */
  watch?: boolean;
  /** Interim write throttle in ms (default 1500; exposed for tests). */
  watchIntervalMs?: number;
  /** Plugins: enrich tests and/or contribute custom dashboard cards. */
  plugins?: BeaconPlugin[];
}

/**
 * Test record handed to plugins. Declared here so the published package does
 * not depend on the private schema package.
 */
export interface BeaconTestDetail {
  caseId: string;
  title: string;
  titlePath: string[];
  location: { file: string; line: number; column: number };
  projectName: string;
  tags: string[];
  annotations: Array<{ type: string; description?: string }>;
  outcome: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  timeout: number;
  slow: boolean;
  metrics?: Record<string, number>;
  results: Array<{
    retry: number;
    status: string;
    duration: number;
    errors: Array<{ message?: string; stack?: string; snippet?: string }>;
  }>;
}

/**
 * v1 plugin surface — deliberately small. `enrich` may mutate each test
 * (add metrics, annotations, tags) before anything is written; `card`
 * contributes a dashboard card rendered after the built-ins.
 */
export interface BeaconPlugin {
  name: string;
  enrich?(detail: BeaconTestDetail): void | Promise<void>;
  card?(details: BeaconTestDetail[]):
    | {
        id: string;
        title: string;
        subtitle?: string;
        rows: Array<{ label: string; value: string }>;
      }
    | undefined
    | Promise<
        | {
            id: string;
            title: string;
            subtitle?: string;
            rows: Array<{ label: string; value: string }>;
          }
        | undefined
      >;
}

/** Report data always stores forward-slash paths, so caseIds, history and
 * deep links agree between Windows and POSIX machines. */
function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

interface CollectedTest {
  test: TestCase;
  projectName: string;
  file: string;
  detail: TestDetail;
}

export class BeaconReporter implements Reporter {
  private readonly options: BeaconReporterOptions & { outputFolder: string; copyUi: boolean };
  private config!: FullConfig;
  private outputDir!: string;
  private historyDir: string | undefined;
  private scrub: Scrubber = (s) => s;
  private store!: AttachmentStore;
  private logoPath: string | undefined;
  private coveragePath: string | undefined;
  private startTime = 0;
  private runErrors: ErrorInfo[] = [];
  private readonly tests = new Map<string, CollectedTest>();
  /** Attachment copies stream while tests run; onEnd awaits them all. */
  private readonly pending: Promise<void>[] = [];
  private readonly watch: boolean;
  private interimTimer: ReturnType<typeof setTimeout> | undefined;
  private interimInFlight: Promise<void> = Promise.resolve();
  private uiCopied = false;

  constructor(options: BeaconReporterOptions = {}) {
    // The env override exists for contexts that can't pass reporter options,
    // like `playwright merge-reports --reporter beacon-reporter`.
    this.options = {
      ...options,
      outputFolder: options.outputFolder ?? process.env.BEACON_OUTPUT_FOLDER ?? 'beacon-report',
      copyUi: options.copyUi ?? true,
    };
    this.watch = options.watch ?? process.env.BEACON_WATCH === '1';
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.config = config;
    this.startTime = Date.now();
    // rootDir is the test discovery root (testDir-relative), so resolve the
    // output folder against the config file's directory like the built-in
    // HTML reporter does.
    const baseDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.outputDir = path.resolve(baseDir, this.options.outputFolder);
    this.store = new AttachmentStore(path.join(this.outputDir, 'attachments'));
    this.historyDir =
      this.options.history === false
        ? undefined
        : path.resolve(baseDir, this.options.history?.dir ?? '.beacon-history');
    this.logoPath = this.options.branding?.logo
      ? path.resolve(baseDir, this.options.branding.logo)
      : undefined;
    this.coveragePath = this.options.coverage
      ? path.resolve(baseDir, this.options.coverage)
      : undefined;

    const rules = (this.options.scrub ?? []).flatMap((rule) => {
      try {
        return [
          { re: new RegExp(rule.pattern, rule.flags ?? 'g'), to: rule.replacement ?? '[redacted]' },
        ];
      } catch {
        console.warn(`[beacon] Invalid scrub pattern ignored: ${rule.pattern}`);
        return [];
      }
    });
    if (rules.length > 0) {
      this.scrub = (text) => rules.reduce((acc, r) => acc.replace(r.re, r.to), text);
    }
  }

  onTestBegin(_test: TestCase, _result: TestResult): void {
    // TODO Phase 5: live/watch mode event stream.
  }

  onStepBegin(_test: TestCase, _result: TestResult, _step: TestStep): void {
    // Steps are read from result.steps at onTestEnd; begin/end hooks feed
    // live mode (Phase 5).
  }

  onStepEnd(_test: TestCase, _result: TestResult, _step: TestStep): void {}

  onStdOut(_chunk: string | Buffer, _test?: TestCase, _result?: TestResult): void {
    // Per-attempt stdio is read from result.stdout/stderr at onTestEnd; these
    // hooks feed live mode (Phase 5) and global-scope output (Phase 2).
  }

  onStdErr(_chunk: string | Buffer, _test?: TestCase, _result?: TestResult): void {}

  onTestEnd(test: TestCase, result: TestResult): void {
    // Capture now, while attachment files still exist on disk — reporter
    // hooks are sync, so track the async work and await it in onEnd.
    this.pending.push(this.captureResult(test, result));
    if (this.watch) this.scheduleInterim();
  }

  /** Watch mode: throttled interim report writes while the run is live. */
  private scheduleInterim(): void {
    if (this.interimTimer) return;
    this.interimTimer = setTimeout(() => {
      this.interimTimer = undefined;
      // Chain so interim writes never overlap each other or the final write.
      this.interimInFlight = this.interimInFlight.then(() => this.writeInterim());
    }, this.options.watchIntervalMs ?? 1500);
  }

  private async writeInterim(): Promise<void> {
    try {
      // Snapshot: captureResult may append results while this serializes.
      const details = [...this.tests.values()].map((collected) => ({
        ...collected.detail,
        outcome: collected.test.outcome() as TestOutcome,
        results: [...collected.detail.results].sort((a, b) => a.retry - b.retry),
      }));
      if (details.length === 0) return;
      const failed = details.some((d) => d.outcome === 'unexpected');
      await writeReport({
        outputDir: this.outputDir,
        status: failed ? 'failed' : 'passed',
        startTime: this.startTime,
        duration: Date.now() - this.startTime,
        details,
        errors: this.runErrors,
        config: this.config,
        copyUi: this.options.copyUi && !this.uiCopied,
        inProgress: true,
        title: this.options.title,
        dashboard: this.options.dashboard,
        environment: this.options.environment,
        links: this.options.links,
        categories: this.options.categories,
        // History only records finished runs — never interim snapshots.
        history: undefined,
        editorLinks: this.options.editorLinks,
      });
      this.uiCopied = true;
    } catch (error) {
      console.warn(
        `[beacon] Interim write failed (run continues): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async captureResult(test: TestCase, result: TestResult): Promise<void> {
    // Feature-detect fields that appeared in later Playwright minors — never
    // version-sniff (see ROADMAP.md risk #1).
    const projectName = test.parent?.project?.()?.name ?? '';
    const file = toPosix(path.relative(this.config.rootDir, test.location.file));
    const caseId = computeCaseId(projectName, file, test.titlePath());
    const record = await toResultRecord(result, this.store, this.scrub);

    // Custom metrics convention: a `beacon:metrics` JSON attachment.
    let metrics: Record<string, number> | undefined;
    for (const attachment of result.attachments ?? []) {
      if (attachment.name !== 'beacon:metrics' || !attachment.body) continue;
      try {
        const parsed = JSON.parse(attachment.body.toString('utf8')) as Record<string, unknown>;
        metrics = Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => typeof v === 'number'),
        ) as Record<string, number>;
      } catch {
        console.warn('[beacon] beacon:metrics attachment is not valid JSON — ignored');
      }
    }

    const existing = this.tests.get(caseId);
    if (existing) {
      existing.detail.results.push(record);
      if (metrics) existing.detail.metrics = { ...existing.detail.metrics, ...metrics };
      return;
    }
    this.tests.set(caseId, {
      test,
      projectName,
      file,
      detail: {
        caseId,
        title: test.title,
        titlePath: test.titlePath(),
        location: { file, line: test.location.line, column: test.location.column },
        projectName,
        tags: (test as { tags?: string[] }).tags ?? [],
        annotations: (test.annotations ?? []).map((a) => ({
          type: a.type,
          description: a.description,
        })),
        outcome: 'expected',
        timeout: test.timeout ?? 0,
        slow: false,
        metrics,
        budgetMs: parseBudget(
          (test.annotations ?? []).find((a) => a.type === 'budget')?.description,
        ),
        results: [record],
      },
    });
  }

  onError(error: TestError): void {
    this.runErrors.push(toErrorInfo(error, this.scrub));
  }

  async onEnd(result: FullResult): Promise<void> {
    if (this.interimTimer) {
      clearTimeout(this.interimTimer);
      this.interimTimer = undefined;
    }
    await this.interimInFlight;
    await Promise.all(this.pending);

    const details: TestDetail[] = [];
    for (const collected of this.tests.values()) {
      const detail = collected.detail;
      // Final-state fields: outcome/annotations settle only after the last retry.
      detail.outcome = collected.test.outcome() as TestOutcome;
      detail.annotations = (collected.test.annotations ?? []).map((a) => ({
        type: a.type,
        description: a.description,
      }));
      detail.slow = detail.annotations.some((a) => a.type === 'slow');
      detail.results.sort((a, b) => a.retry - b.retry);
      details.push(detail);
    }

    if (this.options.embedSource !== false) await this.embedSources(details);

    // Plugins: enrich tests, then collect custom dashboard cards. A broken
    // plugin never breaks the report.
    const customCards: NonNullable<NonNullable<Manifest['ui']>['customCards']> = [];
    for (const plugin of this.options.plugins ?? []) {
      try {
        if (plugin.enrich) {
          for (const detail of details) await plugin.enrich(detail);
        }
        const card = await plugin.card?.(details);
        if (card) customCards.push(card);
      } catch (error) {
        console.warn(
          `[beacon] Plugin "${plugin.name}" failed — skipped: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    await writeReport({
      outputDir: this.outputDir,
      status: result.status,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      details,
      errors: this.runErrors,
      config: this.config,
      copyUi: this.options.copyUi,
      title: this.options.title,
      dashboard: this.options.dashboard,
      environment: this.options.environment,
      links: this.options.links,
      categories: this.options.categories,
      history: this.historyDir
        ? {
            dir: this.historyDir,
            retain: this.options.history === false ? 30 : (this.options.history?.retain ?? 30),
          }
        : undefined,
      editorLinks: this.options.editorLinks,
      branding: this.options.branding
        ? { logo: this.logoPath, accentColor: this.options.branding.accentColor }
        : undefined,
      storage: this.store.stats.count > 0 ? { ...this.store.stats } : undefined,
      customCards: customCards.length > 0 ? customCards : undefined,
      coveragePath: this.coveragePath,
    });
  }

  /**
   * Attaches a source snippet to each failing/flaky test (or every test when
   * the run is small): the spec code at the test's location, or the mapped
   * .feature scenario for playwright-bdd generated specs.
   */
  private async embedSources(details: TestDetail[]): Promise<void> {
    const SNIPPET_LINES = 40;
    const embedAll = details.length <= 2000;
    const cache = new Map<string, string[] | null>();
    const linesOf = async (absPath: string): Promise<string[] | null> => {
      const hit = cache.get(absPath);
      if (hit !== undefined) return hit;
      let lines: string[] | null = null;
      try {
        lines = (await readFile(absPath, 'utf8')).split(/\r?\n/);
      } catch {
        // Source not on disk (replayed fixtures, moved trees) — skip quietly.
      }
      cache.set(absPath, lines);
      return lines;
    };

    for (const detail of details) {
      const failing = detail.outcome === 'unexpected' || detail.outcome === 'flaky';
      if (!embedAll && !failing) continue;

      // playwright-bdd points locations at its generated spec; the original
      // .feature usually sits next to (or one level above) the test root.
      if (/\.feature\.spec\.js$/.test(detail.location.file)) {
        const stripped = detail.location.file.replace(/\.spec\.js$/, '');
        const candidate = [
          path.resolve(this.config.rootDir, stripped),
          path.resolve(this.config.rootDir, '..', stripped),
        ].find((p) => existsSync(p));
        const lines = candidate ? await linesOf(candidate) : null;
        if (candidate && lines) {
          const scenarioName = /^Example #\d+$/.test(detail.title)
            ? (detail.titlePath[detail.titlePath.length - 2] ?? detail.title)
            : detail.title;
          let start = lines.findIndex(
            (l) => /^\s*Scenario( Outline)?:/.test(l) && l.includes(scenarioName),
          );
          if (start >= 0) {
            // Pull in the tag lines directly above the scenario.
            while (start > 0 && /^\s*@/.test(lines[start - 1] ?? '')) start -= 1;
            let end = start + 1;
            while (
              end < lines.length &&
              end - start < SNIPPET_LINES &&
              !/^\s*(Scenario|Rule|Background)\b/.test(lines[end] ?? '')
            ) {
              end += 1;
            }
            detail.source = {
              file: toPosix(path.relative(this.config.rootDir, candidate)),
              startLine: start + 1,
              lines: lines.slice(start, end).map((l) => this.scrub(l)),
              language: 'feature',
            };
            continue;
          }
        }
        continue; // generated JS is noise — no snippet beats a misleading one
      }

      const lines = await linesOf(path.resolve(this.config.rootDir, detail.location.file));
      if (!lines) continue;
      const start = Math.max(0, detail.location.line - 1);
      const slice = lines.slice(start, start + SNIPPET_LINES);
      if (slice.length === 0) continue;
      const errorLine = detail.results.at(-1)?.errors[0]?.location?.line;
      detail.source = {
        file: detail.location.file,
        startLine: start + 1,
        lines: slice.map((l) => this.scrub(l)),
        highlightLine:
          errorLine && errorLine >= start + 1 && errorLine < start + 1 + slice.length
            ? errorLine
            : undefined,
        language: 'ts',
      };
    }
  }

  async onExit(): Promise<void> {
    // TODO Phase 5: flush live-mode sockets.
  }
}
