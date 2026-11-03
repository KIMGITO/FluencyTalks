-- The points ledger, earned levels and vouches.

create table public.points_ledger (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('correction_accepted', 'bounty_posted', 'bounty_answered_accepted', 'bounty_expired_refund', 'post_correction_accepted')),
  ref_type text not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_type, ref_id)
);
alter table public.points_ledger enable row level security;
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
grant select on public.points_ledger to authenticated;

create table public.level_rules (
  level text primary key check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  min_messages int not null,
  min_active_days int not null,
  min_partners int not null,
  min_reviewed int not null,
  max_error_pct int not null,
  min_accepted_given int not null,
  min_helpful_pct int not null,
  min_post_saves int not null,
  vouches_needed int not null default 0
);
alter table public.level_rules enable row level security;
grant select on public.level_rules to authenticated;

create table public.level_vouches (
  voucher_id uuid not null references public.profiles(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  language_id text not null references public.languages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voucher_id, learner_id, language_id)
);
alter table public.level_vouches enable row level security;
create index level_vouches_learner_idx on public.level_vouches (learner_id, language_id);

create function public.award_points(p_user uuid, p_delta int, p_reason text, p_ref_type text, p_ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  insert into public.points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref)
  on conflict (user_id, reason, ref_type, ref_id) do nothing;
  if not found then return false; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set points_balance = points_balance + p_delta where id = p_user returning points_balance into v_balance;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;
  return true;
end $$;

create function public.trg_check_level() returns trigger
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

create function public.set_language_profile(p_native text, p_learning text default null, p_level text default null)
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
    if v_same and public.level_rank(v_level) > public.level_rank(me.learning_level) then raise exception 'level_must_be_earned'; end if;
    if v_same and public.level_rank(v_level) < public.level_rank(me.verified_level) then v_level := me.verified_level; end if;
  else
    v_level := null;
  end if;

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
      verified_level = case when v_same then me.verified_level end,
      last_language_change_at = case when v_changed then now() else last_language_change_at end
  where id = auth.uid();

  delete from public.user_languages where user_id = auth.uid();
  insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_native, 'native', 'Native');
  if v_learning is not null then
    insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_learning, 'learning', v_level);
    if not v_same then perform public.evaluate_level(auth.uid()); end if;
  end if;
end $$;

