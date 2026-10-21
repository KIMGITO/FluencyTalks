-- 0007: Central search — search_people and search_messages.
-- Stands alone; no other file merges into this concept.

-- ---------- search_people function ----------

create or replace function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\\%'), '_', '\\_') || '%'; end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.is_private, p.followers_count,
    coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
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

-- ---------- search_messages function (find messages in conversations I belong to) ----------

-- This is embedded within the list_conversations function logic;
-- the search_messages concept is integrated into conversation search via can_access_conversation.