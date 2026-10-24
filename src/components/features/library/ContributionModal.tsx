import { useState } from 'react';
import { Button, Input, Modal, Select, Textarea, Spinner } from '@/components/ui';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { isContributionEligible, postContribution, type ContributionPost } from '@/services/library';


export function ContributionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState<'phrase' | 'idiom' | 'usage' | 'grammar'>('phrase');
  const [sourceContext, setSourceContext] = useState('');
  const [unsplashUrl, setUnsplashUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ContributionPost | null>(null);

  const languageName = useLanguageStore((s) => s.name);
  const me = useProfileStore((s) => s.me);
  const canContribute = isContributionEligible(me);

  const submit = async () => {
    setError(null);
    if (!phrase.trim() || !language) {
      setError('Phrase and language are required.');
      return;
    }
    setBusy(true);
    try {
      const id = await postContribution(phrase.trim(), translation?.trim() || null as any, language?.trim() || null as any, category, sourceContext?.trim() || null as any, unsplashUrl?.trim() || null as any);
      setSaved({ id, user_id: me?.id ?? '', certified_at: new Date().toISOString(), language_id: language, phrase: phrase.trim(), translation: translation.trim() || null, category, source_context: sourceContext.trim() || null, unsplash_image_url: unsplashUrl.trim() || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      setPhrase(''); setTranslation(''); setLanguage(''); setSourceContext(''); setUnsplashUrl(''); setCategory('phrase');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Could not post to the library.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Contribute to the Community Library">
      {!canContribute && (
        <div className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          Only verified native speakers or learners at B1 or above can contribute to the library. Please upgrade your language certification in your profile.
        </div>
      )}
      {canContribute ? (
        <>
          <Textarea label="Phrase / idiom" rows={2} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="e.g. break the ice" />
          <Input label="Language (ISO 639-3)" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="eng" />
          <Input label="Translation" value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="e.g. to initier une conversation" />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="phrase">Phrase</option>
            <option value="idiom">Idiom</option>
            <option value="usage">Usage example</option>
            <option value="grammar">Grammar</option>
          </Select>
          <Textarea label="Source context (optional)" rows={2} value={sourceContext} onChange={(e) => setSourceContext(e.target.value)} placeholder="Where you saw it used" />
          <Input label="Unsplash image URL (optional)" value={unsplashUrl} onChange={(e) => setUnsplashUrl(e.target.value)} placeholder="https://images.unsplash.com/…" />
          {error && <p className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button loading={busy} onClick={submit}>Post to library</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">!</div>
          <p className="text-sm text-danger">You are not eligible yet. Verify your native language or reach B1+ in your learning language to contribute.</p>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      )}
    </Modal>
  );
}
