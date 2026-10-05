import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/** The app's one search field: icon, clear button, Escape to reset. */
export function SearchBox({ value, onChange, placeholder = 'Search people and chats…', autoFocus = true }: { value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  return (
    <div className="relative">
      <Search size={18} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={input} value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); input.current?.focus(); } }}
        placeholder={placeholder} aria-label="Search FluencyTalks" autoComplete="off"
        className="w-full rounded-full border border-border bg-surface-2 py-2.5 pl-10 pr-10 text-base text-ink transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted transition hover:bg-surface hover:text-ink">
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}