-- Presence, verified levels for everyone to see, and vouching. NEW migration. Never edit past migrations.
--
-- 1. Presence moves to the server. It used to be one realtime channel that everyone joined, and only
--    from the chat screens: anyone could list who was online, blocks did not apply, and someone
--    browsing Home looked offline. Now the app sends a heartbeat (touch_presence) and asks about
--    specific people (presence_of), which is where blocks and privacy can be enforced.
--    Who sees what: "online" is visible to signed-in people who are not blocked; "last seen" only to
--    someone you share an accepted chat with. Turn it off (show_activity) and you are shown to nobody
--    and see nobody else, the same both ways.
-- 2. user_languages_json carries verified_level, so cards can tell earned from self-assessed.
-- 3. Vouching: native speakers who have really chatted with a learner can vouch. Two valid vouches
--    are a faster route to verified B1, and only B1. A voucher who stops qualifying stops counting
--    for future checks. Limited to 3 a month so vouches are not worth trading.

-- ---------- 1. Presence ----------
alter table public.profiles add column if not exists show_activity boolean not null default true;

-- Its own table: a write every 30 seconds per person does not belong on the profiles row.
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now());
alter table public.user_presence enable row level security;   -- no policies: only the functions below

create or replace function public.touch_presence() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if (select show_activity from profiles where id = auth.uid()) then
    insert into user_presence (user_id, last_seen_at) values (auth.uid(), now())
    on conflict (user_id) do update set last_seen_at = now();
  end if;
end $$;

create or replace function public.set_show_activity(p_show boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update profiles set show_activity = coalesce(p_show, true) where id = auth.uid();
  if not coalesce(p_show, true) then delete from user_presence where user_id = auth.uid(); end if;
end $$;

-- Online means a heartbeat within 70 seconds (the app beats every 30).
create or replace function public.presence_of(p_users uuid[])
returns table (user_id uuid, online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pr.user_id,
    pr.last_seen_at > now() - interval '70 seconds',
    case when exists (
      select 1 from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
      where a.user_id = auth.uid() and b.user_id = pr.user_id and a.status = 'active' and b.status = 'active'
    ) then pr.last_seen_at end
  from user_presence pr
  join profiles p on p.id = pr.user_id and p.status = 'active' and p.show_activity
  where pr.user_id = any((p_users)[1:100]) and pr.user_id <> auth.uid()
    and (select show_activity from profiles where id = auth.uid())
    and not public.is_blocked_between(auth.uid(), pr.user_id);
$$;

-- ---------- 2. Verified levels on every card ----------
create or replace function public.user_languages_json(p_user uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'language_id', ul.language_id, 'role', ul.role, 'level', ul.level,
      'verified_level', case when ul.role = 'learning' then p.verified_level end,
      'native_name', l.native_name, 'english_name', l.english_name)
      order by l.english_name)
    from public.user_languages ul
    join public.languages l on l.id = ul.language_id
    join public.profiles p on p.id = ul.user_id
    where ul.user_id = p_user), '[]'::jsonb) $$;

-- ---------- 3. Vouching ----------
alter table public.level_rules add column if not exists vouches_needed int not null default 0;
update public.level_rules set vouches_needed = 2 where level = 'B1';

create table if not exists public.level_vouches (
  voucher_id uuid not null references public.profiles(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  language_id text not null references public.languages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voucher_id, learner_id, language_id));
create index if not exists level_vouches_learner_idx on public.level_vouches (learner_id, language_id);
alter table public.level_vouches enable row level security;   -- no policies: only the functions below

-- Why this person cannot vouch for that learner right now; NULL means they can.
create or replace function public.vouch_blocker(p_voucher uuid, p_learner uuid, p_lang text) returns text
language sql stable security definer set search_path = public as $$
  with v as (select * from profiles where id = p_voucher),
  chats as (
    select a.conversation_id from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
    where a.user_id = p_voucher and b.user_id = p_learner and a.status = 'active' and b.status = 'active'
  ), theirs as (
    select distinct lower(btrim(m.body)) as body, m.created_at::date as day from messages m
    where m.conversation_id in (select conversation_id from chats) and m.sender_id = p_learner and m.language_id = p_lang
      and m.deleted_at is null and char_length(btrim(m.body)) >= 8
  )
  select case
    when p_voucher = p_learner then 'self'
    when (select native_language_id from v) is distinct from p_lang or (select status from v) <> 'active' then 'not_native'
    when public.is_blocked_between(p_voucher, p_learner) then 'not_native'
    when (select created_at from v) > now() - interval '7 days' then 'too_new'
    when not public.corrector_in_good_standing(p_voucher) then 'low_ratings'
    when (select count(distinct body) from theirs) < 15 or (select count(distinct day) from theirs) < 2
      or (select count(*) from messages m where m.conversation_id in (select conversation_id from chats) and m.sender_id = p_voucher and m.deleted_at is null) < 5 then 'not_enough_chat'
    when (select count(*) from level_vouches lv where lv.voucher_id = p_voucher and lv.created_at > now() - interval '30 days') >= 3 then 'limit'
  end;
$$;

