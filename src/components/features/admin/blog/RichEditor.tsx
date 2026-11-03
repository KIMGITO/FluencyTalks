import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import { Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import clsx from 'clsx';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Palette, Quote, Redo2, Strikethrough, Underline, Undo2, type LucideIcon } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { BLOG_COLORS, BLOG_FONTS, BLOG_SIZES, safeUrl, type DocNode } from '@/lib/blogHtml';
import { userMessage } from '@/lib/errors';
import { cleanText } from '@/lib/validate';

/** Marks a phrase as another language, so screen readers and search engines read it correctly. No button: it comes with existing posts. */
const Lang = Mark.create({
  name: 'lang',
  addAttributes() { return { lang: { default: null } }; },
  parseHTML() { return [{ tag: 'span[lang]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', HTMLAttributes, 0]; },
});

const BLOCKS = [{ value: 'p', label: 'Paragraph' }, { value: '2', label: 'Heading' }, { value: '3', label: 'Subheading' }, { value: '4', label: 'Small heading' }];

function Tool({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}
      // Keeps the cursor and selection in the text, and the keyboard open on a phone.
      onMouseDown={(e) => e.preventDefault()}
      className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40', active ? 'bg-ink text-surface' : 'text-ink hover:bg-surface-2')}>
      <Icon size={18} aria-hidden />
    </button>
  );
}
const Group = ({ children }: { children: ReactNode }) => <span className="flex shrink-0 items-center gap-0.5 border-r border-border pr-1 last:border-r-0">{children}</span>;
const toolSelect = 'h-10 shrink-0 rounded-md border border-border bg-surface px-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40';

function Toolbar({ editor, onLink, onImage }: { editor: Editor; onLink: () => void; onImage: () => void }) {
  const block = BLOCKS.find((b) => b.value !== 'p' && editor.isActive('heading', { level: Number(b.value) }))?.value ?? 'p';
  const style = editor.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
  const font = style.fontFamily ?? '';
  // Pasted text can carry its own size or colour. They aren't on the list, so the public page drops them: show "Default" here too.
  const size = BLOG_SIZES.some((s) => s.value === style.fontSize) ? style.fontSize : '';
  const color = BLOG_COLORS.some((c) => c.value === style.color) ? style.color : '';
  const [colors, setColors] = useState(false);
  const chain = () => editor.chain().focus();
  return (
    <div className="sticky top-[var(--layout-topbarH)] z-10 border-b border-border bg-surface">
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-1 overflow-x-auto p-1.5 lg:flex-wrap lg:overflow-x-visible">
      <select aria-label="Text style" className={toolSelect} value={block} onChange={(e) => {
        if (e.target.value === 'p') chain().setParagraph().run(); else chain().setHeading({ level: Number(e.target.value) as 2 | 3 | 4 }).run();
      }}>{BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
      <select aria-label="Font" className={toolSelect} value={font} onChange={(e) => { if (e.target.value) chain().setFontFamily(e.target.value).run(); else chain().unsetFontFamily().run(); }}>
        <option value="">Default font</option>
        {BLOG_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select aria-label="Font size" className={toolSelect} value={size} onChange={(e) => { if (e.target.value) chain().setFontSize(e.target.value).run(); else chain().unsetFontSize().run(); }}>
        <option value="">Normal size</option>
        {BLOG_SIZES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <Group>
        <Tool icon={Bold} label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} />
        <Tool icon={Italic} label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} />
        <Tool icon={Underline} label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} />
        <Tool icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} />
        <span className="relative shrink-0">
          <Tool icon={Palette} label="Text colour" active={colors} onClick={() => setColors(!colors)} />
          {color && <span aria-hidden className="pointer-events-none absolute inset-x-2.5 bottom-1 h-[3px] rounded-full" style={{ background: color }} />}
        </span>
      </Group>
      <Group>
        <Tool icon={AlignLeft} label="Align left" active={!['center', 'right', 'justify'].some((a) => editor.isActive({ textAlign: a }))} onClick={() => chain().unsetTextAlign().run()} />
        <Tool icon={AlignCenter} label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()} />
        <Tool icon={AlignRight} label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()} />
        <Tool icon={AlignJustify} label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()} />
      </Group>
      <Group>
        <Tool icon={List} label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()} />
        <Tool icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()} />
        <Tool icon={Quote} label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()} />
        <Tool icon={Minus} label="Divider line" onClick={() => chain().setHorizontalRule().run()} />
      </Group>
      <Group>
        <Tool icon={Link2} label="Link" active={editor.isActive('link')} onClick={onLink} />
        <Tool icon={ImagePlus} label="Image" onClick={onImage} />
      </Group>
      <Group>
        <Tool icon={Undo2} label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()} />
        <Tool icon={Redo2} label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()} />
      </Group>
    </div>
    {colors && (
      // A row of its own, not a pop-up: the toolbar scrolls sideways on phones, which would cut a pop-up off.
      <div role="group" aria-label="Text colour" className="flex flex-wrap items-center gap-1.5 border-t border-border p-1.5">
        <button type="button" aria-pressed={!color} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().unsetColor().run()}
          className={clsx('h-10 rounded-md border px-3 text-sm font-semibold text-ink', !color ? 'border-ink' : 'border-border hover:bg-surface-2')}>Default</button>
        {BLOG_COLORS.map((c) => (
          <button key={c.value} type="button" title={c.label} aria-label={c.label} aria-pressed={color === c.value} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().setColor(c.value).run()}
            className={clsx('flex h-10 w-10 items-center justify-center rounded-md border', color === c.value ? 'border-ink' : 'border-border hover:bg-surface-2')}>
            <span aria-hidden className="h-5 w-5 rounded-full" style={{ background: c.value }} />
          </button>
        ))}
      </div>
    )}
    </div>
  );
}

