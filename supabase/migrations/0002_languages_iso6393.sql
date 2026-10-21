-- 0002: ISO 639-3 language reference table.
-- Replaces the hand-written languages list in 0002_core_functions.sql.
-- All language references (user_languages.language_id, saved_phrases.language_id, translation_history.language_id)
-- now reference public.languages(id) instead of free-form language codes.

-- ---------- Drop old languages table and constraints (safe to re-apply) ----------

drop table if exists public.languages;
alter table if exists public.user_languages drop constraint if exists user_languages_language_fk;
alter table if exists public.saved_phrases drop constraint if exists saved_phrases_language_code_fkey;
alter table if exists public.translation_history drop constraint if exists translation_history_target_lang_fkey;
drop index if exists user_languages_language_code_role_level_idx;

-- ---------- New ISO 639-3 languages table ----------

create table public.languages (
  id text primary key check (id ~ '^[a-z]{3}$'),           -- ISO 639-3, always lowercase
  iso_639_1 text check (iso_639_1 is null or iso_639_1 ~ '^[a-z]{2}$'), -- null when standard has none
  english_name text not null check (char_length(btrim(english_name)) between 1 and 80),
  native_name text check (native_name is null or char_length(btrim(native_name)) between 1 and 80), -- autonym
  is_supported_learning boolean not null default true     -- false keeps a language off every picker
);

comment on column public.languages.id is 'ISO 639-3 3-letter code; the only identifier the app stores';
comment on column public.languages.native_name is 'Autonym in the language''s own script; what the UI shows, English is the fallback';
comment on column public.languages.is_supported_learning is 'Offered in onboarding, the picker and the search filters';

create index languages_supported_learning_idx on public.languages (is_supported_learning, english_name);

alter table public.languages enable row level security;
create policy "languages public read" on public.languages for select using (true);
grant select on public.languages to anon, authenticated, service_role;

-- ---------- ISO 639-3 lookup rows (core languages) ----------

insert into public.languages (id, iso_639_1, english_name, native_name, is_supported_learning) values
  ('eng','en','English','English',true),
  ('spa','es','Spanish','Español',true),
  ('fra','fr','French','Français',true),
  ('deu','de','German','Deutsch',true),
  ('ita','it','Italian','Italiano',true),
  ('por','pt','Portuguese','Português',true),
  ('swl','sw','Swahili','Kiswahili',true),
  ('ara','ar','Arabic','العربية',true),
  ('heb','he','Hebrew','עברית',true),
  ('fas','fa','Persian','فارسی',true),
  ('zho','zh','Chinese','中文',true),
  ('jpn','ja','Japanese','日本語',true),
  ('kor','ko','Korean','한국어',true),
  ('hin','hi','Hindi','हिन्दी',true),
  ('rus','ru','Russian','Русский',true),
  ('tur','tr','Turkish','Türkçe',true),
  ('nld','nl','Dutch','Nederlands',true),
  ('amh','am','Amharic','አማርኛ',true),
  ('yor','yo','Yoruba','Yorùbá',true),
  ('ind','id','Indonesian','Bahasa Indonesia',true)
on conflict (id) do update
  set iso_639_1             = excluded.iso_639_1,
      english_name          = excluded.english_name,
      native_name           = excluded.native_name,
      is_supported_learning = excluded.is_supported_learning;
