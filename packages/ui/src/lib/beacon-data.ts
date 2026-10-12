import type { Manifest } from '@beacon-report/shared';

/**
 * Chunk loader for the report data files.
 *
 * Every data file is a `.js` chunk calling `window.__BEACON__.push(key, data)`,
 * loaded by injecting a <script> tag — the only strategy that works on
 * file://, localhost, and static hosting alike (fetch() of local JSON is
 * blocked on file://). TanStack Query wraps this loader for caching.
 */

type PushRegistry = { push: (key: string, data: unknown) => void };

declare global {
  interface Window {
    __BEACON__?: PushRegistry;
    /** Single-file export: data chunks inlined ahead of the app. */
    __BEACON_PRELOADED__?: Record<string, unknown>;
    __BEACON_SINGLE_FILE__?: boolean;
    /** e.g. 'failures' for a failures-only export. */
    __BEACON_VARIANT__?: string;
    /** Single-file export: sha256 → data URI for inlined attachments. */
    __BEACON_INLINE_ATTACHMENTS__?: Record<string, string>;
  }
}

const received = new Map<string, unknown>();
const waiters = new Map<string, (data: unknown) => void>();
/** Bumped by resetData(); busts browser caching of re-loaded chunk scripts. */
let generation = 0;

/**
 * Live mode: drop every cached chunk so the next loads re-inject fresh
 * scripts (with a cache-busting query) and pick up the reporter's latest
 * interim write. No-op for single-file exports — their data is baked in.
 */
export function resetData(): void {
  received.clear();
  detailOrder.length = 0;
  generation += 1;
}

/** Detail chunks are LRU-capped so browsing a 50k-test report stays bounded. */
const DETAIL_CACHE_MAX = 40;
const detailOrder: string[] = [];

function remember(key: string, data: unknown): void {
  received.set(key, data);
  if (!key.startsWith('details/')) return;
  const at = detailOrder.indexOf(key);
  if (at >= 0) detailOrder.splice(at, 1);
  detailOrder.push(key);
  while (detailOrder.length > DETAIL_CACHE_MAX) {
    const evict = detailOrder.shift();
    if (evict) received.delete(evict);
  }
}

function ensureRegistry(): void {
  window.__BEACON__ = {
    push(key, data) {
      remember(key, data);
      waiters.get(key)?.(data);
      waiters.delete(key);
    },
  };
}

export function loadChunk<T>(key: string, timeoutMs = 10_000): Promise<T> {
  ensureRegistry();
  // Single-file exports inline every chunk ahead of the app.
  const preloaded = window.__BEACON_PRELOADED__?.[key];
  if (preloaded !== undefined) return Promise.resolve(preloaded as T);
  const cached = received.get(key);
  if (cached !== undefined) return Promise.resolve(cached as T);

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(key);
      reject(new Error(`Timed out loading data chunk "${key}"`));
    }, timeoutMs);

    waiters.set(key, (data) => {
      clearTimeout(timer);
      resolve(data as T);
    });

    const script = document.createElement('script');
    script.src = generation === 0 ? `data/${key}.js` : `data/${key}.js?v=${generation}`;
    script.onerror = () => {
      clearTimeout(timer);
      waiters.delete(key);
      reject(new Error(`Failed to load data chunk "${key}"`));
    };
    document.head.appendChild(script);
  });
}

export const loadManifest = () => loadChunk<Manifest>('manifest');

/** Rendered when no data/ directory is present (e.g. `pnpm dev` in this package). */
export const sampleManifest: Manifest = {
  meta: {
    schemaVersion: 1,
    beaconVersion: '0.0.0-dev',
    playwrightVersion: '1.49.0',
    generatedAt: Date.now(),
    startTime: Date.now() - 74_000,
    duration: 74_000,
    status: 'passed',
    config: { workers: 4, fullyParallel: true },
    errors: [],
  },
  counts: { total: 128, expected: 117, unexpected: 3, flaky: 5, skipped: 3 },
  projects: [{ name: 'chromium' }, { name: 'firefox' }],
  files: ['tests/auth.spec.ts', 'tests/checkout.spec.ts', 'tests/search.spec.ts'],
  tags: ['@smoke', '@regression'],
  chunks: { index: 0, details: 0 },
  aggregates: {},
};
