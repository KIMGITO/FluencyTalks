-- 0008: learning history — every translation a user asks for is stored and traceable
-- back to its source message, corrections get a listable history, reactions accept
-- full emoji-picker-react sequences (ZWJ / skin tones), translations join the data export.

-- ---------- Translation history ----------
create table public.translation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 4000),
  translated_text text not null check (char_length(translated_text) between 1 and 4000),
  target_lang text references public.languages(code),
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now());
create index on public.translation_history (user_id, created_at desc);
alter table public.translation_history enable row level security;
create policy "own translations" on public.translation_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stores one row per (user, source text, target language): tapping Translate twice
-- must not spam the history. Only keeps the source link if the message is visible.
create function public.save_translation(p_source text, p_translated text, p_lang text default null, p_source_message uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_source, ''))) = 0 or char_length(btrim(coalesce(p_translated, ''))) = 0 then raise exception 'empty_message'; end if;
  if p_source_message is not null and not exists (select 1 from messages m where m.id = p_source_message and public.can_access_conversation(m.conversation_id)) then p_source_message := null; end if;
  -- Same text translated twice keeps one row (is not distinct from also covers null lang).
  select id into v_id from translation_history
  where user_id = auth.uid() and source_text = left(btrim(p_source), 4000)
    and target_lang is not distinct from p_lang;
  if v_id is not null then return v_id; end if;
  insert into translation_history (user_id, source_text, translated_text, target_lang, source_message_id)
  values (auth.uid(), left(btrim(p_source), 4000), left(btrim(p_translated), 4000), p_lang, p_source_message)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Correction history for the learner ----------
-- Everything that ever corrected MY messages, newest first: original text, who suggested
-- what, the note, the outcome, and the conversation so the row links back to the chat.
create function public.list_my_corrections()
returns table (
  id uuid, message_id uuid, conversation_id uuid, original_text text,
  suggested_text text, note text, status text,
  corrector_id uuid, corrector_name text, corrector_username text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mc.id, mc.message_id, m.conversation_id,
         case when m.deleted_at is null then m.body else '[deleted]' end,
         mc.suggested_text, mc.note, mc.status,
         mc.corrector_id, coalesce(p.display_name, p.username), p.username, mc.created_at
  from message_corrections mc
  join messages m on m.id = mc.message_id
  join profiles p on p.id = mc.corrector_id
  where m.sender_id = auth.uid()
    and (m.deleted_at is null or mc.status <> 'pending')
    and public.can_access_conversation(m.conversation_id)
  order by mc.created_at desc
  limit 200 $$;

-- ---------- Reactions: full emoji sequences from emoji-picker-react ----------
-- ZWJ sequences (family, professions) and skin-tone modifiers exceed 8 characters.
alter table public.message_reactions drop constraint message_reactions_emoji_check;
alter table public.message_reactions add constraint message_reactions_emoji_check check (char_length(emoji) <= 40);

-- ---------- Translations are personal data: include them in the GDPR export ----------
create or replace function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'translations', coalesce((select jsonb_agg(to_jsonb(t)) from translation_history t where t.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'));
end $$;

-- ---------- Re-apply grants: only signed-in users may call functions (mirrors the 0005 block). ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