create function public.corrector_in_good_standing(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with rated as (
    select c.feedback, m.sender_id as rater from message_corrections c join messages m on m.id = c.message_id
    where c.corrector_id = p_user and c.feedback is not null and c.feedback_at > now() - interval '60 days'
    union all
    select d.feedback, p.user_id from post_discussion d join contribution_posts p on p.id = d.post_id
    where d.author_id = p_user and d.feedback is not null and d.feedback_at > now() - interval '60 days')
  select not (count(*) >= 5
              and 2 * count(*) filter (where feedback = 'not_helpful') > count(*)
              and count(distinct rater) filter (where feedback = 'not_helpful') >= 3)
  from rated;
$$;

create function public.vouch_blocker(p_voucher uuid, p_learner uuid, p_lang text) returns text
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

create function public.valid_vouches(p_learner uuid, p_lang text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from level_vouches lv join profiles v on v.id = lv.voucher_id
  where lv.learner_id = p_learner and lv.language_id = p_lang and v.status = 'active' and v.native_language_id = p_lang
    and public.corrector_in_good_standing(v.id) and not public.is_blocked_between(v.id, p_learner);
$$;

create function public.evaluate_level(p_user uuid) returns text
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

create function public.vouch_for(p_learner uuid) returns void
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

create function public.withdraw_vouch(p_learner uuid) returns void
language sql security definer set search_path = public as $$
  delete from level_vouches where voucher_id = auth.uid() and learner_id = p_learner;
$$;

create function public.vouch_status(p_learner uuid) returns jsonb
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

create function public.check_level_safely(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.evaluate_level(p_user);
exception when others then
  raise warning 'evaluate_level failed: %', sqlerrm;
end $$;

create function public.level_evidence(p_user uuid, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct on (lower(btrim(m.body))) m.id, m.conversation_id, m.created_at, lower(btrim(m.body)) as txt
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
  ), my_posts as (
    select distinct on (lower(btrim(c.phrase))) c.id, c.created_at
    from contribution_posts c
    where c.user_id = p_user and c.language_id = p_lang and c.post_type = 'correct_me' and char_length(btrim(c.phrase)) >= 8
      and lower(btrim(c.phrase)) not in (select txt from mine)
    order by lower(btrim(c.phrase)), c.created_at
  ), post_review as (
    select x.post_id, p.id as partner
    from (select d.post_id, d.author_id as person from post_discussion d where d.post_id in (select id from my_posts) and d.kind = 'correction' and d.status in ('pending','accepted')
          union select e.post_id, e.user_id from post_endorsements e where e.post_id in (select id from my_posts)) x
    join profiles p on p.id = x.person
    where p.id <> p_user and p.native_language_id = p_lang and p.status = 'active' and p.created_at < now() - interval '7 days'
      and not public.is_blocked_between(p_user, p.id)
  ), given as (
    select c.feedback from message_corrections c join messages m on m.id = c.message_id
    where c.corrector_id = p_user and c.status = 'accepted' and m.language_id = p_lang
    union all
    select feedback from (
      select d.feedback, row_number() over (partition by p.user_id, d.decided_at::date order by d.decided_at) as n
      from post_discussion d join contribution_posts p on p.id = d.post_id
      where d.author_id = p_user and d.kind = 'correction' and d.status = 'accepted' and p.language_id = p_lang) capped
    where n <= 3
  ), rated as (
    select feedback from given where feedback is not null
  )
  select jsonb_build_object(
    'messages',    (select count(*) from mine) + (select count(*) from my_posts),
    'active_days', (select count(distinct d) from (select created_at::date as d from mine union select created_at::date from my_posts) days),
    'partners',    (select count(distinct partner) from review),
    'reviewed',    (select count(distinct id) from review),
    'partners_any', (select count(distinct partner) from (select partner from review union select partner from post_review) a),
    'reviewed_any', (select count(distinct id) from review) + (select count(distinct post_id) from post_review),
    -- Every correction counts, accepted or not: dismissing them must not clean the record. Chat only: asking for a fix never counts against you.
    'error_pct',   (select round(100.0 * count(*) filter (where exists (select 1 from message_corrections c where c.message_id = l.id)) / nullif(count(*), 0)) from latest l),
    'accepted_given', (select count(*) from given),
    'rated',       (select count(*) from rated),
    'helpful_pct', (select round(100.0 * count(*) filter (where feedback = 'helpful') / nullif(count(*), 0)) from rated),
    'post_saves',  (select count(*) from saved_posts s join contribution_posts c on c.id = s.post_id
                    where c.user_id = p_user and c.language_id = p_lang and c.post_type = 'library' and s.user_id <> p_user));
$$;

create function public.level_rule_met(e jsonb, r public.level_rules) returns boolean language sql immutable as $$
  select (e->>'messages')::int >= r.min_messages
     and (e->>'active_days')::int >= r.min_active_days
     and case when public.level_rank(r.level) <= 2
           then (e->>'partners_any')::int >= r.min_partners and (e->>'reviewed_any')::int >= r.min_reviewed
           else (e->>'partners')::int >= r.min_partners and (e->>'reviewed')::int >= r.min_reviewed end
     and (r.min_reviewed = 0
          or (public.level_rank(r.level) <= 2 and (e->>'reviewed')::int < r.min_reviewed)
          or coalesce((e->>'error_pct')::int, 100) <= r.max_error_pct)
     and (e->>'accepted_given')::int >= r.min_accepted_given
     and ((e->>'rated')::int < 3 or coalesce((e->>'helpful_pct')::int, 0) >= r.min_helpful_pct)
     and (e->>'post_saves')::int >= r.min_post_saves;
$$;

create function public.my_level_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles; e jsonb; r public.level_rules; v_rated int; v_bad int;
begin
  perform assert_active();
  perform public.evaluate_level(auth.uid());
  select * into me from profiles where id = auth.uid();
  select count(*), count(*) filter (where feedback = 'not_helpful') into v_rated, v_bad from (
    select feedback from message_corrections where corrector_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days'
    union all
    select feedback from post_discussion where author_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days') x;
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

create trigger staff_refused before insert on public.level_vouches for each row execute function public.refuse_staff_learner_action();
create trigger messages_check_level after insert on public.messages for each row execute function public.trg_check_level();

create policy "level rules readable" on public.level_rules for select to authenticated using (true);
create policy "read own ledger" on public.points_ledger for select using (auth.uid() = user_id);

revoke all on function
  public.award_points(uuid, integer, text, text, uuid),
  public.trg_check_level(),
  public.set_language_profile(text, text, text),
  public.corrector_in_good_standing(uuid),
  public.vouch_blocker(uuid, uuid, text),
  public.valid_vouches(uuid, text),
  public.evaluate_level(uuid),
  public.vouch_for(uuid),
  public.withdraw_vouch(uuid),
  public.vouch_status(uuid),
  public.check_level_safely(uuid),
  public.level_evidence(uuid, text),
  public.level_rule_met(jsonb, public.level_rules),
  public.my_level_progress()
from public, anon, authenticated, service_role;

grant execute on function
  public.set_language_profile(text, text, text),
  public.vouch_for(uuid),
  public.withdraw_vouch(uuid),
  public.vouch_status(uuid),
  public.my_level_progress()
to authenticated, service_role;

grant execute on function
  public.award_points(uuid, integer, text, text, uuid),
  public.trg_check_level(),
  public.corrector_in_good_standing(uuid),
  public.vouch_blocker(uuid, uuid, text),
  public.valid_vouches(uuid, text),
  public.evaluate_level(uuid),
  public.level_evidence(uuid, text),
  public.level_rule_met(jsonb, public.level_rules)
to service_role;
