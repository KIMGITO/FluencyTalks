-- Private calls: metadata, invitations and attendance. Media goes through the provider (LiveKit), never Supabase,
-- and nothing is recorded. The first release is one-to-one; the tables are shaped so group calls can be added
-- by raising call_settings.max_participants and adding an invite function, without changing the lifecycle.
-- Clients read through RLS and change state only through the functions below.

create table public.call_settings (
  id boolean default true primary key check (id),
  calls_enabled boolean not null default true,            -- the kill switch: false refuses new calls and joins
  max_participants int not null default 2 check (max_participants between 2 and 50),
  ring_seconds int not null default 45 check (ring_seconds between 10 and 300),
  token_ttl_seconds int not null default 600 check (token_ttl_seconds between 60 and 3600),
  empty_grace_seconds int not null default 60 check (empty_grace_seconds between 10 and 600),
  max_call_minutes int not null default 120 check (max_call_minutes between 5 and 600),
  max_failed_joins int not null default 10 check (max_failed_joins between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.call_settings enable row level security;
insert into public.call_settings default values;

create table public.calls (
  id uuid default gen_random_uuid() primary key,
  initiated_by uuid references public.profiles(id) on delete set null,
  host_id uuid references public.profiles(id) on delete set null,
  status text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'cancelled', 'expired')),
  provider text not null default 'livekit' check (provider in ('livekit')),
  -- Opaque and random, not derived from the call id. Knowing it gets you nothing: joining needs a signed token.
  provider_room text not null unique default ('ftc_' || replace(gen_random_uuid()::text, '-', '')),
  max_participants int not null check (max_participants >= 2),
  created_at timestamptz not null default now(),
  ring_expires_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text check (end_reason in ('hung_up', 'cancelled', 'declined', 'no_answer', 'empty', 'ended_by_host', 'time_limit', 'account_gone')),
  last_empty_at timestamptz,
  constraint calls_end_consistent check ((status in ('ended', 'cancelled', 'expired')) = (ended_at is not null))
);
alter table public.calls enable row level security;
create index calls_initiated_by_created_idx on public.calls (initiated_by, created_at desc);
create index calls_live_idx on public.calls (status) where status in ('ringing', 'active');
-- provider_room stays server-side: the token function reads it, members never need it.
grant select (id, initiated_by, host_id, status, provider, max_participants, created_at, ring_expires_at, started_at, ended_at, end_reason) on public.calls to authenticated;

create table public.call_participants (
  id uuid default gen_random_uuid() primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('host', 'participant')),
  invitation_status text not null check (invitation_status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  presence text not null default 'invited' check (presence in ('invited', 'joining', 'joined', 'left', 'removed')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  presence_at timestamptz not null default now(),
  constraint call_participants_once unique (call_id, user_id)
);
alter table public.call_participants enable row level security;
create index call_participants_user_idx on public.call_participants (user_id, invited_at desc);
create index call_participants_user_status_idx on public.call_participants (user_id, invitation_status);
grant select on public.call_participants to authenticated;

-- Refused joins, counted here because a refusal is returned rather than raised (a raise would roll the count back).
create table public.call_join_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);
alter table public.call_join_failures enable row level security;
create index call_join_failures_user_at_idx on public.call_join_failures (user_id, at);

-- ---------------------------------------------------------------- helpers (internal unless granted below)

create function public.is_call_member(p_call uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from call_participants m where m.call_id = p_call and m.user_id = auth.uid())
     and not exists (select 1 from call_participants o where o.call_id = p_call and o.user_id <> auth.uid() and public.is_blocked_between(auth.uid(), o.user_id)) $$;

