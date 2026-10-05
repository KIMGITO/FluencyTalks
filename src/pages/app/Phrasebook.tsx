import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ExternalLink, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState, Spinner, Tabs } from '@/components/ui';
import { DiffText } from '@/components/features';
import { deletePhrase, deleteTranslation, listMyCorrections, listPhrases, listTranslations } from '@/services';
import type { CorrectionHistory, SavedPhrase, TranslationRecord } from '@/types/db';

type Tab = 'phrases' | 'corrections' | 'translations';
type TextSize = 'tiny' | 'small';

/** Very small by default so a long history stays scannable; toggle to slightly larger. */
const sizeClass: Record<TextSize, string> = { tiny: 'text-2xs', small: 'text-xs' };
const statusChip: Record<CorrectionHistory['status'], string> = {
  accepted: 'bg-success/15 text-success', pending: 'bg-brand-soft text-brand', dismissed: 'bg-surface-2 text-muted',
};
const Loading = () => <div className="flex justify-center p-8"><Spinner /></div>;

export default function Phrasebook() {
  const [tab, setTab] = useState<Tab>('phrases');
  const [size, setSize] = useState<TextSize>('tiny');
  const [phrases, setPhrases] = useState<(SavedPhrase & { conversation_id: string | null })[] | null>(null);
  const [corrections, setCorrections] = useState<CorrectionHistory[] | null>(null);
  const [translations, setTranslations] = useState<(TranslationRecord & { conversation_id: string | null })[] | null>(null);
  useEffect(() => { listPhrases().then(setPhrases).catch(() => setPhrases([])); }, []);
  useEffect(() => { listMyCorrections().then(setCorrections).catch(() => setCorrections([])); }, []);
  useEffect(() => { listTranslations().then(setTranslations).catch(() => setTranslations([])); }, []);

  const withConv = (id: string | null) => id && (
    <Link to={`/messages/${id}`} className="inline-flex items-center gap-1 text-brand hover:underline">Open chat<ExternalLink size={10} /></Link>);
  const when = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <>
      <PageHeader title="Phrasebook" subtitle="Phrases you saved, corrections and translations — each one links back to its chat" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tabs<Tab> value={tab} onChange={setTab} items={[{ key: 'phrases', label: 'Phrases' }, { key: 'corrections', label: 'Corrections' }, { key: 'translations', label: 'Translations' }]} />
        <div className="flex overflow-hidden rounded-full border border-border" role="group" aria-label="Text size">
          {(['tiny', 'small'] as const).map((s) => (
            <button key={s} onClick={() => setSize(s)} aria-pressed={size === s}
              className={clsx('px-3 py-1.5 font-semibold', sizeClass[s], size === s ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2')}>
              {s === 'tiny' ? 'A Very small' : 'A Small'}</button>))}
        </div>
      </div>

      {tab === 'phrases' && (!phrases ? <Loading /> : !phrases.length
        ? <EmptyState title="Nothing saved yet" text="Tap “Save phrase” under any message, or accept a correction, and it will show up here." />
        : <div className="space-y-2">{phrases.map((p) => (
            <div key={p.id} className={clsx('ft-card flex items-start gap-3 p-3', sizeClass[size])}>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words font-medium">{p.phrase}</p>
                {p.translation && <p className="break-words text-muted">{p.translation}</p>}
                <p className="mt-1 flex items-center gap-2 text-muted">{when(p.created_at)}{withConv(p.conversation_id)}</p>
              </div>
              <Button variant="ghost" size="sm" aria-label="Delete phrase" onClick={async () => { await deletePhrase(p.id); setPhrases(phrases.filter((x) => x.id !== p.id)); }}><Trash2 size={16} /></Button>
            </div>))}</div>)}

      {tab === 'corrections' && (!corrections ? <Loading /> : !corrections.length
        ? <EmptyState title="No corrections yet" text="When someone corrects your message it is stored here with the original wording, the suggestion and the outcome." />
        : <div className="space-y-2">{corrections.map((c) => (
            <div key={c.id} className={clsx('ft-card space-y-1 p-3', sizeClass[size])}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx('rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide', statusChip[c.status])}>{c.status}</span>
                <span className="text-muted">from {c.corrector_name}</span>
                <span className="ml-auto flex items-center gap-2 text-muted">{when(c.created_at)}{withConv(c.conversation_id)}</span>
              </div>
              <p>You wrote: <span className="text-muted">{c.original_text}</span></p>
              <div className="font-medium">Suggested: <DiffText original={c.original_text} corrected={c.suggested_text} /></div>
              {c.note && <p className="text-muted">Note: {c.note}</p>}
            </div>))}</div>)}

      {tab === 'translations' && (!translations ? <Loading /> : !translations.length
        ? <EmptyState title="No translations yet" text="Every message you translate is stored here automatically, traceable to the chat it came from." />
        : <div className="space-y-2">{translations.map((t) => (
            <div key={t.id} className={clsx('ft-card flex items-start gap-3 p-3', sizeClass[size])}>
              <div className="min-w-0 flex-1">
                <p className="break-words text-muted">{t.source_text}</p>
                <p className="break-words font-medium">{t.translated_text}{t.target_lang && <span className="ml-1 text-muted">({t.target_lang})</span>}</p>
                <p className="mt-1 flex items-center gap-2 text-muted">{when(t.created_at)}{withConv(t.conversation_id)}</p>
              </div>
              <Button variant="ghost" size="sm" aria-label="Delete translation" onClick={async () => { await deleteTranslation(t.id); setTranslations(translations.filter((x) => x.id !== t.id)); }}><Trash2 size={16} /></Button>
            </div>))}</div>)}
    </>
  );
}

