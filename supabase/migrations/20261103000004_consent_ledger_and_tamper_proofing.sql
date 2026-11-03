-- Vietnamese retention rules, permanent proof of consent, and tamper-proof records. docs/DATA_RETENTION.md.
--
-- 1. Periods now follow Vietnamese law.
-- 2. consent_ledger is the proof of consent. Unlike consents, it outlives the account and records what was agreed to.
-- 3. The ledger and the archive register are hash chains, so changing or removing an entry breaks every later one.
-- 4. Nothing is archived without a copy in write-once storage. archive-run copies files there, plus the ledger and
--    regular checkpoints of both chains, so a rewrite of the database itself can be caught too.

-- ---------- 1. Periods ----------
update public.retention_policies set retain_days = 395, basis = 'Decree 333/2026 Art. 20.3: system logs for investigating violations, at least 12 months. 13 so a file is never destroyed early.' where table_name = 'app_logs';
update public.retention_policies set basis = 'Who used staff powers, as evidence for security incidents and disputes. Decree 356/2025 Art. 29 sets 5 years for some incident records; used here for the whole log.' where table_name = 'admin_audit_log';
update public.retention_policies set basis = 'Explaining a decision about a person if challenged. 3 years matches the limitation period for civil claims (Civil Code 2015 Art. 429, 588).' where table_name in ('accountability_audit', 'moderation_actions');
update public.retention_policies set basis = 'Safety, and defending a decision if challenged. 3 years matches the limitation period for civil claims (Civil Code 2015 Art. 429, 588). Holds message text, so no longer than that. Open reports never move.' where table_name = 'reports';

-- ---------- 2. What people agreed to ----------
-- Each version of the wording. Consent must be verifiable down to its content (Decree 356/2025 Art. 6.1).
create table public.consent_documents (
  kind text not null,
  version text not null,
  wording text not null,          -- what the person ticked
  document_text text,             -- the whole page it pointed to, from supabase/legal/
  sha256 text not null,           -- set by the trigger below, of wording + newline + document_text
  created_at timestamptz not null default now(),
  primary key (kind, version));

create function public.consent_document_hash() returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.sha256 := encode(sha256(convert_to(new.wording || E'\n' || coalesce(new.document_text, ''), 'UTF8')), 'hex');
  return new;
end $$;
create trigger consent_documents_hash before insert on public.consent_documents for each row execute function public.consent_document_hash();

-- The proof. No foreign key, on purpose: it outlives the account. Holds no name and no plain email.
create table public.consent_ledger (
  seq bigint generated always as identity primary key,
  event text not null check (event in ('given', 'ended')),
  user_id uuid not null,
  email_hash text,
  kind text not null,
  version text not null,
  document_sha256 text,
  occurred_at timestamptz not null,
  prev_hash text not null,
  entry_hash text not null);
create index consent_ledger_user_idx on public.consent_ledger (user_id, seq);
create index consent_ledger_email_idx on public.consent_ledger (email_hash, seq);

-- One row per checkpoint: the head of each chain at that moment, as also written to write-once storage.
create table public.archive_checkpoints (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  consent_through bigint not null,
  consent_head text not null,
  register_through bigint not null,
  register_head text not null,
  checkpoint_key text not null,
  checkpoint_version text not null,
  consent_key text,
  consent_version text,
  integrity jsonb not null);

alter table public.consent_documents enable row level security;
alter table public.consent_ledger enable row level security;
alter table public.archive_checkpoints enable row level security;
revoke all on public.consent_documents, public.consent_ledger, public.archive_checkpoints from public, anon, authenticated;

alter table public.archive_batches
  add column worm_key text,
  add column worm_version text,
  add column worm_retain_until date,
  add column chain_seq bigint unique,
  add column prev_hash text,
  add column entry_hash text;
create sequence public.archive_chain_seq owned by public.archive_batches.chain_seq;

-- ---------- 3. Hash chains ----------
create function public.chain_hash(p_prev text, variadic p_fields text[]) returns text
language sql immutable set search_path = pg_catalog as $$
  select encode(sha256(convert_to(p_prev || '|' || array_to_string(p_fields, '|', '-'), 'UTF8')), 'hex') $$;

create function public.chain_time(p_at timestamptz) returns text
language sql immutable set search_path = pg_catalog as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $$;

