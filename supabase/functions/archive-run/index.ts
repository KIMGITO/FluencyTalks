// Edge Function: moves rows past their hot window into private storage, copies them to write-once storage, keeps the
// consent ledger and chain checkpoints there too, then destroys files past their date. Called by the database
// (archive_kick) on a clock, never by a browser. docs/DATA_RETENTION.md
// Deploy: supabase functions deploy archive-run --no-verify-jwt
// Secrets: supabase secrets set ARCHIVE_WEBHOOK_SECRET=… ARCHIVE_WORM_ENDPOINT=… ARCHIVE_WORM_REGION=… ARCHIVE_WORM_BUCKET=… ARCHIVE_WORM_ACCESS_KEY_ID=… ARCHIVE_WORM_SECRET_ACCESS_KEY=…
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { assertArchive, encodeArchive, sha256Hex } from '../_shared/archive-file.ts';
import { createWorm } from '../_shared/worm.ts';

const BUCKET = 'archives';
const PAGE = 1000;
// Stop starting new work before the platform's 150 second limit. Whatever is left goes next run.
const BUDGET_MS = 110_000;
// Consent proof is kept for good. A lock needs a date, and this one can be extended but never shortened.
const PERMANENT_YEARS = 100;

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const yearsFromNow = (n: number) => new Date(Date.now() + n * 365.25 * 864e5);

type Db = ReturnType<typeof createClient>;
type Worm = ReturnType<typeof createWorm>;
type Batch = { id: string; table_name: string; object_path: string };
type Plan = { due: boolean; consent_from: number; consent_through: number; consent_head: string; register_through: number; register_head: string; last: { key: string; version: string } | null };

const call = async <T>(db: Db, fn: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
};

function wormFromEnv() {
  const env = (name: string) => Deno.env.get(`ARCHIVE_WORM_${name}`);
  const [endpoint, region, bucket, accessKeyId, secretAccessKey] = [env('ENDPOINT'), env('REGION'), env('BUCKET'), env('ACCESS_KEY_ID'), env('SECRET_ACCESS_KEY')];
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: 's3' });
  return createWorm((url, init) => aws.fetch(url, init), { endpoint, bucket });
}

