-- 0011: ISO 639-3 everywhere. A language is identified by the 3-letter code of the
-- standard, and nothing else -- no free-form strings, no app-specific abbreviations.
--
-- Before: public.languages(code, name, native_name, rtl) held a hand-written list of
-- 2-letter pseudo-codes ("zh", "sw", "jw"), and user_languages repeated that free text in
-- its own column. A typo stored a language that could never match anybody.
-- After:  public.languages is the single lookup, keyed by its ISO 639-3 id, and every
-- column that used to carry a string now carries that id:
--   user_languages.language_id       -> languages(id) on delete cascade
--   saved_phrases.language_id        -> languages(id) on delete set null
--   translation_history.language_id  -> languages(id) on delete set null
--
-- Rows already in the database are mapped through the only codes 0002 ever shipped, so no
-- profile loses a language. supabase/seed.sql then loads the curated list of 100 languages
-- (English + native names, ISO 639-1 where one exists, all offered as learning options).

begin;

-- ---------- 1. Release the old primary key ----------
alter table public.user_languages      drop constraint if exists user_languages_language_fk;
alter table public.saved_phrases       drop constraint if exists saved_phrases_language_code_fkey;
alter table public.translation_history drop constraint if exists translation_history_target_lang_fkey;
drop index if exists public.user_languages_language_code_role_level_idx;

-- ---------- 2. The lookup table, rebuilt on the standard ----------
drop table if exists public.languages;
create table public.languages (
  id                    text primary key check (id ~ '^[a-z]{3}$'),   -- ISO 639-3, always lowercase
  iso_639_1             text unique check (iso_639_1 is null or iso_639_1 ~ '^[a-z]{2}$'),  -- null when the standard has none
  english_name          text not null check (char_length(btrim(english_name)) between 1 and 80),
  native_name           text check (native_name is null or char_length(btrim(native_name)) between 1 and 80),  -- autonym, in its own script
  is_supported_learning boolean not null default true                 -- false keeps a language off every picker
);
comment on column public.languages.id is 'ISO 639-3 3-letter code; the only identifier the app stores';
comment on column public.languages.native_name is 'Autonym in the language''s own script; what the UI shows, English is the fallback';
comment on column public.languages.is_supported_learning is 'Offered in onboarding, the picker and the search filters';
create index languages_supported_learning_idx on public.languages (is_supported_learning, english_name);

alter table public.languages enable row level security;
create policy "languages public read" on public.languages for select using (true);
grant select on public.languages to anon, authenticated, service_role;

-- The 20 rows 0002 shipped, in their ISO 639-3 form: enough to carry existing profiles over.
-- seed.sql refreshes the names and adds the rest of the curated list. Note that the old 'zh'
-- split into the macrolanguage 'zho' (which keeps alpha-2 'zh') and Mandarin 'cmn' (which has
-- none), and that 'fa' became 'pes' (Persian) rather than the Dari 'prs'.
insert into public.languages (id, iso_639_1, english_name, native_name, is_supported_learning) values
  ('eng','en','English','English',true),        ('spa','es','Spanish','Español',true),
  ('fra','fr','French','Français',true),        ('deu','de','German','Deutsch',true),
  ('ita','it','Italian','Italiano',true),        ('por','pt','Portuguese','Português',true),
  ('swh','sw','Swahili','Kiswahili',true),      ('ara','ar','Arabic','العربية',true),
  ('heb','he','Hebrew','עברית',true),            ('pes','fa','Persian','فارسی',true),
  ('zho','zh','Chinese','中文',true),            ('cmn',null,'Mandarin Chinese','普通话',true),
  ('jpn','ja','Japanese','日本語',true),          ('kor','ko','Korean','한국어',true),
  ('hin','hi','Hindi','हिन्दी',true),             ('rus','ru','Russian','Русский',true),
  ('tur','tr','Turkish','Türkçe',true),          ('nld','nl','Dutch','Nederlands',true),
  ('amh','am','Amharic','አማርኛ',true),             ('yor','yo','Yoruba','Yorùbá',true),
  ('ind','id','Indonesian','Bahasa Indonesia',true)
on conflict (id) do nothing;

-- Every filter, form and RPC argument goes through this before it reaches a query, so
-- 'ENG', ' eng ' and 'Eng' all mean the same row, and anything that is not an ISO 639-3
-- code becomes null -- "no filter" rather than a search that can never match. The pattern is
-- the same one the primary key enforces, so this is a check and not a second opinion.
create or replace function public.normalize_language_code(p_code text) returns text
  language sql immutable as $$
  select case when lower(btrim(coalesce(p_code, ''))) ~ '^[a-z]{3}$'
              then lower(regexp_replace(btrim(coalesce(p_code, '')), '\s+', '', 'g'))
         end $$;

comment on function public.normalize_language_code(text) is
  'Canonical ISO 639-3 code: lower-cased, and null for anything that is not a well-formed 3-letter code (so a junk string means "no filter").';