create function public.consent_entry_hash(l public.consent_ledger) returns text
language sql immutable set search_path = public as $$
  select public.chain_hash(l.prev_hash, l.event, l.user_id::text, l.email_hash, l.kind, l.version, l.document_sha256, public.chain_time(l.occurred_at)) $$;

create function public.register_entry_hash(b public.archive_batches) returns text
language sql immutable set search_path = public as $$
  select public.chain_hash(b.prev_hash, b.chain_seq::text, b.table_name, b.day::text, b.part::text, b.object_path, b.row_count::text, b.byte_count::text,
    b.sha256, b.worm_key, b.worm_version, b.worm_retain_until::text, public.chain_time(b.released_at)) $$;

-- Takes a lock until commit, so entries commit in chain order and an export can never miss one.
create function public.consent_ledger_append(p_event text, p_user uuid, p_email_hash text, p_kind text, p_version text, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare l consent_ledger;
begin
  perform pg_advisory_xact_lock(hashtext('consent_ledger'));
  l.prev_hash := coalesce((select entry_hash from consent_ledger order by seq desc limit 1), repeat('0', 64));
  l.event := p_event; l.user_id := p_user; l.email_hash := p_email_hash; l.kind := p_kind; l.version := p_version; l.occurred_at := p_at;
  l.document_sha256 := (select sha256 from consent_documents d where d.kind = p_kind and d.version = p_version);
  insert into consent_ledger (event, user_id, email_hash, kind, version, document_sha256, occurred_at, prev_hash, entry_hash)
  values (l.event, l.user_id, l.email_hash, l.kind, l.version, l.document_sha256, l.occurred_at, l.prev_hash, public.consent_entry_hash(l));
end $$;

create function public.trg_consent_given() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.consent_ledger_append('given', new.user_id, (select public.email_hash(email) from auth.users where id = new.user_id), new.kind, new.version, new.accepted_at);
  return null;
end $$;
create trigger consents_to_ledger after insert on public.consents for each row execute function public.trg_consent_given();

-- A consent row only goes when the account does, which is when that consent ended.
create function public.trg_consent_ended() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.consent_ledger_append('ended', old.user_id,
    (select email_hash from consent_ledger where user_id = old.user_id and event = 'given' and email_hash is not null order by seq desc limit 1),
    old.kind, old.version, now());
  return null;
end $$;
create trigger consents_end_in_ledger after delete on public.consents for each row execute function public.trg_consent_ended();

-- ---------- 4. Append-only ----------
create function public.append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger consent_ledger_no_change before update or delete on public.consent_ledger for each row execute function public.append_only();
create trigger consent_ledger_no_truncate before truncate on public.consent_ledger for each statement execute function public.append_only();
create trigger consent_documents_no_change before update or delete on public.consent_documents for each row execute function public.append_only();
create trigger consent_documents_no_truncate before truncate on public.consent_documents for each statement execute function public.append_only();
create trigger archive_checkpoints_no_change before update or delete on public.archive_checkpoints for each row execute function public.append_only();
create trigger archive_checkpoints_no_truncate before truncate on public.archive_checkpoints for each statement execute function public.append_only();
create trigger admin_audit_log_no_truncate before truncate on public.admin_audit_log for each statement execute function public.append_only();

-- A sealed entry in the register keeps what its hash covers. Only its status and destroy date move on.
create function public.archive_batch_sealed() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'a sealed archive batch cannot be deleted'; end if;
  if (new.table_name, new.day, new.part, new.object_path, new.row_count, new.byte_count, new.sha256, new.released_at, new.worm_key, new.worm_version, new.worm_retain_until, new.chain_seq, new.prev_hash, new.entry_hash)
     is distinct from (old.table_name, old.day, old.part, old.object_path, old.row_count, old.byte_count, old.sha256, old.released_at, old.worm_key, old.worm_version, old.worm_retain_until, old.chain_seq, old.prev_hash, old.entry_hash) then
    raise exception 'a sealed archive batch cannot be changed';
  end if;
  return new;
end $$;
create trigger archive_batches_sealed before update or delete on public.archive_batches for each row
  when (old.entry_hash is not null) execute function public.archive_batch_sealed();
create trigger archive_batches_no_truncate before truncate on public.archive_batches for each statement execute function public.append_only();

-- ---------- 5. Sealing now needs the write-once copy ----------
create function public.svc_archive_retain_until(p_batch uuid) returns date
language sql stable security definer set search_path = public as $$
  select b.day + p.retain_days from archive_batches b join retention_policies p using (table_name) where b.id = p_batch $$;

drop function public.svc_archive_seal(uuid, bigint, bigint, text);
create function public.svc_archive_seal(p_batch uuid, p_rows bigint, p_bytes bigint, p_sha256 text, p_worm_key text, p_worm_version text, p_worm_until date) returns bigint
language plpgsql security definer set search_path = public as $$
declare b archive_batches; p retention_policies; v_from timestamptz; v_to timestamptz; v_count bigint;
begin
  select * into b from archive_batches where id = p_batch and status = 'exporting' for update;
  if b.id is null then raise exception 'batch_not_open'; end if;
  select * into p from retention_policies where table_name = b.table_name;
  v_from := b.day::timestamp at time zone 'UTC'; v_to := (b.day + 1)::timestamp at time zone 'UTC';

  execute format('select count(*) from %2$I where %1$I >= $1 and %1$I < $2', p.date_column, p.table_name) into v_count using v_from, v_to;
  if v_count <> p_rows then raise exception 'row_count_changed: wrote %, table has %', p_rows, v_count; end if;
  if p_rows = 0 then delete from archive_batches where id = b.id; return 0; end if;
  if nullif(p_worm_key, '') is null or nullif(p_worm_version, '') is null then raise exception 'worm_copy_required'; end if;
  if p_worm_until is null or p_worm_until < b.day + p.retain_days then raise exception 'worm_lock_too_short'; end if;

  update archive_batches set status = 'verified', row_count = p_rows, byte_count = p_bytes, sha256 = p_sha256 where id = b.id;
  execute format('delete from %2$I where %1$I >= $1 and %1$I < $2', p.date_column, p.table_name) using v_from, v_to;
  get diagnostics v_count = row_count;
  if v_count <> p_rows then raise exception 'row_count_changed: wrote %, deleted %', p_rows, v_count; end if;

  perform pg_advisory_xact_lock(hashtext('archive_register'));
  select * into b from archive_batches where id = p_batch;
  b.chain_seq := nextval('public.archive_chain_seq');
  b.prev_hash := coalesce((select entry_hash from archive_batches where chain_seq is not null order by chain_seq desc limit 1), repeat('0', 64));
  b.worm_key := p_worm_key; b.worm_version := p_worm_version; b.worm_retain_until := p_worm_until; b.released_at := now();
  update archive_batches set status = 'released', released_at = b.released_at, last_error = null, retain_until = b.day + p.retain_days,
    worm_key = b.worm_key, worm_version = b.worm_version, worm_retain_until = b.worm_retain_until,
    chain_seq = b.chain_seq, prev_hash = b.prev_hash, entry_hash = public.register_entry_hash(b)
  where id = b.id;
  return v_count;
end $$;

create function public.svc_archive_due_keys(p_batch uuid) returns text
language sql stable security definer set search_path = public as $$ select worm_key from archive_batches where id = p_batch $$;

-- ---------- 6. Checkpoints and checking ----------
-- What the next checkpoint would hold. Due when there's something new, or daily so a silent stop shows.
-- Measured from the last good checkpoint: one written after a failed check holds forged heads, and must never become
-- the thing later checks compare against. So a failure stays a failure until a person deals with it.
create function public.svc_checkpoint_plan() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c archive_checkpoints; v_seq bigint; v_head text; r_seq bigint; r_head text;
begin
  select * into c from archive_checkpoints where (integrity->>'ok')::boolean order by id desc limit 1;
  select seq, entry_hash into v_seq, v_head from consent_ledger order by seq desc limit 1;
  select chain_seq, entry_hash into r_seq, r_head from archive_batches where chain_seq is not null order by chain_seq desc limit 1;
  return jsonb_build_object(
    'due', c.id is null or coalesce(v_seq, 0) > c.consent_through or coalesce(r_seq, 0) > c.register_through or c.taken_at < now() - interval '1 day',
    'consent_from', coalesce(c.consent_through, 0), 'consent_through', coalesce(v_seq, 0), 'consent_head', coalesce(v_head, repeat('0', 64)),
    'register_through', coalesce(r_seq, 0), 'register_head', coalesce(r_head, repeat('0', 64)),
    'last', case when c.id is null then null else jsonb_build_object('key', c.checkpoint_key, 'version', c.checkpoint_version) end);
end $$;

create function public.svc_consent_export_page(p_after bigint, p_through bigint, p_limit int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(l) order by l.seq), '[]') from (
    select * from consent_ledger where seq > p_after and seq <= p_through order by seq limit least(p_limit, 1000)) l $$;

