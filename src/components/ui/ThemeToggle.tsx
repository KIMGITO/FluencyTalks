import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { Button } from './Button';
export function ThemeToggle() {
  const { mode, setMode } = useThemeStore();
  const dark = document.documentElement.dataset.theme === 'dark';
  return <Button variant="ghost" size="sm" aria-label="Toggle theme" data-mode={mode} onClick={() => setMode(dark ? 'light' : 'dark')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</Button>;
}
