-- Data retention and archiving. The whole process, and what to do when it stops: docs/DATA_RETENTION.md.
--
-- Each growing table has one row in retention_policies. Rows past their hot window either go into a gzip file in a
-- private bucket and then leave Postgres ('archive'), or are simply deleted ('purge'). The archive-run edge function
-- does the file work; everything that decides what may be deleted is in here.
--
-- A row is only ever deleted in the transaction that records its verified file. If anything fails, it stays hot.

-- ---------- 1. Tables. No policies and no client grants: only security definer code reads them. ----------
-- Retention rules. Changing a rule is an UPDATE here, and only affects files not written yet.
create table public.retention_policies (
  table_name text primary key,
  action text not null check (action in ('archive', 'purge')),
  date_column text not null,                     -- a row with no date here never moves: an open report has no resolved_at
  hot_days int not null check (hot_days >= 1),   -- how long a row stays in Postgres
  retain_days int,                               -- how long it exists in total, counted from that date. Archive only.
  subject_columns text[] not null default '{}',  -- user ids: written as pseudonyms, see archive_subjects
  drop_columns text[] not null default '{}',     -- never written to a file
  enabled boolean not null default true,
  basis text not null,                           -- why we keep it this long
  check ((action = 'archive') = (retain_days is not null)),
  check (retain_days is null or retain_days >= hot_days));

-- One file. Kept after the file is destroyed: this is the record that the data existed and was destroyed on time.
create table public.archive_batches (
  id uuid primary key default gen_random_uuid(),
  table_name text not null references public.retention_policies(table_name),
  day date not null,                             -- UTC
  part int not null default 1,                   -- a row that turns up late for a finished day gets a new file
  object_path text not null,
  status text not null default 'exporting' check (status in ('exporting', 'verified', 'released', 'failed', 'destroyed')),
  row_count bigint, byte_count bigint, sha256 text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  released_at timestamptz,
  retain_until date,
  destroyed_at timestamptz,
  unique (table_name, day, part));
create unique index archive_batches_one_open on public.archive_batches (table_name) where status = 'exporting';
create index archive_batches_due on public.archive_batches (retain_until) where status = 'released';

-- A hold stops files being destroyed. It does not stop rows moving into files, since that loses nothing.
create table public.archive_legal_holds (
  id uuid primary key default gen_random_uuid(),
  table_name text references public.retention_policies(table_name),   -- null: every table
  from_day date not null,
  to_day date not null,
  reason text not null check (char_length(btrim(reason)) > 0),
  placed_by text not null check (char_length(btrim(placed_by)) > 0),
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by text,
  check (from_day <= to_day));

-- Files are immutable, so a deleted account can't be rewritten out of them. They hold this pseudonym instead, and
-- deleting the account deletes this row: the link back to the person is gone from every file at once.
create table public.archive_subjects (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudonym uuid not null unique default gen_random_uuid());

-- One row, written by hand after deploy, like push_settings. Nothing is archived until it exists.
create table public.archive_settings (
  id boolean primary key default true check (id),
  function_url text not null,
  webhook_secret text not null);

alter table public.retention_policies enable row level security;
alter table public.archive_batches enable row level security;
alter table public.archive_legal_holds enable row level security;
alter table public.archive_subjects enable row level security;
alter table public.archive_settings enable row level security;
revoke all on public.retention_policies, public.archive_batches, public.archive_legal_holds, public.archive_subjects,
  public.archive_settings from public, anon, authenticated;

-- 50 MB is the largest object the Free plan allows. No storage policies: only the service role can reach it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archives', 'archives', false, 52428800, array['application/gzip']) on conflict (id) do nothing;

-- Defaults, to be confirmed by whoever gives legal advice: docs/DATA_RETENTION.md.
insert into public.retention_policies (table_name, action, date_column, hot_days, retain_days, subject_columns, drop_columns, basis) values
  ('app_logs', 'archive', 'created_at', 30, 365, '{user_id}', '{context}', 'Security and fault investigation. The context column (page path, stack) is only useful hot.'),
  ('admin_audit_log', 'archive', 'created_at', 365, 1825, '{target_id}', '{target_email}', 'Who used staff powers. Evidence for security incidents and legal claims. Staff stay named: they acted for the service.'),
  ('accountability_audit', 'archive', 'created_at', 365, 1095, '{actor_id,target_user}', '{}', 'Restrictions, appeals and exemptions, so a decision about a person can be explained later.'),
  ('moderation_actions', 'archive', 'created_at', 365, 1095, '{target_user_id}', '{}', 'Bans and suspensions, so they can be explained or defended later. Staff stay named.'),
  ('reports', 'archive', 'resolved_at', 365, 1095, '{reporter_id,target_user_id}', '{}', 'Safety. Holds message text as evidence, so kept no longer than moderation_actions. Open reports never move.');
