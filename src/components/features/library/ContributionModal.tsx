import { useState } from 'react';
import { Image, X } from 'lucide-react';
import { Button, Modal, Select, Spinner, Textarea } from '@/components/ui';
import { Input } from '@/components/ui';
import { useLanguageStore } from '@/store/languageStore';
import { qualifiedLanguages } from '@/lib/corrections';
import { useProfileStore } from '@/store/profileStore';
import { isContributionEligible, postContribution, type ContributionPost } from '@/services/library';
import { UnsplashPicker } from './UnsplashPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

export function ContributionModal({ open, onClose, onPosted }: Props) {
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState<'phrase' | 'idiom' | 'usage' | 'grammar'>('phrase');
  const [sourceContext, setSourceContext] = useState('');
  const [unsplashUrl, setUnsplashUrl] = useState('');
  const [unsplashThumb, setUnsplashThumb] = useState('');
  const [unsplashAttrib, setUnsplashAttrib] = useState<{ name: string; link: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languageName = useLanguageStore((s) => s.name);
  const me = useProfileStore((s) => s.me);
  const languages = qualifiedLanguages(me);   // only languages you are qualified to teach (the server checks too)
  const canContribute = isContributionEligible(me);

  const reset = () => {
    setPhrase(''); setTranslation(''); setLanguage(''); setSourceContext('');
    setUnsplashUrl(''); setUnsplashThumb(''); setUnsplashAttrib(null); setShowPicker(false);
    setCategory('phrase'); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    setError(null);
    if (!phrase.trim()) { setError('Phrase is required.'); return; }
    if (!language) { setError('Please select a language.'); return; }
    setBusy(true);
    try {
      await postContribution(
        phrase.trim(),
        translation.trim() || null as any,
        language,
        category,
        sourceContext.trim() || null as any,
        unsplashUrl || null as any,
      );
      reset();
      onPosted?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Could not post to the library.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Contribute to the Library">
      {!canContribute ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-3xl">🔒</div>
          <p className="text-sm text-muted">
            Only verified native speakers or learners at <strong>B1 or above</strong> can contribute.
            Verify your language in your profile to unlock this.
          </p>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            label="Phrase / idiom *"
            rows={2}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. break the ice"
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Language *</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Select a language…</option>
              {languages.map((id) => (
                <option key={id} value={id}>{languageName(id)}</option>
              ))}
            </select>
          </label>

          <Input
            label="Translation (optional)"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="e.g. initier une conversation"
          />

          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
          >
            <option value="phrase">Phrase</option>
            <option value="idiom">Idiom</option>
            <option value="usage">Usage example</option>
            <option value="grammar">Grammar</option>
          </Select>

          <Textarea
            label="Source context (optional)"
            rows={2}
            value={sourceContext}
            onChange={(e) => setSourceContext(e.target.value)}
            placeholder="Where you saw or heard it used"
          />

          {unsplashUrl ? (
            <div className="relative overflow-hidden rounded-xl">
              <img src={unsplashThumb || unsplashUrl} alt="Selected" className="h-36 w-full object-cover" />
              <div className="absolute inset-0 flex flex-col justify-between p-2">
                <button
                  type="button"
                  onClick={() => { setUnsplashUrl(''); setUnsplashThumb(''); setUnsplashAttrib(null); }}
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-ink/60 text-white hover:bg-ink/80 transition"
                >
                  <X size={14} />
                </button>
                {unsplashAttrib && (
                  <p className="text-[10px] text-white/80">
                    Photo by{' '}
                    <a href={unsplashAttrib.link} target="_blank" rel="noopener noreferrer" className="underline">
                      {unsplashAttrib.name}
                    </a>{' '}
                    on Unsplash
                  </p>
                )}
              </div>
            </div>
          ) : showPicker ? (
            <UnsplashPicker
              onSelect={(regular, thumb, attrib) => {
                setUnsplashUrl(regular);
                setUnsplashThumb(thumb);
                setUnsplashAttrib(attrib);
                setShowPicker(false);
              }}
              onCancel={() => setShowPicker(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted transition hover:border-brand/50 hover:text-brand"
            >
              <Image size={16} />
              Add an image from Unsplash (optional)
            </button>
          )}

          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={handleClose} disabled={busy}>Cancel</Button>
            <Button loading={busy} onClick={submit}>Post to Library</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
