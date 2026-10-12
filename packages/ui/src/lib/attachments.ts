import type { AttachmentRef } from '@beacon-report/shared';

/** Relative URL of a stored attachment inside the report (undefined for omitted stubs). */
export function attachmentHref(ref: AttachmentRef | undefined): string | undefined {
  if (!ref?.sha256) return undefined;
  // Single-file exports carry a budgeted subset of attachments as data URIs;
  // everything else renders as an omitted stub.
  if (window.__BEACON_SINGLE_FILE__) {
    return window.__BEACON_INLINE_ATTACHMENTS__?.[ref.sha256];
  }
  return `attachments/${ref.sha256}.${ref.ext ?? 'bin'}`;
}
