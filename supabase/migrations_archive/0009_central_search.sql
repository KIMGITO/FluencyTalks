-- 0009: one central search — search_people becomes the single people search used by
-- /search (handle with or without "@", relevance order, role/level filters that no
-- longer need a language, "people you follow" scope) and search_messages searches
-- my own chats so the search page can mix people and conversations like Facebook.

-- Old signature (0002) and the new one, so this file can be re-applied safely.
drop function if exists public.search_people(text, text, text, text, int, int);
drop function if exists public.search_people(text, text, text, text, text, int, int);

create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
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

-- ---------- Conversations: find a message in the chats I belong to ----------
-- Membership, status and blocks are all checked here, so a hit can never leak a
-- conversation the viewer is not allowed to read. Both participants come back:
-- the sender for the row, the other person for the header and the chat link.
-- ilike '%..%' cannot use a btree index; add a pg_trgm GIN index on body
-- once a single account holds a large message history.
drop function if exists public.search_messages(text, uuid, int, int);
create function public.search_messages(p_query text default null, p_conversation uuid default null, p_limit int default 20, p_offset int default 0)
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
end $$;

-- ---------- Re-apply grants: only signed-in users may call functions (mirrors 0005/0008). ----------
-- Supabase's default privileges hand new functions to anon; searching is a signed-in feature.
revoke all on function public.search_people(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.search_messages(text, uuid, int, int) from public, anon;
grant execute on all functions in schema public to authenticated, service_role;