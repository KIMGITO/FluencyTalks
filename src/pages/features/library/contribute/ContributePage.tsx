import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Image, X, ChevronLeft, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Select, Spinner, Textarea, Input } from '@/components/ui';
import { useLanguageStore } from '@/store/languageStore';
import { qualifiedLanguages } from '@/lib/corrections';
import { useProfileStore } from '@/store/profileStore';
import { getContribution, isContributionEligible, postContribution, updateContribution, type TextAlign } from '@/services/library';
import { useFeedCache } from '@/store/feedCache';
import { UnsplashPicker } from '@/components/features/library/UnsplashPicker';

export default function ContributePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editId = useSearchParams()[0].get('edit');
  const [loadingPost, setLoadingPost] = useState(!!editId);
  // Back to wherever the user came from (Home composer, Library, a profile); Library on a direct load.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/library'));
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState<'phrase' | 'idiom' | 'usage' | 'grammar'>('phrase');
  const [sourceContext, setSourceContext] = useState('');
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  const [unsplashUrl, setUnsplashUrl] = useState('');
  const [unsplashThumb, setUnsplashThumb] = useState('');
  const [unsplashAttrib, setUnsplashAttrib] = useState<{ name: string; link: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languageName = useLanguageStore((s) => s.name);
  const me = useProfileStore((s) => s.me);
  const qualified = qualifiedLanguages(me);   // only languages you are qualified to teach (the server checks too)
  // When editing, keep the post's own language selectable even if it is not in the list.
  const languages = language && !qualified.includes(language) ? [language, ...qualified] : qualified;

  useEffect(() => {
    if (!editId) return;
    getContribution(editId)
      .then((p) => {
        if (!p || p.user_id !== me?.id) { setError('This post cannot be edited.'); return; }
        setPhrase(p.phrase);
        setTranslation(p.translation ?? '');
        setLanguage(p.language_id ?? '');
        setCategory(p.category);
        setSourceContext(p.source_context ?? '');
        setTextAlign(p.text_align ?? 'left');
        setUnsplashUrl(p.unsplash_image_url ?? '');
      })
      .catch(() => setError('Could not load this post.'))
      .finally(() => setLoadingPost(false));
  }, [editId, me?.id]);
  const canContribute = isContributionEligible(me);

  const submit = async () => {
    setError(null);
    if (!phrase.trim()) { setError('Phrase is required.'); return; }
    if (!language) { setError('Please select a language.'); return; }
    setBusy(true);
    try {
      if (editId) {
        await updateContribution(editId, phrase.trim(), translation.trim() || null, language, category, sourceContext.trim() || null, unsplashUrl || null, textAlign);
      } else {
        await postContribution(
          phrase.trim(),
          translation.trim() || null as any,
          language,
          category,
          sourceContext.trim() || null as any,
          unsplashUrl || null as any,
          textAlign,
        );
      }
      await new Promise(r => setTimeout(r, 500));

      useFeedCache.getState().invalidate('posts:');   // every post list refreshes on the next visit
      goBack();
    } catch (e: any) {
      setError(e.message || (editId ? 'Could not save your changes.' : 'Could not post to the library.'));
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
  if (loadingPost) return <div className="flex justify-center p-8"><Spinner /></div>;

  return (
    <div className="mx-auto w-full max-w-3xl p-4 pb-24">
      <button
        onClick={goBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <PageHeader title={editId ? 'Edit post' : 'New Contribution'} />

      <div className="space-y-4">
        <div>
          <Textarea
            label="Phrase / idiom *"
            rows={3}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. break the ice"
            className={textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left'}
          />
          {/* Alignment of the text on the post (left by default) */}
          <div role="radiogroup" aria-label="Text alignment" className="mt-2 inline-flex rounded-md border border-border bg-surface-2 p-0.5">
            {([['left', AlignLeft, 'Align left'], ['center', AlignCenter, 'Align center'], ['right', AlignRight, 'Align right']] as const).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={textAlign === value}
                aria-label={label}
                title={label}
                onClick={() => setTextAlign(value)}
                className={`flex h-8 w-9 items-center justify-center rounded-sm transition ${textAlign === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

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
          placeholder="e.g. phá băng"
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
          <div className="relative overflow-hidden rounded-md">
            <img src={unsplashThumb || unsplashUrl} alt="Selected" className="h-48 w-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-between p-2">
              <button
                type="button"
                onClick={() => { setUnsplashUrl(''); setUnsplashThumb(''); setUnsplashAttrib(null); }}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-on-deep hover:bg-ink/80 transition"
              >
                <X size={16} />
              </button>
              {unsplashAttrib && (
                <p className="bg-deep/40 px-2 py-1 text-[10px] text-on-deep/80">
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
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-4 text-sm text-muted transition hover:border-brand/50 hover:text-brand"
          >
            <Image size={18} />
            Add an image from Unsplash (optional)
          </button>
        )}

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex justify-end pt-4">
          <Button size="lg" loading={busy} onClick={submit}>{editId ? 'Save changes' : 'Post to Library'}</Button>
        </div>
      </div>
    </div>
  );
}

