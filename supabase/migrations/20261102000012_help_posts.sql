-- Help posts: beginners can post "Correct me" and "How do I say…?" with no level. NEW migration.
-- Never edit past migrations. See docs/POST_TYPES_AND_UNLOCKS.md, step 1.
--
-- 1. contribution_posts.post_type separates requests for help from Library posts. Help posts live in
--    the Practice tab, and search and the Library leave them out, because their text may be wrong.
-- 2. A help post creates no duty. There are no decision_items, so no deadline, reminder or restriction.
--    Status is needs_fix until a fix or a confirmation arrives, then helped. The text is never replaced.
-- 3. Each new help post tells up to 5 qualified people, and nobody hears more than once in 6 hours.
-- 4. Levels: corrections of a learner's own posts count as evidence, and so do post fixes they give.
--    Fixes on help posts stay out of the error rate, so asking never hurts. A1 and A2 can be reached
--    through posts alone. B1 and up give the right to correct others, so their partners, reviews and
--    error rate still come from real chat, and posts only add to messages and active days.
-- 5. Fixes get the same helpful / not helpful rating as chat corrections, and it counts the same way.

-- ---------- Columns ----------
alter table public.contribution_posts
  add column if not exists post_type text not null default 'library' check (post_type in ('library', 'correct_me', 'how_do_i_say'));
alter table public.contribution_posts add constraint contribution_posts_help_shape check (
  post_type = 'library' or (char_length(phrase) <= 280 and unsplash_image_url is null and accepted_item_id is null));
alter table public.contribution_posts drop constraint if exists contribution_posts_review_status_check;
alter table public.contribution_posts add constraint contribution_posts_review_status_check
  check (review_status in ('unreviewed', 'confirmed', 'disputed', 'corrected', 'needs_fix', 'helped'));
create index if not exists contribution_posts_type_idx on public.contribution_posts (post_type, review_status, created_at desc);

alter table public.post_discussion
  add column if not exists feedback text check (feedback is null or feedback in ('helpful', 'not_helpful')),
  add column if not exists feedback_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch',
  'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed',
  'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override',
  'action_reminder', 'action_overdue', 'action_escalated', 'restriction_applied', 'restriction_lifted', 'appeal_decided',
  'correction_declined', 'correction_superseded', 'bounty_reminder', 'admin_report', 'admin_security',
  'help_request', 'help_fix', 'help_thanked'));

create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('post_correction','post_challenged','post_clarification','post_reply','post_endorsed','correction','correction_accepted','help_request','help_fix','help_thanked') then 'corrections'
    when p_type in ('post_accepted','post_declined','post_withdrawn','post_superseded','post_resolved','post_reverted','post_override',
                    'correction_declined','correction_superseded') then 'decisions'
    when p_type in ('action_reminder','action_overdue','action_escalated','bounty_reminder') then 'reminders'
    else 'system' end;
$$;

