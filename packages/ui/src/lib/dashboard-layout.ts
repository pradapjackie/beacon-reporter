import { create } from 'zustand';

/**
 * Per-viewer dashboard layout: reorder/hide on top of the report's configured
 * card list. The config (manifest.ui.cards) stays the team default and defines
 * which cards exist; this store holds one browser's personal override, exactly
 * like the theme toggle.
 */

const STORAGE_KEY = 'beacon-dashboard-layout';

interface StoredLayout {
  order: string[];
  hidden: string[];
}

interface DashboardLayoutState extends StoredLayout {
  customizing: boolean;
  setCustomizing: (on: boolean) => void;
  setOrder: (order: string[]) => void;
  toggleHidden: (card: string) => void;
  reset: () => void;
}

function load(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredLayout>;
      return {
        order: Array.isArray(parsed.order) ? parsed.order.filter((c) => typeof c === 'string') : [],
        hidden: Array.isArray(parsed.hidden)
          ? parsed.hidden.filter((c) => typeof c === 'string')
          : [],
      };
    }
  } catch {
    // localStorage unavailable — layout just won't persist.
  }
  return { order: [], hidden: [] };
}

function persist(layout: StoredLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore: private windows etc.
  }
}

export const useDashboardLayout = create<DashboardLayoutState>((set) => ({
  ...load(),
  customizing: false,
  setCustomizing: (on) => set({ customizing: on }),
  setOrder: (order) =>
    set((state) => {
      persist({ order, hidden: state.hidden });
      return { order };
    }),
  toggleHidden: (card) =>
    set((state) => {
      const hidden = state.hidden.includes(card)
        ? state.hidden.filter((c) => c !== card)
        : [...state.hidden, card];
      persist({ order: state.order, hidden });
      return { hidden };
    }),
  reset: () => {
    persist({ order: [], hidden: [] });
    return set({ order: [], hidden: [] });
  },
}));

/** Configured cards reordered by the viewer's saved order; unknown saved ids drop, new cards append. */
export function applyOrder(configured: string[], saved: string[]): string[] {
  const inConfig = new Set(configured);
  const ordered = saved.filter((c) => inConfig.has(c));
  const seen = new Set(ordered);
  return [...ordered, ...configured.filter((c) => !seen.has(c))];
}
