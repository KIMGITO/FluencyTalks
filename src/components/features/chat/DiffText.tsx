import { diffWords } from '@/lib/diff';
/** Shows what changed: removed words struck through, added words highlighted. */
export function DiffText({ original, corrected }: { original: string; corrected: string }) {
  return (<p className="ft-selectable whitespace-pre-wrap break-words">{diffWords(original, corrected).map((p, i) =>
    p.kind === 'del' ? <del key={i} className="text-danger">{p.text}</del>
    : p.kind === 'add' ? <ins key={i} className="rounded-sm bg-success/15 font-semibold text-success no-underline">{p.text}</ins>
    : <span key={i}>{p.text}</span>)}</p>);
}
