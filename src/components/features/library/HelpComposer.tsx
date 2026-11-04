import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Textarea } from '@/components/ui';
import { helpSupply, postHelpRequest, updateContribution, type ContributionPost, type ImageLayout } from '@/services/library';
import { useFeedCache } from '@/store/feedCache';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';
import { userMessage } from '@/lib/errors';
import { MAX_OVERLAY_TEXT, MAX_TITLE, maxBody, type PracticeType } from '@/lib/postTypes';
import { checkText, cleanText, firstProblem } from '@/lib/validate';
import { ImageField } from './ImageField';

const FEW_HELPERS = 3;

interface Copy {
  title: string; hint: (language: string) => string; label: (language: string) => string; placeholder: string;
  body?: { label: string; placeholder: string; required: boolean };
  context?: { label: string; placeholder: string }; send: string;
}
const COPY: Record<PracticeType, Copy> = {
  correct_me: {
    title: 'Correct me',
    hint: (language) => `Write anything in ${language}, mistakes are welcome. People who know it will fix it and explain why.`,
    label: (language) => `Your text in ${language}`,
    placeholder: 'Write a sentence or two…',
    context: { label: 'What are you trying to say? (optional)', placeholder: 'In a language you are comfortable with' },
    send: 'Ask for a fix',
  },
  how_do_i_say: {
    title: 'How do I say…?',
    hint: (language) => `Ask in any language. People who know ${language} will tell you how to say it.`,
    label: () => 'What do you want to say?',
    placeholder: 'How do I say “See you tomorrow”?',
    send: 'Ask',
  },
  story: {
    title: 'Story or journal',
    hint: (language) => `Write about your day, a memory or an opinion in ${language}. Readers fix one sentence at a time, so the rest of your story stays yours.`,
    label: () => 'Title',
    placeholder: 'My weekend',
    body: { label: 'Your story', placeholder: 'Start anywhere. It does not have to be perfect.', required: true },
    send: 'Publish story',
  },
  question: {
    title: 'Question or discussion',
    hint: (language) => `Ask how something is used in ${language}, compare expressions, or start a conversation. Anyone can reply.`,
    label: () => 'Your question',
    placeholder: 'When would you use this?',
    body: { label: 'More detail (optional)', placeholder: 'What have you seen or heard so far?', required: false },
    send: 'Ask',
  },
  photo: {
    title: 'Photo and caption',
    hint: (language) => `Pick a photo and write about it in ${language}. People will fix your caption.`,
    label: () => 'Your caption',
    placeholder: 'What do you see?',
    context: { label: 'What are you trying to say? (optional)', placeholder: 'In a language you are comfortable with' },
    send: 'Publish photo',
  },
};
/** Topics, not sentence starters: they read the same whatever language someone is learning. */
const IDEAS = ['What I ate today', 'My family', 'My weekend', 'Why I am learning this language', 'Where I live'];

/** Every practice post, new or edited: the text only until someone has answered, as with any post. */
export function HelpComposer({ type, editing, onDone }: { type: PracticeType; editing?: ContributionPost; onDone: () => void }) {
  const me = useProfileStore((s) => s.me);
  const nameOf = useLanguageStore((s) => s.name);
  const language = editing?.language_id ?? me?.learning_language_id ?? null;
  const languageName = language ? nameOf(language) ?? language : '';
  const copy = COPY[type];
  const [text, setText] = useState(editing?.phrase ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [context, setContext] = useState(editing?.source_context ?? '');
  const [imageUrl, setImageUrl] = useState(editing?.unsplash_image_url ?? '');
  const [layout, setLayout] = useState<ImageLayout>(editing?.image_layout ?? 'above');
  const [idea, setIdea] = useState<string | null>(null);
  const [supply, setSupply] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!editing && ((editing.thread_count ?? 0) > 0 || (editing.endorse_count ?? 0) > 0);
  const limit = maxBody(type);

  useEffect(() => {
    if (!language || editing) return;
    helpSupply(language).then(setSupply).catch(() => undefined);   // only a courtesy note: posting doesn't depend on it
  }, [language, !!editing]);

  if (!language) {
    return <p className="text-sm text-muted">Add the language you are learning to <Link to="/profile/edit" className="font-semibold underline">your profile</Link> first.</p>;
  }

  const submit = async () => {
    const problem = firstProblem(
      checkText(text, { label: copy.label(languageName), required: true, max: layout === 'overlay' ? MAX_OVERLAY_TEXT : MAX_TITLE }),
      copy.body ? checkText(body, { label: copy.body.label, required: copy.body.required, max: limit }) : '',
      checkText(context, { label: 'The extra detail', max: 200 }),
      type === 'photo' && !imageUrl ? 'Choose a photo first.' : '',
    );
    setError(problem || null);
    if (problem) return;
    setBusy(true);
    try {
      if (editing) await updateContribution(editing.id, cleanText(text), null, language, editing.category, cleanText(context) || null, imageUrl || null, 'left', cleanText(body) || null, layout);
      else await postHelpRequest(type, cleanText(text), cleanText(context) || null, { body: cleanText(body) || null, imageUrl: imageUrl || null, layout });
      toast.success(editing ? 'Changes saved.' : 'Posted. You will be told as soon as someone answers.');
      useFeedCache.getState().invalidate('posts:');
      onDone();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const ideasFor = (type === 'correct_me' || type === 'story') && !editing && !text;
  return (
    <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="text-sm text-muted">{copy.hint(languageName)}</p>
      {type === 'photo' && <ImageField url={imageUrl} layout={layout} textLength={text.length} label="Choose a photo from Unsplash" onUrl={setImageUrl} onLayout={setLayout} />}
      <div>
        {copy.body
          ? <Input label={copy.label(languageName)} maxLength={MAX_TITLE} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} placeholder={idea ?? copy.placeholder} />
          : <Textarea label={copy.label(languageName)} rows={4} maxLength={MAX_TITLE} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} placeholder={idea ?? copy.placeholder} />}
        <p className="mt-1 text-right text-xs text-muted">{text.length} / {layout === 'overlay' ? MAX_OVERLAY_TEXT : MAX_TITLE}</p>
        {locked && <p className="text-xs text-muted">People have already answered this, so the text stays as it is.</p>}
      </div>
      {ideasFor && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink">Need an idea?</p>
          <div className="flex flex-wrap gap-1.5">
            {IDEAS.map((i) => (
              <button key={i} type="button" aria-pressed={idea === i} onClick={() => setIdea(i)} className={`min-h-9 rounded-full border border-border px-3 text-xs font-semibold transition ${idea === i ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}>{i}</button>
            ))}
          </div>
        </div>
      )}
      {copy.body && (
        <div>
          <Textarea label={copy.body.label} rows={type === 'story' ? 10 : 4} maxLength={limit} value={body} disabled={locked} onChange={(e) => setBody(e.target.value)} placeholder={copy.body.placeholder} />
          <p className="mt-1 text-right text-xs text-muted">{body.length} / {limit}</p>
        </div>
      )}
      {copy.context && <Input label={copy.context.label} maxLength={200} value={context} onChange={(e) => setContext(e.target.value)} placeholder={copy.context.placeholder} />}
      <p className="text-xs text-muted">Everyone signed in can see this, so leave out private details like your address or phone number.</p>
      {supply !== null && supply < FEW_HELPERS && (
        <p className="rounded-md bg-warning/10 p-2.5 text-sm text-warning">Few people here can answer in {languageName} yet, so this may take a while. Your post stays open until someone does.</p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" full loading={busy} disabled={!text.trim()}>{editing ? 'Save changes' : copy.send}</Button>
    </form>
  );
}
