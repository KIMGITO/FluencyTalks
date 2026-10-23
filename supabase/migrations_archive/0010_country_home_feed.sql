-- 0010: country on the profile + the Home feed.
-- Two things: profiles get a country (a flag everywhere, derived from the timezone until
-- the user picks one themselves) and home_feed() becomes the Home list: people who share
-- one of my languages first, everyone else after a divider.

-- ---------- Countries reference (ISO 3166-1 alpha-2; the flag is derived from the code client-side) ----------
-- Written to be re-appliable: the table, the rows and the policy are all guarded, so a
-- re-run refreshes the list instead of failing on the objects it already created.
create table if not exists public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null
);
insert into public.countries (code, name) values
  ('AD','Andorra'),('AE','United Arab Emirates'),('AF','Afghanistan'),('AG','Antigua & Barbuda'),('AI','Anguilla'),
  ('AL','Albania'),('AM','Armenia'),('AO','Angola'),('AQ','Antarctica'),('AR','Argentina'),
  ('AS','American Samoa'),('AT','Austria'),('AU','Australia'),('AW','Aruba'),('AX','Åland Islands'),
  ('AZ','Azerbaijan'),('BA','Bosnia & Herzegovina'),('BB','Barbados'),('BD','Bangladesh'),('BE','Belgium'),
  ('BF','Burkina Faso'),('BG','Bulgaria'),('BH','Bahrain'),('BI','Burundi'),('BJ','Benin'),
  ('BL','Saint Barthélemy'),('BM','Bermuda'),('BN','Brunei'),('BO','Bolivia'),('BQ','Caribbean Netherlands'),
  ('BR','Brazil'),('BS','Bahamas'),('BT','Bhutan'),('BV','Bouvet Island'),('BW','Botswana'),
  ('BY','Belarus'),('BZ','Belize'),('CA','Canada'),('CC','Cocos (Keeling) Islands'),('CD','DR Congo'),
  ('CF','Central African Republic'),('CG','Republic of the Congo'),('CH','Switzerland'),('CI','Côte d’Ivoire'),('CK','Cook Islands'),
  ('CL','Chile'),('CM','Cameroon'),('CN','China'),('CO','Colombia'),('CR','Costa Rica'),
  ('CU','Cuba'),('CV','Cape Verde'),('CW','Curaçao'),('CX','Christmas Island'),('CY','Cyprus'),
  ('CZ','Czechia'),('DE','Germany'),('DJ','Djibouti'),('DK','Denmark'),('DM','Dominica'),
  ('DO','Dominican Republic'),('DZ','Algeria'),('EC','Ecuador'),('EE','Estonia'),('EG','Egypt'),
  ('EH','Western Sahara'),('ER','Eritrea'),('ES','Spain'),('ET','Ethiopia'),('FI','Finland'),
  ('FJ','Fiji'),('FK','Falkland Islands'),('FM','Micronesia'),('FO','Faroe Islands'),('FR','France'),
  ('GA','Gabon'),('GB','United Kingdom'),('GD','Grenada'),('GE','Georgia'),('GF','French Guiana'),
  ('GG','Guernsey'),('GH','Ghana'),('GI','Gibraltar'),('GL','Greenland'),('GM','Gambia'),
  ('GN','Guinea'),('GP','Guadeloupe'),('GQ','Equatorial Guinea'),('GR','Greece'),('GS','South Georgia & South Sandwich Islands'),
  ('GT','Guatemala'),('GU','Guam'),('GW','Guinea-Bissau'),('GY','Guyana'),('HK','Hong Kong'),
  ('HM','Heard & McDonald Islands'),('HN','Honduras'),('HR','Croatia'),('HT','Haiti'),('HU','Hungary'),
  ('ID','Indonesia'),('IE','Ireland'),('IL','Israel'),('IM','Isle of Man'),('IN','India'),
  ('IO','British Indian Ocean Territory'),('IQ','Iraq'),('IR','Iran'),('IS','Iceland'),('IT','Italy'),
  ('JE','Jersey'),('JM','Jamaica'),('JO','Jordan'),('JP','Japan'),('KE','Kenya'),
  ('KG','Kyrgyzstan'),('KH','Cambodia'),('KI','Kiribati'),('KM','Comoros'),('KN','St. Kitts & Nevis'),
  ('KP','North Korea'),('KR','South Korea'),('KW','Kuwait'),('KY','Cayman Islands'),('KZ','Kazakhstan'),
  ('LA','Laos'),('LB','Lebanon'),('LC','St. Lucia'),('LI','Liechtenstein'),('LK','Sri Lanka'),
  ('LR','Liberia'),('LS','Lesotho'),('LT','Lithuania'),('LU','Luxembourg'),('LV','Latvia'),
  ('LY','Libya'),('MA','Morocco'),('MC','Monaco'),('MD','Moldova'),('ME','Montenegro'),
  ('MF','Saint Martin'),('MG','Madagascar'),('MH','Marshall Islands'),('MK','North Macedonia'),('ML','Mali'),
  ('MM','Myanmar'),('MN','Mongolia'),('MO','Macao'),('MP','Northern Mariana Islands'),('MQ','Martinique'),
  ('MR','Mauritania'),('MS','Montserrat'),('MT','Malta'),('MU','Mauritius'),('MV','Maldives'),
  ('MW','Malawi'),('MX','Mexico'),('MY','Malaysia'),('MZ','Mozambique'),('NA','Namibia'),
  ('NC','New Caledonia'),('NE','Niger'),('NF','Norfolk Island'),('NG','Nigeria'),('NI','Nicaragua'),
  ('NL','Netherlands'),('NO','Norway'),('NP','Nepal'),('NR','Nauru'),('NU','Niue'),
  ('NZ','New Zealand'),('OM','Oman'),('PA','Panama'),('PE','Peru'),('PF','French Polynesia'),
  ('PG','Papua New Guinea'),('PH','Philippines'),('PK','Pakistan'),('PL','Poland'),('PM','St. Pierre & Miquelon'),
  ('PN','Pitcairn Islands'),('PR','Puerto Rico'),('PS','Palestine'),('PT','Portugal'),('PW','Palau'),
  ('PY','Paraguay'),('QA','Qatar'),('RE','Réunion'),('RO','Romania'),('RS','Serbia'),
  ('RU','Russia'),('RW','Rwanda'),('SA','Saudi Arabia'),('SB','Solomon Islands'),('SC','Seychelles'),
  ('SD','Sudan'),('SE','Sweden'),('SG','Singapore'),('SH','St. Helena'),('SI','Slovenia'),
  ('SJ','Svalbard & Jan Mayen'),('SK','Slovakia'),('SL','Sierra Leone'),('SM','San Marino'),('SN','Senegal'),
  ('SO','Somalia'),('SR','Suriname'),('SS','South Sudan'),('ST','São Tomé & Príncipe'),('SV','El Salvador'),
  ('SX','Sint Maarten'),('SY','Syria'),('SZ','Eswatini'),('TC','Turks & Caicos Islands'),('TD','Chad'),
  ('TF','French Southern Territories'),('TG','Togo'),('TH','Thailand'),('TJ','Tajikistan'),('TK','Tokelau'),
  ('TL','Timor-Leste'),('TM','Turkmenistan'),('TN','Tunisia'),('TO','Tonga'),('TR','Turkey'),
  ('TT','Trinidad & Tobago'),('TV','Tuvalu'),('TW','Taiwan'),('TZ','Tanzania'),('UA','Ukraine'),
  ('UG','Uganda'),('UM','U.S. Outlying Islands'),('US','United States'),('UY','Uruguay'),('UZ','Uzbekistan'),
  ('VA','Vatican City'),('VC','St. Vincent & Grenadines'),('VE','Venezuela'),('VG','British Virgin Islands'),('VI','U.S. Virgin Islands'),
  ('VN','Vietnam'),('VU','Vanuatu'),('WF','Wallis & Futuna'),('WS','Samoa'),('YE','Yemen'),
  ('YT','Mayotte'),('ZA','South Africa'),('ZM','Zambia'),('ZW','Zimbabwe')
