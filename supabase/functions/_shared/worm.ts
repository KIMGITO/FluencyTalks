// Write-once storage: an S3 bucket with Object Lock. In COMPLIANCE mode nobody can change or delete a locked version
// before its date, the account's root user included. Every write is checked, so a bucket that isn't locking is refused.
// Takes a signed fetch so the unit tests run it without Deno or a network. npm run test:unit

export type SignedFetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface WormConfig { endpoint: string; bucket: string }

const base64 = (hex: string) => btoa(String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16))));
const path = (key: string) => key.split('/').map(encodeURIComponent).join('/');

export function createWorm(fetchSigned: SignedFetch, cfg: WormConfig) {
  const url = (key: string, query = '') => `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${path(key)}${query}`;

  /** Stores a locked copy and proves it: reads back the lock and the bytes. Returns the version to keep on record. */
  async function put(key: string, bytes: Uint8Array, sha256: string, retainUntil: Date, contentType: string) {
    const res = await fetchSigned(url(key), {
      method: 'PUT',
      body: bytes as BodyInit,
      headers: {
        'content-type': contentType,
        'x-amz-checksum-sha256': base64(sha256),
        'x-amz-object-lock-mode': 'COMPLIANCE',
        'x-amz-object-lock-retain-until-date': retainUntil.toISOString(),
      },
    });
    if (!res.ok) throw new Error(`worm put ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await res.body?.cancel();
    const version = res.headers.get('x-amz-version-id');
    if (!version || version === 'null') throw new Error('worm put: the bucket has no versioning, so it is not write-once');

    const head = await fetchSigned(url(key, `?versionId=${encodeURIComponent(version)}`), { method: 'HEAD' });
    await head.body?.cancel();
    if (!head.ok) throw new Error(`worm check ${head.status}`);
    if (head.headers.get('x-amz-object-lock-mode') !== 'COMPLIANCE') throw new Error('worm check: the copy is not locked in COMPLIANCE mode');
    const lockedUntil = new Date(head.headers.get('x-amz-object-lock-retain-until-date') ?? 0);
    if (lockedUntil.getTime() < retainUntil.getTime()) throw new Error(`worm check: locked only until ${lockedUntil.toISOString()}`);

    const stored = await get(key, version);
    if (stored.length !== bytes.length || stored.some((b, i) => b !== bytes[i])) throw new Error('worm check: the copy differs from what was sent');
    return version;
  }

  async function get(key: string, version: string) {
    const res = await fetchSigned(url(key, `?versionId=${encodeURIComponent(version)}`));
    if (!res.ok) throw new Error(`worm get ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Every stored version of a key: a retried upload leaves more than one. */
  async function versions(key: string) {
    const res = await fetchSigned(`${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}?versions&prefix=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`worm list ${res.status}`);
    const xml = await res.text();
    return [...xml.matchAll(/<(?:Version|DeleteMarker)>([^]*?)<\/(?:Version|DeleteMarker)>/g)]
      .map((m) => ({ key: m[1].match(/<Key>([^<]*)<\/Key>/)?.[1], version: m[1].match(/<VersionId>([^<]*)<\/VersionId>/)?.[1] }))
      .filter((v): v is { key: string; version: string } => v.key === key && !!v.version);
  }

  /** Destroys every version. Storage refuses while the lock lasts, and that refusal stops the destruction. */
  async function destroy(key: string) {
    for (const v of await versions(key)) {
      const res = await fetchSigned(url(key, `?versionId=${encodeURIComponent(v.version)}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(`worm delete ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await res.body?.cancel();
    }
  }

  return { put, get, destroy };
}
