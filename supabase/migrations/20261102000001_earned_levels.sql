-- Levels are earned, not claimed. NEW migration. Never edit past migrations.
--
-- 1. profiles.learning_level stays what you say about yourself. Nothing unlocks from it, and once
--    set it can only go down. profiles.verified_level is what your activity has shown, and it alone
--    gives a learner the right to correct, answer bounties, post and earn (from B1).
-- 2. level_rules holds the thresholds: tune them there. Evidence per language (level_evidence):
--    distinct real messages, active days (the app does not track time, so days stand in for
--    chatting time), native partners who replied, and the error rate over your latest 50 reviewed
--    messages, so that making fewer errors counts. From B2: corrections of yours that were accepted,
--    how helpful they were rated, and saves of your posts by others.
-- 3. Learners rate a correction helpful or not. A corrector whose recent ratings are mostly negative,
--    from at least 3 different people, stops earning the +5 until that recovers. This also covers
--    native speakers, whose claim is not checked anywhere else.
-- 4. Everyone starts unverified. Anyone whose existing history already meets the rules is promoted
--    at the end of this file.

-- ---------- Columns ----------
alter table public.profiles
  add column if not exists verified_level text check (verified_level is null or verified_level in ('A1','A2','B1','B2','C1','C2')),
  add column if not exists level_checked_at timestamptz;
alter table public.message_corrections
  add column if not exists feedback text check (feedback is null or feedback in ('helpful','not_helpful')),
  add column if not exists feedback_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up'));

create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' and not public.is_admin() then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done
       or new.points_balance <> old.points_balance
       or new.native_language_id      is distinct from old.native_language_id
       or new.learning_language_id    is distinct from old.learning_language_id
       or new.learning_level          is distinct from old.learning_level
       or new.verified_level          is distinct from old.verified_level
       or new.level_checked_at        is distinct from old.level_checked_at
       or new.last_language_change_at is distinct from old.last_language_change_at then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;

-- ---------- The thresholds ----------
create table if not exists public.level_rules (
  level text primary key check (level in ('A1','A2','B1','B2','C1','C2')),
  min_messages int not null,        -- distinct messages of 8+ characters in the language
  min_active_days int not null,     -- days with at least one of those messages
  min_partners int not null,        -- native speakers, on the app for 7+ days, who replied
  min_reviewed int not null,        -- messages such a partner replied to or corrected
  max_error_pct int not null,       -- share of the latest 50 reviewed messages that got a correction
  min_accepted_given int not null,  -- your corrections in the language that were accepted
  min_helpful_pct int not null,     -- of the ones rated; only applies from 3 ratings
  min_post_saves int not null);     -- other people saving your posts in the language
alter table public.level_rules enable row level security;
drop policy if exists "level rules readable" on public.level_rules;
create policy "level rules readable" on public.level_rules for select to authenticated using (true);
insert into public.level_rules values
  ('A1',   5,  1, 0,   0, 100,  0,  0,  0),
  ('A2',  20,  3, 1,  10,  80,  0,  0,  0),
  ('B1',  80,  7, 2,  40,  50,  0,  0,  0),
  ('B2', 200, 14, 2, 100,  35,  5, 60,  0),
  ('C1', 400, 30, 3, 200,  20, 20, 70,  3),
  ('C2', 800, 60, 3, 400,  10, 50, 80, 10)
on conflict (level) do nothing;

create or replace function public.level_rank(p_level text) returns int language sql immutable as $$
  select coalesce(array_position(array['A1','A2','B1','B2','C1','C2'], p_level), 0);
$$;

-- ---------- Who may correct: native, or a VERIFIED B1+ learner ----------
create or replace function public.can_correct_language(p_user uuid, p_language text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_language is null or exists (
    select 1 from public.profiles p
    where p.id = p_user and (
      p.native_language_id = p_language
      or (p.learning_language_id = p_language and p.verified_level in ('B1', 'B2', 'C1', 'C2'))));
$$;

create or replace function public.is_contribution_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.native_language_id is not null or p.verified_level in ('B1', 'B2', 'C1', 'C2')
                   from public.profiles p where p.id = p_user), false);
