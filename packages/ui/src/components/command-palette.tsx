import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OUTCOME_DOT } from '../lib/format';
import { useManifest, useRows } from '../lib/hooks';

/** Cmd/Ctrl-K palette: fuzzy-jump to any test from anywhere. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const manifest = useManifest();
  const rows = useRows(manifest.data);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setCursor(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = rows.data ?? [];
    const pool = q
      ? all.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.file.toLowerCase().includes(q) ||
            r.project.toLowerCase().includes(q),
        )
      : all;
    return pool.slice(0, 10);
  }, [rows.data, query]);

  if (!open) return null;

  const go = (caseId: string) => {
    setOpen(false);
    navigate({ to: '/tests/$caseId', params: { caseId } });
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal; Escape works globally
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clicks inside must not dismiss */}
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-[14px] border border-edge bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter') {
              const row = matches[cursor];
              if (row) go(row.caseId);
            }
          }}
          placeholder="Jump to test…"
          className="w-full border-b border-edge bg-card px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-4"
        />
        <div className="max-h-[50vh] overflow-auto py-1">
          {matches.map((row, i) => (
            <button
              key={row.caseId}
              type="button"
              onClick={() => go(row.caseId)}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] ${
                i === cursor ? 'bg-brand-soft' : ''
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${OUTCOME_DOT[row.outcome]}`} />
              <span className="min-w-0 grow truncate">{row.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-3">
                {row.project || 'default'}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-3">No matching tests.</div>
          )}
        </div>
        <div className="border-t border-edge-2 px-4 py-1.5 text-[10px] text-ink-4">
          ↑↓ navigate · Enter open · Esc close
        </div>
      </div>
    </div>
  );
}
