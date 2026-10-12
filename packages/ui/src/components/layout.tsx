import type { Manifest } from '@beacon-report/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { resetData } from '../lib/beacon-data';
import { formatDateTime, formatDuration } from '../lib/format';
import { useManifest } from '../lib/hooks';
import { useTheme } from '../lib/theme';
import { CommandPalette } from './command-palette';
import { IconBranch, IconCheck, IconCross, IconExternal, IconMoon, IconSun } from './icons';

const RUN_PILL: Record<Manifest['meta']['status'], { label: string; className: string }> = {
  passed: { label: 'Passed', className: 'bg-passed-tint text-passed-text' },
  failed: { label: 'Failed', className: 'bg-failed-tint text-failed-text' },
  timedout: { label: 'Timed out', className: 'bg-flaky-tint text-flaky-text' },
  interrupted: { label: 'Interrupted', className: 'bg-skipped-tint text-skipped-text' },
};

export function Layout() {
  const { dark, toggle } = useTheme();
  const { data } = useManifest();
  const meta = data?.manifest.meta;
  const pill = meta ? RUN_PILL[meta.status] : undefined;
  const title = data?.manifest.ui?.title;
  const branding = data?.manifest.ui?.branding;
  const navigate = useNavigate();
  useEffect(() => {
    if (title) document.title = `${title} — Beacon`;
  }, [title]);

  // Watch mode: while the reporter marks the run in progress, poll for the
  // next interim write — drop chunk caches, refetch everything. Works on any
  // static host (and file://) because chunks load via script tags.
  const queryClient = useQueryClient();
  const inProgress = meta?.inProgress === true;
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => {
      resetData();
      void queryClient.invalidateQueries();
    }, 2500);
    return () => clearInterval(timer);
  }, [inProgress, queryClient]);

  // White-labeling: an accentColor retints the brand tokens for both themes.
  useEffect(() => {
    const accent = branding?.accentColor;
    if (!accent) return;
    const root = document.documentElement.style;
    root.setProperty('--brand', accent);
    root.setProperty('--brand-text', accent);
    root.setProperty('--brand-soft', `color-mix(in srgb, ${accent} 12%, transparent)`);
    root.setProperty('--brand-ring', `color-mix(in srgb, ${accent} 18%, transparent)`);
  }, [branding?.accentColor]);

  // Keyboard shortcuts: d dashboard · t tests · w timeline · l theme · / search · ? help.
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'd') navigate({ to: '/' });
      else if (e.key === 't') navigate({ to: '/tests' });
      else if (e.key === 'w') navigate({ to: '/timeline' });
      else if (e.key === 'l') toggle();
      else if (e.key === '?') setHelpOpen((open) => !open);
      else if (e.key === 'Escape') setHelpOpen(false);
      else if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-search]');
        if (search) {
          e.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, toggle]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-edge bg-card/85 backdrop-blur">
        <div className="flex h-[60px] items-center gap-7 px-7">
          <Link to="/" className="flex items-center gap-2.5 text-ink">
            {branding?.logo ? (
              <img src={branding.logo} alt="" className="h-6 w-auto max-w-32" />
            ) : (
              <span
                className="h-3.5 w-3.5 rounded-full bg-brand"
                style={{ boxShadow: '0 0 0 4px var(--brand-ring)' }}
              />
            )}
            <span className="font-display text-[17px] font-bold">Beacon</span>
          </Link>
          {title && (
            <span className="-ml-3 border-l border-edge pl-3 text-sm font-medium text-ink-2">
              {title}
            </span>
          )}
          <nav className="flex gap-1.5 text-sm">
            <Link
              to="/"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeOptions={{ exact: true }}
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Dashboard
            </Link>
            <Link
              to="/tests"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Tests
            </Link>
            <Link
              to="/timeline"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Timeline
            </Link>
            <Link
              to="/gallery"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Media
            </Link>
            <Link
              to="/compare"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Compare
            </Link>
            <Link
              to="/flaky"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Flaky
            </Link>
            <Link
              to="/trends"
              className="rounded-lg px-3.5 py-[7px] text-ink-2"
              activeProps={{
                className: 'rounded-lg px-3.5 py-[7px] bg-brand-soft text-brand-text font-semibold',
              }}
            >
              Trends
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3.5">
            {inProgress ? (
              <span className="flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[13px] font-semibold text-brand-text">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Running
              </span>
            ) : (
              pill && (
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${pill.className}`}
                >
                  {meta?.status === 'passed' ? <IconCheck size={12} /> : <IconCross size={12} />}
                  {pill.label}
                </span>
              )
            )}
            {meta && (
              <span className="text-[13px] text-ink-3">
                {formatDateTime(meta.startTime)} · {formatDuration(meta.duration)}
              </span>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-edge bg-card text-ink-2"
            >
              {dark ? <IconSun size={15} /> : <IconMoon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {meta && (
        <section aria-label="Run info" className="border-b border-edge-2 bg-card-2">
          <div className="flex items-center gap-5 px-7 py-2.5 font-mono text-xs text-ink-3">
            {meta.ci?.branch && (
              <span className="flex items-center gap-1.5">
                <IconBranch size={12} />
                {meta.ci.branch}
              </span>
            )}
            {meta.ci?.sha && <span>{meta.ci.sha.slice(0, 7)}</span>}
            {meta.playwrightVersion && <span>Playwright {meta.playwrightVersion}</span>}
            {meta.configSnapshot && (
              <Link to="/config" className="text-brand-text hover:underline">
                config
              </Link>
            )}
            {meta.config.workers !== undefined && <span>{meta.config.workers} workers</span>}
            <span>{data?.manifest.projects.length} projects</span>
            {meta.config.shard && (
              <span>
                shard {meta.config.shard.current}/{meta.config.shard.total}
              </span>
            )}
            {meta.ci?.runUrl && (
              <a
                href={meta.ci.runUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1.5 font-sans text-brand-text"
              >
                CI run
                <IconExternal size={11} />
              </a>
            )}
          </div>
        </section>
      )}

      <main className="px-7 py-6">
        <Outlet />
      </main>
      <CommandPalette />
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ['d', 'Dashboard'],
  ['t', 'Tests'],
  ['w', 'Worker timeline'],
  ['/', 'Focus search'],
  ['j / k', 'Next / previous test (tests page)'],
  ['Esc', 'Close preview / dialogs'],
  ['⌘K / Ctrl-K', 'Command palette'],
  ['l', 'Toggle light/dark theme'],
  ['?', 'This help'],
];

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled globally
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
      onClick={onClose}
      role="presentation"
    >
      <dialog
        open
        className="static w-[420px] max-w-full rounded-[14px] border border-edge bg-card p-5 text-ink shadow-2xl"
        aria-label="Keyboard shortcuts"
      >
        <div className="text-sm font-semibold">Keyboard shortcuts</div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="contents">
              <kbd className="rounded-md border border-edge bg-card-2 px-2 py-0.5 text-center font-mono text-[11px] text-ink-2">
                {key}
              </kbd>
              <span className="text-ink-2">{label}</span>
            </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