-- Upsert rather than plain insert: a re-run corrects a spelling without duplicating rows,
-- and the `where` keeps it a no-op when nothing changed (so the table is left untouched).
on conflict (code) do update set name = excluded.name where public.countries.name is distinct from excluded.name;
alter table public.countries enable row level security;
drop policy if exists "countries public read" on public.countries;
create policy "countries public read" on public.countries for select using (true);
-- CREATE INDEX has no IF NOT EXISTS, so the index is named and dropped first (same
-- pattern as the policies in 0002). Unnamed indexes would collide on a re-apply.
drop index if exists public.countries_name_idx;
create index countries_name_idx on public.countries (name);

-- ---------- Country column: NULL means "serve my country from my timezone" ----------
alter table public.profiles add column if not exists country_code text references public.countries(code) on delete set null;
-- ---------- save_profile: one extra argument (p_country) ----------
-- Both the old (0002) and the new signature are dropped first, so this file can be
-- re-applied: create function fails outright if the signature already exists.
drop function if exists public.save_profile(text, text, text, text, boolean, text);
drop function if exists public.save_profile(text, text, text, text, boolean, text, text);
create function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_country text;
begin
  perform assert_active();
  -- An empty or unknown country is stored as NULL, i.e. "derive it from my timezone".
  select c.code into v_country from public.countries c where c.code = upper(btrim(coalesce(p_country, '')));
  update profiles set username = lower(p_username), display_name = left(btrim(p_display_name), 60), bio = left(coalesce(p_bio, ''), 300),
    timezone = p_timezone, is_private = coalesce(p_is_private, false), avatar_url = coalesce(p_avatar_url, avatar_url),
    country_code = v_country
  where id = auth.uid();
  if exists (select 1 from profiles where id = auth.uid() and username is not null) and exists (select 1 from user_languages where user_id = auth.uid()) then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set onboarding_done = true where id = auth.uid();
  end if;
