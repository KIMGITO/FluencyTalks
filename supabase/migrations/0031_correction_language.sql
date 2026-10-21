-- 0031: Correction language tag + rate limit.
-- Adds language_id to messages and creates can_suggest_correction function with rate limiting.

-- ---------- Add language_id to messages ----------

alter table public.messages
  add column if not exists language_id uuid references public.languages(id);

-- ---------- Add counts_for_reward to message_corrections ----------

alter table public.message_corrections
  add column if not exists counts_for_reward boolean not null default false;

-- ---------- can_suggest_correction function ----------

create or replace function public.can_suggest_correction(p_message_id uuid, p_corrector_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
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

  if m.language_id is not null and c.native_language_id != m.language_id then
    return false;
  end if;

  -- meaningful diff: suggested text must not be identical to the original message body
  if coalesce(m.body, '') = coalesce((select suggested_text from message_corrections mc where mc.message_id = p_message_id order by mc.created_at desc limit 1), '') then
    return false;
  end if;

  -- rate limit: max 20 corrections per hour per corrector
  select count(*) into corr_count from message_corrections
    where corrector_id = p_corrector_id and created_at > now() - interval '1 hour';
  if corr_count >= 20 then
    return false;
  end if;

  return true;
end $$;