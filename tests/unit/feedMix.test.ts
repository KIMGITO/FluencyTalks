// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixFeed, weavePosts } from '../../src/lib/feedMix.ts';

const row = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));
const shape = (items: { kind: string }[]) => items.map((i) => (i.kind === 'post' ? 'P' : 'U')).join('');

test('opens with posts, not people, and keeps posts in the clear majority', () => {
  const { items } = mixFeed(row('p', 24), row('u', 20), false);
  assert.equal(shape(items).slice(0, 4), 'PPPU');
  const people = items.filter((i) => i.kind === 'person').length;
  assert.ok(24 >= people * 3, `${people} people among 24 posts`);
});

test('people are spread through the posts, never side by side', () => {
  const { items } = mixFeed(row('p', 36), row('u', 20), false);
  assert.ok(!shape(items).includes('UU'));
});

test('a new page of posts does not move anything already on screen', () => {
  const people = row('u', 20);
  const before = mixFeed(row('p', 12), people, false).items;
  const after = mixFeed(row('p', 24), people, false).items;
  assert.deepEqual(after.slice(0, before.length), before);
});

test('leftover people wait until the posts are finished, and are capped then', () => {
  assert.equal(mixFeed(row('p', 2), row('u', 20), false).items.length, 2);
  const done = mixFeed(row('p', 2), row('u', 20), true);
  assert.equal(shape(done.items), 'PPUUUUUU');
  assert.equal(done.morePeople, true);
});

test('with no people it is simply the posts; with no posts, only people', () => {
  assert.equal(shape(mixFeed(row('p', 5), [], true).items), 'PPPPP');
  assert.equal(shape(mixFeed([], row('u', 2), true).items), 'UU');
  assert.equal(mixFeed([], [], true).items.length, 0);
});

test('help requests are woven in from the second post, and nothing shows twice', () => {
  const feed = row('p', 6); const help = [{ id: 'h0' }, { id: 'p2' }];
  const ids = weavePosts(feed, help).map((p) => p.id);
  assert.deepEqual(ids, ['p0', 'h0', 'p1', 'p3', 'p2', 'p4', 'p5']);
  assert.equal(new Set(ids).size, ids.length);
});

test('help requests still show when the feed is short', () => {
  assert.deepEqual(weavePosts([], row('h', 2)).map((p) => p.id), ['h0', 'h1']);
});
