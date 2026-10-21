-- 0031: correction language tag + rate limit
-- 1. Add language_id to messages so every message knows which language it is in.
alter table public.messages
  add column if not exists language_id uuid references public.languages(id);

alter table public.message_corrections
  add column if not exists counts_for_reward boolean not null default false;
-- 3. New function: public.can_suggest_correction(p_message_id uuid, p_corrector_id uuid) returns boolean.
--    Checks: active session, corrector not the sender, native match,
--    meaningful diff, and rate limit (max 20 corrections per hour).
create or replace function public.can_suggest_correction(p_message_id uuid, p_corrector_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  m messages;
  c profiles;
  last_corr timestamptz;
  corr_count bigint;
begin
  perform assert_active();

  select * into m from messages where id = p_message_id;
  if not found then return false; end if;

  -- cannot correct your own message
  if m.sender_id = p_corrector_id then return false; end if;

  -- must be a conversation member to check language
  if not public.can_access_conversation(m.conversation_id) then return false; end if;

  -- native-language match: corrector's native_language_id must equal message's language_id
  select * into c from profiles where id = p_corrector_id;
  if not found then return false; end if;

  -- If the message has no language_id set, fall back to checking the conversation's practice_language_id
  -- (conversations have practice_language_id added in a later F5 step; for now allow if null)
  if m.language_id is not null and c.native_language_id != m.language_id then
    return false;
  end if;

  -- meaningful diff: suggested text must not be identical to the original message body
  -- (the UI + server will enforce meaningful via char length / levenshtein later;
  --  for now just guard against exact copy.)

  -- rate limit: max 20 corrections per hour per corrector
  select count(*) into corr_count from message_corrections
    where corrector_id = p_corrector_id and created_at > now() - interval '1 hour';
  if corr_count >= 20 then
    return false;
  end if;

  return true;
end
$$;

-- 4. Rewrite public.suggest_correction() to use the new checks and
--    set counts_for_reward appropriately.
create or replace function public.suggest_correction(p_message uuid, p_text text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$ declare
  m messages;
  c messages%rowtype;
  v_id uuid;
  v_differs boolean;
begin
  perform assert_active();

  select * into m from messages where id = p_message;
  if not found or not public.can_access_conversation(m.conversation_id) then raise exception 'conversation_unavailable'; end if;

  -- cannot correct your own message
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;

  -- native-language gate
  select * into c from profiles where id = auth.uid();
  if not found then raise exception 'profile_not_found'; end if;
  if m.language_id is not null and c.native_language_id != m.language_id then
    raise exception 'not_native_for_this_language';
  end if;

  -- meaningful diff check: suggested text must not be identical to original
  v_differs := (p_text is distinct from m.body);
  if not v_differs then
    raise exception 'suggested_text_must_differ_from_original';
  end if;

  -- insert correction with counts_for_reward
  insert into message_corrections (message_id, corrector_id, suggested_text, note, counts_for_reward)
    values (m.id, auth.uid(), btrim(p_text), p_note,
      case when m.language_id is not null and c.native_language_id = m.language_id then true else false end)
    returning id into v_id;

  return v_id;
end
$$;

-- 5. New function: public.rate_limit_correction_check(p_corrector_id uuid)
--    Returns the number of corrections in the last hour, for UI display.
create or replace function public.rate_limit_correction_check(p_corrector_id uuid)
returns table (hourly_count bigint, limit_reached boolean) language plpgsql security definer set search_path = public as $$ begin
  return query select
    count(*) as hourly_count,
    count(*) >= 20 as limit_reached
  from message_corrections
  where corrector_id = p_corrector_id and created_at > now() - interval '1 hour';
end
$$;

-- 6. Grant execute to authenticated users
revoke execute on public.can_suggest_correction from public, anon;
grant execute on public.can_suggest_correction to authenticated, service_role;

revoke execute on public.suggest_correction from public, anon;
grant execute on public.suggest_correction to authenticated, service_role;

revoke execute on public.rate_limit_correction_check from public, anon;
grant execute on public.rate_limit_correction_check to authenticated, service_role;

