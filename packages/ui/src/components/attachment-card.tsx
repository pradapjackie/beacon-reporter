import type { AttachmentRef } from '@beacon-report/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { attachmentHref } from '../lib/attachments';
import { IconDownload, IconExternal, IconTrace } from './icons';
import { AxeCard, HarCard, isAxe, isHar } from './json-attachments';
import { Lightbox } from './lightbox';

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTrace(attachment: AttachmentRef): boolean {
  return attachment.contentType === 'application/zip' && attachment.name.includes('trace');
}

/**
 * trace.playwright.dev loads traces by URL, which requires the trace to be
 * reachable over http(s) with CORS — `beacon open` serves both. On file://
 * there is no URL to hand over, so the card degrades to a download + hint
 * (ROADMAP.md risk #5).
 */
function TraceCard({ attachment, href }: { attachment: AttachmentRef; href: string }) {
  const [embedded, setEmbedded] = useState(false);
  const onFile = window.location.protocol === 'file:';
  const viewerUrl = onFile
    ? undefined
    : `https://trace.playwright.dev/?trace=${encodeURIComponent(new URL(href, window.location.href).toString())}`;
  return (
    <div className="flex flex-col justify-center gap-2 rounded-[9px] border border-dashed border-edge px-3.5 py-3">
      <div className="flex items-center gap-[7px] text-[13px] font-medium">
        <IconTrace size={13} className="text-ink-2" />
        {attachment.name}
        {attachment.size !== undefined && (
          <span className="font-normal text-ink-4">· {formatBytes(attachment.size)}</span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        {viewerUrl ? (
          <>
            <button
              type="button"
              onClick={() => setEmbedded(true)}
              className="flex items-center gap-[7px] self-start rounded-lg border border-brand px-3 py-[7px] text-xs font-semibold text-brand-text hover:bg-brand-soft"
            >
              <IconTrace size={12} />
              View trace
            </button>
            <a
              href={viewerUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-text"
            >
              Open in new tab
              <IconExternal size={11} />
            </a>
          </>
        ) : (
          <span className="text-xs text-ink-3">
            Serve the report (<code className="font-mono">beacon open</code>) to open traces in the
            viewer directly.
          </span>
        )}
        <a href={href} className="flex items-center gap-1.5 text-xs text-brand-text" download>
          <IconDownload size={12} />
          Download
        </a>
      </div>
      {embedded && viewerUrl && (
        <TraceViewerModal
          url={viewerUrl}
          name={attachment.name}
          onClose={() => setEmbedded(false)}
        />
      )}
    </div>
  );
}

/**
 * Embedded trace viewer: trace.playwright.dev in a near-fullscreen iframe,
 * loading the trace from this report's own served URL (CORS comes from
 * `beacon open` or any permissive static host).
 */
function TraceViewerModal({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 md:p-8">
      <div className="flex min-h-0 grow flex-col overflow-hidden rounded-[14px] border border-edge bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-edge-2 px-4 py-2.5">
          <IconTrace size={14} className="text-ink-2" />
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs text-ink-3">trace.playwright.dev</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-edge px-3 py-1 text-xs text-ink-2 hover:text-brand-text"
          >
            Close (Esc)
          </button>
        </div>
        <iframe src={url} title={`Trace viewer: ${name}`} className="h-full w-full grow border-0" />
      </div>
      <EscapeToClose onClose={onClose} />
    </div>
  );
}

function EscapeToClose({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return null;
}

export function AttachmentCard({ attachment }: { attachment: AttachmentRef }) {
  const href = attachmentHref(attachment);
  if (attachment.mode === 'omitted' || !href) {
    return (
      <div className="rounded-[9px] border border-dashed border-edge p-3 text-xs text-ink-3">
        {attachment.name} — omitted ({attachment.contentType})
      </div>
    );
  }
  if (isTrace(attachment)) {
    return <TraceCard attachment={attachment} href={href} />;
  }
  if (attachment.contentType.startsWith('image/')) {
    return <ImageCard attachment={attachment} href={href} />;
  }
  if (isHar(attachment)) {
    return <HarCard attachment={attachment} href={href} />;
  }
  if (isAxe(attachment)) {
    return <AxeCard attachment={attachment} href={href} />;
  }
  if (attachment.contentType.startsWith('video/')) {
    return (
      <div className="w-[240px]">
        {/* biome-ignore lint/a11y/useMediaCaption: test recordings have no captions */}
        <video
          src={href}
          controls
          preload="metadata"
          className="h-[100px] w-full rounded-[9px] bg-code-bg"
        />
        <span className="mt-1.5 block truncate text-xs text-ink-2">{attachment.name}</span>
      </div>
    );
  }
  if (isTextual(attachment)) {
    return <TextAttachment attachment={attachment} href={href} />;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-[9px] border border-edge px-3 py-2.5 text-[13px] text-brand-text hover:bg-card-2"
    >
      <IconDownload size={13} />
      {attachment.name}
      <span className="text-xs text-ink-4">
        {attachment.contentType}
        {attachment.size !== undefined && ` · ${formatBytes(attachment.size)}`}
      </span>
    </a>
  );
}

function ImageCard({ attachment, href }: { attachment: AttachmentRef; href: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-[170px]">
      <button type="button" onClick={() => setOpen(true)} className="block w-full">
        <img
          src={href}
          alt={attachment.name}
          className="h-[100px] w-full cursor-zoom-in rounded-[9px] border border-edge object-cover"
        />
      </button>
      <span className="mt-1.5 block truncate text-xs text-ink-2">
        {attachment.name}
        {attachment.size !== undefined && (
          <span className="text-ink-4"> · {formatBytes(attachment.size)}</span>
        )}
      </span>
      {open && <Lightbox src={href} alt={attachment.name} onClose={() => setOpen(false)} />}
    </div>
  );
}

const TEXTUAL = ['application/json', 'text/plain', 'text/csv', 'text/markdown'];
const PREVIEW_MAX = 512 * 1024;
const PREVIEW_LINES = 200;

function isTextual(attachment: AttachmentRef): boolean {
  return (
    TEXTUAL.includes(attachment.contentType.split(';')[0] ?? '') &&
    (attachment.size ?? 0) <= PREVIEW_MAX
  );
}

/** Expandable inline preview: JSON pretty-printed, CSV as a table, text as-is. */
function TextAttachment({ attachment, href }: { attachment: AttachmentRef; href: string }) {
  const [body, setBody] = useState<string | null>(null);
  const [state, setState] = useState<'closed' | 'open' | 'failed'>('closed');
  const [expanded, setExpanded] = useState(false);
  const kind = attachment.contentType.split(';')[0];

  const toggle = async () => {
    if (state === 'open') {
      setState('closed');
      return;
    }
    if (body === null) {
      try {
        const res = await fetch(href);
        let text = await res.text();
        if (kind === 'application/json') {
          try {
            text = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            // Leave as-is when it isn't valid JSON after all.
          }
        }
        setBody(text);
      } catch {
        // fetch() fails on file:// — fall back to the plain link.
        setState('failed');
        return;
      }
    }
    setState('open');
  };

  if (state === 'failed') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-[9px] border border-edge px-3 py-2.5 text-[13px] text-brand-text hover:bg-card-2"
      >
        <IconDownload size={13} />
        {attachment.name}
      </a>
    );
  }

  return (
    <div className="w-full min-w-0">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded-[9px] border border-edge px-3 py-2.5 text-[13px] text-brand-text hover:bg-card-2"
      >
        <span className="text-[10px] text-ink-4">{state === 'open' ? '▾' : '▸'}</span>
        {attachment.name}
        <span className="text-xs text-ink-4">
          {attachment.contentType}
          {attachment.size !== undefined && ` · ${formatBytes(attachment.size)}`}
        </span>
      </button>
      {state === 'open' && body !== null && kind === 'text/csv' && <CsvTable body={body} />}
      {state === 'open' && body !== null && kind === 'text/markdown' && (
        <MarkdownPreview body={body} expanded={expanded} onExpand={() => setExpanded(true)} />
      )}
      {state === 'open' && body !== null && kind !== 'text/csv' && kind !== 'text/markdown' && (
        <PlainPreview body={body} expanded={expanded} onExpand={() => setExpanded(true)} />
      )}
    </div>
  );
}

function clipped(body: string, expanded: boolean): { text: string; hidden: number } {
  const lines = body.split('\n');
  if (expanded || lines.length <= PREVIEW_LINES) return { text: body, hidden: 0 };
  return { text: lines.slice(0, PREVIEW_LINES).join('\n'), hidden: lines.length - PREVIEW_LINES };
}

function PlainPreview({
  body,
  expanded,
  onExpand,
}: {
  body: string;
  expanded: boolean;
  onExpand: () => void;
}) {
  const view = clipped(body, expanded);
  return (
    <div className="mt-2">
      <pre className="max-h-72 overflow-auto rounded-[10px] bg-code-bg p-3 font-mono text-xs leading-[1.6] text-code-ink">
        {view.text}
      </pre>
      {view.hidden > 0 && (
        <button type="button" onClick={onExpand} className="mt-2 text-xs text-brand-text">
          Show {view.hidden} more lines
        </button>
      )}
    </div>
  );
}

function MarkdownPreview({
  body,
  expanded,
  onExpand,
}: {
  body: string;
  expanded: boolean;
  onExpand: () => void;
}) {
  const view = clipped(body, expanded);
  return (
    <div className="mt-2 rounded-[10px] border border-edge bg-card-2 p-3 text-[13px] leading-6 text-ink-2">
      <MarkdownText text={view.text} />
      {view.hidden > 0 && (
        <button type="button" onClick={onExpand} className="mt-2 text-xs text-brand-text">
          Show {view.hidden} more lines
        </button>
      )}
    </div>
  );
}

/** Small markdown subset rendered as React nodes, so attachment HTML never executes. */
function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (trimmed.startsWith('```')) {
          const code = trimmed.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
          return (
            <pre
              // biome-ignore lint/suspicious/noArrayIndexKey: markdown blocks are positional
              key={index}
              className="overflow-auto rounded-md bg-code-bg p-2 font-mono text-xs text-code-ink"
            >
              {code}
            </pre>
          );
        }
        const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
        if (heading) {
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: markdown blocks are positional
              key={index}
              className="font-semibold text-ink"
            >
              {heading[2]}
            </div>
          );
        }
        return (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: markdown blocks are positional
            key={index}
          >
            {inlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key++} className="rounded bg-edge-2 px-1 font-mono text-[12px]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    }
    last = at + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CsvTable({ body }: { body: string }) {
  const rows = body
    .trim()
    .split('\n')
    .slice(0, 51)
    .map((line) => line.split(','));
  return (
    <div className="mt-2 max-h-72 overflow-auto rounded-[10px] border border-edge">
      <table className="w-full text-left font-mono text-xs">
        <tbody>
          {rows.map((cells, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: csv rows are positional
            <tr key={r} className={r === 0 ? 'bg-card-2 font-semibold' : 'border-t border-edge-2'}>
              {cells.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: csv cells are positional
                <td key={c} className="px-2.5 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
