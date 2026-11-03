-- The pause switch and per-user rate limits, enforced on every API request by check_request.

create table public.app_status (
  id boolean default true primary key check (id),
  paused boolean not null default false,
  message text,
  paused_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_status enable row level security;
grant select on public.app_status to anon, authenticated;

create table public.rate_limit_rules (
  path text primary key,
  max_hits int not null check (max_hits > 0),
  window_seconds int not null check (window_seconds > 0)
);
alter table public.rate_limit_rules enable row level security;

create unlogged table public.rate_limit_counters (
  user_id uuid not null,
  path text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (user_id, path, window_start)
);
alter table public.rate_limit_counters enable row level security;
create index rate_limit_counters_window_start_idx on public.rate_limit_counters (window_start);

create function public.check_request() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_path text := coalesce(current_setting('request.path', true), '');
  v_uid uuid; v_paused boolean := false; v_limited boolean := false; v_hits int; r record;
begin
  begin
    if auth.role() = 'service_role' then return; end if;
    v_uid := auth.uid();
    if v_path not in ('/', '/rpc/get_app_status', '/rpc/accept_admin_invitation') then
      v_paused := (select paused from app_status) and (v_uid is null or public.staff_tier(v_uid) is null);
    end if;
    if not v_paused and v_uid is not null and current_setting('transaction_read_only') = 'off' then
      for r in select path, max_hits, window_seconds from rate_limit_rules where path in ('*', v_path) order by path loop
        insert into rate_limit_counters (user_id, path, window_start)
        values (v_uid, r.path, to_timestamp(floor(extract(epoch from now()) / r.window_seconds) * r.window_seconds))
        on conflict (user_id, path, window_start) do update set hits = rate_limit_counters.hits + 1
        returning hits into v_hits;
        if v_hits > r.max_hits then v_limited := true; end if;
      end loop;
    end if;
  exception when others then
    return;
  end;
  if v_paused then raise sqlstate 'PT503' using message = 'app_paused'; end if;
  if v_limited then raise sqlstate 'PT429' using message = 'rate_limited'; end if;
end $$;

create function public.edge_gate() returns void language plpgsql as $$ begin null; end $$;

create function public.app_open() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not (select paused from app_status) then return true; end if;
  return public.staff_tier() is not null;
end $$;

create function public.get_app_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s app_status; v_staff boolean := auth.uid() is not null and public.staff_tier() is not null;
begin
  select * into s from app_status;
  return jsonb_build_object('paused', s.paused, 'message', s.message, 'since', s.paused_at, 'exempt', v_staff)
    || case when v_staff then jsonb_build_object('enforced', exists (
         select 1 from pg_roles, unnest(rolconfig) c where rolname = 'authenticator' and c = 'pgrst.db_pre_request=public.check_request')) else '{}'::jsonb end;
end $$;

create function public.admin_set_app_paused(p_paused boolean, p_reason text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_status; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_staff uuid;
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  select * into s from app_status for update;
  if s.paused is distinct from p_paused then
    if not p_paused then
      update decision_items set due_at = due_at + (now() - s.paused_at) where resolved_at is null and due_at is not null and s.paused_at is not null;
    end if;
    update app_status set paused = p_paused, updated_at = now(), paused_at = case when p_paused then now() end,
      message = case when p_paused then nullif(btrim(left(coalesce(p_message, ''), 280)), '') end
    where id;
    perform public.admin_audit(case when p_paused then 'app_paused' else 'app_resumed' end, null, jsonb_build_object('reason', left(v_reason, 500), 'message', p_message));
    for v_staff in select a.user_id from admin_accounts a join profiles p on p.id = a.user_id where p.status = 'active' and a.user_id <> auth.uid() loop
      perform public.notify_event(v_staff, null, 'admin_site', jsonb_build_object('paused', p_paused, 'note', left(v_reason, 200)), 'site:' || extract(epoch from now())::bigint, true);
    end loop;
  end if;
  return public.get_app_status();
end $$;

create function public.rate_limit_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from rate_limit_counters where window_start < now() - interval '2 hours' $$;

create policy "app status readable" on public.app_status for select to anon, authenticated using (true);
create policy "no uploads during a pause" on storage.objects as restrictive for all to authenticated
  using ((select public.app_open())) with check ((select public.app_open()));

alter publication supabase_realtime add table public.app_status;

revoke all on function
  public.check_request(),
  public.edge_gate(),
  public.app_open(),
  public.get_app_status(),
  public.admin_set_app_paused(boolean, text, text),
  public.rate_limit_cleanup()
from public, anon, authenticated, service_role;

grant execute on function
  public.check_request(),
  public.get_app_status()
to anon, authenticated, service_role;

grant execute on function
  public.edge_gate(),
  public.app_open(),
  public.admin_set_app_paused(boolean, text, text)
to authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-rate-limit-cleanup', '*/10 * * * *', 'select public.rate_limit_cleanup()');
exception when others then
  raise notice 'pg_cron unavailable (%), counters stay until cleaned by hand', sqlerrm;
end $$;
