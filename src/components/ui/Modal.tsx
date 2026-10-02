import { useEffect, type ReactNode } from 'react';
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => { if (!open) return; const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="ft-card w-full max-w-md space-y-4 p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{title}</h2>{children}
      </div>
    </div>
  );
}
