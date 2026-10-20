import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui';

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  caption?: string;
  to?: string; // link to the post this image belongs to
}

/** Facebook-style full-image view: tapping an image opens it whole (never cropped),
 *  with a way to open the post it came from. */
export function ImageLightbox({ open, onClose, src, alt, caption, to }: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Image" className="ft-card relative w-full max-w-[95vw] max-h-[90vh] flex flex-col items-center bg-ink p-2 sm:p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-ink/90 hover:bg-ink/20"><X size={20} /></button>
        <img src={src} alt={alt ?? ''} className="max-w-full max-h-[70vh] object-contain rounded-lg bg-surface" />
        {caption && <p className="mt-2 text-sm text-muted text-center">{caption}</p>}
        {to && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link to={to}><Button size="sm">Open post</Button></Link>
            <a href={src} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary">View image</Button></a>
          </div>
        )}
      </div>
    </div>
  );
}
