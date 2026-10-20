-- 0022: posts feed + detail (blocked/suspended/invisible never leave server).
create or replace function public.list_posts(p_kind text default null, p_mine boolean default false, p_saved boolean default false, p_limit int default 20, p_offset int default 0)
returns table (id uuid, kind text, title text, blocks jsonb, body_text text, language_id text, visibility text,
  created_at timestamptz, updated_at timestamptz, author_id uuid, author_username text, author_name text, author_avatar text,
  read_count int, has_read boolean, saved boolean, notes_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return query
  select p.id, p.kind, p.title, p.blocks, left(p.body_text, 600), p.language_id, p.visibility, p.created_at, p.updated_at,
    p.author_id, a.username, a.display_name, a.avatar_url,
    (select count(*)::int from post_reads r where r.post_id = p.id),
    exists (select 1 from post_reads r where r.post_id = p.id and r.user_id = auth.uid()),
    exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = auth.uid()),
    (select count(*)::int from post_notes n where n.post_id = p.id)
  from posts p join profiles a on a.id = p.author_id
  where (p_kind is null or p_kind = 'all' or p.kind = p_kind)
    and (not p_mine or p.author_id = auth.uid())
    and (not p_saved or exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = auth.uid()))
    and a.status = 'active' and not public.is_blocked_between(auth.uid(), p.author_id)
    and (p.author_id = auth.uid() or public.post_visible_to(p.author_id, p.visibility))
  order by p.created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50) offset least(greatest(coalesce(p_offset, 0), 0), 10000);
end $$;
create or replace function public.get_post(p_id uuid)
returns table (id uuid, kind text, title text, blocks jsonb, body_text text, language_id text, visibility text,
  created_at timestamptz, updated_at timestamptz, author_id uuid, author_username text, author_name text, author_avatar text,
  read_count int, has_read boolean, saved boolean, notes_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return query
  select p.id, p.kind, p.title, p.blocks, p.body_text, p.language_id, p.visibility, p.created_at, p.updated_at,
    p.author_id, a.username, a.display_name, a.avatar_url,
    (select count(*)::int from post_reads r where r.post_id = p.id),
    exists (select 1 from post_reads r where r.post_id = p.id and r.user_id = auth.uid()),
    exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = auth.uid()),
    (select count(*)::int from post_notes n where n.post_id = p.id)
  from posts p join profiles a on a.id = p.author_id
  where p.id = p_id and a.status = 'active' and not public.is_blocked_between(auth.uid(), p.author_id)
    and (p.author_id = auth.uid() or public.post_visible_to(p.author_id, p.visibility));
end $$;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