-- Counted at every check, so a voucher who has since lost standing does not count towards a future promotion.
create or replace function public.valid_vouches(p_learner uuid, p_lang text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from level_vouches lv join profiles v on v.id = lv.voucher_id
  where lv.learner_id = p_learner and lv.language_id = p_lang and v.status = 'active' and v.native_language_id = p_lang
    and public.corrector_in_good_standing(v.id) and not public.is_blocked_between(v.id, p_learner);
$$;

create or replace function public.evaluate_level(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles; e jsonb; r public.level_rules; v_new text; b1 public.level_rules;
begin
  select * into me from profiles where id = p_user;
  if not found or me.learning_language_id is null then return null; end if;
  e := public.level_evidence(p_user, me.learning_language_id);
  v_new := me.verified_level;
  for r in select * from level_rules where public.level_rank(level) > public.level_rank(me.verified_level) order by public.level_rank(level) loop
    exit when not public.level_rule_met(e, r);
    v_new := r.level;
  end loop;

  -- The vouch route reaches B1 and no further, and the learner's own error rate still has to hold.
  select * into b1 from level_rules where level = 'B1';
  if public.level_rank(v_new) < public.level_rank('B1') and b1.vouches_needed > 0
     and public.valid_vouches(p_user, me.learning_language_id) >= b1.vouches_needed
     and coalesce((e->>'error_pct')::int, 100) <= b1.max_error_pct then
    v_new := 'B1';
  end if;

  perform set_config('app.bypass_protect', 'on', true);
  update profiles set level_checked_at = now() where id = p_user;
  if v_new is distinct from me.verified_level then
    update profiles set verified_level = v_new,
      learning_level = case when public.level_rank(v_new) > public.level_rank(learning_level) then v_new else learning_level end
    where id = p_user;
    update user_languages ul set level = p.learning_level from profiles p
    where p.id = p_user and ul.user_id = p_user and ul.role = 'learning';
    perform public.notify(p_user, null, 'level_up', jsonb_build_object('level', v_new, 'language', me.learning_language_id));
  end if;
  return v_new;
end $$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch'));

create or replace function public.vouch_for(p_learner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_lang text; v_block text;
begin
  perform assert_active();
  select learning_language_id into v_lang from profiles where id = p_learner and status = 'active';
  if v_lang is null then raise exception 'user_unavailable'; end if;
  if exists (select 1 from level_vouches where voucher_id = auth.uid() and learner_id = p_learner and language_id = v_lang) then return; end if;
  v_block := public.vouch_blocker(auth.uid(), p_learner, v_lang);
  if v_block is not null then raise exception 'vouch_%', v_block; end if;
  insert into level_vouches (voucher_id, learner_id, language_id) values (auth.uid(), p_learner, v_lang);
  perform public.notify(p_learner, auth.uid(), 'level_vouch', jsonb_build_object('language', v_lang));
  perform public.evaluate_level(p_learner);
end $$;

-- Takes the vouch back. A level already earned stays: verified levels never fall.
create or replace function public.withdraw_vouch(p_learner uuid) returns void
language sql security definer set search_path = public as $$
  delete from level_vouches where voucher_id = auth.uid() and learner_id = p_learner;
$$;

-- What the learner's profile page offers me. NULL: nothing to show (not my language, or already past B1).
create or replace function public.vouch_status(p_learner uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.profiles; v_vouched boolean;
begin
  select * into l from profiles where id = p_learner and status = 'active';
  if l.learning_language_id is null or l.learning_language_id is distinct from (select native_language_id from profiles where id = auth.uid()) then return null; end if;
  v_vouched := exists (select 1 from level_vouches where voucher_id = auth.uid() and learner_id = p_learner and language_id = l.learning_language_id);
  if not v_vouched and public.level_rank(l.verified_level) >= public.level_rank('B1') then return null; end if;
  return jsonb_build_object('language', l.learning_language_id, 'vouched', v_vouched,
    'blocker', case when v_vouched then null else public.vouch_blocker(auth.uid(), p_learner, l.learning_language_id) end);
end $$;

create or replace function public.my_level_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles; e jsonb; r public.level_rules; v_rated int; v_bad int;
begin
  perform assert_active();
  perform public.evaluate_level(auth.uid());
  select * into me from profiles where id = auth.uid();
  select count(*), count(*) filter (where feedback = 'not_helpful') into v_rated, v_bad
  from message_corrections where corrector_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days';
  if me.learning_language_id is not null then
    e := public.level_evidence(auth.uid(), me.learning_language_id);
    select * into r from level_rules where public.level_rank(level) > public.level_rank(me.verified_level) order by public.level_rank(level) limit 1;
  end if;
  return jsonb_build_object(
    'verified_level', me.verified_level,
    'next_level', r.level,
    'evidence', e,
    'needs', case when r.level is null then null else to_jsonb(r) - 'level' end,
    'vouches', case when me.learning_language_id is not null then public.valid_vouches(auth.uid(), me.learning_language_id) else 0 end,
    'vouches_needed', (select vouches_needed from level_rules where level = 'B1'),
    'rated', v_rated,
    'not_helpful', v_bad,
    'rewards_paused', not public.corrector_in_good_standing(auth.uid()));
end $$;

-- ---------- Grants ----------
revoke execute on function public.touch_presence() from public, anon;
grant  execute on function public.touch_presence() to authenticated, service_role;
revoke execute on function public.set_show_activity(boolean) from public, anon;
grant  execute on function public.set_show_activity(boolean) to authenticated, service_role;
revoke execute on function public.presence_of(uuid[]) from public, anon;
grant  execute on function public.presence_of(uuid[]) to authenticated, service_role;
revoke execute on function public.vouch_for(uuid) from public, anon;
grant  execute on function public.vouch_for(uuid) to authenticated, service_role;
revoke execute on function public.withdraw_vouch(uuid) from public, anon;
grant  execute on function public.withdraw_vouch(uuid) to authenticated, service_role;
revoke execute on function public.vouch_status(uuid) from public, anon;
grant  execute on function public.vouch_status(uuid) to authenticated, service_role;
-- Internal.
revoke execute on function public.vouch_blocker(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.valid_vouches(uuid, text) from public, anon, authenticated;
revoke execute on function public.evaluate_level(uuid) from public, anon, authenticated;
