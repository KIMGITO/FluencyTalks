// npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorm, type SignedFetch } from '../../supabase/functions/_shared/worm.ts';

const bytes = new Uint8Array([1, 2, 3]);
const sha = 'aa'.repeat(32);
const until = new Date('2030-01-01T00:00:00Z');

/** Answers like S3. Pass what a badly set up bucket would say instead. */
function fakeBucket({ version = 'v1' as string | null, mode = 'COMPLIANCE' as string | null, lockedUntil = until.toISOString(), stored = bytes } = {}) {
  const calls: { method: string; url: string; headers: Record<string, string> }[] = [];
  const fetchSigned: SignedFetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, headers: (init.headers ?? {}) as Record<string, string> });
    if (method === 'PUT') return new Response(null, { status: 200, headers: version ? { 'x-amz-version-id': version } : {} });
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { ...(mode ? { 'x-amz-object-lock-mode': mode } : {}), 'x-amz-object-lock-retain-until-date': lockedUntil } });
    return new Response(stored, { status: 200 });
  };
  return { worm: createWorm(fetchSigned, { endpoint: 'https://s3.test/', bucket: 'b' }), calls };
}

test('a good copy returns its version, and asks for the compliance lock with the hash', async () => {
  const { worm, calls } = fakeBucket();
  assert.equal(await worm.put('archives/a b.gz', bytes, sha, until, 'application/gzip'), 'v1');
  assert.equal(calls[0].url, 'https://s3.test/b/archives/a%20b.gz');
  assert.equal(calls[0].headers['x-amz-object-lock-mode'], 'COMPLIANCE');
  assert.equal(calls[0].headers['x-amz-object-lock-retain-until-date'], until.toISOString());
  assert.equal(calls[0].headers['x-amz-checksum-sha256'], Buffer.from(sha, 'hex').toString('base64'));
});

test('a bucket with no versioning is refused', async () => {
  await assert.rejects(fakeBucket({ version: null }).worm.put('k', bytes, sha, until, 'x'), /not write-once/);
});

test('a copy in governance mode or with no lock is refused: someone could still remove it', async () => {
  await assert.rejects(fakeBucket({ mode: 'GOVERNANCE' }).worm.put('k', bytes, sha, until, 'x'), /not locked in COMPLIANCE/);
  await assert.rejects(fakeBucket({ mode: null }).worm.put('k', bytes, sha, until, 'x'), /not locked in COMPLIANCE/);
});

test('a lock shorter than asked for is refused', async () => {
  await assert.rejects(fakeBucket({ lockedUntil: '2029-12-31T00:00:00Z' }).worm.put('k', bytes, sha, until, 'x'), /locked only until/);
});

test('a copy that reads back differently is refused', async () => {
  await assert.rejects(fakeBucket({ stored: new Uint8Array([9, 9, 9]) }).worm.put('k', bytes, sha, until, 'x'), /differs/);
});

test('destroying removes every version, and a refusal from the lock stops it', async () => {
  const deleted: string[] = [];
  const list = '<ListVersionsResult><Version><Key>k</Key><VersionId>v1</VersionId></Version><Version><Key>k</Key><VersionId>v2</VersionId></Version><Version><Key>k2</Key><VersionId>other</VersionId></Version></ListVersionsResult>';
  const ok = createWorm(async (url, init = {}) => {
    if (init.method === 'DELETE') { deleted.push(url); return new Response(null, { status: 204 }); }
    return new Response(list);
  }, { endpoint: 'https://s3.test', bucket: 'b' });
  await ok.destroy('k');
  assert.deepEqual(deleted, ['https://s3.test/b/k?versionId=v1', 'https://s3.test/b/k?versionId=v2']);

  const locked = createWorm(async (_url, init = {}) => (init.method === 'DELETE' ? new Response('locked', { status: 403 }) : new Response(list)), { endpoint: 'https://s3.test', bucket: 'b' });
  await assert.rejects(locked.destroy('k'), /worm delete 403/);
});