-- Who may call whom: an accepted direct chat between two active learners, no block either way, no staff.
create function public.can_call(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and a <> b
    and exists (select 1 from profiles where id = a and status = 'active')
    and exists (select 1 from profiles where id = b and status = 'active')
    and not exists (select 1 from admin_accounts where user_id in (a, b))
    and not public.is_blocked_between(a, b)
    and exists (select 1 from conversation_members x join conversation_members y on y.conversation_id = x.conversation_id
                where x.user_id = a and y.user_id = b and x.status = 'active' and y.status = 'active') $$;

create function public.in_live_call(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from call_participants p join calls c on c.id = p.call_id
                 where p.user_id = p_user and c.status in ('ringing', 'active')
                   and p.invitation_status in ('pending', 'accepted') and p.presence not in ('left', 'removed')) $$;

create function public.finish_call(p_call uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  update calls set status = case p_reason when 'cancelled' then 'cancelled' when 'no_answer' then 'expired' else 'ended' end,
                   ended_at = now(), end_reason = p_reason
  where id = p_call and status in ('ringing', 'active');
  if not found then return; end if;
  update call_participants set invitation_status = case when p_reason = 'no_answer' then 'expired' else 'cancelled' end, responded_at = coalesce(responded_at, now())
  where call_id = p_call and invitation_status = 'pending';
  update call_participants set presence = 'left', left_at = now(), presence_at = now()
  where call_id = p_call and presence in ('joining', 'joined');
end $$;

-- A call ends once fewer than two people are still in it (invited or accepted, and not gone).
create function public.settle_call(p_call uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from call_participants where call_id = p_call and invitation_status in ('pending', 'accepted') and presence not in ('left', 'removed')) < 2 then
    perform public.finish_call(p_call, p_reason);
  end if;
end $$;

-- Lazy sweep, run at the start of every call function and by pg_cron where it exists.
create function public.expire_stale_calls() returns void language plpgsql security definer set search_path = public as $$
declare s call_settings; r record;
begin
  select * into s from call_settings;
  for r in select id from calls where status = 'ringing' and ring_expires_at < now() order by ring_expires_at limit 200 loop
    perform public.finish_call(r.id, 'no_answer');
  end loop;
  -- Opened a join but never connected: they're not in the call.
  update call_participants set presence = 'left', left_at = now(), presence_at = now()
  where presence = 'joining' and presence_at < now() - make_interval(secs => s.token_ttl_seconds);
  for r in select c.id from calls c where c.status = 'active'
             and not exists (select 1 from call_participants p where p.call_id = c.id and p.presence in ('joining', 'joined'))
             and coalesce(c.last_empty_at, c.started_at) < now() - make_interval(secs => s.empty_grace_seconds)
           limit 200 loop
    perform public.finish_call(r.id, 'empty');
  end loop;
  for r in select id from calls where status = 'active' and started_at < now() - make_interval(mins => s.max_call_minutes) limit 200 loop
    perform public.finish_call(r.id, 'time_limit');
  end loop;
  delete from call_join_failures where at < now() - interval '1 hour';
end $$;

-- ---------------------------------------------------------------- what the app calls

create function public.start_call(p_callee uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare s call_settings; v_id uuid; v_me uuid := auth.uid();
begin
  perform assert_active();
  perform public.expire_stale_calls();
  select * into s from call_settings;
  if not s.calls_enabled then raise exception 'calls_disabled'; end if;
  if p_callee = v_me then raise exception 'cannot_call_self'; end if;
  if not public.can_call(v_me, p_callee) then raise exception 'user_unavailable'; end if;
  -- Both people, in a fixed order, so two calls between them (or a crossing call) can't start at once.
  perform pg_advisory_xact_lock(hashtextextended(least(v_me, p_callee)::text, 7));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_me, p_callee)::text, 7));
  if public.in_live_call(v_me) then raise exception 'already_in_call'; end if;
  if public.in_live_call(p_callee) then raise exception 'user_busy'; end if;
  if (select count(*) from calls c join call_participants p on p.call_id = c.id and p.user_id = p_callee
      where c.initiated_by = v_me and c.created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from calls where initiated_by = v_me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into calls (initiated_by, host_id, max_participants, ring_expires_at)
  values (v_me, v_me, s.max_participants, now() + make_interval(secs => s.ring_seconds)) returning id into v_id;
  insert into call_participants (call_id, user_id, role, invitation_status, invited_by, responded_at, expires_at) values
    (v_id, v_me, 'host', 'accepted', v_me, now(), null),
    (v_id, p_callee, 'participant', 'pending', v_me, null, now() + make_interval(secs => s.ring_seconds));
  return v_id;
end $$;

create function public.respond_call_invite(p_call uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare c calls; me call_participants;
begin
  perform assert_active();
  perform public.expire_stale_calls();
  select * into c from calls where id = p_call for update;
  select * into me from call_participants where call_id = p_call and user_id = auth.uid();
  if c.id is null or me.id is null or me.invitation_status <> 'pending' or c.status not in ('ringing', 'active') then raise exception 'call_unavailable'; end if;
  if coalesce(p_accept, false) then
    if exists (select 1 from call_participants o where o.call_id = p_call and o.user_id <> auth.uid()
               and o.invitation_status in ('pending', 'accepted') and o.presence not in ('left', 'removed')
               and (public.is_blocked_between(auth.uid(), o.user_id)
                    or not exists (select 1 from profiles pr where pr.id = o.user_id and pr.status = 'active'))) then
      raise exception 'call_unavailable';
    end if;
    update call_participants set invitation_status = 'accepted', responded_at = now() where id = me.id;
    update calls set status = 'active', started_at = coalesce(started_at, now()) where id = p_call and status = 'ringing';
  else
    update call_participants set invitation_status = 'declined', responded_at = now() where id = me.id;
    perform public.settle_call(p_call, 'declined');
  end if;
end $$;

-- Hanging up. Before anyone answered, the caller hanging up cancels the call.
create function public.leave_call(p_call uuid) returns void language plpgsql security definer set search_path = public as $$
declare c calls; me call_participants;
begin
  perform assert_active();
  select * into c from calls where id = p_call for update;
  select * into me from call_participants where call_id = p_call and user_id = auth.uid();
  if c.id is null or me.id is null then raise exception 'call_unavailable'; end if;
  if c.status not in ('ringing', 'active') then return; end if;   -- already over: leaving twice is harmless
  if me.invitation_status = 'pending' then
    update call_participants set invitation_status = 'declined', responded_at = now() where id = me.id;
    perform public.settle_call(p_call, 'declined');
    return;
  end if;
  update call_participants set presence = 'left', left_at = now(), presence_at = now() where id = me.id and presence <> 'removed';
  perform public.settle_call(p_call, case when c.started_at is null then 'cancelled' else 'hung_up' end);
end $$;

create function public.end_call(p_call uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if not exists (select 1 from calls where id = p_call and host_id = auth.uid() and status in ('ringing', 'active') for update) then raise exception 'call_unavailable'; end if;
  perform public.finish_call(p_call, case when (select started_at from calls where id = p_call) is null then 'cancelled' else 'ended_by_host' end);
end $$;

-- Called by the call-token edge function with the member's own token, just before it signs a media token.
-- Expected refusals are returned, not raised, so they are counted and cannot be retried for free.
create function public.claim_call_join(p_call uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare s call_settings; c calls; me call_participants; v_me uuid := auth.uid();
begin
  perform assert_active();
  perform public.expire_stale_calls();
  select * into s from call_settings;
  if not s.calls_enabled then return jsonb_build_object('ok', false, 'code', 'calls_disabled'); end if;
  if (select count(*) from call_join_failures where user_id = v_me and at > now() - interval '10 minutes') >= s.max_failed_joins then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  select * into c from calls where id = p_call for update;   -- serialises joins, so capacity holds under a race
  select * into me from call_participants where call_id = p_call and user_id = v_me;
  if c.id is null or me.id is null or me.invitation_status <> 'accepted' or me.presence = 'removed'
     or not (c.status = 'active' or (c.status = 'ringing' and me.role = 'host'))
     or exists (select 1 from call_participants o where o.call_id = p_call and o.user_id <> v_me and public.is_blocked_between(v_me, o.user_id))
     or (select count(*) from call_participants o where o.call_id = p_call and o.user_id <> v_me and o.presence in ('joining', 'joined')) >= c.max_participants then
    insert into call_join_failures (user_id) values (v_me);
    return jsonb_build_object('ok', false, 'code', 'call_unavailable');
  end if;
  update call_participants set presence = 'joining', presence_at = now(), left_at = null where id = me.id;
  update calls set last_empty_at = null where id = p_call;
  return jsonb_build_object('ok', true, 'call_id', c.id, 'room', c.provider_room, 'identity', v_me, 'ttl', s.token_ttl_seconds);
end $$;

-- The browser says it connected. It only moves the caller's own row; the provider webhook is the authority.
create function public.report_call_connected(p_call uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update call_participants p set presence = 'joined', joined_at = coalesce(p.joined_at, now()), presence_at = now()
  where p.call_id = p_call and p.user_id = auth.uid() and p.presence in ('joining', 'joined')
    and exists (select 1 from calls c where c.id = p_call and c.status in ('ringing', 'active'));
end $$;

create function public.get_call(p_call uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c calls;
begin
  perform assert_active();
  perform public.expire_stale_calls();
  select * into c from calls where id = p_call;
  if c.id is null or not public.is_call_member(p_call) then raise exception 'call_unavailable'; end if;
  return jsonb_build_object('id', c.id, 'status', c.status, 'host_id', c.host_id, 'initiated_by', c.initiated_by,
    'created_at', c.created_at, 'ring_expires_at', c.ring_expires_at, 'started_at', c.started_at, 'ended_at', c.ended_at, 'end_reason', c.end_reason,
    'max_participants', c.max_participants,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', pr.username, 'display_name', pr.display_name,
        'avatar_url', pr.avatar_url, 'role', p.role, 'invitation_status', p.invitation_status, 'presence', p.presence,
        'joined_at', p.joined_at, 'left_at', p.left_at) order by p.invited_at, p.role), '[]'::jsonb)
      from call_participants p join profiles pr on pr.id = p.user_id where p.call_id = c.id));
end $$;

-- Calls I'm in right now, or being asked to join: drives the incoming-call banner on page load.
create function public.list_live_calls()
returns table (call_id uuid, status text, my_invitation text, my_presence text, ring_expires_at timestamptz, initiated_by uuid, other_id uuid, other_name text, other_username text, other_avatar text)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.expire_stale_calls();
  return query
  select c.id, c.status, me.invitation_status, me.presence, c.ring_expires_at, c.initiated_by, o.id, o.display_name, o.username, o.avatar_url
  from call_participants me
  join calls c on c.id = me.call_id and c.status in ('ringing', 'active')
  left join lateral (select pr.* from call_participants op join profiles pr on pr.id = op.user_id
                     where op.call_id = c.id and op.user_id <> auth.uid() order by op.invited_at limit 1) o on true
  where me.user_id = auth.uid() and me.invitation_status in ('pending', 'accepted') and me.presence not in ('left', 'removed')
    and public.is_call_member(c.id)
  order by c.created_at desc limit 5;
end $$;

create function public.list_call_history(p_limit int default 30, p_before timestamptz default null)
returns table (call_id uuid, status text, end_reason text, created_at timestamptz, started_at timestamptz, ended_at timestamptz, outgoing boolean,
               my_invitation text, attended boolean, participant_count int, other_id uuid, other_name text, other_username text, other_avatar text)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.expire_stale_calls();
  return query
  select c.id, c.status, c.end_reason, c.created_at, c.started_at, c.ended_at, c.initiated_by = auth.uid(),
    me.invitation_status, me.joined_at is not null,
    (select count(*)::int from call_participants x where x.call_id = c.id),
    o.id, o.display_name, o.username, o.avatar_url
  from call_participants me
  join calls c on c.id = me.call_id
  left join lateral (select pr.* from call_participants op join profiles pr on pr.id = op.user_id
                     where op.call_id = c.id and op.user_id <> auth.uid() order by op.invited_at limit 1) o on true
  where me.user_id = auth.uid() and public.is_call_member(c.id) and (p_before is null or c.created_at < p_before)
  order by c.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;

-- ---------------------------------------------------------------- triggers, policies, realtime

-- Account deletion cascades participant rows. A live call left with one person ends; an emptied call goes.
create function public.trg_call_participant_gone() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from calls where id = old.call_id) then return null; end if;
  if not exists (select 1 from call_participants where call_id = old.call_id) then
    delete from calls where id = old.call_id;
  else
    perform public.settle_call(old.call_id, 'account_gone');
  end if;
  return null;
end $$;

-- A block ends any live call the two people share, straight away.
create function public.trg_block_ends_calls() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select c.id from calls c
           where c.status in ('ringing', 'active')
             and exists (select 1 from call_participants a where a.call_id = c.id and a.user_id = new.blocker_id)
             and exists (select 1 from call_participants b where b.call_id = c.id and b.user_id = new.blocked_id) loop
    perform public.finish_call(r.id, case when (select started_at from calls where id = r.id) is null then 'cancelled' else 'hung_up' end);
  end loop;
  return null;
end $$;
create trigger block_ends_calls after insert on public.blocks for each row execute function public.trg_block_ends_calls();

create trigger call_participant_gone after delete on public.call_participants for each row execute function public.trg_call_participant_gone();
create trigger staff_refused before insert on public.calls for each row execute function public.refuse_staff_learner_action();

create policy "closed during a pause" on public.calls as restrictive for select to authenticated using ((select public.app_open()));
create policy "read my calls" on public.calls for select to authenticated using (public.is_call_member(id));
create policy "closed during a pause" on public.call_participants as restrictive for select to authenticated using ((select public.app_open()));
create policy "read my call members" on public.call_participants for select to authenticated using (public.is_call_member(call_id));

-- Only participant rows are published: they hold no provider identifiers. The app refetches get_call on a change.
alter publication supabase_realtime add table public.call_participants;

insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('/rpc/start_call', 20, 3600),
  ('/rpc/respond_call_invite', 60, 3600),
  ('/rpc/claim_call_join', 30, 60),
  ('/rpc/get_call', 120, 60),
  ('/rpc/list_call_history', 60, 60)
on conflict (path) do nothing;

revoke all on function
  public.is_call_member(uuid),
  public.can_call(uuid, uuid),
  public.in_live_call(uuid),
  public.finish_call(uuid, text),
  public.settle_call(uuid, text),
  public.expire_stale_calls(),
  public.start_call(uuid),
  public.respond_call_invite(uuid, boolean),
  public.leave_call(uuid),
  public.end_call(uuid),
  public.claim_call_join(uuid),
  public.report_call_connected(uuid),
  public.get_call(uuid),
  public.list_live_calls(),
  public.list_call_history(integer, timestamp with time zone),
  public.trg_call_participant_gone(),
  public.trg_block_ends_calls()
from public, anon, authenticated, service_role;

grant execute on function
  public.is_call_member(uuid),
  public.start_call(uuid),
  public.respond_call_invite(uuid, boolean),
  public.leave_call(uuid),
  public.end_call(uuid),
  public.claim_call_join(uuid),
  public.report_call_connected(uuid),
  public.get_call(uuid),
  public.list_live_calls(),
  public.list_call_history(integer, timestamp with time zone)
to authenticated, service_role;

grant execute on function public.expire_stale_calls() to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-call-sweep', '* * * * *', 'select public.expire_stale_calls()');
exception when others then
  raise notice 'pg_cron unavailable (%), calls expire lazily on the next call request', sqlerrm;
end $$;