$$;

-- ---------- The evidence ----------
create or replace function public.level_evidence(p_user uuid, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    -- The same text twice counts once; very short messages do not count. Characters, not words,
    -- because Chinese, Japanese and Thai do not put spaces between words.
    select distinct on (lower(btrim(m.body))) m.id, m.conversation_id, m.created_at
    from messages m
    where m.sender_id = p_user and m.language_id = p_lang and m.deleted_at is null and char_length(btrim(m.body)) >= 8
    order by lower(btrim(m.body)), m.created_at
  ), natives as (
    select distinct cm.conversation_id, p.id as partner
    from conversation_members cm join profiles p on p.id = cm.user_id
    where cm.conversation_id in (select conversation_id from mine) and cm.user_id <> p_user
      and p.native_language_id = p_lang and p.status = 'active' and p.created_at < now() - interval '7 days'
      and not public.is_blocked_between(p_user, p.id)
  ), review as (
    select m.id, m.created_at, n.partner
    from mine m join natives n on n.conversation_id = m.conversation_id
    where exists (select 1 from messages r where r.conversation_id = m.conversation_id and r.sender_id = n.partner and r.created_at > m.created_at)
       or exists (select 1 from message_corrections c where c.message_id = m.id and c.corrector_id = n.partner)
  ), latest as (
    select distinct id, created_at from review order by created_at desc limit 50
  ), given as (
    select c.feedback from message_corrections c join messages m on m.id = c.message_id
    where c.corrector_id = p_user and c.status = 'accepted' and m.language_id = p_lang
  ), rated as (
    select feedback from given where feedback is not null
  )
  select jsonb_build_object(
    'messages',    (select count(*) from mine),
    'active_days', (select count(distinct created_at::date) from mine),
    'partners',    (select count(distinct partner) from review),
    'reviewed',    (select count(distinct id) from review),
    -- Every correction counts, accepted or not: dismissing them must not clean the record.
    'error_pct',   (select round(100.0 * count(*) filter (where exists (select 1 from message_corrections c where c.message_id = l.id)) / nullif(count(*), 0)) from latest l),
    'accepted_given', (select count(*) from given),
    'rated',       (select count(*) from rated),
    'helpful_pct', (select round(100.0 * count(*) filter (where feedback = 'helpful') / nullif(count(*), 0)) from rated),
    'post_saves',  (select count(*) from saved_posts s join contribution_posts c on c.id = s.post_id
                    where c.user_id = p_user and c.language_id = p_lang and s.user_id <> p_user));
$$;

create or replace function public.level_rule_met(e jsonb, r public.level_rules) returns boolean language sql immutable as $$
  select (e->>'messages')::int >= r.min_messages
     and (e->>'active_days')::int >= r.min_active_days
     and (e->>'partners')::int >= r.min_partners
     and (e->>'reviewed')::int >= r.min_reviewed
     and (r.min_reviewed = 0 or coalesce((e->>'error_pct')::int, 100) <= r.max_error_pct)
     and (e->>'accepted_given')::int >= r.min_accepted_given
     and ((e->>'rated')::int < 3 or coalesce((e->>'helpful_pct')::int, 0) >= r.min_helpful_pct)
     and (e->>'post_saves')::int >= r.min_post_saves;
$$;

-- Promote as far as the evidence reaches. Never demotes: a verified level stays until the learning
-- language changes.
create or replace function public.evaluate_level(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles; e jsonb; r public.level_rules; v_new text;
begin
  select * into me from profiles where id = p_user;
  if not found or me.learning_language_id is null then return null; end if;
  e := public.level_evidence(p_user, me.learning_language_id);
  v_new := me.verified_level;
  for r in select * from level_rules where public.level_rank(level) > public.level_rank(me.verified_level) order by public.level_rank(level) loop
    exit when not public.level_rule_met(e, r);
    v_new := r.level;
  end loop;

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

-- Checked as people chat, at most once an hour each. A problem here must never stop a message.
create or replace function public.trg_check_level() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles p where p.id = new.sender_id and p.learning_language_id = new.language_id
             and (p.level_checked_at is null or p.level_checked_at < now() - interval '1 hour')) then
    perform public.evaluate_level(new.sender_id);
  end if;
  return new;
