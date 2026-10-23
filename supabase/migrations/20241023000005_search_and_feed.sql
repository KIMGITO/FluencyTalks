-- 20241023000005: Search & Feed (Part 1)
create or replace function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.is_private, p.followers_count,
    coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_id, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    and ((p_language is null and p_role is null and p_level is null)
      or exists (select 1 from user_languages ul where ul.user_id = p.id
           and (p_language is null or ul.language_id = p_language)
           and (p_role is null or ul.role = p_role)
           and (p_level is null or ul.level = p_level)))
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end;
$$;

create or replace function public.search_messages(p_query text default null, p_conversation uuid default null, p_limit int default 20, p_offset int default 0)
returns table (message_id uuid, conversation_id uuid, body text, created_at timestamptz, sender_id uuid, sender_name text, sender_username text, sender_avatar text, other_id uuid, other_name text, other_username text, other_avatar text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  v_q := nullif(btrim(coalesce(p_query, '')), '');
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select m.id, m.conversation_id, m.body, m.created_at,
    s.id, s.display_name, s.username, s.avatar_url,
    o.id, o.display_name, o.username, o.avatar_url
  from messages m
  join conversation_members me on me.conversation_id = m.conversation_id and me.user_id = auth.uid() and me.status in ('active', 'request')
  join profiles s on s.id = m.sender_id
  join conversation_members om on om.conversation_id = m.conversation_id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  where m.deleted_at is null and o.status = 'active'
    and not public.is_blocked_between(auth.uid(), o.id)
    and not public.is_blocked_between(auth.uid(), s.id)
    and (p_conversation is null or m.conversation_id = p_conversation)
    and (v_like is null or m.body ilike v_like)
  order by m.created_at desc
  limit least(p_limit, 50) offset p_offset;
end;
$$;


create or replace function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  return query
  with mine as (
    select
      array_agg(language_id) filter (where role = 'native') as native_langs,
      array_agg(language_id) filter (where role = 'learning') as learning_langs
    from user_languages where user_id = v_uid
  ),
  candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count, p.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_id, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb) as languages,
      (select f.status from follows f where f.follower_id = v_uid and f.followee_id = p.id) as follow_status,
      case
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ul.role = 'native' and ul.language_id = any(mine.learning_langs)) then 'native'
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ((ul.role = 'learning' and ul.language_id = any(mine.native_langs))
               or (ul.role = 'learning' and ul.language_id = any(mine.learning_langs))
               or (ul.role = 'native'  and ul.language_id = any(mine.native_langs)))) then 'learning'
        else 'other'
      end as match_kind,
      coalesce(
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_id = any(mine.learning_langs) order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_id = any(mine.native_langs)   order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_id = any(mine.learning_langs) order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_id = any(mine.native_langs)   order by ul.language_id limit 1)
      ) as match_language
    from profiles p cross join mine
    where p.id <> v_uid and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(v_uid, p.id)
  )
  select c.id, c.username, c.display_name, c.avatar_url, c.bio, c.timezone, c.country_code,
    c.is_private, c.followers_count, c.languages, c.follow_status, c.match_kind, c.match_language
  from (
    (select candidates.* from candidates where candidates.match_kind = 'native'
      order by candidates.followers_count desc, candidates.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select candidates.* from candidates where candidates.match_kind = 'learning'
      order by candidates.followers_count desc, candidates.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select candidates.* from candidates where candidates.match_kind = 'other'
      order by candidates.followers_count desc, candidates.created_at desc limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) c
  order by (c.match_kind = 'other'), c.followers_count desc, c.created_at desc;
end;
$$;


-- ---------- Notifications ----------
create or replace function public.list_notifications(p_limit int default 30)
returns table (id uuid, type text, data jsonb, read_at timestamptz, created_at timestamptz, actor_id uuid, actor_username text, actor_name text, actor_avatar text)
language sql stable security definer set search_path = public as $$
  select n.id, n.type, n.data, n.read_at, n.created_at, n.actor_id, p.username, p.display_name, p.avatar_url
  from notifications n left join profiles p on p.id = n.actor_id
  where n.user_id = auth.uid() and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
  order by n.created_at desc limit least(p_limit, 100);
$$;
create or replace function public.count_unread_notifications() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications n
  where n.user_id = auth.uid() and n.read_at is null and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id));
$$;
-- ---------- Admin ----------
create or replace function public.admin_report_queue(p_status text default 'open')
returns table (id uuid, reason text, details text, evidence jsonb, status text, created_at timestamptz, conversation_id uuid,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_id uuid, target_username text, target_name text, target_status text, target_open_reports int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.reason, r.details, r.evidence, r.status, r.created_at, r.conversation_id,
           r.reporter_id, rp.username, rp.display_name,
           r.target_user_id, tp.username, tp.display_name, tp.status,
           (select count(*)::int from reports x where x.target_user_id = r.target_user_id and x.status = 'open')
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    left join profiles tp on tp.id = r.target_user_id
    where r.status = p_status
    order by case when p_status = 'open' then r.created_at end asc nulls last, r.created_at desc
    limit 100;
end;
$$;
create or replace function public.admin_search_users(p_query text default null)
returns table (id uuid, username text, display_name text, role text, status text, created_at timestamptz, open_reports int)
language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), ''); v_like text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
    select p.id, p.username, p.display_name, p.role, p.status, p.created_at,
           (select count(*)::int from reports r where r.target_user_id = p.id and r.status = 'open')
    from profiles p
    where p.username is not null and (v_like is null or p.username ilike v_like or p.display_name ilike v_like)
    order by (p.status <> 'active') desc, p.created_at desc
    limit 50;
end;
$$;
create or replace function public.admin_recent_actions(p_limit int default 50)
returns table (id uuid, action text, reason text, created_at timestamptz, admin_name text, target_username text, target_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select a.id, a.action, a.reason, a.created_at, ap.display_name, tp.username, tp.display_name
    from moderation_actions a
    left join profiles ap on ap.id = a.admin_id
    left join profiles tp on tp.id = a.target_user_id
    order by a.created_at desc limit least(p_limit, 100);
end;
$$;
grant execute on all functions in schema public to authenticated, service_role;

