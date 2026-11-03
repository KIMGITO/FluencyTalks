-- Message corrections, their review workflow and bounties.

create table public.message_corrections (
  id uuid default gen_random_uuid() primary key,
  message_id uuid not null references public.messages(id) on delete cascade,
  corrector_id uuid not null references public.profiles(id) on delete cascade,
  suggested_text text not null check ((char_length(suggested_text) >= 1) and (char_length(suggested_text) <= 4000)),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed', 'superseded')),
  created_at timestamptz not null default now(),
  feedback text check ((feedback is null) or (feedback in ('helpful', 'not_helpful'))),
  feedback_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 300)
);
alter table public.message_corrections enable row level security;
create index message_corrections_message_id_idx on public.message_corrections (message_id);
create index message_corrections_corrector_idx on public.message_corrections (corrector_id, created_at desc);
grant select on public.message_corrections to authenticated;

create table public.correction_agreements (
  item_id uuid not null references public.post_discussion(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
alter table public.correction_agreements enable row level security;

create function public.respond_correction(p_id uuid, p_accept boolean) returns void language sql security definer set search_path = public as $$
  update message_corrections c set status = case when p_accept then 'accepted' else 'dismissed' end
  from messages m where c.id = p_id and m.id = c.message_id and m.sender_id = auth.uid() and c.status = 'pending' $$;

create function public.trg_notify_correction() returns trigger language plpgsql security definer set search_path = public as $$
declare m messages;
begin
  select * into m from messages where id = new.message_id;
  perform public.notify(m.sender_id, new.corrector_id, 'correction', jsonb_build_object('conversation_id', m.conversation_id, 'message_id', m.id));
  return null;
end $$;

create function public.list_my_corrections()
returns table (
  id uuid, message_id uuid, conversation_id uuid, original_text text,
  suggested_text text, note text, status text,
  corrector_id uuid, corrector_name text, corrector_username text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mc.id, mc.message_id, m.conversation_id,
         m.body,
         mc.suggested_text, mc.note, mc.status,
         mc.corrector_id, coalesce(p.display_name, p.username), p.username, mc.created_at
  from message_corrections mc
  join messages m on m.id = mc.message_id
  join profiles p on p.id = mc.corrector_id
  where m.sender_id = auth.uid()
    and m.deleted_at is null and m.body <> '[deleted]'
    and public.can_access_conversation(m.conversation_id)
  order by mc.created_at desc
  limit 200 $$;

create function public.answer_bounty(p_message uuid, p_text text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.messages; v_id uuid; v_text text := btrim(p_text);
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  select * into m from public.messages where id = p_message;
  if not found or m.bounty_status <> 'open' then raise exception 'bounty_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  if public.is_blocked_between(auth.uid(), m.sender_id) then raise exception 'bounty_unavailable'; end if;
  if not public.can_correct_language(auth.uid(), m.language_id) then raise exception 'not_qualified_to_correct'; end if;
  if v_text is null or char_length(v_text) = 0 then raise exception 'empty_message'; end if;
  if lower(v_text) = lower(btrim(m.body)) then raise exception 'no_change'; end if;
  if exists (select 1 from public.message_corrections where message_id = p_message and corrector_id = auth.uid()) then raise exception 'already_answered'; end if;
  if (select count(*) from public.message_corrections where corrector_id = auth.uid() and created_at > now() - interval '24 hours') >= 30 then raise exception 'rate_limited'; end if;
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), v_text, p_note) returning id into v_id;
  return v_id;
end $$;

create function public.suggest_correction(p_message uuid, p_text text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.messages; v_id uuid; v_text text := btrim(p_text);
begin
  perform assert_active();
  select * into m from public.messages where id = p_message;
  if not found or not public.can_access_conversation(m.conversation_id) then raise exception 'conversation_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  if not public.can_correct_language(auth.uid(), m.language_id) then raise exception 'not_qualified_to_correct'; end if;
  if v_text is null or char_length(v_text) = 0 then raise exception 'empty_message'; end if;
  if lower(v_text) = lower(btrim(m.body)) then raise exception 'no_change'; end if;
  if (select count(*) from public.message_corrections where corrector_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate_limited'; end if;
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), v_text, p_note) returning id into v_id;
  return v_id;
end $$;

create function public.rate_correction(p_id uuid, p_helpful boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update message_corrections c set feedback = case when p_helpful then 'helpful' else 'not_helpful' end, feedback_at = now()
  from messages m where c.id = p_id and m.id = c.message_id and m.sender_id = auth.uid() and c.status <> 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
end $$;

create function public.accept_correction(p_id uuid) returns void
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
    perform public.notify(c.corrector_id, auth.uid(), 'bounty_paid', jsonb_build_object('points', v_msg.bounty_cost, 'message_id', v_msg.id));
    return;
  end if;

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

create function public.apply_accept(post public.contribution_posts, it public.post_discussion, p_note text, p_from text) returns void
language plpgsql security definer set search_path = public as $$
declare prev public.post_discussion; v_reward boolean := true; v_count int; v_data jsonb;
begin
  v_data := jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post));
  if post.accepted_item_id is not null and post.accepted_item_id <> it.id then
    select * into prev from post_discussion where id = post.accepted_item_id;
    update post_discussion set status = 'superseded', decided_at = now(), decided_by = auth.uid() where id = prev.id;
    perform public.log_discussion(post.id, prev.id, 'superseded', 'accepted', 'superseded', 'Replaced by a newer accepted correction');
    perform public.notify_event(prev.author_id, auth.uid(), 'post_superseded', v_data || jsonb_build_object('item_id', prev.id, 'by_item', it.id), 'superseded:' || prev.id || ':' || it.id);
  end if;
  update post_discussion set status = 'accepted', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = it.id;
  update contribution_posts set accepted_item_id = it.id,
    current_phrase = coalesce(it.proposed_phrase, post.current_phrase),
    current_translation = coalesce(it.proposed_translation, post.current_translation)
  where id = post.id;
  perform public.log_discussion(post.id, it.id, 'accepted', p_from, 'accepted', p_note);
  perform public.close_decision(it.id, 'decided', p_note);

  if not public.corrector_in_good_standing(it.author_id) then v_reward := false; end if;
  select count(*) into v_count from points_ledger where user_id = it.author_id and reason in ('correction_accepted','post_correction_accepted') and created_at > now() - interval '24 hours';
  if v_count >= 10 then v_reward := false; end if;
  select count(*) into v_count from points_ledger l join post_discussion d2 on d2.id = l.ref_id join contribution_posts p2 on p2.id = d2.post_id
  where l.user_id = it.author_id and l.reason = 'post_correction_accepted' and l.created_at > now() - interval '24 hours' and p2.user_id = post.user_id;
  if v_count >= 3 then v_reward := false; end if;
  if v_reward and it.author_id is not null and not exists (select 1 from points_ledger where reason = 'post_correction_accepted' and ref_id = it.id) then
    perform public.award_points(it.author_id, 5, 'post_correction_accepted', 'post_discussion', it.id);
  else
    v_reward := false;
  end if;
  perform public.notify_event(it.author_id, auth.uid(), 'post_accepted', v_data || jsonb_build_object('points', case when v_reward then 5 else 0 end), 'accepted:' || it.id || ':' || coalesce(p_from, ''));
end $$;

create function public.decide_correction(p_id uuid, p_accept boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_mod boolean := false;
begin
  perform assert_active();
  select post_id into post.id from post_discussion where id = p_id;
  if post.id is null then raise exception 'correction_unavailable'; end if;
  -- The post row is the lock: two decisions on one post happen one after the other.
  select * into post from contribution_posts where id = post.id for update;
  select * into it from post_discussion where id = p_id for update;
  if post.user_id <> auth.uid() then
    v_mod := public.is_admin();
    if not v_mod then raise exception 'forbidden'; end if;
    if v_note is null then raise exception 'reason_required'; end if;
  end if;
  if it.author_id = auth.uid() then raise exception 'forbidden'; end if;
  if it.kind <> 'correction' then raise exception 'correction_unavailable'; end if;
  if it.status <> 'pending' then raise exception 'already_decided'; end if;

  if p_accept then
    perform public.apply_accept(post, it, v_note, 'pending');
  else
    update post_discussion set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_note = v_note where id = it.id;
    perform public.log_discussion(post.id, it.id, 'declined', 'pending', 'declined', v_note);
    perform public.close_decision(it.id, 'decided', v_note);
    perform public.notify_event(it.author_id, auth.uid(), 'post_declined', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'note', v_note), 'declined:' || it.id);
  end if;
  perform public.refresh_post_review(post.id);
  return case when p_accept then 'accepted' else 'declined' end;
end $$;

create function public.resolve_clarification(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id for update;
  if it.id is null or it.kind <> 'clarification' then raise exception 'correction_unavailable'; end if;
  select * into post from contribution_posts where id = it.post_id;
  if post.user_id <> auth.uid() and it.author_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  if v_note is null then raise exception 'reason_required'; end if;
  if it.status <> 'pending' then raise exception 'already_decided'; end if;
  update post_discussion set status = 'resolved', decided_by = auth.uid(), decided_at = now(), decision_note = left(v_note, 500) where id = it.id;
  perform public.log_discussion(post.id, it.id, 'resolved', 'pending', 'resolved', v_note);
  perform public.close_decision(it.id, 'decided', v_note);
  perform public.notify_event(it.author_id, auth.uid(), 'post_resolved', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'note', v_note), 'resolved:' || it.id);
  perform public.notify_event(post.user_id, auth.uid(), 'post_resolved', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'note', v_note), 'resolved:' || it.id);
  perform public.refresh_post_review(post.id);