-- Walks both chains, and compares them with the heads last written to write-once storage. Any change shows here.
create function public.svc_integrity_check(p_consent_seq bigint default 0, p_consent_head text default null, p_register_seq bigint default 0, p_register_head text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l consent_ledger; b archive_batches; v_prev text := repeat('0', 64); v_bad bigint; r_bad bigint; v_match boolean := true;
begin
  for l in select * from consent_ledger order by seq loop
    if l.prev_hash <> v_prev or l.entry_hash <> public.consent_entry_hash(l) then v_bad := l.seq; exit; end if;
    v_prev := l.entry_hash;
  end loop;
  v_prev := repeat('0', 64);
  for b in select * from archive_batches where chain_seq is not null order by chain_seq loop
    if b.prev_hash <> v_prev or b.entry_hash <> public.register_entry_hash(b) then r_bad := b.chain_seq; exit; end if;
    v_prev := b.entry_hash;
  end loop;
  if p_consent_seq > 0 then v_match := v_match and exists (select 1 from consent_ledger where seq = p_consent_seq and entry_hash = p_consent_head); end if;
  if p_register_seq > 0 then v_match := v_match and exists (select 1 from archive_batches where chain_seq = p_register_seq and entry_hash = p_register_head); end if;
  return jsonb_build_object('ok', v_bad is null and r_bad is null and v_match, 'consent_bad_seq', v_bad, 'register_bad_seq', r_bad, 'matches_checkpoint', v_match, 'checked_at', now());
end $$;

create function public.svc_checkpoint_record(p_consent_through bigint, p_consent_head text, p_register_through bigint, p_register_head text,
  p_checkpoint_key text, p_checkpoint_version text, p_consent_key text, p_consent_version text, p_integrity jsonb) returns void
language sql security definer set search_path = public as $$
  insert into archive_checkpoints (consent_through, consent_head, register_through, register_head, checkpoint_key, checkpoint_version, consent_key, consent_version, integrity)
  values (p_consent_through, p_consent_head, p_register_through, p_register_head, p_checkpoint_key, p_checkpoint_version, p_consent_key, p_consent_version, p_integrity) $$;

-- ---------- 7. The health page ----------
create or replace function public.admin_archive_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p retention_policies; v_oldest timestamptz; v_min timestamptz; c archive_checkpoints;
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  for p in select * from retention_policies where action = 'archive' and enabled loop
    execute format('select min(%1$I) from %2$I where %1$I < $1', p.date_column, p.table_name) into v_min
      using ((now() at time zone 'UTC')::date - p.hot_days)::timestamp at time zone 'UTC';
    if v_oldest is null or v_min < v_oldest then v_oldest := v_min; end if;
  end loop;
  select * into c from archive_checkpoints order by id desc limit 1;
  return jsonb_build_object(
    'configured', exists (select 1 from archive_settings),
    'files', (select count(*) from archive_batches where status = 'released'),
    'rows', (select coalesce(sum(row_count), 0) from archive_batches where status = 'released'),
    'bytes', (select coalesce(sum(byte_count), 0) from archive_batches where status = 'released'),
    'destroyed', (select count(*) from archive_batches where status = 'destroyed'),
    'last_released_at', (select max(released_at) from archive_batches),
    'oldest_waiting', v_oldest,
    'failed', (select count(*) from archive_batches where status = 'failed'),
    'active_holds', (select count(*) from archive_legal_holds where released_at is null),
    'overdue_destruction', (select count(*) from archive_batches b where b.status = 'released'
      and b.retain_until < (now() at time zone 'UTC')::date and not public.archive_is_held(b.table_name, b.day)),
    'last_checkpoint_at', c.taken_at,
    'integrity_ok', (c.integrity->>'ok')::boolean,
    'consent_records', (select count(*) from consent_ledger));
end $$;

-- ---------- 8. Grants ----------
revoke execute on function public.chain_hash(text, text[]), public.chain_time(timestamptz), public.consent_entry_hash(public.consent_ledger),
  public.register_entry_hash(public.archive_batches), public.consent_ledger_append(text, uuid, text, text, text, timestamptz),
  public.trg_consent_given(), public.trg_consent_ended(), public.append_only(), public.archive_batch_sealed(), public.consent_document_hash(),
  public.svc_archive_retain_until(uuid), public.svc_archive_seal(uuid, bigint, bigint, text, text, text, date), public.svc_archive_due_keys(uuid),
  public.svc_checkpoint_plan(), public.svc_consent_export_page(bigint, bigint, int), public.svc_integrity_check(bigint, text, bigint, text),
  public.svc_checkpoint_record(bigint, text, bigint, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.svc_archive_retain_until(uuid), public.svc_archive_seal(uuid, bigint, bigint, text, text, text, date), public.svc_archive_due_keys(uuid),
  public.svc_checkpoint_plan(), public.svc_consent_export_page(bigint, bigint, int), public.svc_integrity_check(bigint, text, bigint, text),
  public.svc_checkpoint_record(bigint, text, bigint, text, text, text, text, text, jsonb) to service_role;

-- ---------- 9. The wording so far, then everyone who already agreed ----------
insert into public.consent_documents (kind, version, wording, document_text) values
  ('age_18', '1', $w$I'm 16 or older and agree to the Terms and Privacy Policy.$w$, null),
  ('terms', '1', $w$I'm 16 or older and agree to the Terms and Privacy Policy.$w$, $legal$Last updated 24 October 2026
Acceptance
The basics
By creating an account you agree to these terms. You must be 16 or older, and the details you give us must be accurate.
You are responsible for activity on your account, so keep your password private.
Conduct
Be a good conversation partner
Be respectful: no harassment, hate speech or discrimination.
Stay safe: no spam, scams or sharing other people’s private details.
Be yourself: no impersonation or fake profiles.
Content
You own what you write
You keep ownership of your messages and saved phrases. You give us permission to store and display them only so the service works, for example showing a message to your partner.
Termination
Leaving, and our limits
You can delete your account at any time. We may suspend accounts that break these rules.
The Fluency Talks is provided as is. We are not responsible for what members say to each other, but we act quickly on reports.
Questions about this page?
Write to terms@thefluencytalks.com
$legal$),
  ('privacy', '1', $w$I'm 16 or older and agree to the Terms and Privacy Policy.$w$, $legal$Last updated 24 October 2026
Information we collect
Transparent data collection
We collect what you give us when you create an account, practise a language or chat with a partner.
Account and profile: email, username, avatar, native and target languages.
Messages and content: the messages you send, corrections, translated phrases and saved vocabulary.
Contributions: your posts, the corrections and replies you write, and the decisions you make on them, which stay in the discussion history. If you delete your account your name is removed from what you wrote elsewhere.
Activity: when you were last active, unless you turn this off in Settings, and the level your activity has earned.
Technical data: IP address, device type, browser settings and usage analytics.
How we use your data
Empowering your fluency
Every piece of data has a purpose.
Core service: partner matching, real-time chat and conversation practice.
Safety: preventing spam and abuse, and enforcing our terms.
Notifications: practice reminders, partner messages and security updates.
Third parties
Trusted infrastructure partners
We never sell your personal information. We share data only with the providers that run the service.
Supabase: encrypted database and sign-in.
Translation: the text you ask to translate is sent to a translation service (MyMemory).
Image search: when you search for a picture for a phrase, your search words are sent to Unsplash through our server. Your name and account are not.
Privacy first
Your conversations are built on trust
Your chats are yours. We collect only what we need, protect it carefully and never use it to sell advertising.
Retention and rights
Complete control in your hands
You own your data at all times. We follow GDPR and CCPA principles.
Export: download a copy of your data from Settings.
Deletion: deleting your account removes your profile, messages, saved phrases and points straight away. See Delete my data.
Reports: if someone reported you, the report is kept for safety, without your account attached.
Questions about this page?
Write to privacy@thefluencytalks.com
$legal$),
  ('privacy', '2', $w$I'm 16 or older and agree to the Terms and Privacy Policy.$w$, $legal$Last updated 3 November 2026
Information we collect
Transparent data collection
We collect what you give us when you create an account, practise a language or chat with a partner.
Account and profile: email, username, avatar, native and target languages.
Messages and content: the messages you send, corrections, translated phrases and saved vocabulary.
Contributions: your posts, the corrections and replies you write, and the decisions you make on them, which stay in the discussion history. If you delete your account your name is removed from what you wrote elsewhere.
Activity: when you were last active, unless you turn this off in Settings, and the level your activity has earned.
Technical data: IP address, device type, browser settings and usage analytics.
How we use your data
Empowering your fluency
Every piece of data has a purpose.
Core service: partner matching, real-time chat and conversation practice.
Safety: preventing spam and abuse, and enforcing our terms.
Notifications: practice reminders, partner messages and security updates.
Third parties
Trusted infrastructure partners
We never sell your personal information. We share data only with the providers that run the service.
Supabase: encrypted database and sign-in.
Translation: the text you ask to translate is sent to a translation service (MyMemory).
Image search: when you search for a picture for a phrase, your search words are sent to Unsplash through our server. Your name and account are not.
Archive storage: an independent provider holds the write-once copy of our archived records.
Our database is hosted outside Vietnam, in the European Union (Ireland).
Privacy first
Your conversations are built on trust
Your chats are yours. We collect only what we need, protect it carefully and never use it to sell advertising.
Retention schedule
How long we keep your data
We keep each kind of data only as long as its purpose needs, or as the law requires. When a period ends, the data is permanently destroyed.
Your account and content: profile, messages, posts, saved phrases, translation history and points stay until you delete them or your account.
Read notifications: 180 days after you read them. Unread ones stay until you read them or delete your account.
Application logs: 13 months, as Vietnamese cybersecurity rules require system logs to be kept for at least 12 months. For the first 30 days they stay in our database, then they move to private archive storage.
Safety reports, moderation decisions, restrictions and appeals: 3 years from the decision, so they can be explained if someone challenges them. For the first year they stay in our database, then they move to private archive storage.
Records of what our staff do: 5 years. For the first year they stay in our database, then they move to private archive storage.
Proof of your consent: kept permanently, including after you delete your account, because the law makes us responsible for proving consent. It holds only your account number, a scrambled (hashed) copy of your email address, what you agreed to and when.
We may keep a specific record for longer if the law requires it, if a competent authority orders it, or if it is needed for a legal claim.
Tamper-proof records
How we protect archived records
Archived records are copied to write-once storage with an independent provider, where they cannot be changed or deleted before their date, even by us. Each record is linked to the one before it, so a change to our own copy can be detected. Archived records do not show your user account number: they use a random code instead, and deleting your account removes the link between that code and you. Words someone typed, such as the text of a reported message, stay as written. Proof of consent is the exception: it keeps your account number and hashed email, because it has to be able to show who agreed.
Rights and time limits
Complete control in your hands
We follow Vietnam’s Law on Personal Data Protection (Law No. 91/2025/QH15) and Decree No. 356/2025/ND-CP.
Export: download a copy of your data from Settings at any time.
Deletion: deleting your account removes your profile, messages, saved phrases and points straight away. See Delete my data.
Reports: if someone reported you, the report is kept for safety for the period above, without your account attached.
You can also write to us about your data. We reply within 2 working days and then act within these limits:
Seeing, correcting or getting a copy of your data: 10 days, or 15 days if another provider has to act too.
Withdrawing consent, or limiting or objecting to how we use your data: 15 days, or 20 days if another provider has to act too.
Deleting your data: 20 days, or 30 days if another provider has to act too.
If we need longer: we can extend a limit once, by no more than the 10, 15 or 20 days above, and we will tell you why.
Withdrawing consent does not affect what we did before you withdrew it. Some records can be kept without consent where the law allows, such as to protect people’s rights and safety.
Questions about this page?
Write to privacy@thefluencytalks.com
$legal$);

do $$ declare c record; begin
  for c in select x.*, u.email from public.consents x left join auth.users u on u.id = x.user_id order by x.accepted_at, x.user_id, x.kind loop
    perform public.consent_ledger_append('given', c.user_id, public.email_hash(c.email), c.kind, c.version, c.accepted_at);
  end loop;
end $$;