-- ---------- Status ----------
create or replace function public.refresh_post_review(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update contribution_posts c set
    open_corrections = o.open, thread_count = o.total, endorse_count = o.endorsed,
    review_status = case
      when c.post_type <> 'library' then case when o.live > 0 or o.endorsed > 0 then 'helped' else 'needs_fix' end
      when o.open > 0 then 'disputed' when c.accepted_item_id is not null then 'corrected' when o.endorsed > 0 then 'confirmed' else 'unreviewed' end
  from (select
          (select count(*)::int from post_discussion d where d.post_id = p_post and d.status = 'pending') as open,
          (select count(*)::int from post_discussion d where d.post_id = p_post) as total,
          (select count(*)::int from post_discussion d where d.post_id = p_post and d.kind = 'correction' and d.status in ('pending','accepted')) as live,
          (select count(*)::int from post_endorsements e where e.post_id = p_post) as endorsed) o
  where c.id = p_post;
$$;

-- A problem with levels must never stop someone posting or helping.
create or replace function public.check_level_safely(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.evaluate_level(p_user);
exception when others then
  raise warning 'evaluate_level failed: %', sqlerrm;
end $$;

-- ---------- Asking ----------
-- Always about the language you are learning, whatever your level. The question itself may be in any language.
create or replace function public.post_help_request(p_type text, p_text text, p_context text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.profiles; post public.contribution_posts; v_text text := btrim(coalesce(p_text, '')); v_helper uuid;
begin
  perform assert_active();
  perform public.sweep_if_due();
  if exists (select 1 from user_restrictions where user_id = auth.uid() and lifted_at is null and kind = 'new_posts') then raise exception 'posting_restricted'; end if;
  if p_type not in ('correct_me', 'how_do_i_say') then raise exception 'invalid_post_type'; end if;
  select * into me from profiles where id = auth.uid();
  if me.learning_language_id is null then raise exception 'learning_language_required'; end if;
  if char_length(v_text) = 0 then raise exception 'empty_phrase'; end if;
  if char_length(v_text) > 280 then raise exception 'text_too_long'; end if;
  if (select count(*) from contribution_posts where user_id = me.id and post_type <> 'library' and created_at > now() - interval '24 hours') >= 3 then raise exception 'rate_limited'; end if;

  insert into contribution_posts (user_id, certified_at, language_id, phrase, source_context, post_type, review_status, updated_at)
  values (me.id, now(), me.learning_language_id, v_text, left(nullif(btrim(coalesce(p_context, '')), ''), 200), p_type, 'needs_fix', now())
  returning * into post;

  for v_helper in
    select p.id from profiles p left join user_presence up on up.user_id = p.id
    where p.id <> me.id and p.status = 'active' and p.role = 'user' and p.onboarding_done
      and public.can_correct_language(p.id, post.language_id) and not public.is_blocked_between(me.id, p.id)
      and not exists (select 1 from notifications n where n.user_id = p.id and n.type = 'help_request' and n.created_at > now() - interval '6 hours')
    order by (p.native_language_id = post.language_id) desc, up.last_seen_at desc nulls last
    limit 5
  loop
    perform public.notify_event(v_helper, me.id, 'help_request', jsonb_build_object('post_id', post.id, 'phrase', public.post_snippet(post)), 'help_request:' || post.id || ':' || v_helper);
  end loop;

  perform public.check_level_safely(me.id);
  return post.id;
end $$;

-- How many people could answer, up to 5: enough to be honest about a language with few helpers.
create or replace function public.help_supply(p_language text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from (
    select 1 from profiles p
    where p.id <> auth.uid() and p.status = 'active' and p.role = 'user' and p.onboarding_done
      and public.can_correct_language(p.id, public.normalize_language_code(p_language))
    limit 5) x;
$$;

create or replace function public.submit_discussion(p_post uuid, p_parent uuid, p_kind text, p_body text, p_phrase text default null, p_translation text default null, p_client_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  post public.contribution_posts; par public.post_discussion; v_id uuid; v_depth int := 0;
  v_body text := btrim(coalesce(p_body, '')); v_phrase text := nullif(btrim(coalesce(p_phrase, '')), ''); v_trans text := nullif(btrim(coalesce(p_translation, '')), '');
  v_base_phrase text; v_base_trans text; pol public.accountability_policy; v_data jsonb;
begin
  perform assert_active();
  if p_client_key is null then raise exception 'missing_client_key'; end if;
  select id into v_id from post_discussion where author_id = auth.uid() and client_key = p_client_key;
  if v_id is not null then return v_id; end if;   -- a repeated tap: same row, no second notification

  select * into post from contribution_posts where id = p_post for share;
  if post.id is null or public.is_blocked_between(auth.uid(), post.user_id) then raise exception 'post_not_found'; end if;
  if p_kind not in ('correction','clarification','comment') then raise exception 'invalid_kind'; end if;
  if char_length(v_body) = 0 then raise exception 'explanation_required'; end if;
  if char_length(v_body) > 1000 or char_length(v_phrase) > 500 or char_length(v_trans) > 500 then raise exception 'text_too_long'; end if;
  if (select count(*) from post_discussion where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;

  if p_parent is not null then
    select * into par from post_discussion where id = p_parent and post_id = p_post;
    if par.id is null then raise exception 'invalid_parent'; end if;
    if public.is_blocked_between(auth.uid(), par.author_id) then raise exception 'invalid_parent'; end if;
    v_depth := par.depth + 1;
    if v_depth > 12 then raise exception 'thread_too_deep'; end if;
  end if;

  -- A help post takes fixes, not debate: no questions for the author and no corrections of corrections.
  if post.post_type <> 'library' and (p_kind = 'clarification' or (p_kind = 'correction' and p_parent is not null)) then raise exception 'help_post_fix_only'; end if;

  if p_kind in ('correction','clarification') then
    if not public.can_correct_language(auth.uid(), post.language_id) then raise exception 'not_qualified_to_correct'; end if;
    if post.user_id = auth.uid() then raise exception 'owner_cannot_correct'; end if;
    -- A correction targets the post or another correction, never a chat comment or a closed proposal.
    if par.id is not null then
      if par.kind <> 'correction' then raise exception 'invalid_parent'; end if;
      if par.status not in ('pending','accepted') then raise exception 'parent_closed'; end if;
      if par.author_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
    end if;
  end if;

  if p_kind = 'correction' then
    v_base_phrase := coalesce(par.proposed_phrase, post.current_phrase, post.phrase);
    v_base_trans := coalesce(par.proposed_translation, post.current_translation, post.translation);
    if v_phrase is null and v_trans is null then raise exception 'proposal_required'; end if;
    if (v_phrase is null or lower(v_phrase) = lower(v_base_phrase)) and (v_trans is null or lower(v_trans) = lower(coalesce(v_base_trans, ''))) then raise exception 'no_change'; end if;
    if exists (select 1 from post_discussion d where d.post_id = p_post and d.author_id = auth.uid() and d.status = 'pending' and d.parent_id is not distinct from p_parent
               and lower(coalesce(d.proposed_phrase, '')) = lower(coalesce(v_phrase, '')) and lower(coalesce(d.proposed_translation, '')) = lower(coalesce(v_trans, ''))) then
      raise exception 'duplicate_correction';
    end if;
  else
    v_phrase := null; v_trans := null;
  end if;

  insert into post_discussion (post_id, parent_id, depth, author_id, kind, body, proposed_phrase, proposed_translation, status, client_key)
  values (p_post, p_parent, v_depth, auth.uid(), p_kind, v_body, v_phrase, v_trans, case when p_kind = 'comment' then null else 'pending' end, p_client_key)
  returning id into v_id;
  perform public.log_discussion(p_post, v_id, 'submitted', null, case when p_kind = 'comment' then null else 'pending' end);

  v_data := jsonb_build_object('post_id', p_post, 'item_id', v_id, 'phrase', public.post_snippet(post), 'parent_id', p_parent);
  if p_kind = 'comment' then
    -- The person replied to; the owner when it is about the post itself or a correction to it.
    perform public.notify_event(par.author_id, auth.uid(), 'post_reply', v_data, 'reply:' || v_id || ':' || coalesce(par.author_id::text, ''));
    if par.id is null or par.kind <> 'comment' then
      perform public.notify_event(post.user_id, auth.uid(), 'post_reply', v_data, 'reply:' || v_id || ':' || post.user_id);
    end if;
  else
    -- Asking for help never creates a duty: no deadline, no reminders, no restriction.
    if post.post_type = 'library' then
      select * into pol from accountability_policy;
      insert into decision_items (user_id, post_id, item_id, due_at)
      values (post.user_id, p_post, v_id, now() + make_interval(hours => pol.deadline_hours));
      perform public.notify_event(post.user_id, auth.uid(), case when p_kind = 'correction' then 'post_correction' else 'post_clarification' end, v_data, 'submitted:' || v_id, true);
    else
      perform public.notify_event(post.user_id, auth.uid(), 'help_fix', v_data, 'help_fix:' || v_id);
    end if;
    -- Their correction is being challenged: they hear about it, nobody else in the thread does.
    if par.id is not null and par.author_id is distinct from post.user_id then
      perform public.notify_event(par.author_id, auth.uid(), 'post_challenged', v_data, 'challenged:' || v_id);
    end if;
  end if;
  perform public.refresh_post_review(p_post);
  if post.post_type <> 'library' and p_kind = 'correction' then perform public.check_level_safely(post.user_id); end if;
  return v_id;
end $$;

-- ---------- Thanking ----------
-- Optional and final. A thank-you pays the helper, with the same limits as every other correction.
create or replace function public.rate_help_fix(p_id uuid, p_helpful boolean) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_status text := case when p_helpful then 'accepted' else 'declined' end; v_reward boolean := p_helpful; v_count int;
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id for update;
  if it.id is null or it.kind <> 'correction' then raise exception 'correction_unavailable'; end if;
  select * into post from contribution_posts where id = it.post_id;
  if post.user_id <> auth.uid() or post.post_type = 'library' then raise exception 'forbidden'; end if;
  if it.status <> 'pending' then raise exception 'already_decided'; end if;

  update post_discussion set status = v_status, decided_by = auth.uid(), decided_at = now(),
    feedback = case when p_helpful then 'helpful' else 'not_helpful' end, feedback_at = now()
  where id = it.id;
  perform public.log_discussion(post.id, it.id, v_status, 'pending', v_status);

  if v_reward then
    if not public.corrector_in_good_standing(it.author_id) then v_reward := false; end if;
    select count(*) into v_count from points_ledger where user_id = it.author_id and reason in ('correction_accepted','post_correction_accepted') and created_at > now() - interval '24 hours';
    if v_count >= 10 then v_reward := false; end if;
    select count(*) into v_count from points_ledger l join post_discussion d2 on d2.id = l.ref_id join contribution_posts p2 on p2.id = d2.post_id
    where l.user_id = it.author_id and l.reason = 'post_correction_accepted' and l.created_at > now() - interval '24 hours' and p2.user_id = post.user_id;
    if v_count >= 3 then v_reward := false; end if;
    if v_reward and it.author_id is not null then perform public.award_points(it.author_id, 5, 'post_correction_accepted', 'post_discussion', it.id); else v_reward := false; end if;
    perform public.notify_event(it.author_id, auth.uid(), 'help_thanked',
      jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'points', case when v_reward then 5 else 0 end), 'help_thanked:' || it.id);
    perform public.check_level_safely(it.author_id);
  end if;
  perform public.refresh_post_review(post.id);
end $$;

-- ---------- Standing: post fixes are rated too ----------
create or replace function public.corrector_in_good_standing(p_user uuid) returns boolean
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

-- ---------- The evidence ----------
create or replace function public.level_evidence(p_user uuid, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    -- The same text twice counts once; very short messages do not count. Characters, not words,
    -- because Chinese, Japanese and Thai do not put spaces between words.
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
    -- Only "Correct me": it is writing in the language. A "How do I say…?" may be in any language.
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
    -- Fixes on posts count too, at most 3 a day for one author, so two accounts cannot trade them.
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
    -- The same two with posts included. Only A1 and A2 read these (level_rule_met).
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

-- A1 and A2 can come from posts. There the chat error rate only applies once there is enough chat to judge.
create or replace function public.level_rule_met(e jsonb, r public.level_rules) returns boolean language sql immutable as $$
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

create or replace function public.my_level_progress() returns jsonb
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

-- ---------- Help posts stay out of search; the queue is on the Bounties badge ----------
create or replace function public.search_posts(p_query text default null, p_language text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, user_id uuid, language_id text, phrase text, translation text, category text, source_context text,
  unsplash_image_url text, text_align text, pinned_at timestamptz, created_at timestamptz, updated_at timestamptz, certified_at timestamptz,
  author_username text, author_name text, author_avatar text, saved boolean,
  current_phrase text, current_translation text, review_status text, open_corrections int, thread_count int, endorse_count int)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_like is null and v_lang is null then return; end if;   -- nothing to search for

  return query
  select c.id, c.user_id, c.language_id, c.phrase, c.translation, c.category, c.source_context,
    c.unsplash_image_url, c.text_align, c.pinned_at, c.created_at, c.updated_at, c.certified_at,
    a.username, a.display_name, a.avatar_url,
    exists (select 1 from saved_posts s where s.user_id = auth.uid() and s.post_id = c.id),
    c.current_phrase, c.current_translation, c.review_status, c.open_corrections, c.thread_count, c.endorse_count
  from contribution_posts c
  join profiles a on a.id = c.user_id
  where c.post_type = 'library'
    and (a.status = 'active' or a.id = auth.uid())
    and not public.is_blocked_between(auth.uid(), c.user_id)
    and (v_lang is null or c.language_id = v_lang)
    and (v_like is null or c.phrase ilike v_like or c.translation ilike v_like or c.source_context ilike v_like
         or a.display_name ilike v_like or a.username ilike v_like)
  -- Relevance: the phrase itself starts with the query, then the phrase contains it, then the rest; newest first within each.
  order by case
      when v_q is null then 2
      when lower(c.phrase) like v_q || '%' then 0
      when c.phrase ilike v_like then 1
      else 2 end,
    c.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

create or replace function public.nav_badges() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; v_home timestamptz; v_library timestamptz; v_bounties timestamptz;
        v_default timestamptz := now() - interval '3 days';   -- first visit: only what's fairly fresh
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.status <> 'active' then return '{}'::jsonb; end if;
  select coalesce(max(seen_at) filter (where tab = 'home'), v_default),
         coalesce(max(seen_at) filter (where tab = 'library'), v_default),
         coalesce(max(seen_at) filter (where tab = 'bounties'), v_default)
    into v_home, v_library, v_bounties
  from tab_seen where user_id = auth.uid();
  return jsonb_build_object(
    'home', (select count(*) from (select 1 from profiles p
              where p.created_at > v_home and p.id <> me.id and p.status = 'active' and p.onboarding_done
                and ((me.learning_language_id is not null and p.native_language_id = me.learning_language_id)
                  or (me.native_language_id is not null and p.learning_language_id = me.native_language_id))
                and not public.is_blocked_between(me.id, p.id) limit 100) x),
    'library', (select count(*) from (select 1 from contribution_posts c
              where c.created_at > v_library and c.user_id <> me.id
                and c.language_id in (me.native_language_id, me.learning_language_id)
                and not public.is_blocked_between(me.id, c.user_id) limit 100) x),
    'bounties',
      (select count(*) from message_corrections mc join messages m on m.id = mc.message_id
        where m.sender_id = me.id and m.bounty_status = 'open' and mc.status = 'pending')
      + (select count(*) from (select 1 from messages m
          where m.bounty_status = 'open' and m.deleted_at is null and m.created_at > v_bounties and m.sender_id <> me.id
            and m.bounty_expires_at > now() and public.can_correct_language(me.id, m.language_id) and m.language_id is not null
            and not public.is_blocked_between(me.id, m.sender_id)
            and not exists (select 1 from message_corrections mc where mc.message_id = m.id and mc.corrector_id = me.id) limit 100) x)
      + (select count(*) from (select 1 from contribution_posts c
          where c.post_type <> 'library' and c.review_status = 'needs_fix' and c.created_at > v_bounties and c.user_id <> me.id
            and public.can_correct_language(me.id, c.language_id) and not public.is_blocked_between(me.id, c.user_id) limit 100) x));
end $$;

-- ---------- Grants ----------
revoke execute on function public.post_help_request(text, text, text) from public, anon;
grant  execute on function public.post_help_request(text, text, text) to authenticated, service_role;
revoke execute on function public.help_supply(text) from public, anon;
grant  execute on function public.help_supply(text) to authenticated, service_role;
revoke execute on function public.rate_help_fix(uuid, boolean) from public, anon;
grant  execute on function public.rate_help_fix(uuid, boolean) to authenticated, service_role;
-- Internal.
revoke execute on function public.check_level_safely(uuid) from public, anon, authenticated;
