-- Search library posts: phrase, translation, context, or the author's name / @username.
-- Same visibility rules as search_people: no blocked people (either direction), only active authors.
create or replace function public.search_posts(p_query text default null, p_language text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, user_id uuid, language_id text, phrase text, translation text, category text, source_context text,
  unsplash_image_url text, text_align text, pinned_at timestamptz, created_at timestamptz, updated_at timestamptz, certified_at timestamptz,
  author_username text, author_name text, author_avatar text, saved boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_like is null and v_lang is null then return; end if;   -- nothing to search for

  return query
  select c.id, c.user_id, c.language_id, c.phrase, c.translation, c.category, c.source_context,
    c.unsplash_image_url, c.text_align, c.pinned_at, c.created_at, c.updated_at, c.certified_at,
    a.username, a.display_name, a.avatar_url,
    exists (select 1 from saved_posts s where s.user_id = auth.uid() and s.post_id = c.id)
  from contribution_posts c
  join profiles a on a.id = c.user_id
  where (a.status = 'active' or a.id = auth.uid())
    and not public.is_blocked_between(auth.uid(), c.user_id)
    and (v_lang is null or c.language_id = v_lang)
    and (v_like is null or c.phrase ilike v_like or c.translation ilike v_like or c.source_context ilike v_like
         or a.display_name ilike v_like or a.username ilike v_like)
  -- Relevance: the phrase itself starts with the query, then the phrase contains it, then the rest; newest first within each.
  order by case
      when v_q is null then 2
      when lower(c.phrase) like v_q || '%' then 0
      when c.phrase ilike v_like then 1
      else 2 end,
    c.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

revoke execute on function public.search_posts(text, text, int, int) from public, anon;
grant  execute on function public.search_posts(text, text, int, int) to authenticated, service_role;

-- My own phrasebook (always private to me, so no block rules needed).
create or replace function public.search_phrases(p_query text default null, p_language text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, phrase text, translation text, language_id text, source_message_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_like text; v_lang text;
begin
  v_like := nullif(btrim(coalesce(p_query, '')), '');
  if v_like is not null then v_like := '%' || replace(replace(replace(v_like, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_like is null then return; end if;
  return query
  select s.id, s.phrase, s.translation, s.language_id, s.source_message_id, s.created_at
  from saved_phrases s
  where s.user_id = auth.uid()
    and (v_lang is null or s.language_id = v_lang)
    and (s.phrase ilike v_like or s.translation ilike v_like)
  order by s.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

revoke execute on function public.search_phrases(text, text, int, int) from public, anon;
grant  execute on function public.search_phrases(text, text, int, int) to authenticated, service_role;
