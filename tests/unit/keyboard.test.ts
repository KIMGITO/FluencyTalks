// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollDelta } from '../../src/lib/keyboard.ts';

const band = { top: 56, bottom: 400 };

test('a field already in the free space does not move', () => {
  assert.equal(scrollDelta({ top: 100, bottom: 148 }, band), 0);
});

test('a field behind the keyboard moves up to the middle of the free space', () => {
  assert.equal(scrollDelta({ top: 600, bottom: 648 }, band), 624 - 228);
});

test('a field under the header moves down', () => {
  assert.ok(scrollDelta({ top: 10, bottom: 58 }, band) < 0);
});

test('a field too tall to fit shows its top', () => {
  assert.equal(scrollDelta({ top: 500, bottom: 1200 }, band, 12), 500 - 56 - 12);
});
