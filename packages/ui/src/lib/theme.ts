import { create } from 'zustand';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

function initialDark(): boolean {
  try {
    const stored = localStorage.getItem('beacon-theme');
    if (stored) return stored === 'dark';
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export const useTheme = create<ThemeState>((set) => ({
  dark: initialDark(),
  toggle: () =>
    set((state) => {
      const dark = !state.dark;
      document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem('beacon-theme', dark ? 'dark' : 'light');
      } catch {
        // localStorage unavailable (e.g. some file:// contexts) — theme just won't persist.
      }
      return { dark };
    }),
}));
