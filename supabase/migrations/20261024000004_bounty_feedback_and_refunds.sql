-- Bounty experience fixes. Never edit past migrations.
--
-- 1. Deleting a message that carries an open bounty refunds the held points straight away
--    (before, they stayed held until someone opened the Bounties page).
-- 2. The helper is told when an answer is accepted: 'bounty_paid' (carries the points, never the
--    chat id: a helper is not a member of the asker's chat) and 'correction_accepted'.
-- 3. A helper can send at most 30 bounty answers per 24 hours.

-- ---------- 2. New notification types ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid'));

-- ---------- 1. delete_message refunds immediately ----------
create or replace function public.delete_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.messages set deleted_at = now(), body = '[deleted]' where id = p_id and sender_id = auth.uid();
  perform public.refund_expired_bounties();   -- an open bounty on a deleted message is refunded now
end $$;

-- ---------- 2. accept_correction tells the corrector ----------
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
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);

  if v_msg.bounty_status = 'open' then
    update public.messages set bounty_status = 'paid', bounty_paid_to = c.corrector_id where id = v_msg.id;
    perform public.award_points(c.corrector_id, v_msg.bounty_cost, 'bounty_answered_accepted', 'message', v_msg.id);
    -- The helper may not be in this chat, so the notification carries the points but no conversation id.
    perform public.notify(c.corrector_id, auth.uid(), 'bounty_paid', jsonb_build_object('points', v_msg.bounty_cost, 'message_id', v_msg.id));
    return;
  end if;

  -- Ordinary +5, with limits so two accounts cannot farm each other.
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

-- ---------- 3. answer_bounty: spam limit ----------
create or replace function public.answer_bounty(p_message uuid, p_text text, p_note text default null) returns uuid
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

-- ---------- Grants (keep LAST) ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.refund_expired_bounties() from public, anon, authenticated;
