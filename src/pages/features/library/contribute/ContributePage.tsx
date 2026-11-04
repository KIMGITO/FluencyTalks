import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, AlignLeft, AlignCenter, AlignRight, Camera, Check, GraduationCap, Lock, Languages, MessageCircleQuestion, PencilLine, ScrollText, Sparkles, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, DeniedState, Select, Textarea, ThreadSkeleton, Input } from '@/components/ui';
import { useLanguageStore } from '@/store/languageStore';
import { qualifiedLanguages } from '@/lib/corrections';
import { useProfileStore } from '@/store/profileStore';
import { getContribution, isContributionEligible, postContribution, updateContribution, type ContributionPost, type ImageLayout, type TextAlign } from '@/services/library';
import { useFeedCache } from '@/store/feedCache';
import { useAccountabilityStore } from '@/store/accountabilityStore';
import { toast } from '@/store/toastStore';
import { LanguageMark } from '@/components/features/LanguagePicker';
import { ImageField } from '@/components/features/library/ImageField';
import { HelpComposer } from '@/components/features/library/HelpComposer';
import { userMessage } from '@/lib/errors';
import { isPractice, MAX_OVERLAY_TEXT, maxBody, type PracticeType } from '@/lib/postTypes';
import { checkText, cleanText, firstProblem } from '@/lib/validate';

const MAX_PHRASE = 500;
const MAX_NOTE = 500;

