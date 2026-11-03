// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertArchive, decodeArchive, encodeArchive, sha256Hex } from '../../supabase/functions/_shared/archive-file.ts';

const rows = [{ id: 1, message: 'first' }, { id: 2, message: 'line\nbreak and “unicode” ✓' }];

test('rows come back exactly as they went in, even with a newline inside a value', async () => {
  const { bytes } = await encodeArchive(rows);
  assert.deepEqual(await decodeArchive(bytes), rows);
});

test('the hash is of the stored bytes, so sha256sum on the downloaded file gives the same answer', async () => {
  const { bytes, sha256 } = await encodeArchive(rows);
  assert.equal(sha256, await sha256Hex(bytes));
  assert.match(sha256, /^[0-9a-f]{64}$/);
});

test('a good file passes', async () => {
  const { bytes, sha256 } = await encodeArchive(rows);
  await assertArchive(bytes, sha256, rows.length);
});

test('one changed byte is refused', async () => {
  const { bytes, sha256 } = await encodeArchive(rows);
  const damaged = bytes.slice();
  damaged[damaged.length - 1] ^= 1;
  await assert.rejects(assertArchive(damaged, sha256, rows.length), /hash mismatch/);
});

test('a file with the wrong number of rows is refused, so no rows get deleted on its strength', async () => {
  const { bytes, sha256 } = await encodeArchive(rows);
  await assert.rejects(assertArchive(bytes, sha256, rows.length + 1), /row mismatch/);
});
