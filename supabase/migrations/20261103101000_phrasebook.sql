-- Saved phrases and translation history.

create table public.saved_phrases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  phrase text not null check (char_length(phrase) <= 500),
  translation text,
  language_id text references public.languages(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  is_public boolean not null default false,
  unsplash_image_url text
);
alter table public.saved_phrases enable row level security;
create unique index saved_phrases_user_phrase on public.saved_phrases (user_id, phrase);
create index saved_phrases_public_idx on public.saved_phrases (is_public, created_at desc) where is_public;
create index saved_phrases_user_id_created_at_idx on public.saved_phrases (user_id, created_at desc);
grant delete, select on public.saved_phrases to authenticated;

create table public.translation_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_text text not null check ((char_length(source_text) >= 1) and (char_length(source_text) <= 4000)),
  translated_text text not null check ((char_length(translated_text) >= 1) and (char_length(translated_text) <= 4000)),
  language_id text references public.languages(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.translation_history enable row level security;
create index translation_history_user_id_created_at_idx on public.translation_history (user_id, created_at desc);
grant delete, select on public.translation_history to authenticated;

create function public.save_translation(p_source text, p_translated text, p_lang text default null, p_source_message uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_source, ''))) = 0 or char_length(btrim(coalesce(p_translated, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := public.normalize_language_code(p_lang);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  if p_source_message is not null and not exists (select 1 from messages m where m.id = p_source_message and public.can_access_conversation(m.conversation_id)) then p_source_message := null; end if;
  select t.id into v_id from translation_history t
  where t.user_id = auth.uid() and t.source_text = left(btrim(p_source), 4000)
    and t.language_id is not distinct from v_lang;
  if v_id is not null then return v_id; end if;
  insert into translation_history (user_id, source_text, translated_text, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_source), 4000), left(btrim(p_translated), 4000), v_lang, p_source_message)
  returning id into v_id;
  return v_id;
end $$;

create function public.save_phrase(p_phrase text, p_translation text default null, p_language text default null, p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  if p_source is not null and not exists (select 1 from messages m where m.id = p_source and public.can_access_conversation(m.conversation_id)) then p_source := null; end if;
  insert into saved_phrases (user_id, phrase, translation, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_phrase), 500), left(p_translation, 500), v_lang, p_source)
  on conflict (user_id, phrase) do update set translation = coalesce(excluded.translation, saved_phrases.translation)
  returning id into v_id;
  return v_id;
end $$;

create function public.search_phrases(p_query text default null, p_language text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, phrase text, translation text, language_id text, source_message_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_like text; v_lang text;
begin
  v_like := nullif(btrim(coalesce(p_query, '')), '');
  if v_like is not null then v_like := '%' || replace(replace(replace(v_like, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_like is null then return; end if;
  return query
  select s.id, s.phrase, s.translation, s.language_id, s.source_message_id, s.created_at
  from saved_phrases s
  where s.user_id = auth.uid()
    and (v_lang is null or s.language_id = v_lang)
    and (s.phrase ilike v_like or s.translation ilike v_like)
  order by s.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

create trigger staff_refused before insert on public.saved_phrases for each row execute function public.refuse_staff_learner_action();

create policy "delete own phrases" on public.saved_phrases for delete to authenticated using (auth.uid() = user_id);
create policy "read own phrases" on public.saved_phrases for select to authenticated using (auth.uid() = user_id);
create policy "delete own translations" on public.translation_history for delete to authenticated using (auth.uid() = user_id);
create policy "read own translations" on public.translation_history for select to authenticated using (auth.uid() = user_id);

revoke all on function
  public.save_translation(text, text, text, uuid),
  public.save_phrase(text, text, text, uuid),
  public.search_phrases(text, text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.save_translation(text, text, text, uuid),
  public.save_phrase(text, text, text, uuid),
  public.search_phrases(text, text, integer, integer)
to authenticated, service_role;
