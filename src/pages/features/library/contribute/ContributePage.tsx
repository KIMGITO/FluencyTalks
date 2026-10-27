import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, X, ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Select, Textarea, Input } from '@/components/ui';
import { useLanguageStore } from '@/store/languageStore';
import { qualifiedLanguages } from '@/lib/corrections';
import { useProfileStore } from '@/store/profileStore';
import { isContributionEligible, postContribution } from '@/services/library';
import { UnsplashPicker } from '@/components/features/library/UnsplashPicker';

export default function ContributePage() {
  const navigate = useNavigate();
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
      await new Promise(r => setTimeout(r, 500));

      navigate('/library');
    } catch (e: any) {
      setError(e.message || 'Could not post to the library.');
    } finally {
      setBusy(false);
    }
  };

  if (!canContribute) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <PageHeader title="Contribute" />
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-4xl">🔒</div>
          <p className="max-w-sm text-muted">
            Only verified native speakers or learners at <strong>B1 or above</strong> can contribute.
            Verify your language in your profile to unlock this.
          </p>
          <Button variant="secondary" onClick={() => navigate('/library')}>Go back to Library</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl p-4 pb-24">
      <button
        onClick={() => navigate('/library')}
        className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> Back to Library
      </button>

      <PageHeader title="New Contribution" />

      <div className="space-y-4">
        <Textarea
          label="Phrase / idiom *"
          rows={2}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="e.g. break the ice"
        />

        <Select
          label="Language *"
          searchable
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="">Select a language</option>
          {languages.map((id) => (
            <option key={id} value={id}>{languageName(id)}</option>
          ))}
        </Select>

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
            <img src={unsplashThumb || unsplashUrl} alt="Selected" className="h-48 w-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-between p-2">
              <button
                type="button"
                onClick={() => { setUnsplashUrl(''); setUnsplashThumb(''); setUnsplashAttrib(null); }}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-white hover:bg-ink/80 transition"
              >
                <X size={16} />
              </button>
              {unsplashAttrib && (
                <p className="bg-black/40 px-2 py-1 text-[10px] text-white/80">
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted transition hover:border-brand/50 hover:text-brand"
          >
            <Image size={18} />
            Add an image from Unsplash (optional)
          </button>
        )}

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex justify-end pt-4">
          <Button size="lg" loading={busy} onClick={submit}>Post to Library</Button>
        </div>
      </div>
    </div>
  );
}