insert into public.retention_policies (table_name, action, date_column, hot_days, basis) values
  ('system_heartbeats', 'purge', 'minute', 90, 'Uptime history. No personal data, no later use.'),
  ('message_push_claims', 'purge', 'claimed_at', 30, 'Only stops a push being sent twice, which cannot happen this late.'),
  ('notifications', 'purge', 'read_at', 180, 'Read notifications have done their job. Unread ones have no read_at and stay.');

create index reports_resolved_at_idx on public.reports (resolved_at) where resolved_at is not null;
create index moderation_actions_created_idx on public.moderation_actions (created_at);
create index accountability_audit_created_idx on public.accountability_audit (created_at);
create index notifications_read_at_idx on public.notifications (read_at) where read_at is not null;
create index message_push_claims_claimed_idx on public.message_push_claims (claimed_at);

-- ---------- 2. Stop the old deletes ----------
-- This deleted app_logs after 30 days with no copy kept. Heartbeats move to retention_policies with the rest.
create or replace function public.system_heartbeat() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into system_heartbeats (minute) values (date_trunc('minute', now())) on conflict do nothing;
end $$;

-- Still append-only. The one exception: rows covered by a batch that is verified right now, which only exists
-- inside the transaction in svc_archive_seal.
create or replace function public.admin_audit_append_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1 from archive_batches b where b.table_name = 'admin_audit_log' and b.status = 'verified'
      and old.created_at >= (b.day::timestamp at time zone 'UTC') and old.created_at < ((b.day + 1)::timestamp at time zone 'UTC')) then
    return old;
  end if;
  raise exception 'admin_audit_log is append-only';
end $$;

