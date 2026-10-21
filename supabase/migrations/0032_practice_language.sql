-- 0032: Conversation practice_language_id for message language tagging.
-- Adds practice_language_id to conversations and a trigger to set message language on insert.

-- ---------- Add practice_language_id to conversations ----------

alter table public.conversations
  add column if not exists practice_language_id text references public.languages(id);

-- ---------- Backfill: set practice_language_id from the first active member's native language ----------

update public.conversations c
set practice_language_id = (
  select p.native_language_id
  from public.profiles p
  join public.conversation_members cm on cm.user_id = p.id
  where cm.conversation_id = c.id and cm.status = 'active'
  order by p.native_language_id
  limit 1
) where practice_language_id is null;

-- ---------- Trigger: set message language on insert ----------

create or replace function public.set_message_language_on_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- if the new message doesn't have a language_id set, use the conversation's practice_language_id
  if new.language_id is null then
    select practice_language_id into new.language_id from public.conversations where id = new.conversation_id;
  end if;
  return new;
end $$;

create trigger messages_set_language_before_insert
before insert on public.messages
for each row execute procedure public.set_message_language_on_insert();