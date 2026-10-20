-- 0021: posts policies + write RPCs (admin-only blogs, owner-managed stories).
drop policy if exists "post images public read" on storage.objects;
create policy "post images public read" on storage.objects for select using (bucket_id = 'post-images');
drop policy if exists "post images insert own" on storage.objects;
create policy "post images insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post images delete own" on storage.objects;
create policy "post images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create or replace function public.post_visible_to(p_author uuid, p_visibility text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_author = auth.uid() then true when p_visibility = 'public' then true
    when p_visibility = 'followers' then exists (
      select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p_author and f.status = 'accepted')
    else false end $$;
create or replace function public.create_post(p_kind text, p_title text, p_blocks jsonb, p_body_text text, p_visibility text default 'public', p_language text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if p_kind not in ('blog','story') then raise exception 'invalid_kind'; end if;
  if p_kind = 'blog' and not public.is_admin() then raise exception 'forbidden'; end if;
  if p_visibility not in ('public','followers','private') then raise exception 'invalid_kind'; end if;
  if p_kind = 'blog' then p_visibility := 'public'; end if;
  insert into posts (author_id, kind, title, blocks, body_text, visibility, language_id)
  values (auth.uid(), p_kind, left(btrim(p_title), 200), coalesce(p_blocks, '[]'), left(coalesce(p_body_text, ''), 20000),
          p_visibility, nullif(btrim(coalesce(p_language, '')), ''))
  returning id into v_id; return v_id;
end $$;
create or replace function public.update_post(p_id uuid, p_title text, p_blocks jsonb, p_body_text text, p_visibility text default null, p_language text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v posts;
begin
  perform assert_active();
  select * into v from posts where id = p_id;
  if v.id is null then raise exception 'forbidden'; end if;
  if v.author_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  if v.kind = 'blog' and not public.is_admin() then raise exception 'forbidden'; end if;
  update posts set title = left(btrim(p_title), 200), blocks = coalesce(p_blocks, blocks),
    body_text = left(coalesce(p_body_text, ''), 20000),
    visibility = case when p_visibility is null then visibility when v.kind = 'blog' then 'public'
      when p_visibility in ('public','followers','private') then p_visibility else visibility end,
    language_id = coalesce(nullif(btrim(coalesce(p_language, '')), ''), language_id),
    updated_at = now() where id = p_id;
end $$;
create or replace function public.delete_post(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v posts;
begin
  perform assert_active();
  select * into v from posts where id = p_id;
  if v.id is null then return; end if;
  if v.author_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  delete from posts where id = p_id;
end $$;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
