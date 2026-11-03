-- Two guards that sit in front of every API call: a switch that takes the app down for everyone but staff,
-- and per-user rate limits. Both run from check_request(), which PostgREST calls before each request.
-- If this ever misbehaves, this turns it off at once (the steps are in docs/SECURITY.md):
--   alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';

-- ---------- 1. The switch ----------
-- Readable by anyone, so it holds nothing private. Who pressed it and why go to admin_audit_log.
create table public.app_status (
  id boolean primary key default true check (id),
  paused boolean not null default false,
  message text,
  paused_at timestamptz,
  updated_at timestamptz not null default now());
insert into public.app_status (id) values (true);
alter table public.app_status enable row level security;
revoke all on public.app_status from public, anon, authenticated;
grant select on public.app_status to anon, authenticated;
create policy "app status readable" on public.app_status for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.app_status;

-- ---------- 2. Rate limits ----------
-- One row per path, so a limit can be tuned with an UPDATE and no deploy. '*' is every write, whatever the path.
create table public.rate_limit_rules (
  path text primary key,
  max_hits int not null check (max_hits > 0),
  window_seconds int not null check (window_seconds > 0));
insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('*', 240, 60),
  -- These tell someone else, or staff, so a burst is someone else's problem.
  ('/rpc/follow_user', 60, 3600),
  ('/rpc/report_user', 10, 3600),
  ('/rpc/report_post', 10, 3600),
  ('/rpc/block_user', 60, 3600),
  ('/rpc/appeal_restriction', 10, 3600),
  ('/rpc/request_decision_extension', 20, 3600),
  ('/rpc/toggle_post_endorsement', 60, 60),
  ('/rpc/toggle_correction_agreement', 60, 60),
  ('/rpc/toggle_reaction', 60, 60),
  ('/rpc/edit_message', 30, 60),
  ('/rpc/save_profile', 30, 3600),
  ('/rpc/save_phrase', 60, 60),
  ('/rpc/save_translation', 60, 60),
  -- The ways to walk the member list.
  ('/rpc/search_people', 60, 60),
  ('/rpc/search_messages', 60, 60),
  ('/rpc/search_posts', 60, 60),
  ('/rpc/search_phrases', 60, 60),
  ('/rpc/get_profile', 120, 60),
  ('/rpc/list_follows', 120, 60),
  -- Edge functions spending a paid quota ask here first.
  ('/rpc/edge_gate', 30, 60);

-- Unlogged: losing the counters in a crash only hands everyone a fresh window.
create unlogged table public.rate_limit_counters (
  user_id uuid not null,
  path text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (user_id, path, window_start));
create index on public.rate_limit_counters (window_start);
alter table public.rate_limit_rules enable row level security;
alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_rules, public.rate_limit_counters from public, anon, authenticated;

-- A read-only transaction can't count anything, and PostgREST opens one for stable functions. These are the
-- reads worth counting, so they become volatile: nothing about what they return changes.
alter function public.search_people(text, text, text, text, text, integer, integer) volatile;
alter function public.search_messages(text, uuid, integer, integer) volatile;
alter function public.search_posts(text, text, integer, integer) volatile;
alter function public.search_phrases(text, text, integer, integer) volatile;
alter function public.get_profile(text) volatile;
alter function public.list_follows(uuid, text, integer, integer) volatile;

-- ---------- 3. In front of every request ----------
-- Anything unexpected in here lets the request through: a bug in this function must not be able to take the
-- whole API down, and every table still has RLS behind it. Only the two deliberate refusals escape the block.
-- Counts are written in the request's own transaction, so a request that fails is not counted.
create function public.check_request() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_path text := coalesce(current_setting('request.path', true), '');
  v_uid uuid; v_paused boolean := false; v_limited boolean := false; v_hits int; r record;
begin
  begin
    if auth.role() = 'service_role' then return; end if;
    v_uid := auth.uid();
    -- Open during a pause: the page has to be able to ask, the health probe reads the root, and an invited responder has to get in.
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
-- PostgREST calls it as the requesting role.
revoke execute on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

