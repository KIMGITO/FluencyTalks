import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, Card, Input, Select } from '@/components/ui';
import { PostEditor } from '@/components/features/posts';
import { blocksToText, markdownToBlocks } from '@/lib/blocks';
import { createPost, getPost, updatePost } from '@/services/posts';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { displayLabel, useLanguages } from '@/store/languageStore';
import { normalizeCode } from '@/lib/languages';
import type { RichBlock } from '@/types/posts';

export default function PostEdit() {
  const { id } = useParams();
  const [qs] = useSearchParams();
  const nav = useNavigate();
  const uid = useAuthStore((s) => s.user?.id) ?? '';
  const me = useProfileStore((s) => s.me);
  const staff = me?.role === 'admin' || me?.role === 'moderator';
  const isNew = !id;
  const [kind, setKind] = useState<'blog' | 'story'>((qs.get('type') === 'blog' ? 'blog' : 'story'));
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<RichBlock[]>(markdownToBlocks(''));
  const [vis, setVis] = useState('public');
  const [language, setLanguage] = useState('');
  const allLanguages = useLanguages();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    getPost(id).then((p) => {
      if (!p) return;
      setKind(p.kind); setTitle(p.title); setBlocks(p.blocks?.length ? p.blocks : markdownToBlocks(p.body_text ?? '')); setVis(p.visibility);
      setLanguage(p.language_id ?? '');
    }).catch(() => {});
  }, [id]);
  const save = async () => {
    setErr('');
    if (!title.trim()) { setErr('Give it a title first.'); return; }
    if (!blocksToText(blocks).trim() && !blocks.some((b) => b.type === 'image' && b.src)) { setErr('Write something first.'); return; }
    if (!language) { setErr('Pick the language this is written in.'); return; }
    setBusy(true);
    try {
      const bodyText = blocksToText(blocks);
      const lang = normalizeCode(language);
      if (isNew) {
        const nid = await createPost({ kind: kind === 'blog' && !staff ? 'story' : kind, title: title.trim(), blocks, bodyText, visibility: vis, language: lang });
        nav(`/posts/${nid}`);
      } else {
        await updatePost(id!, { title: title.trim(), blocks, bodyText, visibility: vis, language: lang });
        nav(`/posts/${id}`);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title={isNew ? (kind === 'blog' ? 'New blog post' : 'Write a story') : 'Edit post'} subtitle="Bold, italic, links, lists, headings and captioned pictures." />
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as 'blog' | 'story')} disabled={!staff}>
            <option value="story">Story (you manage it)</option>
            <option value="blog">Blog (admins only)</option>
          </Select>
          <Select label="Written in" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Pick language...</option>
            {allLanguages.map((l) => <option key={l.id} value={l.id}>{displayLabel(l, l.iso_639_1 ? [l.iso_639_1, 'en'] : 'en')}</option>)}
          </Select>
          <Select label="Who can see it?" value={vis} onChange={(e) => setVis(e.target.value)} disabled={kind === 'blog'}>
            <option value="public">Everyone</option>
            <option value="followers">Followers only</option>
            <option value="private">Only me</option>
          </Select>
        </div>
        <Input label="Title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="What is this about?" />
        <PostEditor blocks={blocks} onChange={setBlocks} userId={uid} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => nav(-1)}>Cancel</Button>
          <Button loading={busy} onClick={save}>{isNew ? 'Publish' : 'Save changes'}</Button>
        </div>
      </Card>
    </>
  );
}
