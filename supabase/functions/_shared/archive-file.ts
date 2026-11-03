// The archive file format: one JSON object per line, gzipped. Any machine can read one with gunzip and sha256sum.
// Shared so the unit tests run it without Deno. npm run test:unit

const stream = (bytes: BlobPart, transform: CompressionStream | DecompressionStream) =>
  new Response(new Blob([bytes]).stream().pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));

export const sha256Hex = async (bytes: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function encodeArchive(rows: unknown[]) {
  const text = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const bytes = new Uint8Array(await stream(text, new CompressionStream('gzip')).arrayBuffer());
  return { bytes, sha256: await sha256Hex(bytes) };
}

export const decodeArchive = async (bytes: Uint8Array) => {
  const text = await stream(bytes as BlobPart, new DecompressionStream('gzip')).text();
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as unknown);
};

/** Throws unless these bytes are the file we meant to store: same hash, and it opens to the same number of rows. */
export async function assertArchive(bytes: Uint8Array, sha256: string, rowCount: number) {
  const actual = await sha256Hex(bytes);
  if (actual !== sha256) throw new Error(`hash mismatch: expected ${sha256}, read back ${actual}`);
  const rows = await decodeArchive(bytes);
  if (rows.length !== rowCount) throw new Error(`row mismatch: expected ${rowCount}, read back ${rows.length}`);
}
