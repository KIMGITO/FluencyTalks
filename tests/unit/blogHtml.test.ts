// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docWords, jsonForScript, postCardsHtml, postHtml, renderDoc, safeUrl, type Post } from '../../src/lib/blogHtml.ts';

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
