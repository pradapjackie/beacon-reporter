import { readFile, stat } from 'node:fs/promises';
import type {
  AttachmentRef,
  ErrorInfo,
  StdioChunk,
  StepNode,
  TestResultRecord,
  VisualDiff,
} from '@beacon-report/shared';
import type { TestError, TestResult, TestStep } from '@playwright/test/reporter';
import type { AttachmentStore, RawAttachment } from './attachments';

/**
 * Converters from live Playwright objects to schema v1 records. Everything is
 * defensive (`?? []`, feature probes) because fields appear across Playwright
 * minors and replayed fixtures may predate them — never version-sniff.
 */

export type Scrubber = ((text: string) => string) & { active?: boolean };
const identity: Scrubber = Object.assign((s: string) => s, { active: false });

const TEXT_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** Text-like attachments (and Playwright's error-context) can carry the raw error. */
export function isScrubbableAttachment(attachment: { name: string; contentType: string }): boolean {
  const type = attachment.contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type.startsWith('text/')) return true;
  if (type === 'application/json' || type === 'application/xml') return true;
  const name = attachment.name.toLowerCase();
  return (
    name === 'error-context' ||
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.log') ||
    name.endsWith('.csv')
  );
}

export function toErrorInfo(error: TestError, scrub: Scrubber = identity): ErrorInfo {
  return {
    message: scrub(error.message ?? String(error.value ?? 'Unknown error')),
    stack: error.stack ? scrub(error.stack) : undefined,
    snippet: error.snippet ? scrub(error.snippet) : undefined,
    location: error.location,
  };
}

function toStdio(result: TestResult, scrub: Scrubber): StdioChunk[] {
  const chunks: StdioChunk[] = [];
  for (const [stream, entries] of [
    ['stdout', result.stdout ?? []],
    ['stderr', result.stderr ?? []],
  ] as const) {
    for (const entry of entries) {
      chunks.push(
        Buffer.isBuffer(entry)
          ? { stream, text: entry.toString('base64'), base64: true }
          : { stream, text: scrub(entry) },
      );
    }
  }
  return chunks;
}

function toStepNode(
  step: TestStep,
  resultAttachments: TestResult['attachments'],
  scrub: Scrubber,
): StepNode {
  // Step-level attachments landed in Playwright ~1.50; probe and map to
  // indexes in the owning result's attachments array by identity.
  const stepAttachments = (step as { attachments?: TestResult['attachments'] }).attachments ?? [];
  const indexes: number[] = [];
  for (const attachment of stepAttachments) {
    const index = resultAttachments.indexOf(attachment);
    if (index >= 0) indexes.push(index);
  }
  return {
    title: step.title,
    category: step.category,
    startTime: step.startTime.getTime(),
    duration: step.duration,
    error: step.error ? toErrorInfo(step.error, scrub) : undefined,
    attachments: indexes,
    steps: (step.steps ?? []).map((child) => toStepNode(child, resultAttachments, scrub)),
  };
}

async function scrubAttachment(attachment: RawAttachment, scrub: Scrubber): Promise<RawAttachment> {
  if (!scrub.active || !isScrubbableAttachment(attachment)) return attachment;
  let body = attachment.body;
  if (body === undefined && attachment.path) {
    try {
      const info = await stat(attachment.path);
      if (info.size > TEXT_ATTACHMENT_BYTES) return attachment;
      body = await readFile(attachment.path);
    } catch {
      return attachment;
    }
  }
  if (!body) return attachment;
  const next = scrub(body.toString('utf8'));
  if (next === body.toString('utf8')) return attachment;
  return { name: attachment.name, contentType: attachment.contentType, body: Buffer.from(next) };
}

/** toHaveScreenshot writes `<name>-expected/-actual/-diff` attachment triples. */
export function detectVisualDiffs(refs: AttachmentRef[]): VisualDiff[] {
  const groups = new Map<string, VisualDiff>();
  refs.forEach((ref, index) => {
    const match = /^(.+)-(expected|actual|diff)(\.[a-z0-9]+)?$/i.exec(ref.name);
    if (!match || !match[1] || !match[2]) return;
    const key = match[1];
    const group = groups.get(key) ?? { name: key };
    group[match[2].toLowerCase() as 'expected' | 'actual' | 'diff'] = index;
    groups.set(key, group);
  });
  // Only groups that look like a real snapshot comparison (2+ parts) count.
  return [...groups.values()].filter(
    (g) => [g.expected, g.actual, g.diff].filter((v) => v !== undefined).length >= 2,
  );
}

export async function toResultRecord(
  result: TestResult,
  store: AttachmentStore,
  scrub: Scrubber = identity,
): Promise<TestResultRecord> {
  const rawAttachments = result.attachments ?? [];
  const attachments = await Promise.all(
    rawAttachments.map(async (a) =>
      store.put(
        await scrubAttachment(
          { name: a.name, contentType: a.contentType, path: a.path, body: a.body },
          scrub,
        ),
      ),
    ),
  );
  return {
    retry: result.retry,
    workerIndex: result.workerIndex,
    parallelIndex: result.parallelIndex,
    startTime: result.startTime?.getTime?.() ?? 0,
    duration: result.duration ?? 0,
    status: result.status,
    errors: (result.errors ?? []).map((e) => toErrorInfo(e, scrub)),
    stdio: toStdio(result, scrub),
    attachments,
    steps: (result.steps ?? []).map((step) => toStepNode(step, rawAttachments, scrub)),
    visualDiffs: detectVisualDiffs(attachments),
    annotations: (result as { annotations?: Array<{ type: string; description?: string }> })
      .annotations,
  };
}
