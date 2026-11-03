-- Retention policies, archive batches, legal holds and integrity checkpoints.

create table public.retention_policies (
  table_name text primary key,
  action text not null check (action in ('archive', 'purge')),
  date_column text not null,
  hot_days int not null check (hot_days >= 1),
  retain_days int,
  subject_columns text[] not null default '{}'::text[],
  drop_columns text[] not null default '{}'::text[],
  enabled boolean not null default true,
  basis text not null,
  constraint retention_policies_check check ((action = 'archive') = (retain_days is not null)),
  constraint retention_policies_check1 check ((retain_days is null) or (retain_days >= hot_days))
);
alter table public.retention_policies enable row level security;

create table public.archive_settings (
  id boolean default true primary key check (id),
  function_url text not null,
  webhook_secret text not null
);
alter table public.archive_settings enable row level security;

create table public.archive_batches (
  id uuid default gen_random_uuid() primary key,
  table_name text not null references public.retention_policies(table_name),
  day date not null,
  part int not null default 1,
  object_path text not null,
  status text not null default 'exporting' check (status in ('exporting', 'verified', 'released', 'failed', 'destroyed')),
  row_count bigint,
  byte_count bigint,
  sha256 text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  released_at timestamptz,
  retain_until date,
  destroyed_at timestamptz,
  worm_key text,
  worm_version text,
  worm_retain_until date,
  chain_seq bigint unique,
  prev_hash text,
  entry_hash text,
  unique (table_name, day, part)
);
alter table public.archive_batches enable row level security;
create index archive_batches_due on public.archive_batches (retain_until) where status = 'released';
create unique index archive_batches_one_open on public.archive_batches (table_name) where status = 'exporting';

create table public.archive_subjects (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudonym uuid not null default gen_random_uuid() unique
);
alter table public.archive_subjects enable row level security;

create table public.archive_legal_holds (
  id uuid default gen_random_uuid() primary key,
  table_name text references public.retention_policies(table_name),
  from_day date not null,
  to_day date not null,
  reason text not null check (char_length(btrim(reason)) > 0),
  placed_by text not null check (char_length(btrim(placed_by)) > 0),
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by text,
  constraint archive_legal_holds_check check (from_day <= to_day)
);
alter table public.archive_legal_holds enable row level security;

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
  integrity jsonb not null
);
alter table public.archive_checkpoints enable row level security;

create sequence public.archive_chain_seq owned by public.archive_batches.chain_seq;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archives', 'archives', false, 52428800, array['application/gzip']) on conflict (id) do nothing;

create function public.admin_audit_append_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1 from archive_batches b where b.table_name = 'admin_audit_log' and b.status = 'verified'
      and old.created_at >= (b.day::timestamp at time zone 'UTC') and old.created_at < ((b.day + 1)::timestamp at time zone 'UTC')) then
    return old;
  end if;
  raise exception 'admin_audit_log is append-only';
end $$;

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

create function public.register_entry_hash(b public.archive_batches) returns text
language sql immutable set search_path = public as $$
  select public.chain_hash(b.prev_hash, b.chain_seq::text, b.table_name, b.day::text, b.part::text, b.object_path, b.row_count::text, b.byte_count::text,
    b.sha256, b.worm_key, b.worm_version, b.worm_retain_until::text, public.chain_time(b.released_at)) $$;

create function public.archive_batch_sealed() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'a sealed archive batch cannot be deleted'; end if;
  if (new.table_name, new.day, new.part, new.object_path, new.row_count, new.byte_count, new.sha256, new.released_at, new.worm_key, new.worm_version, new.worm_retain_until, new.chain_seq, new.prev_hash, new.entry_hash)
     is distinct from (old.table_name, old.day, old.part, old.object_path, old.row_count, old.byte_count, old.sha256, old.released_at, old.worm_key, old.worm_version, old.worm_retain_until, old.chain_seq, old.prev_hash, old.entry_hash) then
    raise exception 'a sealed archive batch cannot be changed';
  end if;
  return new;
end $$;

create function public.svc_archive_retain_until(p_batch uuid) returns date
language sql stable security definer set search_path = public as $$
  select b.day + p.retain_days from archive_batches b join retention_policies p using (table_name) where b.id = p_batch $$;

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

create function public.admin_archive_status() returns jsonb
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

create trigger admin_audit_log_no_change before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_append_only();
create trigger archive_batches_no_truncate before truncate on public.archive_batches for each statement execute function public.append_only();
create trigger archive_batches_sealed before update or delete on public.archive_batches for each row
  when (old.entry_hash is not null) execute function public.archive_batch_sealed();
create trigger archive_checkpoints_no_change before update or delete on public.archive_checkpoints for each row execute function public.append_only();
create trigger archive_checkpoints_no_truncate before truncate on public.archive_checkpoints for each statement execute function public.append_only();

revoke all on function
  public.admin_audit_append_only(),
  public.archive_pseudonym(uuid),
  public.archive_scrub_row(public.retention_policies, jsonb),
  public.archive_is_held(text, date),
  public.svc_archive_next_batch(),
  public.svc_archive_export_page(uuid, integer, integer),
  public.svc_archive_fail(uuid, text),
  public.svc_archive_due_for_destruction(integer),
  public.svc_archive_mark_destroyed(uuid),
  public.archive_purge(),
  public.archive_kick(),
  public.register_entry_hash(public.archive_batches),
  public.archive_batch_sealed(),
  public.svc_archive_retain_until(uuid),
  public.svc_archive_seal(uuid, bigint, bigint, text, text, text, date),
  public.svc_archive_due_keys(uuid),
  public.svc_checkpoint_plan(),
  public.svc_integrity_check(bigint, text, bigint, text),
  public.svc_checkpoint_record(bigint, text, bigint, text, text, text, text, text, jsonb),
  public.admin_archive_status()
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_archive_status()
to authenticated, service_role;

grant execute on function
  public.svc_archive_next_batch(),
  public.svc_archive_export_page(uuid, integer, integer),
  public.svc_archive_fail(uuid, text),
  public.svc_archive_due_for_destruction(integer),
  public.svc_archive_mark_destroyed(uuid),
  public.svc_archive_retain_until(uuid),
  public.svc_archive_seal(uuid, bigint, bigint, text, text, text, date),
  public.svc_archive_due_keys(uuid),
  public.svc_checkpoint_plan(),
  public.svc_integrity_check(bigint, text, bigint, text),
  public.svc_checkpoint_record(bigint, text, bigint, text, text, text, text, text, jsonb)
to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-archive-purge', '7 * * * *', 'select public.archive_purge()');
  perform cron.schedule('ft-archive-run', '17 */6 * * *', 'select public.archive_kick()');
exception when others then
  raise notice 'pg_cron unavailable (%), retention does not run until it is enabled', sqlerrm;
end $$;
