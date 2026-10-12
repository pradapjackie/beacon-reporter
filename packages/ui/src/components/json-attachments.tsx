import type { AttachmentRef } from '@beacon-report/shared';
import { useState } from 'react';
import { formatDuration } from '../lib/format';
import { IconDownload } from './icons';

/**
 * Structured JSON attachment viewers: HAR network logs and axe accessibility
 * scans. Both lazy-fetch on expand and degrade to a download link when
 * fetch() is unavailable (file://).
 */

export function isHar(a: AttachmentRef): boolean {
  return a.name.toLowerCase().includes('har') && a.contentType.includes('json');
}
export function isAxe(a: AttachmentRef): boolean {
  const n = a.name.toLowerCase();
  return (n.includes('axe') || n.includes('a11y')) && a.contentType.includes('json');
}

interface HarEntry {
  request?: { method?: string; url?: string };
  response?: { status?: number; content?: { size?: number } };
  time?: number;
}

interface AxeViolation {
  id?: string;
  impact?: string;
  help?: string;
  nodes?: unknown[];
}

function useLazyJson(href: string) {
  const [data, setData] = useState<unknown | null>(null);
  const [state, setState] = useState<'closed' | 'open' | 'failed'>('closed');
  const toggle = async () => {
    if (state === 'open') {
      setState('closed');
      return;
    }
    if (data === null) {
      try {
        const res = await fetch(href);
        setData(await res.json());
      } catch {
        setState('failed');
        return;
      }
    }
    setState('open');
  };
  return { data, state, toggle };
}

function ExpandButton({
  label,
  meta,
  open,
  onClick,
}: {
  label: string;
  meta: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-[9px] border border-edge px-3 py-2.5 text-[13px] text-brand-text hover:bg-card-2"
    >
      <span className="text-[10px] text-ink-4">{open ? '▾' : '▸'}</span>
      {label}
      <span className="text-xs text-ink-4">{meta}</span>
    </button>
  );
}

function FallbackLink({ href, name }: { href: string; name: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-[9px] border border-edge px-3 py-2.5 text-[13px] text-brand-text hover:bg-card-2"
    >
      <IconDownload size={13} />
      {name}
    </a>
  );
}

export function HarCard({ attachment, href }: { attachment: AttachmentRef; href: string }) {
  const { data, state, toggle } = useLazyJson(href);
  if (state === 'failed') return <FallbackLink href={href} name={attachment.name} />;
  const entries: HarEntry[] = (
    (data as { log?: { entries?: HarEntry[] } } | null)?.log?.entries ?? []
  ).slice(0, 100);
  return (
    <div className="w-full min-w-0">
      <ExpandButton
        label={attachment.name}
        meta="network log"
        open={state === 'open'}
        onClick={toggle}
      />
      {state === 'open' && (
        <div className="mt-2 max-h-72 overflow-auto rounded-[10px] border border-edge">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-card-2 font-semibold">
                <td className="px-2.5 py-1.5">method</td>
                <td className="px-2.5 py-1.5">url</td>
                <td className="px-2.5 py-1.5">status</td>
                <td className="px-2.5 py-1.5">time</td>
                <td className="px-2.5 py-1.5">size</td>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const status = entry.response?.status ?? 0;
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: HAR entries are positional
                  <tr key={i} className="border-t border-edge-2">
                    <td className="px-2.5 py-1.5">{entry.request?.method ?? '—'}</td>
                    <td className="max-w-80 truncate px-2.5 py-1.5">{entry.request?.url ?? '—'}</td>
                    <td
                      className={`px-2.5 py-1.5 ${status >= 400 ? 'font-semibold text-failed-text' : status >= 300 ? 'text-flaky-text' : 'text-passed-text'}`}
                    >
                      {status || '—'}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {entry.time !== undefined ? formatDuration(entry.time) : '—'}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {entry.response?.content?.size !== undefined
                        ? `${entry.response.content.size} B`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const IMPACT_TONE: Record<string, string> = {
  critical: 'bg-failed-tint text-failed-text',
  serious: 'bg-failed-tint text-failed-text',
  moderate: 'bg-flaky-tint text-flaky-text',
  minor: 'bg-skipped-tint text-skipped-text',
};

export function AxeCard({ attachment, href }: { attachment: AttachmentRef; href: string }) {
  const { data, state, toggle } = useLazyJson(href);
  if (state === 'failed') return <FallbackLink href={href} name={attachment.name} />;
  const violations: AxeViolation[] =
    (data as { violations?: AxeViolation[] } | null)?.violations ?? [];
  return (
    <div className="w-full min-w-0">
      <ExpandButton
        label={attachment.name}
        meta="accessibility scan"
        open={state === 'open'}
        onClick={toggle}
      />
      {state === 'open' && (
        <div className="mt-2 flex flex-col gap-2">
          {violations.length === 0 && (
            <div className="rounded-[10px] border border-edge px-3 py-2 text-[13px] text-passed-text">
              No violations.
            </div>
          )}
          {violations.map((v) => (
            <div
              key={`${v.id}:${v.help}`}
              className="rounded-[10px] border border-edge-2 px-3 py-2 text-[13px]"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{v.id ?? 'rule'}</span>
                {v.impact && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${IMPACT_TONE[v.impact] ?? 'bg-edge-2 text-ink-2'}`}
                  >
                    {v.impact}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-3">
                  {(v.nodes ?? []).length} element{(v.nodes ?? []).length === 1 ? '' : 's'}
                </span>
              </div>
              {v.help && <div className="mt-1 text-ink-2">{v.help}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