-- ---------- 3. One code, one meaning ----------
-- The only legacy codes 0002 could have written, so no row is orphaned by the swap.
-- Kept in one place on purpose: add a mapping here only when a real database has old rows.
create or replace function public.legacy_language_id(p_code text) returns text
  language sql immutable as $$
  select m.new_id from (values
    ('en','eng'),('es','spa'),('fr','fra'),('de','deu'),('it','ita'),('pt','por'),('sw','swh'),
    ('ar','ara'),('he','heb'),('fa','pes'),('zh','cmn'),('ja','jpn'),('ko','kor'),('hi','hin'),
    ('ru','rus'),('tr','tur'),('nl','nld'),('am','amh'),('yo','yor'),('id','ind')) as m(old_id, new_id)
  where m.old_id = lower(btrim(coalesce(p_code, ''))) $$;

-- user_languages: swap the text column for the foreign key, then make it mandatory.
alter table public.user_languages add column language_id text references public.languages(id) on delete cascade;
update public.user_languages ul set language_id = public.legacy_language_id(ul.language_code);
-- A code the standard does not define cannot be expressed as an id, so that row goes.
delete from public.user_languages ul where ul.language_id is null
  or not exists (select 1 from public.languages l where l.id = ul.language_id);
alter table public.user_languages drop column language_code;   -- this also drops the old primary key, which used that column
alter table public.user_languages alter column language_id set not null;
-- The same key, now over the real reference: one row per (user, language, role).
alter table public.user_languages add constraint user_languages_pkey primary key (user_id, language_id, role);
create index user_languages_language_role_level_idx on public.user_languages (language_id, role, level);

-- The phrasebook and the translation history keep pointing at the same lookup.
alter table public.saved_phrases rename column language_code to language_id;
update public.saved_phrases s set language_id = public.legacy_language_id(s.language_id);
delete from public.saved_phrases s where s.language_id is not null
  and not exists (select 1 from public.languages l where l.id = s.language_id);
alter table public.saved_phrases add constraint saved_phrases_language_id_fkey
  foreign key (language_id) references public.languages(id) on delete set null;

alter table public.translation_history rename column target_lang to language_id;
update public.translation_history t set language_id = public.legacy_language_id(t.language_id);
delete from public.translation_history t where t.language_id is not null
  and not exists (select 1 from public.languages l where l.id = t.language_id);
alter table public.translation_history add constraint translation_history_language_id_fkey
  foreign key (language_id) references public.languages(id) on delete set null;

-- ---------- 4. Writes: only ids go in ----------
-- Reads the ISO 639-3 key and normalises it; `language_code` is accepted as a legacy alias
-- so a client that has not been rebuilt yet cannot store a value that silently disappears.
-- An id the table does not have is dropped rather than stored, but a bad role or level is a
-- client bug and fails the whole call -- a half-saved language list is worse than an error.
create or replace function public.set_my_languages(p_languages jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if jsonb_typeof(p_languages) <> 'array' or jsonb_array_length(p_languages) > 12 then raise exception 'invalid_languages'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_languages) as x(role text, level text)
    where x.role is null or x.role not in ('native', 'learning')
       or x.level is null or x.level not in ('A1','A2','B1','B2','C1','C2','Native')
  ) then raise exception 'invalid_languages'; end if;
  delete from public.user_languages where user_id = auth.uid();
  -- The join is the whitelist: an id the table does not have is dropped, not stored.
  insert into public.user_languages (user_id, language_id, role, level)
  select auth.uid(), v.language_id, x.role, x.level
  from jsonb_to_recordset(p_languages) as x(language_id text, language_code text, role text, level text)
  cross join lateral (select public.normalize_language_code(coalesce(x.language_id, x.language_code)) as language_id) v
  join public.languages l on l.id = v.language_id
  on conflict do nothing;   -- the same language listed twice is not an error
end $$;

-- ---------- 5. Reads: the ids come back joined, carrying their display name ----------
-- Every person-shaped payload returns `languages` as
-- { language_id, role, level, native_name, english_name }, so a card can print the autonym
-- without a second round trip and still fall back to English when there is no native script.
create or replace function public.user_languages_json(p_user uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'language_id', ul.language_id, 'role', ul.role, 'level', ul.level,
      'native_name', l.native_name, 'english_name', l.english_name)
      order by l.english_name)
    from public.user_languages ul join public.languages l on l.id = ul.language_id
    where ul.user_id = p_user), '[]'::jsonb) $$;

drop function if exists public.get_profile(text);
create function public.get_profile(p_username text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v profiles;
begin
  select * into v from profiles where lower(username) = lower(p_username) and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), v.id) then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'username', v.username, 'display_name', v.display_name, 'avatar_url', v.avatar_url, 'bio', v.bio,
    'timezone', v.timezone, 'country_code', v.country_code, 'is_private', v.is_private,
    'followers_count', v.followers_count, 'following_count', v.following_count,
    'languages', public.user_languages_json(v.id),
    'relationship', jsonb_build_object(
      'is_me', v.id = auth.uid(),
      'following', (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = v.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = v.id and f.followee_id = auth.uid() and f.status = 'accepted')));
end $$;

