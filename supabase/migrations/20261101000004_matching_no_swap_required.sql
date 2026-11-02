-- Matching: a perfect swap is the best match, never a requirement. NEW migration; never edit past ones.
--
-- Before: a partner had to speak a language I am learning, or be learning one of mine, and
-- people who merely shared a language with me were ranked as partners too. Ranking leaned on
-- follower counts, which the app no longer has as a feature.
--
-- Now, for me (native N, learning L, L may be empty):
--   'swap'     they speak L natively AND are learning N.   Best match, ranked first.
--   'native'   they speak L natively. They can teach me, whatever they are learning (or nothing).
--   'learning' they are learning N. I can help them, whatever their native language is.
--   'other'    nothing in common; shown after the partners.
-- So an English speaker learning Chinese sees every Chinese speaker, and every learner of English
-- (a French speaker learning English included). Someone who learns nothing still matches as a teacher.
-- Within a tier: newest members first, then closest timezone offset.

drop function if exists public.home_feed(int, int);
create function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with me as (
    select p.native_language_id as n, p.learning_language_id as l, p.timezone as tz
    from profiles p where p.id = auth.uid()
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      public.user_languages_json(p.id) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when me.l is not null and p.native_language_id = me.l and p.learning_language_id = me.n then 'swap'
        when me.l is not null and p.native_language_id = me.l then 'native'
        when me.n is not null and p.learning_language_id = me.n then 'learning'
        else 'other'
      end as match_kind,
      case
        when me.l is not null and p.native_language_id = me.l then me.l   -- the language they can teach me
        when me.n is not null and p.learning_language_id = me.n then me.n -- the language I can help with
      end as match_language,
      abs(coalesce(extract(epoch from (now() at time zone p.timezone) - (now() at time zone me.tz)), 0)) as tz_gap
    from profiles p cross join me
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language
  from (
    (select c.* from candidates c where c.match_kind <> 'other'
      order by case c.match_kind when 'swap' then 0 when 'native' then 1 else 2 end, c.created_at desc, c.tz_gap
      limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'other'
      order by c.created_at desc, c.tz_gap
      limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) feed
  order by (feed.match_kind = 'other'),
    case feed.match_kind when 'swap' then 0 when 'native' then 1 when 'learning' then 2 else 3 end,
    feed.created_at desc;
end $$;

-- How many people could match me, for the empty state ("12 people speak Chinese").
create or replace function public.match_pool()
returns table (teachers int, learners int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from profiles p, profiles m where m.id = auth.uid() and m.learning_language_id is not null
       and p.native_language_id = m.learning_language_id and p.id <> m.id and p.status = 'active' and p.onboarding_done
       and not public.is_blocked_between(m.id, p.id)),
    (select count(*)::int from profiles p, profiles m where m.id = auth.uid()
       and p.learning_language_id = m.native_language_id and p.id <> m.id and p.status = 'active' and p.onboarding_done
       and not public.is_blocked_between(m.id, p.id));
$$;

revoke all on function public.home_feed(int, int) from public, anon;
revoke all on function public.match_pool() from public, anon;
grant execute on function public.home_feed(int, int) to authenticated, service_role;
grant execute on function public.match_pool() to authenticated, service_role;
