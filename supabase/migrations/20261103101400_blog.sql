-- Blog posts, their staff editor and the images bucket.

create table public.blog_posts (
  id uuid default gen_random_uuid() primary key,
  slug text not null check ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') and (char_length(slug) <= 80)) unique,
  draft jsonb not null default '{}'::jsonb,
  draft_saved_at timestamptz not null default now(),
  is_live boolean not null default false,
  title text,
  seo_title text,
  description text,
  kicker text,
  summary text,
  cover_url text,
  cover_alt text,
  body jsonb,
  read_minutes int,
  published_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.blog_posts enable row level security;
create index blog_posts_live_idx on public.blog_posts (published_at desc) where is_live;
grant select (id, slug, title, seo_title, description, kicker, summary, cover_url, cover_alt, body, read_minutes, published_at, updated_at) on public.blog_posts to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;

create function public.blog_admin_row(p public.blog_posts) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', p.id, 'slug', p.slug, 'draft', p.draft, 'draft_saved_at', p.draft_saved_at, 'is_live', p.is_live,
    'live_title', p.title, 'published_at', p.published_at, 'updated_at', p.updated_at, 'created_at', p.created_at,
    'has_changes', p.is_live and p.draft is distinct from jsonb_build_object('title', p.title, 'seo_title', p.seo_title, 'description', p.description,
      'kicker', p.kicker, 'summary', p.summary, 'cover_url', p.cover_url, 'cover_alt', p.cover_alt, 'body', p.body)) $$;

create function public.admin_blog_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(public.blog_admin_row(p) #- '{draft,body}' order by p.is_live desc, coalesce(p.updated_at, p.draft_saved_at) desc) from blog_posts p), '[]');
end $$;

create function public.admin_blog_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select public.blog_admin_row(p) from blog_posts p where p.id = p_id);
end $$;

create function public.admin_blog_save(p_id uuid, p_slug text, p_draft jsonb, p_expected timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v blog_posts; v_clean jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 80 then raise exception 'blog_invalid_slug'; end if;
  if pg_column_size(p_draft) > 1000000 then raise exception 'blog_too_long'; end if;
  if exists (select 1 from blog_posts where slug = p_slug and id <> p_id) then raise exception 'blog_slug_taken'; end if;
  v_clean := jsonb_build_object('title', p_draft->'title', 'seo_title', p_draft->'seo_title', 'description', p_draft->'description',
    'kicker', p_draft->'kicker', 'summary', p_draft->'summary', 'cover_url', p_draft->'cover_url', 'cover_alt', p_draft->'cover_alt', 'body', p_draft->'body');
  select * into v from blog_posts where id = p_id for update;
  if not found then
    insert into blog_posts (id, slug, draft) values (p_id, p_slug, v_clean) returning * into v;
    return public.blog_admin_row(v);
  end if;
  if p_expected is not null and v.draft_saved_at > p_expected then raise exception 'blog_changed'; end if;
  if v.published_at is not null and v.slug <> p_slug then raise exception 'blog_slug_locked'; end if;
  update blog_posts set slug = p_slug, draft = v_clean, draft_saved_at = now() where id = p_id returning * into v;
  return public.blog_admin_row(v);
end $$;

create function public.admin_blog_publish(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v blog_posts; d jsonb; v_words int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into v from blog_posts where id = p_id for update;
  if not found then raise exception 'blog_not_found'; end if;
  d := v.draft;
  if coalesce(trim(d->>'title'), '') = '' then raise exception 'blog_title_required'; end if;
  if v.slug like 'untitled-%' then raise exception 'blog_slug_required'; end if;
  if coalesce(trim(d->>'description'), '') = '' then raise exception 'blog_description_required'; end if;
  if coalesce(trim(d->>'summary'), '') = '' then raise exception 'blog_summary_required'; end if;
  select coalesce(sum(cardinality(regexp_split_to_array(trim(t #>> '{}'), '\s+'))), 0) into v_words from jsonb_path_query(d->'body', '$.**.text') t;
  if v_words = 0 then raise exception 'blog_body_required'; end if;
  update blog_posts set is_live = true, title = d->>'title', seo_title = d->>'seo_title', description = d->>'description', kicker = d->>'kicker',
    summary = d->>'summary', cover_url = d->>'cover_url', cover_alt = d->>'cover_alt', body = d->'body', read_minutes = greatest(1, ceil(v_words / 200.0)::int),
    published_at = coalesce(published_at, now()), updated_at = now()
  where id = p_id returning * into v;
  perform public.admin_audit('blog_publish', null, jsonb_build_object('slug', v.slug, 'title', v.title));
  return public.blog_admin_row(v);
end $$;

create function public.admin_blog_unpublish(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v blog_posts;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update blog_posts set is_live = false where id = p_id returning * into v;
  if not found then raise exception 'blog_not_found'; end if;
  perform public.admin_audit('blog_unpublish', null, jsonb_build_object('slug', v.slug, 'title', v.title));
  return public.blog_admin_row(v);
end $$;

create function public.admin_blog_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v blog_posts;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from blog_posts where id = p_id returning * into v;
  if not found then raise exception 'blog_not_found'; end if;
  perform public.admin_audit('blog_delete', null, jsonb_build_object('slug', v.slug, 'title', coalesce(v.title, v.draft->>'title')));
end $$;

create policy "live posts are public" on public.blog_posts for select to anon, authenticated using (is_live);
create policy "blog images staff delete" on storage.objects for delete to authenticated using (bucket_id = 'blog-images' and public.is_admin());
create policy "blog images staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'blog-images' and public.is_admin());
create policy "blog images staff read" on storage.objects for select to authenticated using (bucket_id = 'blog-images' and public.is_admin());

revoke all on function
  public.blog_admin_row(public.blog_posts),
  public.admin_blog_list(),
  public.admin_blog_get(uuid),
  public.admin_blog_save(uuid, text, jsonb, timestamp with time zone),
  public.admin_blog_publish(uuid),
  public.admin_blog_unpublish(uuid),
  public.admin_blog_delete(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_blog_list(),
  public.admin_blog_get(uuid),
  public.admin_blog_save(uuid, text, jsonb, timestamp with time zone),
  public.admin_blog_publish(uuid),
  public.admin_blog_unpublish(uuid),
  public.admin_blog_delete(uuid)
to authenticated, service_role;
