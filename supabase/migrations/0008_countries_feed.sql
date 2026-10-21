-- 0008: Countries and home feed.
-- Adds countries table and the home_feed() function that shows people who share languages first.

-- ---------- Countries reference (ISO 3166-1 alpha-2) ----------

create table if not exists public.countries (
  code text primary key check (code ~ '^[A-Z]{2}'),
  name text not null
);

insert into public.countries (code, name) values
  ('AD','Andorra'),('AE','United Arab Emirates'),('AF','Afghanistan')
on conflict do nothing;

-- ---------- Home feed function (three-tier matching) ----------

create or replace function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, languages jsonb, match_kind text, match_language text, match_reason text)
language plpgsql stable security definer set search_path = public as
$$ declare
  my_learning text[];
  my_timezone text;
begin
  select array_agg(ul.language_code) filter (where ul.role = 'native') into my_learning from user_languages ul where ul.user_id = auth.uid();
  if my_learning is null then my_learning := '{}'; end if;
  select timezone into my_timezone from profiles where id = auth.uid();

  return query
  with
    candidates as (
      select
        p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
        coalesce((select jsonb_agg(jsonb_build_object(ul.language_code, ul.role, ul.level)) filter (where ul is not null) from user_languages ul where ul.user_id = p.id), '[]'::jsonb) as languages,
        case
          when exists (select 1 from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'native' and ul2.language_code = any(my_learning) and exists (select 1 from user_languages ul3 where ul3.user_id = auth.uid() and ul3.role = 'learning' and not (ul3.language_code && my_learning))) then 'partner'
          when exists (select 1 from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'native' and ul2.language_code = any(my_learning)) then 'teacher'
          when exists (select 1 from user_languages ul2 join user_languages ul3 on ul3.user_id = auth.uid() and ul3.role = 'learning' where ul2.user_id = p.id and ul2.role = 'learning') then 'bridge'
          else 'other'
        end as match_kind,
        case
          when exists (select 1 from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'native' and ul2.language_code = any(my_learning) and exists (select 1 from user_languages ul3 where ul3.user_id = auth.uid() and ul3.role = 'learning' and not (ul3.language_code && my_learning))) then ul2.language_code
          when exists (select 1 from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'native' and ul2.language_code = any(my_learning)) then ul2.language_code
          when exists (select 1 from user_languages ul2 join user_languages ul3 on ul3.user_id = auth.uid() and ul3.role = 'learning' where ul2.user_id = p.id and ul2.role = 'learning') then ul2.language_code
          else null
        end as match_language
      from profiles p
      where p.id <> auth.uid() and p.status != 'removed' and not public.is_blocked_between(auth.uid(), p.id)
    )
  select id, username, display_name, avatar_url, bio, timezone, country_code, is_private, languages, match_kind, match_language,
    case match_kind
      when 'partner' then 'Partner: shared learning language'
      when 'teacher' then 'Teacher: you are learning their native language'
      when 'bridge' then 'Bridge: mutual learning'
      else 'Other: no shared language'
    end as match_reason
  from candidates
  order by case match_kind when 'partner' then 1 when 'teacher' then 2 when 'bridge' then 3 else 4 end, match_language is not null desc, p.followers_count desc, created_at desc
  limit least(p_partner_limit + p_other_limit, 50);
end
$$;