-- ---------- 6. search_people: relational matching on fixed identifiers ----------
-- p_language is an ISO 639-3 id. It is lower-cased here, and an id the table does not have
-- is treated as "no language filter" instead of a query that silently returns nobody.
drop function if exists public.search_people(text, text, text, text, text, int, int);
create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text; v_role text; v_level text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;

  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  v_role := nullif(btrim(coalesce(p_role, '')), '');
  if v_role is not null and v_role not in ('native', 'learning') then v_role := null; end if;
  v_level := nullif(btrim(coalesce(p_level, '')), '');
  if v_level is not null and v_level not in ('A1','A2','B1','B2','C1','C2','Native') then v_level := null; end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count,
    public.user_languages_json(p.id),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    -- One user_languages row has to satisfy every filter at once, and each filter also works
    -- on its own. The join to languages is what makes the id a real reference, not a string.
    and ((v_lang is null and v_role is null and v_level is null)
      or exists (select 1 from user_languages ul
           join languages l on l.id = ul.language_id
           where ul.user_id = p.id
             and (v_lang is null or l.id = v_lang)
             and (v_role is null or ul.role = v_role)
             and (v_level is null or ul.level = v_level)))
  -- Relevance first: exact handle, then handle prefix, then name prefix, then anything else.
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

-- ---------- 7. home_feed: the same identifiers, matched both ways ----------
--   'native'   = speaks natively a language I am learning            -> can teach me
--   'learning' = is learning one of my languages, or speaks natively a language I speak
--   'other'    = nothing in common                                   -> the rest of the app
drop function if exists public.home_feed(int, int);
create function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    -- Empty arrays (no languages yet) simply match nobody, so everyone lands in 'other'.
    select array(select ul.language_id from user_languages ul where ul.user_id = auth.uid() and ul.role = 'native')   as native_langs,
           array(select ul.language_id from user_languages ul where ul.user_id = auth.uid() and ul.role = 'learning') as learning_langs
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      public.user_languages_json(p.id) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ul.role = 'native' and ul.language_id = any(mine.learning_langs)) then 'native'
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ((ul.role = 'learning' and ul.language_id = any(mine.native_langs))
               or (ul.role = 'learning' and ul.language_id = any(mine.learning_langs))
               or (ul.role = 'native'  and ul.language_id = any(mine.native_langs)))) then 'learning'
        else 'other'
      end as match_kind,
      -- Why they matched, for the badge on the card. First hit wins: what they can teach me,
      -- then what they want to learn, then the language we practise together, then the one we share.
      coalesce(
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_id = any(mine.learning_langs) order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_id = any(mine.native_langs)   order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_id = any(mine.learning_langs) order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_id = any(mine.native_langs)   order by ul.language_id limit 1)
      ) as match_language
    from profiles p cross join mine
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  -- Every column is table-qualified: plpgsql would treat a bare "id" or "languages" as the
  -- function's OUT parameter and refuse the query as ambiguous.
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language
  from (
    (select c.* from candidates c where c.match_kind = 'native'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'learning'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'other'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) feed
  -- Partners first, everyone else after: the two lists the page draws, already in order.
  order by (feed.match_kind = 'other'), feed.followers_count desc, feed.created_at desc;
end $$;

-- ---------- 8. Learning history: an ISO 639-3 id, or nothing at all ----------
-- p_lang / p_language are ISO 639-3 ids, same rule as search_people: normalised, and
-- dropped when the table has no such id, so history never records a code that means nothing.
create or replace function public.save_translation(p_source text, p_translated text, p_lang text default null, p_source_message uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_source, ''))) = 0 or char_length(btrim(coalesce(p_translated, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := public.normalize_language_code(p_lang);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  if p_source_message is not null and not exists (select 1 from messages m where m.id = p_source_message and public.can_access_conversation(m.conversation_id)) then p_source_message := null; end if;
  -- Same text translated twice keeps one row (is not distinct from also covers no language).
  select t.id into v_id from translation_history t
  where t.user_id = auth.uid() and t.source_text = left(btrim(p_source), 4000)
    and t.language_id is not distinct from v_lang;
  if v_id is not null then return v_id; end if;
  insert into translation_history (user_id, source_text, translated_text, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_source), 4000), left(btrim(p_translated), 4000), v_lang, p_source_message)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_phrase(p_phrase text, p_translation text default null, p_language text default null, p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  -- Only keep the source link if I can actually see that message.
  if p_source is not null and not exists (select 1 from messages m where m.id = p_source and public.can_access_conversation(m.conversation_id)) then p_source := null; end if;
  insert into saved_phrases (user_id, phrase, translation, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_phrase), 500), left(p_translation, 500), v_lang, p_source)
  on conflict (user_id, phrase) do update set translation = coalesce(excluded.translation, saved_phrases.translation)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- 9. Grants: reference data is readable by anyone, RPCs stay signed-in only ----------
revoke all on function public.save_profile(text, text, text, text, boolean, text, text) from public, anon;
revoke all on function public.get_profile(text) from public, anon;
revoke all on function public.search_people(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.home_feed(int, int) from public, anon;
revoke all on function public.user_languages_json(uuid) from public, anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

commit;