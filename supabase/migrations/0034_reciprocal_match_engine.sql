-- 0034: reciprocal match engine for home_feed
-- --------------------------------------------------------------
-- Replaces the old home_feed() with three-tier matching:
--   1. perfect_swap: their native = my target AND their target = my native
--   2. teacher: their native = my target (they can help, I may not help back)
--   3. bridge: shared third language at B1+ (optional, off by default)
-- Within each tier: order by recent activity + timezone overlap, NOT followers_count.
-- --------------------------------------------------------------
create or replace function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, languages jsonb, match_kind text, match_language text, match_reason text)
language plpgsql stable security definer set search_path = public as
\$\$ declare
  my_native text[];
  my_learning text[];
  my_level text := 'A1';
  my_timezone text;
begin
  -- Load the current user's languages and timezone
  select timezone into my_timezone from profiles where id = auth.uid();
  select array_agg(ul.language_code) filter (where ul.role = 'native') into my_native from user_languages ul where ul.user_id = auth.uid();
  select array_agg(ul.language_code) filter (where ul.role = 'learning') into my_learning from user_languages ul where ul.user_id = auth.uid();
  if my_learning is null then my_learning := '{}'::text[]; end if;

  return query
  with
    candidates as (
      select
        p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
        coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) filter (where ul is not null) from user_languages ul where ul.user_id = p.id), '[]'::jsonb) as languages,
        case
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'native'
            and ul2.language_code = any(my_learning)
            and exists (
              select 1 from user_languages ul3
              where ul3.user_id = auth.uid() and ul3.role = 'learning'
              and ul3.language_code = ul2.language_code
            )
          then 'perfect_swap'
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'native'
            and ul2.language_code = any(my_learning)
          then 'teacher'
          when exists (
            select 1 from user_languages ul2
            join user_languages ul3 on ul3.user_id = auth.uid() and ul3.role = 'learning'
            on ul2.language_code = ul3.language_code
            where ul2.user_id = p.id and ul2.role = 'learning'
            and ul3.language_code = any(my_native)
            and ul2.level::text in ('B1','B2','C1','C2')
            or ul3.level::text in ('B1','B2','C1','C2') and ul2.level::text in ('B1','B2','C1','C2')
          then 'bridge'
          else 'other'
        end as match_kind,
        case
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'native'
            and ul2.language_code = any(my_learning)
          then (select ul2.language_code from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'native' and ul2.language_code = any(my_learning) limit 1)
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'learning'
            and ul2.language_code = any(my_native)
          then (select ul2.language_code from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'learning' and ul2.language_code = any(my_native) limit 1)
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'learning'
            and ul2.language_code = any(my_learning)
            and ul2.level::text in ('B1','B2','C1','C2')
          then (select ul2.language_code from user_languages ul2 where ul2.user_id = p.id and ul2.role = 'learning' and ul2.language_code = any(my_learning) and ul2.level::text in ('B1','B2','C1','C2') limit 1)
          else null
        end as match_language,
        case
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'native'
            and ul2.language_code = any(my_learning)
            and exists (
              select 1 from user_languages ul3
              where ul3.user_id = auth.uid() and ul3.role = 'learning'
              and ul3.language_code = ul2.language_code
            )
          then 'Perfect swap: we can both teach each other'
          when exists (
            select 1 from user_languages ul2
            where ul2.user_id = p.id and ul2.role = 'native'
            and ul2.language_code = any(my_learning)
          then 'Teacher: they can help you with ' || (select languages->0->>'language_code' from jsonb each(select languages from user_languages where user_id = p.id))
          when exists (
            select 1 from user_languages ul2
            join user_languages ul3 on ul3.user_id = auth.uid() and ul3.role = 'learning'
            on ul2.language_code = ul3.language_code
            where ul2.user_id = p.id and ul2.role = 'learning'
            and ul3.language_code = any(my_native)
            and ul2.level::text in ('B1','B2','C1','C2')
            or ul3.level::text in ('B1','B2','C1','C2') and ul2.level::text in ('B1','B2','C1','C2')
          then 'Bridge: we share ' || (select ul3.language_code from user_languages ul3 where ul3.user_id = auth.uid() and ul3.role = 'learning' limit 1) || ' at B1+'
          else 'Other'
        end as match_reason
      from profiles p
      where p.id <> auth.uid()
        and p.status = 'active'
        and p.onboarding_done
        and not public.is_blocked_between(auth.uid(), p.id)
    ),
    enriched as (
      select
        c.*,
        coalesce((select max(m.created_at) from messages m where m.conversation_id in (select conversation_id from conversation_members where user_id = auth.uid()) and m.sender_id <> auth.uid() and m.sender_id = c.id), c.created_at) as last_activity,
        case when my_timezone is not null and c.timezone is not null then
          case when my_timezone = c.timezone then 24
               when abs(extract(hour from (my_timezone::text - c.timezone::text))::int) <= 8 then 8
               else 0 end
        else 0 end as tz_overlap_hours,
        c.created_at as user_since
      from candidates c
    )
select id, username, display_name, avatar_url, bio, timezone, country_code, is_private, languages,
    match_kind, match_language, match_reason
  from enriched
  order by
    case when match_kind = 'perfect_swap' then 1 when match_kind = 'teacher' then 2 when match_kind = 'bridge' then 3 else 4 end,
    tz_overlap_hours desc,
    last_activity desc nulls last,
    user_since desc
  limit greatest(least(coalesce(p_partner_limit, 12), 50), 0)
  union all
  select id, username, display_name, avatar_url, bio, timezone, country_code, is_private, languages,
    match_kind, match_language, match_reason
  from enriched
  where match_kind != 'perfect_swap' and match_kind != 'teacher' and match_kind != 'bridge'
  order by
    tz_overlap_hours desc,
    last_activity desc nulls last,
    user_since desc
  limit greatest(least(coalesce(p_other_limit, 8), 50), 0);
end
$$;

-- --------------------------------------------------------------
-- Re-apply grants: only signed-in users may call the new home_feed()
-- --------------------------------------------------------------
revoke all on function public.home_feed(int, int) from public, anon;
grant execute on function public.home_feed(int, int) to authenticated;
