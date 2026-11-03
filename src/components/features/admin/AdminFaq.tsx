import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CircleHelp, Eye, EyeOff, FilePen, Plus, Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Modal, RowListSkeleton, Select, Textarea } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { FAQ_SECTIONS } from '@/lib/blogHtml';
import { adminFaqDelete, adminFaqList, adminFaqMove, adminFaqSave, type AdminFaqItem, type FaqDraft } from '@/services/faq';
import { toast } from '@/store/toastStore';
import { ActionMenu, Chip, IconTile, RefreshButton, Switch, Toolbar } from './AdminKit';
import { checkText, cleanText, firstProblem } from '@/lib/validate';
import { UserError } from '@/lib/errors';

const MAX_QUESTION = 200;
const MAX_ANSWER = 2000;

/** The questions on /faq and the home page, for admins and moderators alike. A save is public within about a minute. */
export function AdminFaq() {
  const [items, setItems] = useState<AdminFaqItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<AdminFaqItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminFaqItem | null>(null);
  const refresh = useAction(async () => { setItems(await adminFaqList()); setFailed(false); });
  const move = useAction(async (id: string, direction: -1 | 1) => { await adminFaqMove(id, direction); setItems(await adminFaqList()); });
  const toggle = useAction(async (f: AdminFaqItem) => {
    await adminFaqSave(f.id, { ...f, is_live: !f.is_live }, f.updated_at);
    setItems(await adminFaqList());
    toast.success(f.is_live ? 'The question is off the site. It is still here.' : 'The question is back on the site.');
  });
  useEffect(() => { adminFaqList().then(setItems).catch(() => setFailed(true)); }, []);
  if (failed && !items) return <ErrorState title="Couldn't load the questions" onRetry={() => void refresh.run()} busy={refresh.busy} />;
  if (!items) return <RowListSkeleton label="Loading the questions" />;
  return (
    <div className="space-y-4">
      <Toolbar>
        <Button size="sm" onClick={() => setEditing('new')}><Plus size={16} aria-hidden /> New question</Button>
        <RefreshButton busy={refresh.busy} onClick={() => void refresh.run()} />
      </Toolbar>
      {!items.length && <EmptyState icon={<IconTile icon={CircleHelp} />} title="No questions yet" text="Add the first one. It shows on the FAQ page straight away." />}
      {FAQ_SECTIONS.map((s) => {
        const rows = items.filter((f) => f.section === s.id);
        if (!rows.length) return null;
        return (
          <section key={s.id} aria-labelledby={`faq-${s.id}`} className="space-y-2">
            <h2 id={`faq-${s.id}`} className="ft-inset font-display text-lg font-medium">{s.title}</h2>
            <Card pad={false}>
              <ul className="divide-y divide-border">
                {rows.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2 p-3 md:px-4">
                    <div className="min-w-0 flex-1">
                      <button type="button" className="block max-w-full break-words text-left font-semibold leading-snug hover:underline" onClick={() => setEditing(f)}>{f.question}</button>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{f.answer}</p>
                      {(!f.is_live || f.on_home) && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {!f.is_live && <Chip tone="sun">Hidden</Chip>}
                          {f.on_home && <Chip tone="brand">On the home page</Chip>}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label={`Move up: ${f.question}`} disabled={i === 0 || move.busy} onClick={() => void move.run(f.id, -1)}><ArrowUp size={16} aria-hidden /></Button>
                      <Button variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label={`Move down: ${f.question}`} disabled={i === rows.length - 1 || move.busy} onClick={() => void move.run(f.id, 1)}><ArrowDown size={16} aria-hidden /></Button>
                      <ActionMenu label={`Actions for ${f.question}`} actions={[
                        { label: 'Edit', icon: FilePen, onSelect: () => setEditing(f) },
                        { label: f.is_live ? 'Hide from the site' : 'Show on the site', icon: f.is_live ? EyeOff : Eye, disabled: toggle.busy, onSelect: () => void toggle.run(f) },
                        { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(f) },
                      ]} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        );
      })}
      {editing && (
        <FaqForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={async (isNew) => { setEditing(null); setItems(await adminFaqList()); toast.success(isNew ? 'Question added. It shows on the site within about a minute.' : 'Saved. The site updates within about a minute.'); }} />
      )}
      <ConfirmDialog open={!!deleting} title="Delete this question?" confirmLabel="Delete for good" danger onClose={() => setDeleting(null)}
        onConfirm={async () => { await adminFaqDelete(deleting!.id); setItems((all) => all?.filter((x) => x.id !== deleting!.id) ?? null); toast.success('Question deleted.'); }}>
        <p><b>{deleting?.question}</b> is removed for good. To take it off the site and keep the text, hide it instead.</p>
      </ConfirmDialog>
    </div>
  );
}

function FaqForm({ item, onClose, onSaved }: { item: AdminFaqItem | null; onClose: () => void; onSaved: (isNew: boolean) => Promise<void> }) {
  const [draft, setDraft] = useState<FaqDraft>(item
    ? { section: item.section, question: item.question, answer: item.answer, on_home: item.on_home, is_live: item.is_live }
    : { section: FAQ_SECTIONS[0].id, question: '', answer: '', on_home: false, is_live: true });
  const set = (patch: Partial<FaqDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const save = useAction(async () => {
    const problem = firstProblem(checkText(draft.question, { label: 'The question', required: true, max: MAX_QUESTION }), checkText(draft.answer, { label: 'The answer', required: true, max: MAX_ANSWER }));
    if (problem) throw new UserError(problem);
    await adminFaqSave(item?.id ?? null, { ...draft, question: cleanText(draft.question, { singleLine: true }), answer: cleanText(draft.answer) }, item?.updated_at ?? null); await onSaved(!item); }, { silent: true });
  return (
    <Modal open title={item ? 'Edit question' : 'New question'} onClose={() => { if (!save.busy) onClose(); }}>
      <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save.run(); }}>
        <div className="-mx-1 max-h-[65dvh] space-y-3 overflow-y-auto px-1 pb-1">
          <Select label="Section" value={draft.section} onChange={(e) => set({ section: e.target.value })}>
            {FAQ_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
          <Input label="Question" value={draft.question} maxLength={MAX_QUESTION} onChange={(e) => set({ question: e.target.value })} />
          <div>
            <Textarea label="Answer" rows={6} value={draft.answer} maxLength={MAX_ANSWER} onChange={(e) => set({ answer: e.target.value })} />
            <p className="mt-1 text-xs text-muted">Plain text. Start with the direct answer in short sentences, because search and AI tools quote single paragraphs. {draft.answer.length} of {MAX_ANSWER}.</p>
          </div>
          <Switch label="Show on the site" hint="Off keeps the text here without showing it to anyone." checked={draft.is_live} onChange={(is_live) => set({ is_live })} />
          <Switch label="Also on the home page" hint="Every question is on the FAQ page. This adds it to the home page too." checked={draft.on_home} onChange={(on_home) => set({ on_home })} />
        </div>
        {save.error && <p role="alert" className="text-sm text-danger">{save.error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={save.busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.busy}>{item ? 'Save' : 'Add question'}</Button>
        </div>
      </form>
    </Modal>
  );
}
