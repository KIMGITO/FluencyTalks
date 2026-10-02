import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, EmptyState, Spinner } from '@/components/ui';
import { deletePhrase, listPhrases } from '@/services';
import type { SavedPhrase } from '@/types/db';
export default function Phrasebook() {
  const [items, setItems] = useState<SavedPhrase[] | null>(null);
  useEffect(() => { listPhrases().then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <div className="flex justify-center p-8"><Spinner /></div>;
  return (
    <>
      <PageHeader title="Phrasebook" subtitle="Phrases you saved from chats and accepted corrections" />
      {!items.length ? <EmptyState title="Nothing saved yet" text="Tap “Save phrase” under any message, or accept a correction, and it will show up here." /> : (
        <div className="space-y-3">{items.map((p) => (
          <Card key={p.id} className="flex items-start gap-3">
            <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words font-medium">{p.phrase}</p>{p.translation && <p className="text-sm text-muted">{p.translation}</p>}
              <p className="mt-1 text-xs text-muted">{new Date(p.created_at).toLocaleDateString()}</p></div>
            <Button variant="ghost" size="sm" aria-label="Delete phrase" onClick={async () => { await deletePhrase(p.id); setItems(items.filter((x) => x.id !== p.id)); }}><Trash2 size={18} /></Button>
          </Card>))}</div>)}
    </>
  );
}