-- ---------- 3. What goes into a file ----------
-- No pseudonym for an account that is already gone: that person stays unlinked.
create function public.archive_pseudonym(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then return null; end if;
  insert into archive_subjects (user_id) values (p_user) on conflict (user_id) do nothing;
  select pseudonym into v from archive_subjects where user_id = p_user;
  return v;
end $$;

create function public.archive_scrub_row(p public.retention_policies, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb := p_row - p.drop_columns; c text;
begin
  foreach c in array p.subject_columns loop
    if v ? c then v := jsonb_set(v, array[c], coalesce(to_jsonb(archive_pseudonym((v->>c)::uuid)), 'null')); end if;
  end loop;
  -- Two places a person is named inside a json value.
  if p.table_name = 'reports' and jsonb_typeof(v->'evidence') = 'array' then
    v := jsonb_set(v, '{evidence}', (select coalesce(jsonb_agg(
        case when e ? 'sender_id' then jsonb_set(e, '{sender_id}', coalesce(to_jsonb(archive_pseudonym((e->>'sender_id')::uuid)), 'null')) else e end order by n), '[]')
      from jsonb_array_elements(v->'evidence') with ordinality x(e, n)));
  elsif p.table_name = 'admin_audit_log' and v ? 'detail' then
    v := jsonb_set(v, '{detail}', (v->'detail') - 'email');
  end if;
  return v;
end $$;

create function public.archive_is_held(p_table text, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from archive_legal_holds h where h.released_at is null
    and (h.table_name is null or h.table_name = p_table) and p_day between h.from_day and h.to_day) $$;

-- ---------- 4. The steps archive-run calls ----------
-- The next batch to work on, or null. Finishes an unfinished batch first. A table with a failed batch stops until
-- someone looks at it: its rows stay hot, so waiting loses nothing.
create function public.svc_archive_next_batch() returns jsonb
language plpgsql security definer set search_path = public as $$
declare b archive_batches; p retention_policies; v_min timestamptz; v_day date; v_part int;
begin
  update archive_batches set status = 'failed', last_error = coalesce(last_error, 'stopped without reporting')
  where status = 'exporting' and attempts >= 5 and claimed_at < now() - interval '15 minutes';

  select * into b from archive_batches
  where status = 'exporting' and (claimed_at is null or claimed_at < now() - interval '15 minutes')
  order by created_at limit 1 for update skip locked;

  if b.id is null then
    for p in select * from retention_policies where action = 'archive' and enabled order by table_name loop
      continue when exists (select 1 from archive_batches x where x.table_name = p.table_name and x.status in ('exporting', 'failed'));
      execute format('select min(%1$I) from %2$I where %1$I < $1', p.date_column, p.table_name) into v_min
        using ((now() at time zone 'UTC')::date - p.hot_days)::timestamp at time zone 'UTC';
      continue when v_min is null;
      v_day := (v_min at time zone 'UTC')::date;
      select count(*) + 1 into v_part from archive_batches x where x.table_name = p.table_name and x.day = v_day;
      insert into archive_batches (table_name, day, part, object_path)
      values (p.table_name, v_day, v_part, format('%s/%s/%s.p%s.ndjson.gz', p.table_name, to_char(v_day, 'YYYY/MM'), v_day, v_part))
      on conflict do nothing returning * into b;
      exit when b.id is not null;
    end loop;
  end if;
  if b.id is null then return null; end if;

  update archive_batches set attempts = attempts + 1, claimed_at = now() where id = b.id returning * into b;
  return jsonb_build_object('id', b.id, 'table_name', b.table_name, 'day', b.day, 'part', b.part, 'object_path', b.object_path, 'attempt', b.attempts);
end $$;

-- One page of scrubbed rows. Returns a single json value, so PostgREST's row limit doesn't apply.
create function public.svc_archive_export_page(p_batch uuid, p_offset int, p_limit int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b archive_batches; p retention_policies; v jsonb;
begin
  select * into b from archive_batches where id = p_batch and status = 'exporting';
  if b.id is null then raise exception 'batch_not_open'; end if;
  select * into p from retention_policies where table_name = b.table_name;
  execute format($q$
    select coalesce(jsonb_agg(public.archive_scrub_row($1, r.j) order by r.id), '[]')
    from (select t.id, to_jsonb(t) as j from %2$I t where %1$I >= $2 and %1$I < $3 order by t.id offset $4 limit $5) r$q$, p.date_column, p.table_name)
  into v using p, b.day::timestamp at time zone 'UTC', (b.day + 1)::timestamp at time zone 'UTC', p_offset, least(p_limit, 1000);
  return v;
end $$;

-- Called once the file is uploaded and read back. Records the file and deletes the rows in one transaction, so
-- neither can happen without the other. Refuses if the rows are not exactly the ones that were written.
create function public.svc_archive_seal(p_batch uuid, p_rows bigint, p_bytes bigint, p_sha256 text) returns bigint
language plpgsql security definer set search_path = public as $$
declare b archive_batches; p retention_policies; v_from timestamptz; v_to timestamptz; v_count bigint;
begin
  select * into b from archive_batches where id = p_batch and status = 'exporting' for update;
  if b.id is null then raise exception 'batch_not_open'; end if;
  select * into p from retention_policies where table_name = b.table_name;
  v_from := b.day::timestamp at time zone 'UTC'; v_to := (b.day + 1)::timestamp at time zone 'UTC';

  execute format('select count(*) from %2$I where %1$I >= $1 and %1$I < $2', p.date_column, p.table_name) into v_count using v_from, v_to;
  if v_count <> p_rows then raise exception 'row_count_changed: wrote %, table has %', p_rows, v_count; end if;
  -- Everything it held was removed meanwhile (say, the post was deleted), so no file was made.
  if p_rows = 0 then delete from archive_batches where id = b.id; return 0; end if;

  update archive_batches set status = 'verified', row_count = p_rows, byte_count = p_bytes, sha256 = p_sha256 where id = b.id;
  execute format('delete from %2$I where %1$I >= $1 and %1$I < $2', p.date_column, p.table_name) using v_from, v_to;
  get diagnostics v_count = row_count;
  if v_count <> p_rows then raise exception 'row_count_changed: wrote %, deleted %', p_rows, v_count; end if;
  update archive_batches set status = 'released', released_at = now(), last_error = null, retain_until = b.day + p.retain_days where id = b.id;
  return v_count;
end $$;

create function public.svc_archive_fail(p_batch uuid, p_error text) returns void
language sql security definer set search_path = public as $$
  update archive_batches set last_error = left(p_error, 1000), status = case when attempts >= 5 then 'failed' else status end
  where id = p_batch and status = 'exporting' $$;

create function public.svc_archive_due_for_destruction(p_limit int default 100) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'object_path', d.object_path)), '[]') from (
    select b.id, b.object_path from archive_batches b
    where b.status = 'released' and b.retain_until <= (now() at time zone 'UTC')::date and not public.archive_is_held(b.table_name, b.day)
    order by b.retain_until limit least(p_limit, 1000)) d $$;

