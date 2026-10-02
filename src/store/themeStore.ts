import { create } from 'zustand';
type Mode = 'light' | 'dark' | 'system';
interface ThemeState { mode: Mode; init: () => void; setMode: (m: Mode) => void; }
const apply = (m: Mode) => {
  const dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  init: () => { const m = (localStorage.getItem('ft-theme') as Mode) || 'system'; set({ mode: m }); apply(m); },
  setMode: (m) => { localStorage.setItem('ft-theme', m); set({ mode: m }); apply(m); },
}));