-- An edge function calls this with the user's token before doing something costly. There's nothing inside:
-- check_request() does the work, so a pause or a limit comes back as a 503 or a 429.
create function public.edge_gate() returns void language plpgsql as $$ begin null; end $$;
revoke execute on function public.edge_gate() from public, anon;
grant execute on function public.edge_gate() to authenticated, service_role;

-- ---------- 4. What the page and the policies ask ----------
-- For RLS: true unless the app is paused and the caller isn't staff. Realtime and Storage don't go through
-- check_request(), so this is what stops an open socket or an upload during a pause.
create function public.app_open() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not (select paused from app_status) then return true; end if;
  return public.staff_tier() is not null;
end $$;
revoke execute on function public.app_open() from public, anon;
grant execute on function public.app_open() to authenticated, service_role;

create function public.get_app_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s app_status; v_staff boolean := auth.uid() is not null and public.staff_tier() is not null;
begin
  select * into s from app_status;
  return jsonb_build_object('paused', s.paused, 'message', s.message, 'since', s.paused_at, 'exempt', v_staff)
    -- A switch that only looks like it works is worse than none, so staff get told if the API isn't wired to it.
    || case when v_staff then jsonb_build_object('enforced', exists (
         select 1 from pg_roles, unnest(rolconfig) c where rolname = 'authenticator' and c = 'pgrst.db_pre_request=public.check_request')) else '{}'::jsonb end;
end $$;
revoke execute on function public.get_app_status() from public;
grant execute on function public.get_app_status() to anon, authenticated, service_role;

-- ---------- 5. Pressing it ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch',
  'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed',
  'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override',
  'action_reminder', 'action_overdue', 'action_escalated', 'restriction_applied', 'restriction_lifted', 'appeal_decided',
  'correction_declined', 'correction_superseded', 'bounty_reminder', 'admin_report', 'admin_security', 'admin_appeal', 'admin_site',
  'help_request', 'help_fix', 'help_thanked'));

create function public.admin_set_app_paused(p_paused boolean, p_reason text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_status; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_staff uuid;
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  select * into s from app_status for update;
  if s.paused is distinct from p_paused then
    -- Nobody could answer while it was down, so the time doesn't count against their decision deadlines.
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
revoke execute on function public.admin_set_app_paused(boolean, text, text) from public, anon;
grant execute on function public.admin_set_app_paused(boolean, text, text) to authenticated, service_role;

-- ---------- 6. What keeps running during a pause ----------
-- Nobody can answer a decision, so the clock must not be escalating them or restricting people.
create or replace function public.sweep_if_due() returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select paused from app_status) then return; end if;
  if coalesce((select last_sweep_at from accountability_policy), 'epoch') < now() - interval '10 minutes' then
    perform public.accountability_sweep();
  end if;
end $$;
revoke execute on function public.sweep_if_due() from public, anon;

create function public.accountability_sweep_on_clock() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (select paused from app_status) then perform public.accountability_sweep(); end if;
end $$;
revoke execute on function public.accountability_sweep_on_clock() from public, anon, authenticated;

create function public.rate_limit_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from rate_limit_counters where window_start < now() - interval '2 hours' $$;
revoke execute on function public.rate_limit_cleanup() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-accountability-sweep', '*/15 * * * *', 'select public.accountability_sweep_on_clock()');
  perform cron.schedule('ft-rate-limit-cleanup', '*/10 * * * *', 'select public.rate_limit_cleanup()');
exception when others then
  raise notice 'pg_cron unavailable (%), counters stay until cleaned by hand', sqlerrm;
end $$;

-- No new accounts during a pause, except someone invited to help or the first super admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select paused from app_status)
     and not exists (select 1 from admin_invitations i where lower(i.email) = lower(new.email) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
     and not exists (select 1 from super_admin_bootstrap where open_until > now()) then
    raise exception 'app_paused';
  end if;
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email,'@',1)),
    nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), ''));
  return new;
end $$;

-- Live data stops at the door: an open tab gets nothing new during a pause.
do $$
declare t text;
begin
  foreach t in array array['messages','message_reactions','message_corrections','notifications','conversation_members','post_discussion'] loop
    execute format('create policy "closed during a pause" on public.%I as restrictive for select to authenticated using ((select public.app_open()))', t);
  end loop;
end $$;
