// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasLongBody, isPractice, maxBody, PRACTICE_TYPES, REFERENCE_TYPES, takesFixes } from '../../src/lib/postTypes.ts';

test('every type is either practice or teaching, never both', () => {
  for (const t of PRACTICE_TYPES) assert.ok(!REFERENCE_TYPES.includes(t));
  assert.ok(!isPractice('library') && !isPractice('lesson') && !isPractice(undefined));
});

test('only long posts are corrected a sentence at a time, and a question takes replies', () => {
  assert.ok(hasLongBody('story') && hasLongBody('lesson') && !hasLongBody('correct_me'));
  assert.ok(!takesFixes('question') && takesFixes('photo'));
});

test('limits match the database', () => {
  assert.equal(maxBody('question'), 2000);
  assert.equal(maxBody('story'), 5000);
});
