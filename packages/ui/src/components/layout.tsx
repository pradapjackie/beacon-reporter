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

  // Watch mode polls quickly while a run is in progress. A slower poll keeps
  // running afterwards so a report opened before the first interim write
  // still notices the new run. Single-file exports are baked in.
  const queryClient = useQueryClient();
  const inProgress = meta?.inProgress === true;
  useEffect(() => {
    if (window.__BEACON_SINGLE_FILE__) return;
    const timer = setInterval(
      () => {
        resetData();
        void queryClient.invalidateQueries();
      },
      inProgress ? 2500 : 8000,
    );
    return () => clearInterval(timer);
  }, [inProgress, queryClient]);

  // White-labeling: an accentColor retints the brand tokens for both themes.
  // Link text uses a darkened (or lightened) shade so it stays above 4.5:1.
  useEffect(() => {
    const accent = branding?.accentColor;
    if (!accent) return;
    const root = document.documentElement.style;
    root.setProperty('--brand', accent);
    root.setProperty('--brand-text', readableAccent(accent, dark));
    root.setProperty('--brand-soft', `color-mix(in srgb, ${accent} 12%, transparent)`);
    root.setProperty('--brand-ring', `color-mix(in srgb, ${accent} 18%, transparent)`);
  }, [branding?.accentColor, dark]);

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
        <div className="flex min-h-[60px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-2 sm:px-7">
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
          <nav className="flex flex-wrap gap-1.5 text-sm">
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
              onClick={() => setHelpOpen(true)}
              className="hidden text-[13px] text-ink-3 hover:text-brand-text sm:inline"
            >
              Shortcuts
            </button>
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

function readableAccent(hex: string, dark: boolean): string {
  const parsed = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!parsed?.[1]) return dark ? '#e8edf4' : '#312e81';
  const raw = parsed[1];
  let rgb: [number, number, number] = [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
  const background: [number, number, number] = dark ? [21, 29, 43] : [255, 255, 255];
  const toward: [number, number, number] = dark ? [232, 237, 244] : [30, 27, 75];
  for (let step = 0; step < 12 && contrastRatio(rgb, background) < 4.5; step++) {
    rgb = [
      Math.round(rgb[0] * 0.78 + toward[0] * 0.22),
      Math.round(rgb[1] * 0.78 + toward[1] * 0.22),
      Math.round(rgb[2] * 0.78 + toward[2] * 0.22),
    ];
  }
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
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
