import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Textarea } from '@/components/ui';
import { helpSupply, postHelpRequest, updateContribution, type ContributionPost, type HelpType } from '@/services/library';
import { useFeedCache } from '@/store/feedCache';
import { useLanguageStore } from '@/store/languageStore';
import { useProfileStore } from '@/store/profileStore';
import { toast } from '@/store/toastStore';

const MAX = 280;
const FEW_HELPERS = 3;

const COPY: Record<HelpType, { title: string; hint: (language: string) => string; label: (language: string) => string; placeholder: string; context?: { label: string; placeholder: string }; send: string }> = {
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
};
/** Topics, not sentence starters: they read the same whatever language someone is learning. */
const IDEAS = ['What I ate today', 'My family', 'My weekend', 'Why I am learning this language', 'Where I live'];

/** Asks for help, or edits a request: the text only until someone has answered, as with any post. */
export function HelpComposer({ type, editing, onDone }: { type: HelpType; editing?: ContributionPost; onDone: () => void }) {
  const me = useProfileStore((s) => s.me);
  const nameOf = useLanguageStore((s) => s.name);
  const language = editing?.language_id ?? me?.learning_language_id ?? null;
  const languageName = language ? nameOf(language) ?? language : '';
  const copy = COPY[type];
  const [text, setText] = useState(editing?.phrase ?? '');
  const [context, setContext] = useState(editing?.source_context ?? '');
  const [idea, setIdea] = useState<string | null>(null);
  const [supply, setSupply] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!editing && ((editing.thread_count ?? 0) > 0 || (editing.endorse_count ?? 0) > 0);

  useEffect(() => {
    if (!language || editing) return;
    helpSupply(language).then(setSupply).catch(() => undefined);   // only a courtesy note: posting doesn't depend on it
  }, [language, !!editing]);

  if (!language) {
    return <p className="text-sm text-muted">Add the language you are learning to <Link to="/profile/edit" className="font-semibold underline">your profile</Link> first.</p>;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (editing) await updateContribution(editing.id, text.trim(), null, language, editing.category, context.trim() || null, null, 'left');
      else await postHelpRequest(type, text.trim(), context.trim() || null);
      toast.success(editing ? 'Changes saved.' : 'Posted. You will be told as soon as someone answers.');
      useFeedCache.getState().invalidate('posts:');
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void submit(); }}>
      <p className="text-sm text-muted">{copy.hint(languageName)}</p>
      <div>
        <Textarea label={copy.label(languageName)} rows={4} maxLength={MAX} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} placeholder={idea ?? copy.placeholder} />
        <p className="mt-1 text-right text-xs text-muted">{text.length} / {MAX}</p>
        {locked && <p className="text-xs text-muted">People have already answered this, so the text stays as it is.</p>}
      </div>
      {type === 'correct_me' && !editing && !text && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink">Need an idea?</p>
          <div className="flex flex-wrap gap-1.5">
            {IDEAS.map((i) => (
              <button key={i} type="button" aria-pressed={idea === i} onClick={() => setIdea(i)} className={`min-h-9 rounded-full border border-border px-3 text-xs font-semibold transition ${idea === i ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}>{i}</button>
            ))}
          </div>
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
