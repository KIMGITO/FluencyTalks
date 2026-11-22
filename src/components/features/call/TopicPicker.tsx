import { useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Button, Chip, Modal, Spinner } from '@/components/ui';
import { BANDS, CATEGORY_LABEL, listTopics, type Band, type Topic, type TopicCategory } from '@/services/path';

/**
 * Choose what to talk about. With `band` the list is that level's topics only (a topic call); without it, any level,
 * starting at `startBand`. "Surprise me" picks one at random from what's shown.
 */
export function TopicPicker({ open, band, startBand, title = 'Choose a topic', onPick, onClose }: {
  open: boolean; band?: Band | null; startBand?: Band | null; title?: string; onPick: (t: Topic) => void; onClose: () => void;
}) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState<Band>(band ?? startBand ?? 'A1');
  const [category, setCategory] = useState<TopicCategory | null>(null);
  useEffect(() => { if (open && !topics) listTopics().then(setTopics).catch(() => setFailed(true)); }, [open, topics]);
  useEffect(() => { if (band) setLevel(band); }, [band]);
  const atLevel = useMemo(() => (topics ?? []).filter((t) => t.band === level), [topics, level]);
  const categories = useMemo(() => [...new Set(atLevel.map((t) => t.category))], [atLevel]);
  const shown = category ? atLevel.filter((t) => t.category === category) : atLevel;
  const pick = (t: Topic) => { onPick(t); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {!band && (
        <div className="ft-chips" role="group" aria-label="Level">
          {BANDS.map((b) => <Chip key={b} active={b === level} onClick={() => { setLevel(b); setCategory(null); }}>{b}</Chip>)}
        </div>)}
      {failed ? <p className="text-sm text-muted">Couldn't load the topics. Check your connection and try again.</p> : !topics ? <div className="flex justify-center p-4"><Spinner /></div> : (
        <>
          <div className="ft-chips" role="group" aria-label="Kind of topic">
            <Chip active={!category} onClick={() => setCategory(null)}>All</Chip>
            {categories.map((c) => <Chip key={c} active={c === category} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]}</Chip>)}
          </div>
          <ul className="-mx-1 max-h-[45vh] space-y-1 overflow-y-auto px-1">
            {shown.map((t) => (
              <li key={t.no}>
                <button type="button" onClick={() => pick(t)} className="w-full rounded-md border border-border p-3 text-left hover:bg-surface-2">
                  <span className="block font-semibold text-ink">{t.title}</span>
                  <span className="block text-xs text-muted">{CATEGORY_LABEL[t.category]} · {t.summary}</span>
                </button>
              </li>))}
          </ul>
          <Button variant="secondary" full disabled={!shown.length} onClick={() => pick(shown[Math.floor(Math.random() * shown.length)])}><Shuffle size={16} aria-hidden />Surprise me</Button>
        </>)}
    </Modal>
  );
}