end $$;

create function public.revert_accepted(p_post uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare post public.contribution_posts; v_id uuid; v_author uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform assert_active();
  select * into post from contribution_posts where id = p_post for update;
  if post.id is null then raise exception 'post_not_found'; end if;
  if post.user_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  if v_note is null then raise exception 'reason_required'; end if;
  v_id := post.accepted_item_id;
  if v_id is null then raise exception 'correction_unavailable'; end if;
  update post_discussion set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_note = v_note where id = v_id returning author_id into v_author;
  update contribution_posts set accepted_item_id = null, current_phrase = null, current_translation = null where id = p_post;
  perform public.log_discussion(p_post, v_id, 'reverted', 'accepted', 'declined', v_note);
  perform public.notify_event(v_author, auth.uid(), 'post_reverted', jsonb_build_object('post_id', p_post, 'item_id', v_id, 'phrase', left(post.phrase, 80), 'note', v_note), 'reverted:' || v_id || ':' || extract(epoch from now())::bigint);
  perform public.refresh_post_review(p_post);
end $$;

create function public.admin_override_correction(p_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_from text; v_pol public.accountability_policy;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  if p_status not in ('pending','accepted','declined') then raise exception 'invalid_kind'; end if;
  select post_id into post.id from post_discussion where id = p_id;
  if post.id is null then raise exception 'correction_unavailable'; end if;
  select * into post from contribution_posts where id = post.id for update;
  select * into it from post_discussion where id = p_id for update;
  if it.kind <> 'correction' then raise exception 'correction_unavailable'; end if;
  if it.status = p_status then raise exception 'already_decided'; end if;
  v_from := it.status;

  if post.accepted_item_id = it.id then
    update contribution_posts set accepted_item_id = null, current_phrase = null, current_translation = null where id = post.id returning * into post;
  end if;
  if p_status = 'accepted' then
    perform public.apply_accept(post, it, v_reason, v_from);
  else
    update post_discussion set status = p_status, decided_by = auth.uid(), decided_at = now(), decision_note = v_reason where id = it.id;
    perform public.log_discussion(post.id, it.id, 'override', v_from, p_status, v_reason);
    perform public.close_decision(it.id, 'decided', v_reason);
    if p_status = 'pending' then
      select * into v_pol from accountability_policy;
      insert into decision_items (user_id, post_id, item_id, due_at) values (post.user_id, post.id, it.id, now() + make_interval(hours => v_pol.deadline_hours))
      on conflict (item_id) do update set resolved_at = null, resolution = null, resolved_note = null, due_at = excluded.due_at, reminder_count = 0, last_reminded_at = null, overdue_notified_at = null, escalated_at = null;
    end if;
  end if;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), it.author_id, 'decision_override:' || v_from || '>' || p_status, v_reason, it.id);
  perform public.notify_event(it.author_id, auth.uid(), 'post_override', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'status', p_status, 'note', v_reason), 'override:' || it.id || ':' || extract(epoch from now())::bigint);
  perform public.notify_event(post.user_id, auth.uid(), 'post_override', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'status', p_status, 'note', v_reason), 'override:' || it.id || ':' || extract(epoch from now())::bigint);
  perform public.refresh_post_review(post.id);