async function archiveBatch(db: Db, worm: Worm, batch: Batch) {
  const rows: unknown[] = [];
  for (;;) {
    const page = await call<unknown[]>(db, 'svc_archive_export_page', { p_batch: batch.id, p_offset: rows.length, p_limit: PAGE });
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (!rows.length) return call<number>(db, 'svc_archive_seal', { p_batch: batch.id, p_rows: 0, p_bytes: 0, p_sha256: '', p_worm_key: null, p_worm_version: null, p_worm_until: null });

  const { bytes, sha256 } = await encodeArchive(rows);
  // Overwrites only a retry of this same batch: a sealed batch never comes back here, and a later file gets a new part number.
  const { error: upErr } = await db.storage.from(BUCKET).upload(batch.object_path, bytes, { contentType: 'application/gzip', upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);

  // Read back what storage actually has. The rows in Postgres are deleted on the strength of this.
  const { data: stored, error: downErr } = await db.storage.from(BUCKET).download(batch.object_path);
  if (downErr || !stored) throw new Error(`read back: ${downErr?.message ?? 'empty'}`);
  await assertArchive(new Uint8Array(await stored.arrayBuffer()), sha256, rows.length);

  const until = await call<string>(db, 'svc_archive_retain_until', { p_batch: batch.id });
  // Locked until the destroy date, so the lock has just run out when the file comes due.
  const key = `archives/${batch.object_path}`;
  const version = await worm.put(key, bytes, sha256, new Date(`${until}T00:00:00Z`), 'application/gzip');

  return call<number>(db, 'svc_archive_seal', { p_batch: batch.id, p_rows: rows.length, p_bytes: bytes.length, p_sha256: sha256, p_worm_key: key, p_worm_version: version, p_worm_until: until });
}

async function checkpoint(db: Db, worm: Worm, logFailure: (where: string, err: unknown) => unknown) {
  const plan = await call<Plan>(db, 'svc_checkpoint_plan');

  // Compare the database with what it last wrote to a place it can't change. Done on every run, due or not.
  let last = { consent_through: 0, consent_head: null as string | null, register_through: 0, register_head: null as string | null };
  if (plan.last) last = JSON.parse(new TextDecoder().decode(await worm.get(plan.last.key, plan.last.version)));
  const integrity = await call<{ ok: boolean }>(db, 'svc_integrity_check', {
    p_consent_seq: last.consent_through, p_consent_head: last.consent_head, p_register_seq: last.register_through, p_register_head: last.register_head,
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (!integrity.ok) {
    // Evidence, not a new baseline: what's in the database now can't be trusted, so no ledger copy from it either.
    await logFailure('integrity', JSON.stringify(integrity));
    const alert = new TextEncoder().encode(JSON.stringify({ taken_at: new Date().toISOString(), database_heads: plan, integrity }));
    const alertKey = `alerts/${stamp}.json`;
    const alertVersion = await worm.put(alertKey, alert, await sha256Hex(alert), yearsFromNow(PERMANENT_YEARS), 'application/json');
    await call(db, 'svc_checkpoint_record', {
      p_consent_through: plan.consent_through, p_consent_head: plan.consent_head, p_register_through: plan.register_through, p_register_head: plan.register_head,
      p_checkpoint_key: alertKey, p_checkpoint_version: alertVersion, p_consent_key: null, p_consent_version: null, p_integrity: integrity,
    });
    return true;
  }
  if (!plan.due) return false;

  let consentKey: string | null = null, consentVersion: string | null = null;
  if (plan.consent_through > plan.consent_from) {
    const rows: unknown[] = [];
    for (let after = plan.consent_from; after < plan.consent_through;) {
      const page = await call<{ seq: number }[]>(db, 'svc_consent_export_page', { p_after: after, p_through: plan.consent_through, p_limit: PAGE });
      if (!page.length) break;
      rows.push(...page);
      after = page[page.length - 1].seq;
    }
    const { bytes, sha256 } = await encodeArchive(rows);
    consentKey = `consents/${stamp}.seq${plan.consent_from + 1}-${plan.consent_through}.ndjson.gz`;
    consentVersion = await worm.put(consentKey, bytes, sha256, yearsFromNow(PERMANENT_YEARS), 'application/gzip');
  }

  const body = new TextEncoder().encode(JSON.stringify({
    taken_at: new Date().toISOString(), consent_through: plan.consent_through, consent_head: plan.consent_head,
    register_through: plan.register_through, register_head: plan.register_head, consent_key: consentKey, consent_version: consentVersion, integrity,
  }));
  const checkpointKey = `checkpoints/${stamp}.json`;
  const checkpointVersion = await worm.put(checkpointKey, body, await sha256Hex(body), yearsFromNow(PERMANENT_YEARS), 'application/json');
  await call(db, 'svc_checkpoint_record', {
    p_consent_through: plan.consent_through, p_consent_head: plan.consent_head, p_register_through: plan.register_through, p_register_head: plan.register_head,
    p_checkpoint_key: checkpointKey, p_checkpoint_version: checkpointVersion, p_consent_key: consentKey, p_consent_version: consentVersion, p_integrity: integrity,
  });
  return true;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('ARCHIVE_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-archive-secret') !== secret) return reply(401, { error: 'forbidden' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const started = Date.now();
  const inBudget = () => Date.now() - started < BUDGET_MS;
  const result = { files: 0, rows: 0, destroyed: 0, checkpoint: false, failed: [] as string[] };
  const logFailure = (where: string, err: unknown) => db.from('app_logs').insert({
    level: 'error', source: 'edge:archive-run', message: `${where}: ${message(err)}`.slice(0, 1000),
  });

  // No write-once copy, no archive: rows stay in the database, and the health page says why.
  const worm = wormFromEnv();
  if (!worm) return reply(200, { ...result, worm: 'not configured' });

  try {
    while (inBudget()) {
      const batch = await call<Batch | null>(db, 'svc_archive_next_batch');
      if (!batch) break;
      try {
        const rows = await archiveBatch(db, worm, batch);
        result.rows += rows;
        if (rows) result.files += 1;
      } catch (err) {
        result.failed.push(batch.object_path);
        await call(db, 'svc_archive_fail', { p_batch: batch.id, p_error: message(err) });
        await logFailure(batch.object_path, err);
      }
    }

    const due = inBudget() ? await call<{ id: string; object_path: string }[]>(db, 'svc_archive_due_for_destruction') : [];
    for (const file of due) {
      if (!inBudget()) break;
      try {
        // Write-once copy first: if its lock refuses, the file stays whole and comes up again next run.
        const key = await call<string | null>(db, 'svc_archive_due_keys', { p_batch: file.id });
        if (key) await worm.destroy(key);
        const { error } = await db.storage.from(BUCKET).remove([file.object_path]);
        if (error) throw new Error(error.message);
        await call(db, 'svc_archive_mark_destroyed', { p_batch: file.id });
        result.destroyed += 1;
      } catch (err) {
        await logFailure(`destroy ${file.object_path}`, err);
      }
    }

    result.checkpoint = await checkpoint(db, worm, logFailure);
  } catch (err) {
    await logFailure('run', err);
    return reply(500, { ...result, error: message(err) });
  }
  return reply(200, result);
});
