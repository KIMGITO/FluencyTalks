-- Message language, who may correct, and the Priority Bounty system.
--
-- 1. Every message carries the language it is written in (defaults to the sender's learning
--    language). Corrections are limited to people qualified in that language: a native speaker,
--    or a learner at B1 or above. Enforced here, not only in the UI.
-- 2. Bounty: the sender pays 50 points (held) to put a message in the community queue. People
--    qualified in its language see it, answer with a correction, and when the sender accepts
--    the answer the 50 points go to the helper. Unanswered after 48 hours, or deleted: refunded.
--    All point movements go through award_points() (idempotent, one ledger row per event).
--
-- Values: cost 50, lifetime 48 hours, at most 3 open bounties per person.

-- ---------- Columns ----------
alter table public.messages
  add column if not exists is_bounty         boolean not null default false,
  add column if not exists bounty_cost       int,
  add column if not exists bounty_status     text    not null default 'none' check (bounty_status in ('none', 'open', 'paid', 'refunded')),
  add column if not exists bounty_expires_at timestamptz,
  add column if not exists bounty_paid_to    uuid references public.profiles(id) on delete set null;
alter table public.messages drop constraint if exists messages_bounty_consistent;
alter table public.messages add constraint messages_bounty_consistent check (is_bounty = (bounty_status <> 'none'));
create index if not exists messages_open_bounties_idx on public.messages (bounty_expires_at) where bounty_status = 'open';

-- The provisional bounty columns on saved_phrases (baseline 0031) are replaced by the above.
alter table public.saved_phrases
  drop column if exists bounty_status,
  drop column if exists bounty_cost,
  drop column if exists bounty_asker_id;

-- ---------- Who may correct a message ----------
-- A message with no language tag (older messages) can be corrected by anyone in the chat.
create or replace function public.can_correct_language(p_user uuid, p_language text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_language is null or exists (
    select 1 from public.profiles p
    where p.id = p_user and (
      p.native_language_id = p_language
      or (p.learning_language_id = p_language and p.learning_level in ('B1', 'B2', 'C1', 'C2'))));
$$;

-- ---------- Refund bounties nobody answered (or whose message was deleted) ----------
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
  return n;
end $$;

-- ---------- send_message: language tag + optional bounty ----------
drop function if exists public.send_message(uuid, text, uuid);
create function public.send_message(p_conv uuid, p_body text, p_reply_to uuid default null,
                                    p_language text default null, p_bounty boolean default false)
returns public.messages language plpgsql security definer set search_path = public as $$
declare
  m public.messages; v_other_status text; v_body text := btrim(p_body);
  me public.profiles; v_lang text := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
begin
  perform assert_active();
  if not public.can_access_conversation(p_conv) then raise exception 'conversation_unavailable'; end if;
  if v_body is null or char_length(v_body) = 0 then raise exception 'empty_message'; end if;
  select * into me from public.profiles where id = auth.uid();

  -- The language is one of the sender's own two languages; default is the one they are learning.
  if v_lang is null then
    v_lang := coalesce(me.learning_language_id, me.native_language_id);
  elsif v_lang is distinct from me.native_language_id and v_lang is distinct from me.learning_language_id then
    raise exception 'language_not_yours';
  end if;

  select status into v_other_status from public.conversation_members where conversation_id = p_conv and user_id <> auth.uid();
  -- Until the recipient accepts a request, the sender gets exactly one message.
  if v_other_status = 'request' and exists (select 1 from public.messages where conversation_id = p_conv and sender_id = auth.uid()) then raise exception 'awaiting_acceptance'; end if;
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then raise exception 'rate_limited'; end if;
  if p_reply_to is not null and not exists (select 1 from public.messages where id = p_reply_to and conversation_id = p_conv) then raise exception 'invalid_reply'; end if;

  if coalesce(p_bounty, false) then
    perform public.refund_expired_bounties();
    if v_lang is null then raise exception 'bounty_needs_language'; end if;
    if (select count(*) from public.messages where sender_id = auth.uid() and bounty_status = 'open') >= 3 then raise exception 'too_many_bounties'; end if;
    if me.points_balance < 50 then raise exception 'insufficient_points'; end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body, reply_to, language_id, is_bounty, bounty_cost, bounty_status, bounty_expires_at)
  values (p_conv, auth.uid(), v_body, p_reply_to, v_lang, coalesce(p_bounty, false),
          case when coalesce(p_bounty, false) then 50 end,
          case when coalesce(p_bounty, false) then 'open' else 'none' end,
          case when coalesce(p_bounty, false) then now() + interval '48 hours' end)
  returning * into m;
  if coalesce(p_bounty, false) then
    perform public.award_points(auth.uid(), -50, 'bounty_posted', 'message', m.id);   -- rolls the whole send back if short of points
  end if;
  update public.conversations set last_message_at = m.created_at where id = p_conv;
  update public.conversation_members set last_read_at = m.created_at where conversation_id = p_conv and user_id = auth.uid();
  return m;
