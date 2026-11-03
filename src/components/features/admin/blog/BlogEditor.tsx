import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CircleAlert, CloudOff, Eye, ImagePlus, Save, Trash2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { Button, Card, ConfirmDialog, ErrorState, Input, RowListSkeleton, Textarea } from '@/components/ui';
import { docWords, readMinutes, type Post } from '@/lib/blogHtml';
import { adminBlogDelete, adminBlogGet, adminBlogPublish, adminBlogSave, adminBlogUnpublish, uploadBlogImage, type AdminPost, type BlogDraft } from '@/services/blog';
import { toast } from '@/store/toastStore';
import { ActionMenu } from '../AdminKit';
import { BlogStatusChip } from '../AdminBlog';
import { BlogPreview } from './BlogPreview';
import { RichEditor } from './RichEditor';
import '@/styles/landing.css';

const EMPTY: BlogDraft = { title: '', seo_title: null, description: '', kicker: null, summary: '', cover_url: null, cover_alt: null, body: null };
const AUTOSAVE_MS = 4000;

/** A web address from a title: "Tôi đói: why?" becomes "toi-doi-why". */
export const slugify = (title: string) => title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');

const Count = ({ n, good, max }: { n: number; good: number; max: number }) => (
  <span className={clsx('tabular-nums', n > max ? 'text-danger' : n >= good ? 'text-success' : 'text-muted')}>{n} / {max}</span>
);
const Check1 = ({ ok, children, optional }: { ok: boolean; children: React.ReactNode; optional?: boolean }) => (
  <li className={clsx('flex items-start gap-2', ok ? 'text-ink' : optional ? 'text-muted' : 'text-danger')}>
    {ok ? <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-success" /> : <CircleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />}
    <span>{children}{!ok && <span className="sr-only"> (missing)</span>}</span>
  </li>
);

export function BlogEditor() {
  const { id: param = 'new' } = useParams();
  const navigate = useNavigate();
  const isNew = param === 'new';
  // The id is chosen here, so images can be uploaded to the post's folder before its first save.
  const [id] = useState(() => (isNew ? crypto.randomUUID() : param));
  const [post, setPost] = useState<AdminPost | null>(null);
  const [form, setForm] = useState<BlogDraft | null>(isNew ? EMPTY : null);
  const [slug, setSlug] = useState('');
  const [failed, setFailed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'hide' | null>(null);

  useEffect(() => {
    if (isNew) return;
    adminBlogGet(id).then((p) => {
      if (!p) { setFailed(true); return; }
      setPost(p); setSlug(p.slug); setForm({ ...EMPTY, ...p.draft });
    }).catch(() => setFailed(true));
  }, []);

  // Autosave and the buttons share one path, so two saves never race and the newest text always wins.
  const latest = useRef({ form, slug, post, dirty });
  latest.current = { form, slug, post, dirty };
  const inFlight = useRef<Promise<AdminPost | null> | null>(null);
  const slugFor = (f: BlogDraft, s: string) => s || slugify(f.title) || `untitled-${id.slice(0, 8)}`;
  const save = useCallback(async (): Promise<AdminPost | null> => {
    if (inFlight.current) await inFlight.current;
    const { form: f, slug: s, post: p, dirty: d } = latest.current;
    if (!f) return null;
    if (!d && p) return p;
    setSaving(true); setSaveError(''); setDirty(false);
    const run = adminBlogSave(id, slugFor(f, s), f, p?.draft_saved_at ?? null).then((saved) => {
      setPost(saved);
      latest.current.post = saved;
      // A new post's address comes from its first title, and then stays put unless someone edits it.
      setSlug(saved.slug);
      if (isNew) window.history.replaceState(window.history.state, '', `/admin/blog/${id}`);
      return saved;
    }).catch((e: Error) => { setDirty(true); setSaveError(e.message); throw e; }).finally(() => { inFlight.current = null; setSaving(false); });
    inFlight.current = run.catch(() => null);
    return run;
  }, [id]);

  const hasContent = !!form && (!!form.title.trim() || docWords(form.body) > 0 || !!form.cover_url);
  useEffect(() => {
    if (!dirty || !hasContent || saveError) return undefined;
    const t = window.setTimeout(() => { save().catch(() => undefined); }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [form, slug, dirty, hasContent, saveError, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (latest.current.dirty) e.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);

  const change = (patch: Partial<BlogDraft>) => { setForm((f) => f && { ...f, ...patch }); setDirty(true); setSaveError(''); };
  const onBody = useCallback((body: BlogDraft['body']) => { setForm((f) => f && { ...f, body }); setDirty(true); setSaveError(''); }, []);
  const upload = useCallback((file: File) => uploadBlogImage(id, file), [id]);
  const coverInput = useRef<HTMLInputElement>(null);
  const uploadCover = async (file: File) => {
    setUploading(true);
    try { change({ cover_url: await uploadBlogImage(id, file) }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };
  const publish = async () => {
    setPublishing(true);
    try {
      await save();
      const saved = await adminBlogPublish(id);
      setPost(saved); setPreviewing(false);
      toast.success(`Published. It's on the site within about a minute.`);
    } catch (e) { toast.error((e as Error).message); setPreviewing(false); }
    finally { setPublishing(false); }
  };
  const previewPost = useMemo<Post | null>(() => {
    if (!form || !previewing) return null;
    const now = new Date().toISOString();
    return {
      slug: slugFor(form, slug), title: form.title || 'Untitled post', seo_title: form.seo_title, description: form.description, kicker: form.kicker, summary: form.summary,
      cover_url: form.cover_url, cover_alt: form.cover_alt, body: form.body, read_minutes: readMinutes(form.body), published_at: post?.published_at ?? now, updated_at: now,
    };
  }, [form, slug, post, previewing]);

  if (failed) return <ErrorState title="Couldn't open this post" text="It may have been deleted." onRetry={() => navigate('/admin/blog')} />;
  if (!form) return <RowListSkeleton label="Opening the post" />;

  const words = docWords(form.body);
  const shownSlug = slugFor(form, slug);
  const slugLocked = !!post?.published_at;
  const status = saveError ? <span role="alert" className="text-danger">{saveError}</span>
    : saving ? 'Saving…' : dirty ? 'Unsaved changes' : post ? 'All changes saved' : 'Not saved yet';
  return (
    <div className="space-y-3">
      <div className="ft-inset flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to="/admin/blog" className="inline-flex min-h-[2.5rem] items-center gap-1 text-sm font-bold hover:underline"><ArrowLeft size={16} aria-hidden /> All posts</Link>
        {post && <BlogStatusChip post={post} />}
        <p aria-live="polite" className="min-w-0 flex-1 basis-[10rem] text-xs text-muted">{status}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPreviewing(true)}><Eye size={16} aria-hidden /> Preview</Button>
          <Button size="sm" variant="secondary" loading={saving} disabled={!dirty || !hasContent} onClick={() => { save().catch(() => undefined); }}><Save size={16} aria-hidden /> Save draft</Button>
          <Button size="sm" loading={publishing} onClick={() => void publish()}><Upload size={16} aria-hidden /> {post?.is_live ? 'Publish changes' : 'Publish'}</Button>
          {post && <ActionMenu label="More actions" actions={[
            ...(post.is_live ? [
              { label: 'View on the site', icon: Eye, onSelect: () => window.open(`/blog/${post.slug}`, '_blank', 'noopener') },
              { label: 'Take off the site', icon: CloudOff, onSelect: () => setConfirm('hide') },
            ] : []),
            { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirm('delete') },
          ]} />}
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <Card>
            <label className="block">
              <span className="sr-only">Title</span>
              <textarea rows={2} maxLength={120} value={form.title} placeholder="Post title" onChange={(e) => change({ title: e.target.value.replace(/\n/g, ' ') })}
                className="w-full resize-none bg-transparent font-display text-3xl font-medium leading-tight text-ink placeholder:text-muted focus:outline-none md:text-4xl" />
            </label>
          </Card>
          <RichEditor value={form.body} onChange={onBody} onUpload={upload} onError={(m) => toast.error(m)} />
          <p className="ft-inset text-xs text-muted">{words.toLocaleString()} {words === 1 ? 'word' : 'words'} · about {readMinutes(form.body)} min read</p>
        </div>

        <aside className="min-w-0 space-y-3">
          <Card>
            <h2 className="mb-2 font-display text-lg font-medium">Cover image</h2>
            {form.cover_url ? (
              <div className="relative">
                <img src={form.cover_url} alt="" className="aspect-video w-full rounded-md object-cover" />
                <Button variant="secondary" size="sm" className="absolute right-1.5 top-1.5 h-9 w-9 !bg-surface px-0" aria-label="Remove the cover image" onClick={() => change({ cover_url: null, cover_alt: null })}><X size={16} aria-hidden /></Button>
              </div>
            ) : (
              <button type="button" disabled={uploading} onClick={() => coverInput.current?.click()} className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink/30 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                <ImagePlus size={22} aria-hidden /> {uploading ? 'Uploading…' : 'Add a cover image'}
              </button>
            )}
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadCover(file); }} />
            {form.cover_url && <div className="mt-3"><Input label="Describe the image" maxLength={200} value={form.cover_alt ?? ''} onChange={(e) => change({ cover_alt: e.target.value })} /></div>}
            <p className="mt-2 text-xs text-muted">Shown wide (16:9) on the post and in the list, and when the link is shared. JPG, PNG or WebP, up to 5 MB.</p>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg font-medium">In the list and on Google</h2>
            <div className="space-y-3">
              <Input label="Topic (shown above the title)" maxLength={60} placeholder="Language exchange basics" value={form.kicker ?? ''} onChange={(e) => change({ kicker: e.target.value || null })} />
              <div>
                <Textarea label="Summary (opens the post)" rows={4} maxLength={600} value={form.summary} onChange={(e) => change({ summary: e.target.value })} />
                <p className="mt-1 text-xs text-muted">The answer in two or three sentences. Search engines and AI tools often quote this.</p>
              </div>
              <div>
                <Textarea label="Search description" rows={3} maxLength={200} value={form.description} onChange={(e) => change({ description: e.target.value })} />
                <p className="mt-1 flex justify-between gap-2 text-xs text-muted"><span>Shown under the title on Google.</span><Count n={form.description.length} good={120} max={160} /></p>
              </div>
              <div>
                <Input label="Shorter title for Google (optional)" maxLength={70} value={form.seo_title ?? ''} onChange={(e) => change({ seo_title: e.target.value || null })} />
                <p className="mt-1 flex justify-between gap-2 text-xs text-muted"><span>Google cuts long titles.</span><Count n={(form.seo_title || form.title).length} good={1} max={42} /></p>
              </div>
              <div>
                <Input label="Web address" disabled={slugLocked} maxLength={80} value={slugLocked ? slug : slug || slugify(form.title)} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-')); setDirty(true); setSaveError(''); }} onBlur={() => setSlug((s) => slugify(s))} />
                <p className="mt-1 break-all text-xs text-muted">thefluencytalks.com/blog/{shownSlug}{slugLocked && <span className="break-normal"> · Fixed, as this post has been public.</span>}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-lg font-medium">Before publishing</h2>
            <ul className="space-y-1.5 text-sm">
              <Check1 ok={!!form.title.trim()}>A title</Check1>
              <Check1 ok={words > 0}>The post itself</Check1>
              <Check1 ok={!!form.summary.trim()}>A summary</Check1>
              <Check1 ok={!!form.description.trim()}>A search description</Check1>
              <Check1 optional ok={!!form.cover_url}>A cover image (recommended)</Check1>
              {form.cover_url && <Check1 optional ok={!!form.cover_alt?.trim()}>A description of the cover image (recommended)</Check1>}
            </ul>
          </Card>
        </aside>
      </div>

      {previewPost && <BlogPreview post={previewPost} isLive={!!post?.is_live} publishing={publishing} onPublish={() => void publish()} onClose={() => setPreviewing(false)} />}
      <ConfirmDialog open={confirm === 'hide'} title="Take this post off the site?" confirmLabel="Take off the site" onClose={() => setConfirm(null)}
        onConfirm={async () => { setPost(await adminBlogUnpublish(id)); toast.success('The post is off the site. It is still here as a draft.'); }}>
        <p>It stops being public within about a minute. You can publish it again at the same address.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'delete'} title="Delete this post?" confirmLabel="Delete for good" danger onClose={() => setConfirm(null)}
        onConfirm={async () => { await adminBlogDelete(id); toast.success('Post deleted.'); navigate('/admin/blog', { replace: true }); }}>
        <p>The post and its images are removed for good. {post?.is_live && 'Links to it will show a "page not found" page within about a minute.'}</p>
      </ConfirmDialog>
    </div>
  );
}
