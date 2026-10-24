import { useState, useRef, useCallback } from 'react';
import { Search, X, ImageOff } from 'lucide-react';
import { Spinner } from '@/components/ui';

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string;

export interface UnsplashPhoto {
  id: string;
  urls: { regular: string; thumb: string; small: string };
  alt_description: string | null;
  user: { name: string; links: { html: string } };
}

interface Props {
  onSelect: (regularUrl: string, thumbUrl: string, attribution: { name: string; link: string }) => void;
  onCancel: () => void;
}

export function UnsplashPicker({ onSelect, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setPhotos([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } },
      );
      if (!res.ok) throw new Error('Unsplash search failed');
      const data = await res.json() as { results: UnsplashPhoto[] };
      setPhotos(data.results ?? []);
    } catch {
      setError('Could not load images. Check your Unsplash API key.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void search(v), 500);
  };

  const pick = (photo: UnsplashPhoto) => {
    setSelected(photo.id);
    onSelect(photo.urls.regular, photo.urls.thumb, {
      name: photo.user.name,
      link: photo.user.links.html,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search Unsplash…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setPhotos([]); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink transition"
        >
          Cancel
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {error && <p className="py-3 text-center text-xs text-danger">{error}</p>}
      {!loading && !error && photos.length === 0 && query.trim() && (
        <div className="flex flex-col items-center gap-1 py-6 text-muted">
          <ImageOff size={24} />
          <p className="text-xs">No results for "{query}"</p>
        </div>
      )}
      {!loading && photos.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                  selected === p.id ? 'border-brand' : 'border-transparent hover:border-brand/50'
                }`}
              >
                <img
                  src={p.urls.small}
                  alt={p.alt_description ?? 'Unsplash photo'}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                {selected === p.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand/30">
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted">
            Photos from{' '}
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">
              Unsplash
            </a>
          </p>
        </>
      )}
    </div>
  );
}