end $$;

-- ---------- suggest_correction: only qualified people ----------
create or replace function public.suggest_correction(p_message uuid, p_text text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.messages; v_id uuid;
begin
  perform assert_active();
  select * into m from public.messages where id = p_message;
  if not found or not public.can_access_conversation(m.conversation_id) then raise exception 'conversation_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  if not public.can_correct_language(auth.uid(), m.language_id) then raise exception 'not_qualified_to_correct'; end if;
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), btrim(p_text), p_note) returning id into v_id;
  return v_id;
end $$;

-- ---------- Bounty queue ----------
-- A helper is not a member of the asker's chat, so they answer through this function instead of
-- suggest_correction. The answer lands in the asker's chat as an ordinary pending correction.
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
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), v_text, p_note) returning id into v_id;
  return v_id;
end $$;

create or replace function public.list_open_bounties(p_limit int default 20)
returns table (message_id uuid, body text, language_id text, cost int, expires_at timestamptz, created_at timestamptz,
               asker_id uuid, asker_username text, asker_display_name text, asker_avatar_url text)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  return query
  select m.id, m.body, m.language_id, m.bounty_cost, m.bounty_expires_at, m.created_at,
         p.id, p.username, p.display_name, p.avatar_url
  from public.messages m join public.profiles p on p.id = m.sender_id
  where m.bounty_status = 'open' and m.language_id is not null and m.sender_id <> auth.uid()
    and p.status = 'active' and not public.is_blocked_between(auth.uid(), m.sender_id)
    and public.can_correct_language(auth.uid(), m.language_id)
    and not exists (select 1 from public.message_corrections mc where mc.message_id = m.id and mc.corrector_id = auth.uid())
  order by m.bounty_expires_at asc          -- closest to expiring first
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

create or replace function public.list_my_bounties()
returns table (message_id uuid, conversation_id uuid, body text, language_id text, cost int, status text,
               expires_at timestamptz, created_at timestamptz, answers int)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  return query
  select m.id, m.conversation_id, m.body, m.language_id, m.bounty_cost, m.bounty_status, m.bounty_expires_at, m.created_at,
         (select count(*)::int from public.message_corrections mc where mc.message_id = m.id and mc.status = 'pending')
  from public.messages m
  where m.sender_id = auth.uid() and m.is_bounty
  order by m.created_at desc limit 100;
end $$;

-- ---------- accept_correction: a bounty answer pays the bounty instead of the +5 ----------
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
    return;
  end if;

  -- Ordinary +5, with limits so two accounts cannot farm each other (see baseline 0031).
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
end $$;

-- ---------- Grants (project convention) ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
-- Internal only: these move points. The blanket grant above re-opens them, so close them again.
revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.refund_expired_bounties() from public, anon, authenticated;
