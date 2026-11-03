// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOG_COLORS, docWords, jsonForScript, postCardsHtml, postHtml, renderDoc, safeUrl, type Post } from '../../src/lib/blogHtml.ts';

const para = (...content: object[]) => ({ type: 'paragraph', content });
const text = (t: string, marks?: object[]) => ({ type: 'text', text: t, marks });

test('text is escaped', () => {
  assert.equal(renderDoc(para(text('<script>alert(1)</script>'))), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('unknown nodes keep their text but not their tag', () => {
  assert.equal(renderDoc({ type: 'script', content: [text('x')] }), 'x');
  assert.equal(renderDoc({ type: 'iframe', attrs: { src: 'https://evil.test' } }), '');
});

test('dangerous links lose the link and keep the text', () => {
  for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.test', '/\\evil.test']) {
    assert.equal(safeUrl(href), null, href);
    assert.equal(renderDoc(para(text('hi', [{ type: 'link', attrs: { href } }]))), '<p>hi</p>', href);
  }
});

test('good links work, and outside ones open safely', () => {
  assert.equal(renderDoc(para(text('a', [{ type: 'link', attrs: { href: '/faq' } }]))), '<p><a href="/faq">a</a></p>');
  assert.match(renderDoc(para(text('a', [{ type: 'link', attrs: { href: 'https://x.test/?a=1&b=2' } }]))), /href="https:\/\/x\.test\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);
});

test('attributes cannot be broken out of', () => {
  const html = renderDoc({ type: 'image', attrs: { src: 'https://x.test/a.webp"onerror="alert(1)', alt: '"><script>' } });
  assert.ok(!html.includes('"onerror'), html); assert.ok(!html.includes('<script'), html);
  assert.equal(renderDoc({ type: 'image', attrs: { src: 'javascript:alert(1)' } }), '');
  assert.equal(renderDoc({ type: 'image', attrs: { src: '/local.png' } }), '');
});

test('only listed fonts and alignments reach a style attribute', () => {
  assert.equal(renderDoc(para(text('a', [{ type: 'textStyle', attrs: { fontFamily: 'x;background:url(//evil.test)' } }]))), '<p>a</p>');
  assert.match(renderDoc(para(text('a', [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif' } }]))), /font-family:Georgia, serif/);
  assert.equal(renderDoc({ type: 'paragraph', attrs: { textAlign: 'center;color:red' }, content: [text('a')] }), '<p>a</p>');
  assert.equal(renderDoc({ type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('a')] }), '<p style="text-align:center">a</p>');
});

test('only listed sizes and colours reach a style attribute', () => {
  const styled = (attrs: object) => renderDoc(para(text('a', [{ type: 'textStyle', attrs }])));
  assert.equal(styled({ fontSize: '99px' }), '<p>a</p>');
  assert.equal(styled({ fontSize: '1rem;position:fixed' }), '<p>a</p>');
  assert.equal(styled({ color: 'red' }), '<p>a</p>');
  assert.equal(styled({ color: 'url(//evil.test)' }), '<p>a</p>');
  assert.equal(styled({ color: 'var(--post-red);background:red' }), '<p>a</p>');
  assert.equal(styled({ fontSize: '1.25rem' }), '<p><span style="font-size:1.25rem">a</span></p>');
  assert.equal(styled({ fontFamily: 'Georgia, serif', fontSize: '2rem', color: 'var(--post-blue)' }), '<p><span style="font-family:Georgia, serif;font-size:2rem;color:var(--post-blue)">a</span></p>');
  // One bad value doesn't take the good ones with it.
  assert.equal(styled({ fontSize: '99px', color: 'var(--post-red)' }), '<p><span style="color:var(--post-red)">a</span></p>');
});

test('every text colour is readable in both themes, on the page, the editor and a quote', () => {
  const css = readFileSync('src/styles/landing.css', 'utf8');
  const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // light: paper, surface, paper-2. dark: bg, surface, surface-2.
  const backgrounds = [['#faf6ee', '#ffffff', '#f1eadc'], ['#0e0d28', '#181744', '#24235e']];
  for (const { value } of BLOG_COLORS) {
    const name = value.slice(4, -1);
    const shades = [...css.matchAll(new RegExp(`${name}: (#[0-9a-f]{6})`, 'g'))].map((m) => m[1]);
    assert.equal(shades.length, 2, `${name} has a light and a dark shade`);
    shades.forEach((shade, theme) => backgrounds[theme].forEach((bg) => assert.ok(contrast(shade, bg) >= 4.5, `${name} ${shade} on ${bg}: ${contrast(shade, bg).toFixed(2)}`)));
  }
});

test('a body can never add a second h1', () => {
  assert.equal(renderDoc({ type: 'heading', attrs: { level: 1 }, content: [text('a')] }), '<h2>a</h2>');
});

test('words are counted for the reading time', () => {
  assert.equal(docWords({ type: 'doc', content: [para(text('one two ')), para(text(' three'))] }), 3);
});

test('structured data cannot close its script tag', () => {
  assert.ok(!jsonForScript({ a: '</script><script>' }).includes('<'));
});

const post: Post = { slug: 'a-b', title: '<T>', seo_title: null, description: 'd', kicker: null, summary: 's', cover_url: 'javascript:x', cover_alt: null, body: para(text('b')), read_minutes: 1, published_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z' };
test('a post has one h1 and an unsafe cover is dropped', () => {
  const html = postHtml(post, [post]);
  assert.equal(html.match(/<h1/g)?.length, 1);
  assert.ok(html.includes('&lt;T&gt;')); assert.ok(!html.includes('javascript:x'));
  assert.ok(!postCardsHtml([post]).includes('javascript:x'));
});

test('keep reading shows a thumbnail, title, date and reading time, and nothing else', () => {
  const more = postHtml(post, [{ ...post, cover_url: 'https://x.test/a.jpg', cover_alt: 'alt', kicker: 'kick', description: 'long words', read_minutes: 4 }]).split('lp-post__more')[1];
  assert.ok(more.includes('href="/blog/a-b"')); assert.ok(more.includes('src="https://x.test/a.jpg" alt=""'));
  assert.ok(more.includes('&lt;T&gt;')); assert.ok(more.includes('3 November 2026</time> · 4 min read'));
  assert.ok(!more.includes('kick')); assert.ok(!more.includes('long words'));
  // No cover, or an unsafe one: the letter panel, not the URL.
  const blank = postHtml(post, [post]).split('lp-post__more')[1];
  assert.ok(blank.includes('lp-postcard__blank')); assert.ok(!blank.includes('javascript:x'));
});