end $$;

-- ---------- get_profile: same JSON plus country_code ----------
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
    'languages', coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = v.id), '[]'::jsonb),
    'relationship', jsonb_build_object(
      'is_me', v.id = auth.uid(),
      'following', (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = v.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = v.id and f.followee_id = auth.uid() and f.status = 'accepted')));
end $$;

-- ---------- search_people: unchanged except for country_code in the row ----------
drop function if exists public.search_people(text, text, text, text, text, int, int);
create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count,
    coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    -- One user_language row has to satisfy every filter at once, and the filters
    -- apply on their own: picking only a role or only a level used to be ignored.
    and ((p_language is null and p_role is null and p_level is null)
      or exists (select 1 from user_languages ul where ul.user_id = p.id
           and (p_language is null or ul.language_code = p_language)
           and (p_role is null or ul.role = p_role)
           and (p_level is null or ul.level = p_level)))
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
-- ---------- home_feed: the Home list in one round trip ----------
-- One ordered result with two groups, so the page can split it however it likes.
-- A "partner" shares a language with me, in any combination:
--   'native'   = speaks natively a language I am learning            -> can teach me
--   'learning' = is learning one of my languages, or speaks natively a language I speak
--   'other'    = nothing in common                                   -> the rest of the app
-- Everyone is filtered exactly like search_people: active, finished onboarding, not me,
-- and never blocked in either direction (blocking stays silent in both directions).
-- p_partner_limit applies to each partner group, p_other_limit to everyone else.
drop function if exists public.home_feed(int, int);
create function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    -- Empty arrays (no languages yet) simply match nobody, so everyone lands in 'other'.
    select array(select ul.language_code from user_languages ul where ul.user_id = auth.uid() and ul.role = 'native')   as native_langs,
           array(select ul.language_code from user_languages ul where ul.user_id = auth.uid() and ul.role = 'learning') as learning_langs
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ul.role = 'native' and ul.language_code = any(mine.learning_langs)) then 'native'
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ((ul.role = 'learning' and ul.language_code = any(mine.native_langs))
               or (ul.role = 'learning' and ul.language_code = any(mine.learning_langs))
               or (ul.role = 'native'  and ul.language_code = any(mine.native_langs)))) then 'learning'
        else 'other'
      end as match_kind,
      -- Why they matched, for the badge on the card. First hit wins: what they can teach me,
      -- then what they want to learn, then the language we practise together, then the one we share.
      coalesce(
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_code = any(mine.learning_langs) order by ul.language_code limit 1),
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_code = any(mine.native_langs)   order by ul.language_code limit 1),
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_code = any(mine.learning_langs) order by ul.language_code limit 1),
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_code = any(mine.native_langs)   order by ul.language_code limit 1)
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

-- ---------- Re-apply grants: only signed-in users may call functions (mirrors 0005/0008). ----------
revoke all on function public.save_profile(text, text, text, text, boolean, text, text) from public, anon;
revoke all on function public.get_profile(text) from public, anon;
revoke all on function public.search_people(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.home_feed(int, int) from public, anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;