end $$;

create function public.toggle_correction_agreement(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; v_on boolean;
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id;
  if it.id is null or it.kind <> 'correction' or public.is_blocked_between(auth.uid(), it.author_id) then raise exception 'correction_unavailable'; end if;
  if it.author_id = auth.uid() then raise exception 'cannot_review_own'; end if;
  delete from correction_agreements where item_id = p_id and user_id = auth.uid();
  v_on := not found;
  if v_on then insert into correction_agreements (item_id, user_id) values (p_id, auth.uid()); end if;
  return v_on;
end $$;

create function public.guard_correction_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'pending' then raise exception 'correction_already_decided'; end if;
    new.decided_at := now();
    new.decided_by := auth.uid();
  end if;
  return new;
end $$;

create function public.supersede_bounty_answers() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_msg messages;
begin
  select * into v_msg from messages where id = new.message_id;
  if not v_msg.is_bounty then return null; end if;
  for r in update message_corrections set status = 'superseded'
           where message_id = new.message_id and id <> new.id and status = 'pending'
           returning id, corrector_id loop
    perform public.notify_event(r.corrector_id, v_msg.sender_id, 'correction_superseded',
      jsonb_build_object('message_id', v_msg.id, 'bounty', true), 'superseded:' || r.id, false);
  end loop;
  return null;
end $$;

create function public.guard_bounty_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.bounty_status is distinct from old.bounty_status
     and not (old.bounty_status = 'open' and new.bounty_status in ('paid', 'refunded')) then
    raise exception 'invalid_bounty_transition';
  end if;
  if old.bounty_paid_to is not null and new.bounty_paid_to is not null and new.bounty_paid_to <> old.bounty_paid_to then
    raise exception 'invalid_bounty_transition';
  end if;
  return new;
end $$;

create function public.decline_correction(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c message_corrections; v_msg messages; v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 300); v_member boolean;
begin
  perform assert_active();
  if v_reason is null then raise exception 'reason_required'; end if;
  select mc.* into c from message_corrections mc join messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending' for update of mc;
  if not found then raise exception 'correction_unavailable'; end if;
  select * into v_msg from messages where id = c.message_id;
  update message_corrections set status = 'dismissed', decision_note = v_reason where id = p_id;
  v_member := exists (select 1 from conversation_members where conversation_id = v_msg.conversation_id and user_id = c.corrector_id);
  perform public.notify_event(c.corrector_id, auth.uid(), 'correction_declined',
    jsonb_build_object('message_id', v_msg.id, 'note', v_reason, 'bounty', v_msg.is_bounty,
                       'conversation_id', case when v_member then v_msg.conversation_id end),
    'declined:' || p_id, false);
end $$;

create function public.refund_expired_bounties() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.sender_id, m.bounty_cost from public.messages m
           where m.bounty_status = 'open' and (m.bounty_expires_at < now() or m.deleted_at is not null)
           for update skip locked loop
    update public.messages set bounty_status = 'refunded' where id = r.id;
    perform public.award_points(r.sender_id, r.bounty_cost, 'bounty_expired_refund', 'message', r.id);
    n := n + 1;
  end loop;
  for r in select m.id, m.sender_id, m.conversation_id,
                  (select count(*) from public.message_corrections c where c.message_id = m.id and c.status = 'pending') as waiting
           from public.messages m
           where m.bounty_status = 'open' and m.deleted_at is null and m.bounty_expires_at <= now() + interval '12 hours'
             and exists (select 1 from public.message_corrections c where c.message_id = m.id and c.status = 'pending') loop
    perform public.notify_event(r.sender_id, null, 'bounty_reminder',
      jsonb_build_object('conversation_id', r.conversation_id, 'message_id', r.id, 'waiting', r.waiting), 'bounty-reminder:' || r.id, true);
  end loop;
  return n;
end $$;

create function public.list_open_bounties(p_limit int default 20, p_offset int default 0)
returns table (message_id uuid, body text, language_id text, cost int, expires_at timestamptz, created_at timestamptz,
               asker_id uuid, asker_username text, asker_display_name text, asker_avatar_url text,
               answers int, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  return query
  select m.id, m.body, m.language_id, m.bounty_cost, m.bounty_expires_at, m.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         (select count(*)::int from public.message_corrections mc where mc.message_id = m.id and mc.status = 'pending'),
         case when exists (select 1 from public.conversation_members cm where cm.conversation_id = m.conversation_id and cm.user_id = auth.uid())
              then m.conversation_id end
  from public.messages m join public.profiles p on p.id = m.sender_id
  where m.bounty_status = 'open' and m.deleted_at is null and m.language_id is not null and m.sender_id <> auth.uid()
    and p.status = 'active' and not public.is_blocked_between(auth.uid(), m.sender_id)
    and public.can_correct_language(auth.uid(), m.language_id)
    and not exists (select 1 from public.message_corrections mc where mc.message_id = m.id and mc.corrector_id = auth.uid())
  order by m.bounty_expires_at asc, m.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create function public.list_my_bounty_answers()
returns table (correction_id uuid, message_id uuid, original text, suggested_text text, note text, status text,
               decision_note text, decided_at timestamptz, created_at timestamptz, language_id text,
               bounty_status text, cost int, expires_at timestamptz, paid_to_me boolean,
               asker_username text, asker_display_name text, asker_avatar_url text, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  return query
  select mc.id, m.id, m.body, mc.suggested_text, mc.note, mc.status, mc.decision_note, mc.decided_at, mc.created_at, m.language_id,
         m.bounty_status, m.bounty_cost, m.bounty_expires_at, m.bounty_paid_to = auth.uid(),
         p.username, p.display_name, p.avatar_url,
         case when exists (select 1 from public.conversation_members cm where cm.conversation_id = m.conversation_id and cm.user_id = auth.uid())
              then m.conversation_id end
  from public.message_corrections mc join public.messages m on m.id = mc.message_id join public.profiles p on p.id = m.sender_id
  where mc.corrector_id = auth.uid() and m.is_bounty and not public.is_blocked_between(auth.uid(), m.sender_id)
  order by mc.created_at desc limit 100;
end $$;

create function public.list_my_bounties()
returns table (message_id uuid, conversation_id uuid, body text, language_id text, cost int, status text,
               expires_at timestamptz, created_at timestamptz, answers int, paid_to_username text, paid_to_name text)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  return query
  select m.id, m.conversation_id, m.body, m.language_id, m.bounty_cost, m.bounty_status, m.bounty_expires_at, m.created_at,
         (select count(*)::int from public.message_corrections mc where mc.message_id = m.id and mc.status = 'pending'),
         w.username, w.display_name
  from public.messages m left join public.profiles w on w.id = m.bounty_paid_to
  where m.sender_id = auth.uid() and m.is_bounty
  order by m.created_at desc limit 100;
end $$;

create trigger corrections_notify after insert on public.message_corrections for each row execute function public.trg_notify_correction();
create trigger message_corrections_guard before update on public.message_corrections
  for each row execute function public.guard_correction_status();
create trigger message_corrections_supersede after update of status on public.message_corrections
  for each row when (old.status = 'pending' and new.status = 'accepted') execute function public.supersede_bounty_answers();
create trigger staff_refused before insert on public.message_corrections for each row execute function public.refuse_staff_learner_action();
create trigger messages_bounty_guard before update of bounty_status, bounty_paid_to on public.messages
  for each row execute function public.guard_bounty_status();

create policy "closed during a pause" on public.message_corrections as restrictive for select to authenticated using ((select public.app_open()));
create policy "read corrections" on public.message_corrections for select using (exists (select 1 from public.messages m where m.id = message_id));
create policy "read own corrections" on public.message_corrections for select using (corrector_id = auth.uid());

alter publication supabase_realtime add table public.message_corrections;

revoke all on function
  public.respond_correction(uuid, boolean),
  public.trg_notify_correction(),
  public.list_my_corrections(),
  public.answer_bounty(uuid, text, text),
  public.suggest_correction(uuid, text, text),
  public.rate_correction(uuid, boolean),
  public.accept_correction(uuid),
  public.apply_accept(public.contribution_posts, public.post_discussion, text, text),
  public.decide_correction(uuid, boolean, text),
  public.resolve_clarification(uuid, text),
  public.revert_accepted(uuid, text),
  public.admin_override_correction(uuid, text, text),
  public.toggle_correction_agreement(uuid),
  public.guard_correction_status(),
  public.supersede_bounty_answers(),
  public.guard_bounty_status(),
  public.decline_correction(uuid, text),
  public.refund_expired_bounties(),
  public.list_open_bounties(integer, integer),
  public.list_my_bounty_answers(),
  public.list_my_bounties()
from public, anon, authenticated, service_role;

grant execute on function
  public.respond_correction(uuid, boolean),
  public.trg_notify_correction(),
  public.list_my_corrections(),
  public.answer_bounty(uuid, text, text),
  public.suggest_correction(uuid, text, text),
  public.rate_correction(uuid, boolean),
  public.accept_correction(uuid),
  public.decide_correction(uuid, boolean, text),
  public.resolve_clarification(uuid, text),
  public.revert_accepted(uuid, text),
  public.admin_override_correction(uuid, text, text),
  public.toggle_correction_agreement(uuid),
  public.decline_correction(uuid, text),
  public.list_open_bounties(integer, integer),
  public.list_my_bounty_answers(),
  public.list_my_bounties()
to authenticated, service_role;

grant execute on function
  public.apply_accept(public.contribution_posts, public.post_discussion, text, text),
  public.refund_expired_bounties()
to service_role;
