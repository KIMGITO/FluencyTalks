-- Chat corrections and bounties: one lifecycle, enforced here. NEW migration. Never edit past migrations.
-- Full write-up: docs/CORRECTIONS_AND_BOUNTIES.md
--
-- 1. message_corrections records who decided and when, and why on a decline. New final state 'superseded':
--    the other answers to a bounty once one of them is accepted (before, they stayed pending forever).
-- 2. Triggers refuse invalid transitions: a decided correction never changes status again, a bounty only goes
--    open -> paid or open -> refunded.
-- 3. A helper can read their own answers. Before, only chat members could, so a bounty answer disappeared
--    from the helper's view the moment it was sent.
-- 4. decline_correction: the sender declines with a reason; the helper is told.
-- 5. list_open_bounties pages (it stopped at 20, soonest-expiring first, so a new bounty on a busy queue was
--    cut off), says how many answers are waiting, and whether it came from a chat you are in.
-- 6. list_my_bounty_answers: what you answered and what happened to it. list_my_bounties names who was paid.
-- 7. One reminder to the asker when answers are waiting and under 12 hours are left.

-- ---------- 1. Columns and states ----------
alter table public.message_corrections
  add column if not exists decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists decision_note text check (char_length(decision_note) <= 300);
alter table public.message_corrections drop constraint if exists message_corrections_status_check;
alter table public.message_corrections add constraint message_corrections_status_check
  check (status in ('pending', 'accepted', 'dismissed', 'superseded'));
create index if not exists message_corrections_corrector_idx on public.message_corrections (corrector_id, created_at desc);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch',
  'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed',
  'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override',
  'action_reminder', 'action_overdue', 'action_escalated', 'restriction_applied', 'restriction_lifted', 'appeal_decided',
  'correction_declined', 'correction_superseded', 'bounty_reminder'));

create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('post_correction','post_challenged','post_clarification','post_reply','post_endorsed','correction','correction_accepted') then 'corrections'
    when p_type in ('post_accepted','post_declined','post_withdrawn','post_superseded','post_resolved','post_reverted','post_override',
                    'correction_declined','correction_superseded') then 'decisions'
    when p_type in ('action_reminder','action_overdue','action_escalated','bounty_reminder') then 'reminders'
    else 'system' end;
$$;

-- ---------- 2. Transitions ----------
create or replace function public.guard_correction_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'pending' then raise exception 'correction_already_decided'; end if;
    new.decided_at := now();
    new.decided_by := auth.uid();   -- null when the system decides
  end if;
  return new;
end $$;
drop trigger if exists message_corrections_guard on public.message_corrections;
create trigger message_corrections_guard before update on public.message_corrections
  for each row execute function public.guard_correction_status();

-- Accepting one answer to a bounty closes the others. They keep their text; only the outcome moves.
create or replace function public.supersede_bounty_answers() returns trigger language plpgsql security definer set search_path = public as $$
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
drop trigger if exists message_corrections_supersede on public.message_corrections;
create trigger message_corrections_supersede after update of status on public.message_corrections
  for each row when (old.status = 'pending' and new.status = 'accepted') execute function public.supersede_bounty_answers();

create or replace function public.guard_bounty_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.bounty_status is distinct from old.bounty_status
     and not (old.bounty_status = 'open' and new.bounty_status in ('paid', 'refunded')) then
    raise exception 'invalid_bounty_transition';
  end if;
  -- Once paid, the recipient never changes (it may only become null when their account is deleted).
  if old.bounty_paid_to is not null and new.bounty_paid_to is not null and new.bounty_paid_to <> old.bounty_paid_to then
    raise exception 'invalid_bounty_transition';
  end if;
  return new;
end $$;
drop trigger if exists messages_bounty_guard on public.messages;
create trigger messages_bounty_guard before update of bounty_status, bounty_paid_to on public.messages
  for each row execute function public.guard_bounty_status();

-- ---------- 3. A helper reads their own answers ----------
drop policy if exists "read own corrections" on public.message_corrections;
create policy "read own corrections" on public.message_corrections for select using (corrector_id = auth.uid());

-- ---------- 4. Decline with a reason ----------
create or replace function public.decline_correction(p_id uuid, p_reason text) returns void
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
  -- A bounty helper is usually not in the chat: no conversation id for them, the link goes to their answers.
  v_member := exists (select 1 from conversation_members where conversation_id = v_msg.conversation_id and user_id = c.corrector_id);
  perform public.notify_event(c.corrector_id, auth.uid(), 'correction_declined',
    jsonb_build_object('message_id', v_msg.id, 'note', v_reason, 'bounty', v_msg.is_bounty,
                       'conversation_id', case when v_member then v_msg.conversation_id end),
    'declined:' || p_id, false);
end $$;

-- ---------- 7. Refunds, plus the reminder ----------
create or replace function public.refund_expired_bounties() returns int
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
  -- Answers are waiting and time is short: tell the asker once. They are never penalised for not answering.
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

-- ---------- 5. The queue ----------
drop function if exists public.list_open_bounties(int);
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
         -- Only when you are in that chat: you can open it. Otherwise it stays private.
         case when exists (select 1 from public.conversation_members cm where cm.conversation_id = m.conversation_id and cm.user_id = auth.uid())
              then m.conversation_id end
  from public.messages m join public.profiles p on p.id = m.sender_id
  where m.bounty_status = 'open' and m.deleted_at is null and m.language_id is not null and m.sender_id <> auth.uid()
    and p.status = 'active' and not public.is_blocked_between(auth.uid(), m.sender_id)
    and public.can_correct_language(auth.uid(), m.language_id)
    and not exists (select 1 from public.message_corrections mc where mc.message_id = m.id and mc.corrector_id = auth.uid())
  order by m.bounty_expires_at asc, m.id          -- closest to expiring first; id keeps pages stable
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------- 6. Both sides' history ----------
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

drop function if exists public.list_my_bounties();
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

-- ---------- Grants ----------
revoke execute on function public.decline_correction(uuid, text) from public, anon;
grant  execute on function public.decline_correction(uuid, text) to authenticated, service_role;
revoke execute on function public.list_open_bounties(int, int) from public, anon;
grant  execute on function public.list_open_bounties(int, int) to authenticated, service_role;
revoke execute on function public.list_my_bounty_answers() from public, anon;
grant  execute on function public.list_my_bounty_answers() to authenticated, service_role;
revoke execute on function public.list_my_bounties() from public, anon;
grant  execute on function public.list_my_bounties() to authenticated, service_role;
revoke execute on function public.guard_correction_status() from public, anon, authenticated;
revoke execute on function public.supersede_bounty_answers() from public, anon, authenticated;
revoke execute on function public.guard_bounty_status() from public, anon, authenticated;
revoke execute on function public.refund_expired_bounties() from public, anon, authenticated;
