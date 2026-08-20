import { create } from 'zustand';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'pdv.theme';

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'dark';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const initial = readInitial();
if (typeof document !== 'undefined') applyTheme(initial);

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial,
  setTheme: (t) => {
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
    set({ theme: t });
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));
