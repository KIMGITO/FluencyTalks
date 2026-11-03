-- Extensions, default privileges, language and country lists, and helpers with no table of their own.

alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

create table public.languages (
  id text primary key check (id ~ '^[a-z]{3}$'),
  iso_639_1 text check ((iso_639_1 is null) or (iso_639_1 ~ '^[a-z]{2}$')) unique,
  english_name text not null check ((char_length(btrim(english_name)) >= 1) and (char_length(btrim(english_name)) <= 80)),
  native_name text check ((native_name is null) or ((char_length(btrim(native_name)) >= 1) and (char_length(btrim(native_name)) <= 80))),
  is_supported_learning boolean not null default true
);
alter table public.languages enable row level security;
create index languages_supported_learning_idx on public.languages (is_supported_learning, english_name);
grant select on public.languages to anon, authenticated, service_role;

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null
);
alter table public.countries enable row level security;
create index countries_name_idx on public.countries (name);
grant select on public.countries to anon, authenticated;

comment on column public.languages.id is 'ISO 639-3 3-letter code; the only identifier the app stores';
comment on column public.languages.native_name is 'Autonym in the language''s own script; what the UI shows, English is the fallback';
comment on column public.languages.is_supported_learning is 'Offered in onboarding, the picker and the search filters';

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create function public.email_hash(p_email text) returns text language sql immutable as $$
  select encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex') $$;

create function public.normalize_language_code(p_code text) returns text
  language sql immutable as $$
  select case when lower(btrim(coalesce(p_code, ''))) ~ '^[a-z]{3}$'
              then lower(regexp_replace(btrim(coalesce(p_code, '')), '\s+', '', 'g'))
         end $$;
comment on function public.normalize_language_code(text) is
  'Canonical ISO 639-3 code: lower-cased, and null for anything that is not a well-formed 3-letter code (so a junk string means "no filter").';

create function public.legacy_language_id(p_code text) returns text
  language sql immutable as $$
  select m.new_id from (values
    ('en','eng'),('es','spa'),('fr','fra'),('de','deu'),('it','ita'),('pt','por'),('sw','swh'),
    ('ar','ara'),('he','heb'),('fa','pes'),('zh','cmn'),('ja','jpn'),('ko','kor'),('hi','hin'),
    ('ru','rus'),('tr','tur'),('nl','nld'),('am','amh'),('yo','yor'),('id','ind')) as m(old_id, new_id)
  where m.old_id = lower(btrim(coalesce(p_code, ''))) $$;

create function public.tz_hours_apart(p_a text, p_b text) returns numeric
language plpgsql stable set search_path = public as $$
declare v_diff numeric;
begin
  v_diff := abs(extract(epoch from (now() at time zone p_a) - (now() at time zone p_b))) / 3600;
  return least(v_diff, 24 - v_diff);
exception when others then
  return null;
end $$;

create function public.level_rank(p_level text) returns int language sql immutable as $$
  select coalesce(array_position(array['A1','A2','B1','B2','C1','C2'], p_level), 0);
$$;

create policy "countries public read" on public.countries for select using (true);
create policy "languages public read" on public.languages for select using (true);

revoke all on function
  public.touch_updated_at(),
  public.email_hash(text),
  public.normalize_language_code(text),
  public.legacy_language_id(text),
  public.tz_hours_apart(text, text),
  public.level_rank(text)
from public, anon, authenticated, service_role;

grant execute on function
  public.touch_updated_at(),
  public.email_hash(text),
  public.normalize_language_code(text),
  public.legacy_language_id(text),
  public.level_rank(text)
to authenticated, service_role;

grant execute on function
  public.tz_hours_apart(text, text)
to service_role;