function TypeOption({ icon: Icon, title, text, onClick }: { icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ft-card flex w-full items-start gap-3 p-4 text-left transition hover:bg-surface-2">
      <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}

const POST_TITLE: Record<PracticeType, string> = { correct_me: 'Correct me', how_do_i_say: 'How do I say…?', story: 'Story or journal', question: 'Question or discussion', photo: 'Photo and caption' };

export default function ContributePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const editId = params.get('edit');
  const type = params.get('type');
  const [helpPost, setHelpPost] = useState<ContributionPost | null>(null);   // the post being edited, when it is a request for help
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
  const [imageLayout, setImageLayout] = useState<ImageLayout>('above');
  const [body, setBody] = useState('');
  const [editingLesson, setEditingLesson] = useState(false);
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
        if (isPractice(p.post_type)) setHelpPost(p);
        setEditingLesson(p.post_type === 'lesson');
        setBody(p.body ?? '');
        setImageLayout(p.image_layout ?? 'above');
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
  const isLesson = editingLesson || type === 'lesson';
  const restriction = useAccountabilityStore((s) => s.data?.restriction ?? null);
  const [locked, setLocked] = useState(false);   // people are discussing this text, so only the rest can change

  const submit = async () => {
    setError(null);
    const problem = firstProblem(
      checkText(phrase, { label: isLesson ? 'Title' : 'Phrase', required: true, max: imageLayout === 'overlay' ? MAX_OVERLAY_TEXT : MAX_PHRASE }),
      isLesson ? checkText(body, { label: 'Your lesson', required: true, max: maxBody('lesson') }) : '',
      checkText(translation, { label: 'Translation', max: MAX_NOTE }),
      checkText(sourceContext, { label: 'Source context', max: MAX_NOTE }),
    );
    if (problem) { setError(problem); return; }
    if (!language) { setError('Please select a language.'); return; }
    setBusy(true);
    try {
      if (editId) {
        await updateContribution(editId, cleanText(phrase), cleanText(translation) || null, language, category, cleanText(sourceContext) || null, unsplashUrl || null, textAlign, isLesson ? cleanText(body) : null, imageLayout);
      } else {
        await postContribution(
          cleanText(phrase),
          cleanText(translation) || null,
          language,
          category,
          cleanText(sourceContext) || null,
          unsplashUrl || null,
          textAlign,
          isLesson ? 'lesson' : 'library',
          isLesson ? cleanText(body) : null,
          imageLayout,
        );
      }
      toast.success(editId ? 'Changes saved.' : 'Posted to the Library.');
      useFeedCache.getState().invalidate('posts:');   // every post list refreshes on the next visit
      goBack();
    } catch (e: any) {
      setError(userMessage(e, editId ? 'Could not save your changes.' : 'Could not post to the library.'));
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
            Add your languages to your profile to start posting. Stories, questions and “Correct me” posts need no level.
          </p>
          <Button variant="secondary" onClick={() => navigate('/library')}>Go back to Library</Button>
        </div>
      </div>
    );
  }
  if (loadingPost) return <div className="mx-auto w-full max-w-3xl p-4"><ThreadSkeleton /></div>;
  // A pause only ever covers teaching posts. Asking for help stays open.
  if (restriction && !editId && type && !isPractice(type)) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <PageHeader title="Contribute" />
        <DeniedState title="New teaching posts are paused" text={`${restriction.reason}. Answer them, ask for more time, or appeal, and teaching posts come back. Stories, questions and “Correct me” posts still work.`}
          action={<Link to="/notifications" className="font-semibold underline">See what's waiting</Link>} />
      </div>
    );
  }

  const backButton = (
    <button type="button" onClick={goBack} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-ink">
      <ChevronLeft size={16} /> Back
    </button>
  );
  if (helpPost || isPractice(type)) {
    const helpType = (helpPost?.post_type ?? type) as PracticeType;
    return (
      <div className="mx-auto w-full max-w-3xl p-4 pb-24">
        {backButton}
        <PageHeader title={helpPost ? 'Edit post' : POST_TITLE[helpType]} />
        <HelpComposer type={helpType} editing={helpPost ?? undefined} onDone={goBack} />
      </div>
    );
  }
  // Choosing what to write comes first, and decides which form follows.
  if (!editId && !type) {
    const learning = me?.learning_language_id ? languageName(me.learning_language_id) : null;
    const choose = (t: string) => setParams({ type: t }, { replace: true });
    const shareIn = qualified.map((id) => languageName(id)).join(' or ');
    return (
      <div className="mx-auto w-full max-w-3xl p-4 pb-24">
        {backButton}
        <PageHeader title="What do you want to post?" />
        {learning && (
          <section aria-label="Practise" className="space-y-2">
            <h2 className="ft-kicker">Practise {learning}. No level needed</h2>
            <TypeOption icon={PencilLine} title="Correct me" text={`Write a little in ${learning} and people will fix it. Mistakes are welcome.`} onClick={() => choose('correct_me')} />
            <TypeOption icon={ScrollText} title="Story or journal" text="Your day, a memory, an opinion. Readers fix one sentence at a time." onClick={() => choose('story')} />
            <TypeOption icon={Camera} title="Photo and caption" text={`Pick a photo and describe it in ${learning}.`} onClick={() => choose('photo')} />
            <TypeOption icon={MessageCircleQuestion} title="Question or discussion" text="Ask how something is used, compare expressions, or start a conversation." onClick={() => choose('question')} />
            <TypeOption icon={Languages} title="How do I say…?" text={`Ask how to say something in ${learning}.`} onClick={() => choose('how_do_i_say')} />
          </section>
        )}
        <section aria-label="Teach" className={learning ? 'mt-5 space-y-2' : 'space-y-2'}>
          <h2 className="ft-kicker">Teach{shareIn && ` in ${shareIn}`}</h2>
          {qualified.length > 0 ? (
            restriction
              ? <p className="rounded-md bg-warning/10 p-2.5 text-sm text-warning">New teaching posts are paused. {restriction.reason}. <Link to="/notifications" className="font-semibold underline">See what's waiting</Link></p>
              : (
                <>
                  <TypeOption icon={Sparkles} title="Phrase or expression" text="Share a phrase, idiom or useful sentence, with its meaning and an example." onClick={() => choose('library')} />
                  <TypeOption icon={GraduationCap} title="Lesson or explanation" text="Explain grammar, vocabulary, pronunciation or a common mistake." onClick={() => choose('lesson')} />
                </>
              )
          ) : null}
          {lockedLearning && (
            <p className="flex items-start gap-2 text-sm text-muted">
              <Lock size={14} aria-hidden className="mt-1 shrink-0" />
              <span>Teaching in {languageName(lockedLearning)} opens when you're verified at B1, so readers can trust what the Library says. <Link to="/profile/edit" className="underline hover:text-ink">See your progress</Link></span>
            </p>
          )}
        </section>
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

      <PageHeader title={editId ? 'Edit post' : isLesson ? 'New lesson' : 'New phrase'} />

      <div className="space-y-4">
        {locked && <p className="rounded-md bg-warning/10 p-2.5 text-sm text-warning">People are discussing this text, so the phrase, translation and language can't change. Corrections go through the discussion. You can still edit the rest.</p>}
        <div>
          <Textarea
            label={isLesson ? 'Title *' : 'Phrase / idiom *'}
            rows={isLesson ? 2 : 3}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={isLesson ? 'e.g. When to use “de” and “het”' : 'e.g. break the ice'}
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

        {isLesson && (
          <div>
            <Textarea label="Your lesson *" rows={12} maxLength={maxBody('lesson')} value={body} disabled={locked} onChange={(e) => setBody(e.target.value)} placeholder="Explain it the way you would to a friend. Examples help most." />
            <p className="mt-1 text-right text-xs text-muted">{body.length} / {maxBody('lesson')}</p>
          </div>
        )}

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
                  <span className="block text-xs text-muted">Teaching posts open at B1, and practice posts are open now. <Link to="/profile/edit" className="underline hover:text-ink">See your progress</Link></span>
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

        <ImageField url={unsplashUrl} layout={imageLayout} textLength={phrase.length} label="Add an image from Unsplash (optional)" onUrl={setUnsplashUrl} onLayout={setImageLayout} />

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex justify-end pt-4">
          <Button size="lg" loading={busy} onClick={submit}>{editId ? 'Save changes' : isLesson ? 'Publish lesson' : 'Post to Library'}</Button>
        </div>
      </div>
    </div>
  );
}

