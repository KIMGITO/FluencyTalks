-- 0006: Learning history — translation history and correction history.
-- Stands alone; no other file merges into this concept.

-- ---------- Translation History ----------

create table public.translation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 4000),
  translated_text text not null check (char_length(translated_text) between 1 and 4000),
  target_lang text references public.languages(code),
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.translation_history (user_id, created_at desc);

alter table public.translation_history enable row level security;
create policy "own translations" on public.translation_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- save_translation function ----------

create or replace function public.save_translation(p_source text, p_translated text, p_lang text default null, p_source_message uuid default null) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_source, ''))) = 0 or char_length(btrim(coalesce(p_translated, ''))) = 0 then raise exception 'empty_message'; end if;
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

-- ---------- List my corrections ----------

create or replace function public.list_my_corrections() returns table (
  id uuid, message_id uuid, conversation_id uuid, original_text text,
  suggested_text text, note text, status text,
  corrector_id uuid, corrector_name text, corrector_username text, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select mc.id, mc.message_id, m.conversation_id,
         case when m.deleted_at is null then m.body else '[deleted]' end,
         mc.suggested_text, mc.note, mc.status,
         mc.corrector_id, coalesce(p.display_name, p.username), p.username, mc.created_at
  from message_corrections mc
  join messages m on m.id = mc.message_id
  join profiles p on p.id = mc.corrector_id
  where m.sender_id = auth.uid()
    and m.deleted_at is null and m.body <> '[deleted]'
    and public.can_access_conversation(m.conversation_id)
  order by mc.created_at desc;
$$;