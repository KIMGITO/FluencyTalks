// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceChars, splitSentences } from '../../src/lib/sentences.ts';

test('splits sentences and drops the spaces between them', () => {
  const s = splitSentences('Ik ga. Jij gaat? Wij gaan!');
  assert.deepEqual(s.map((x) => x.text), ['Ik ga.', 'Jij gaat?', 'Wij gaan!']);
});

test('positions count characters as the database does, so an emoji is one', () => {
  const text = 'Ik ben 😀 blij. Gisteren ik ga naar school.';
  const [first, second] = splitSentences(text);
  assert.equal(first.text, 'Ik ben 😀 blij.');
  assert.deepEqual([first.start, first.end], [0, 14]);
  assert.equal(second.text, 'Gisteren ik ga naar school.');
  assert.deepEqual([second.start, second.end], [15, 42]);
  assert.equal(sliceChars(text, second.start, second.end), second.text);
});

test('every sentence reads back exactly from its own positions, across paragraphs', () => {
  const text = 'Eerste zin.\n\nTweede zin! Derde zin?\nVierde';
  for (const s of splitSentences(text)) assert.equal(sliceChars(text, s.start, s.end), s.text);
  assert.equal(splitSentences(text).at(-1)?.text, 'Vierde');
});

test('languages without spaces between sentences still split', () => {
  assert.deepEqual(splitSentences('私は学生です。毎日勉強します。', 'ja').map((s) => s.text), ['私は学生です。', '毎日勉強します。']);
});

test('nothing to split gives nothing to correct', () => {
  assert.deepEqual(splitSentences('   \n '), []);
});