/** The post body. `value` is read once, on mount: after that the editor owns the document. */
export function RichEditor({ value, onChange, onUpload, onError }: { value: DocNode | null; onChange: (doc: DocNode) => void; onUpload: (file: File) => Promise<string>; onError: (message: string) => void }) {
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, code: false, codeBlock: false, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: null } } }),
      TextStyle, FontFamily, FontSize, Color, Lang, Image,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Placeholder.configure({ placeholder: 'Write your post here…' }),
    ],
    content: (value as JSONContent | null) ?? '',
    editorProps: { attributes: { class: 'lp-article__body ft-blog-editor', 'aria-label': 'Post body' } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as DocNode),
  });

  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<{ file: File; preview: string; alt: string; busy: boolean } | null>(null);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.preview); }, [image?.preview]);

  if (!editor) return null;
  const openLink = () => { setLinkError(''); setLink((editor.getAttributes('link').href as string | undefined) ?? ''); };
  const saveLink = () => {
    const url = (link ?? '').trim();
    if (!url) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLink(null); return; }
    // A bare "example.com" means the website, not a path on this site.
    const href = safeUrl(url) ?? safeUrl(`https://${url}`);
    if (!href || !/^(https?:\/\/[^./]+\.|https?:\/\/localhost|mailto:|\/|#)/i.test(href)) { setLinkError('Enter a full web address, such as https://example.com, or a page on this site, such as /faq.'); return; }
    const chain = editor.chain().focus().extendMarkRange('link').setLink({ href });
    // With nothing selected, the address becomes the link's text.
    if (editor.state.selection.empty && !editor.isActive('link')) chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href } }] });
    chain.run();
    setLink(null);
  };
  const insertImage = async () => {
    if (!image) return;
    setImage({ ...image, busy: true });
    try {
      const src = await onUpload(image.file);
      editor.chain().focus().setImage({ src, alt: cleanText(image.alt, { singleLine: true }) }).run();
      setImage(null);
    } catch (e) { onError(userMessage(e)); setImage((i) => i && { ...i, busy: false }); }
  };

  return (
    <div className="lp ft-blog-frame overflow-visible rounded-lg border border-border">
      <Toolbar editor={editor} onLink={openLink} onImage={() => fileInput.current?.click()} />
      <EditorContent editor={editor} />
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file) setImage({ file, preview: URL.createObjectURL(file), alt: '', busy: false });
      }} />
      <Modal open={link !== null} onClose={() => setLink(null)} title="Link">
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveLink(); }}>
          <Input autoFocus label="Web address" value={link ?? ''} error={linkError} placeholder="https://example.com or /faq" onChange={(e) => { setLink(e.target.value); setLinkError(''); }} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setLink(null)}>Cancel</Button>
            <Button type="submit" size="sm">{link?.trim() ? 'Save link' : 'Remove link'}</Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!image} onClose={() => { if (!image?.busy) setImage(null); }} title="Add an image">
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void insertImage(); }}>
          {image && <img src={image.preview} alt="" className="max-h-[12rem] w-full rounded-md object-contain" />}
          <Input autoFocus label="Describe the image" placeholder="Two friends chatting at a café" maxLength={200} value={image?.alt ?? ''} onChange={(e) => setImage((i) => i && { ...i, alt: e.target.value })} />
          <p className="text-xs text-muted">People using screen readers, and search engines, rely on this description.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={image?.busy} onClick={() => setImage(null)}>Cancel</Button>
            <Button type="submit" size="sm" loading={image?.busy} disabled={!image?.alt.trim()}>Add image</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
