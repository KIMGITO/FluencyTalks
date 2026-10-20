-- 0025: public blogs for logged-out readers + author signals for Home ranking.
-- list_posts/get_post gain author_country/timezone for affinity; new anon-safe
-- list_public_blogs/get_public_blog serve ONLY public blogs (no translate gating
-- needed server-side; client hides translate when logged out).
create or replace function public.list_public_blogs(p_limit int default 20, p_offset int default 0)
returns table (id uuid, title text, blocks jsonb, body_text text, language_id text,
  created_at timestamptz, author_name text, author_username text, author_avatar text, read_count int)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.blocks, left(p.body_text, 600), p.language_id, p.created_at,
    a.display_name, a.username, a.avatar_url,
    (select count(*)::int from post_reads r where r.post_id = p.id)
  from posts p join profiles a on a.id = p.author_id
  where p.kind = 'blog' and p.visibility = 'public' and a.status = 'active'
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;
create or replace function public.get_public_blog(p_id uuid)
returns table (id uuid, title text, blocks jsonb, body_text text, language_id text,
  created_at timestamptz, author_name text, author_username text, author_avatar text, read_count int)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.blocks, p.body_text, p.language_id, p.created_at,
    a.display_name, a.username, a.avatar_url,
    (select count(*)::int from post_reads r where r.post_id = p.id)
  from posts p join profiles a on a.id = p.author_id
  where p.id = p_id and p.kind = 'blog' and p.visibility = 'public' and a.status = 'active'
  limit 1;
$$;
grant execute on function public.list_public_blogs(int, int) to anon, authenticated, service_role;
grant execute on function public.get_public_blog(uuid) to anon, authenticated, service_role;
