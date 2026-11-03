import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/** Blog pages are an HTML string, so their links aren't router links: this keeps a tap on one from reloading the app. */
export function useBlogLinks() {
  const navigate = useNavigate();
  return useCallback((e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href || !href.startsWith('/') || a?.target === '_blank') return;
    e.preventDefault();
    navigate(href);
    window.scrollTo(0, 0);
  }, [navigate]);
}
