-- 0032: conversation practice_language_id for message language tagging
--
-- Adds practice_language_id to conversations so messages can default
-- to the language being practiced. This enables F5 (Direct Message Bridging)
-- and supports F4 correction language matching.
--
-- 1. Add practice_language_id to conversations table
--
alter table public.conversations
  add column if not exists practice_language_id uuid references public.languages(id);
--
-- 2. Backfill: set practice_language_id from the conversation members
--    (simplified: for each conversation, try to find a member whose role matches)
--
update public.conversations c
set practice_language_id = m.language_id
from (
  select conv.id, l.language_id
  from public.conversation_members cm
  join public.profiles p on p.id = cm.user_id
  join public.languages l on l.id = p.native_language_id
  where cm.status = 'active
) m on m.id = c.id;
--
-- 3. Make message.language_id default to conversation
--    practice_language_id when inserting new messages.
--    This is handled by the application layer and/or a trigger.
--
-- 4. Grant execute considerations handled in migration 0031
;
