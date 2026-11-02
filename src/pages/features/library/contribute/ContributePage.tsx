import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Image, X, ChevronLeft, AlignLeft, AlignCenter, AlignRight, Check, Lock } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, DeniedState, Select, Textarea, ThreadSkeleton, Input } from '@/components/ui';
import { useLanguageStore } from '@/store/languageStore';
import { qualifiedLanguages } from '@/lib/corrections';
import { useProfileStore } from '@/store/profileStore';
import { getContribution, isContributionEligible, postContribution, updateContribution, type TextAlign } from '@/services/library';
import { useFeedCache } from '@/store/feedCache';
import { useAccountabilityStore } from '@/store/accountabilityStore';
import { toast } from '@/store/toastStore';
import { LanguageMark } from '@/components/features/LanguagePicker';
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
  // When editing, a post can keep its language even if you no longer qualify (the server allows that too).
  const languages = language && !qualified.includes(language) ? [language, ...qualified] : qualified;
  // Your learning language before verified B1: shown locked, so its absence explains itself.
  const lockedLearning = me?.learning_language_id && !languages.includes(me.learning_language_id) ? me.learning_language_id : null;
  const languageNote = (id: string) =>
    id === me?.native_language_id ? 'Native' : id === me?.learning_language_id && qualified.includes(id) ? `Learning · verified ${me.verified_level}` : 'This post’s language';

  // A new post starts in your native language.
  useEffect(() => { if (!editId && !language && qualified[0]) setLanguage(qualified[0]); }, [editId, language, qualified[0]]);

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
        setLocked((p.thread_count ?? 0) > 0 || (p.endorse_count ?? 0) > 0);
      })
      .catch(() => setError('Could not load this post.'))
      .finally(() => setLoadingPost(false));
  }, [editId, me?.id]);
  const canContribute = isContributionEligible(me);
  const restriction = useAccountabilityStore((s) => s.data?.restriction ?? null);
  const [locked, setLocked] = useState(false);   // people are discussing this text, so only the rest can change

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
      toast.success(editId ? 'Changes saved.' : 'Posted to the Library.');
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
            Set your native language in your profile to start posting. Your learning language unlocks once you're verified at <strong>B1</strong>.
          </p>
          <Button variant="secondary" onClick={() => navigate('/library')}>Go back to Library</Button>
        </div>
      </div>
    );
  }
  if (loadingPost) return <div className="mx-auto w-full max-w-3xl p-4"><ThreadSkeleton /></div>;
  if (restriction && !editId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <PageHeader title="Contribute" />
        <DeniedState title="New posts are paused" text={`${restriction.reason}. Answer them, ask for more time, or appeal, and posting comes back.`}
          action={<Link to="/notifications" className="font-semibold underline">See what's waiting</Link>} />
      </div>
    );
  }

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
        {locked && <p className="rounded-md bg-warning/10 p-2.5 text-sm text-warning">People are discussing this text, so the phrase, translation and language can't change. Corrections go through the discussion. You can still edit the rest.</p>}
        <div>
          <Textarea
            label="Phrase / idiom *"
            rows={3}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="e.g. break the ice"
            disabled={locked}
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

        <div>
          <span id="post-language" className="mb-1 block text-sm font-semibold text-ink">Language this post teaches *</span>
          <div role="radiogroup" aria-labelledby="post-language" className="grid gap-2 sm:grid-cols-2">
            {languages.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={language === id}
                disabled={locked}
                onClick={() => setLanguage(id)}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${language === id ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-ink/40'}`}
              >
                <LanguageMark id={id} active={language === id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{languageName(id)}</span>
                  <span className="block truncate text-xs text-muted">{languageNote(id)}</span>
                </span>
                {language === id && <Check size={18} aria-hidden className="shrink-0 text-accent" />}
              </button>
            ))}
            {lockedLearning && (
              <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-3 opacity-80">
                <LanguageMark id={lockedLearning} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-muted">{languageName(lockedLearning)}</span>
                  <span className="block text-xs text-muted">Posting unlocks when you're verified at B1. <Link to="/profile/edit" className="underline hover:text-ink">See your progress</Link></span>
                </span>
                <Lock size={16} aria-hidden className="shrink-0 text-muted" />
              </div>
            )}
          </div>
        </div>

        <Input
          label="Translation (optional)"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="e.g. phá băng"
          disabled={locked}
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

