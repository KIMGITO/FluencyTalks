import { useEffect, type ReactNode } from 'react';
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => { if (!open) return; const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-deep/60 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="ft-card w-full max-w-md space-y-4 p-5 shadow-pop sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-medium">{title}</h2>{children}
      </div>
    </div>
  );
}