create function public.svc_archive_mark_destroyed(p_batch uuid) returns void
language sql security definer set search_path = public as $$
  update archive_batches b set status = 'destroyed', destroyed_at = now()
  where b.id = p_batch and b.status = 'released' and not public.archive_is_held(b.table_name, b.day) $$;

-- ---------- 5. On a clock ----------
-- Bounded, so a big first run can't hold locks for long. What's left goes next hour.
create function public.archive_purge() returns void
language plpgsql security definer set search_path = public as $$
declare p retention_policies;
begin
  for p in select * from retention_policies where action = 'purge' and enabled loop
    execute format('delete from %2$I where ctid in (select ctid from %2$I where %1$I < $1 limit 5000)', p.date_column, p.table_name)
      using now() - make_interval(days => p.hot_days);
  end loop;
  -- pg_cron's own run history grows by a row per job per run, and the heartbeat runs each minute.
  begin
    execute 'delete from cron.job_run_details where end_time < now() - interval ''14 days''';
  exception when others then null;
  end;
end $$;

create function public.archive_kick() returns void
language plpgsql security definer set search_path = public as $$
declare cfg archive_settings;
begin
  select * into cfg from archive_settings;
  if cfg.function_url is null then return; end if;
  perform net.http_post(
    url := cfg.function_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-archive-secret', cfg.webhook_secret),
    timeout_milliseconds := 300000);
exception when others then
  raise warning 'archive not started: %', sqlerrm;
end $$;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-archive-purge', '7 * * * *', 'select public.archive_purge()');
  perform cron.schedule('ft-archive-run', '17 */6 * * *', 'select public.archive_kick()');
exception when others then
  raise notice 'pg_cron unavailable (%), retention does not run until it is enabled', sqlerrm;
end $$;

-- ---------- 6. What the health page shows ----------
create function public.admin_archive_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p retention_policies; v_oldest timestamptz; v_min timestamptz;
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  for p in select * from retention_policies where action = 'archive' and enabled loop
    execute format('select min(%1$I) from %2$I where %1$I < $1', p.date_column, p.table_name) into v_min
      using ((now() at time zone 'UTC')::date - p.hot_days)::timestamp at time zone 'UTC';
    if v_oldest is null or v_min < v_oldest then v_oldest := v_min; end if;
  end loop;
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
      and b.retain_until < (now() at time zone 'UTC')::date and not public.archive_is_held(b.table_name, b.day)));
end $$;

-- ---------- 7. Grants ----------
revoke execute on function public.archive_pseudonym(uuid), public.archive_scrub_row(public.retention_policies, jsonb),
  public.archive_is_held(text, date), public.archive_purge(), public.archive_kick(),
  public.svc_archive_next_batch(), public.svc_archive_export_page(uuid, int, int), public.svc_archive_seal(uuid, bigint, bigint, text),
  public.svc_archive_fail(uuid, text), public.svc_archive_due_for_destruction(int), public.svc_archive_mark_destroyed(uuid)
  from public, anon, authenticated;
grant execute on function public.svc_archive_next_batch(), public.svc_archive_export_page(uuid, int, int), public.svc_archive_seal(uuid, bigint, bigint, text),
  public.svc_archive_fail(uuid, text), public.svc_archive_due_for_destruction(int), public.svc_archive_mark_destroyed(uuid) to service_role;
revoke execute on function public.admin_archive_status() from public, anon;
grant execute on function public.admin_archive_status() to authenticated, service_role;