exception when others then
  raise warning 'evaluate_level failed: %', sqlerrm;
  return new;
end $$;
drop trigger if exists messages_check_level on public.messages;
create trigger messages_check_level after insert on public.messages for each row execute function public.trg_check_level();

-- ---------- Helpfulness ----------
create or replace function public.rate_correction(p_id uuid, p_helpful boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update message_corrections c set feedback = case when p_helpful then 'helpful' else 'not_helpful' end, feedback_at = now()
  from messages m where c.id = p_id and m.id = c.message_id and m.sender_id = auth.uid() and c.status <> 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
end $$;

-- 3 different people is what stops one annoyed learner from cutting someone's rewards.
create or replace function public.corrector_in_good_standing(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not (count(*) >= 5
              and 2 * count(*) filter (where c.feedback = 'not_helpful') > count(*)
              and count(distinct m.sender_id) filter (where c.feedback = 'not_helpful') >= 3)
  from message_corrections c join messages m on m.id = c.message_id
  where c.corrector_id = p_user and c.feedback is not null and c.feedback_at > now() - interval '60 days';
$$;

create or replace function public.accept_correction(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.message_corrections; v_msg public.messages; v_reward boolean := true; v_count int;
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  select mc.* into c from public.message_corrections mc join public.messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  select * into v_msg from public.messages where id = c.message_id;

  update public.message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, v_msg.language_id, c.message_id);

  if v_msg.bounty_status = 'open' then
    update public.messages set bounty_status = 'paid', bounty_paid_to = c.corrector_id where id = v_msg.id;
    perform public.award_points(c.corrector_id, v_msg.bounty_cost, 'bounty_answered_accepted', 'message', v_msg.id);
    -- The helper may not be in this chat, so the notification carries the points but no conversation id.
    perform public.notify(c.corrector_id, auth.uid(), 'bounty_paid', jsonb_build_object('points', v_msg.bounty_cost, 'message_id', v_msg.id));
    return;
  end if;

  -- Ordinary +5, with limits so two accounts cannot farm each other.
  -- An untagged message has no language to check the corrector against, so it earns nothing.
  if v_msg.language_id is null then v_reward := false; end if;
  if not public.corrector_in_good_standing(c.corrector_id) then v_reward := false; end if;
  if lower(btrim(c.suggested_text)) = lower(btrim(v_msg.body)) then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger
   where user_id = c.corrector_id and reason = 'correction_accepted' and created_at > now() - interval '24 hours';
  if v_count >= 10 then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger l
   join public.message_corrections mc2 on mc2.id = l.ref_id
   join public.messages m2 on m2.id = mc2.message_id
   where l.user_id = c.corrector_id and l.reason = 'correction_accepted'
     and l.created_at > now() - interval '24 hours' and m2.sender_id = v_msg.sender_id;
  if v_count >= 3 then v_reward := false; end if;
  if v_reward then perform public.award_points(c.corrector_id, 5, 'correction_accepted', 'correction', c.id); end if;
  perform public.notify(c.corrector_id, auth.uid(), 'correction_accepted',
    jsonb_build_object('conversation_id', v_msg.conversation_id, 'message_id', v_msg.id, 'points', case when v_reward then 5 else 0 end));
end $$;

-- ---------- What the profile page shows; also the moment a promotion lands ----------
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
    'rated', v_rated,
    'not_helpful', v_bad,
    'rewards_paused', not public.corrector_in_good_standing(auth.uid()));
end $$;

-- ---------- set_language_profile: a level can be lowered, never raised by hand ----------
create or replace function public.set_language_profile(p_native text, p_learning text default null, p_level text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_native text := public.normalize_language_code(p_native);
  v_learning text := public.normalize_language_code(nullif(btrim(coalesce(p_learning, '')), ''));
  v_level text := nullif(upper(btrim(coalesce(p_level, ''))), '');
  me public.profiles;
  v_changed boolean;
  v_same boolean;
begin
  perform assert_active();
  select * into me from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'user_unavailable'; end if;

  if v_native is null then raise exception 'language_required'; end if;
  -- Must exist and be on the launch list (an already-saved value is always allowed to stay).
  if not exists (select 1 from public.languages l where l.id = v_native
                 and (l.is_supported_learning or v_native = me.native_language_id)) then
    raise exception 'language_unsupported';
  end if;

  v_same := v_learning is not null and v_learning is not distinct from me.learning_language_id;
  if v_learning is not null then
    if v_learning = v_native then raise exception 'language_same'; end if;
    if not exists (select 1 from public.languages l where l.id = v_learning
                   and (l.is_supported_learning or v_learning = me.learning_language_id)) then
      raise exception 'language_unsupported';
    end if;
    v_level := coalesce(v_level, case when v_same then me.learning_level else 'A1' end);
    if v_level not in ('A1','A2','B1','B2','C1','C2') then raise exception 'invalid_level'; end if;
    -- A new learning language takes any starting level: it unlocks nothing by itself.
    if v_same and public.level_rank(v_level) > public.level_rank(me.learning_level) then raise exception 'level_must_be_earned'; end if;
    if v_same and public.level_rank(v_level) < public.level_rank(me.verified_level) then v_level := me.verified_level; end if;
  else
    v_level := null;
  end if;

  -- Replacing or removing an existing language is a "change". Adding one for the first time, or
  -- lowering the level, is free. A change is free once, then allowed every 30 days.
  v_changed := (me.native_language_id is not null and me.native_language_id <> v_native)
            or (me.learning_language_id is not null and me.learning_language_id is distinct from v_learning);
  if v_changed and me.last_language_change_at is not null
     and me.last_language_change_at > now() - interval '30 days' then
    raise exception 'language_change_cooldown';
  end if;

  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles
  set native_language_id = v_native,
      learning_language_id = v_learning,
      learning_level = v_level,
      -- Evidence belongs to one language. Going back to an old one finds its messages again below.
      verified_level = case when v_same then me.verified_level end,
      last_language_change_at = case when v_changed then now() else last_language_change_at end
  where id = auth.uid();

  -- Derived copy, so existing reads keep working.
  delete from public.user_languages where user_id = auth.uid();
  insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_native, 'native', 'Native');
  if v_learning is not null then
    insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_learning, 'learning', v_level);
    if not v_same then perform public.evaluate_level(auth.uid()); end if;
  end if;
end $$;

-- ---------- Existing people: promote whoever's history already qualifies ----------
do $$ declare u uuid; begin
  for u in select id from public.profiles where learning_language_id is not null loop
    perform public.evaluate_level(u);
  end loop;
end $$;

-- ---------- Grants ----------
revoke execute on function public.rate_correction(uuid, boolean) from public, anon;
grant  execute on function public.rate_correction(uuid, boolean) to authenticated, service_role;
revoke execute on function public.my_level_progress() from public, anon;
grant  execute on function public.my_level_progress() to authenticated, service_role;
revoke execute on function public.level_rank(text) from public, anon;
grant  execute on function public.level_rank(text) to authenticated, service_role;
-- Internal: other people's evidence stays private, and promotion only happens through the rules.
revoke execute on function public.level_evidence(uuid, text) from public, anon, authenticated;
revoke execute on function public.level_rule_met(jsonb, public.level_rules) from public, anon, authenticated;
revoke execute on function public.evaluate_level(uuid) from public, anon, authenticated;
revoke execute on function public.corrector_in_good_standing(uuid) from public, anon, authenticated;
revoke execute on function public.trg_check_level() from public, anon, authenticated;
