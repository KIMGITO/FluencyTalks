-- 0028: remove the story/blog system entirely.
-- Drops every object introduced by 0020-0026 (posts, post_reads, post_saves,
-- post_notes, the post-images bucket and its policies, and all post RPCs).
-- Safe to run on a fresh DB (uses IF EXISTS / WHERE id = ...) and on an
-- existing DB that already has the posts system applied.

-- 1. Revoke + drop every post RPC first (they reference the posts tables).
revoke execute on all functions in schema public from public, anon, authenticated, service_role;

drop function if exists public.list_posts(text, boolean, boolean, integer, integer) cascade;
drop function if exists public.get_post(uuid) cascade;
drop function if exists public.toggle_post_read(uuid) cascade;
drop function if exists public.list_post_readers(uuid) cascade;
drop function if exists public.toggle_post_save(uuid) cascade;
drop function if exists public.add_post_note(uuid, text) cascade;
drop function if exists public.list_post_notes(uuid) cascade;
drop function if exists public.delete_post_note(uuid) cascade;
drop function if exists public.create_post(text, text, jsonb, text, text, text) cascade;
drop function if exists public.update_post(uuid, text, jsonb, text, text, text) cascade;
drop function if exists public.delete_post(uuid) cascade;
drop function if exists public.list_public_blogs(integer, integer) cascade;
drop function if exists public.get_public_blog(uuid) cascade;
drop function if exists public.post_visible_to(uuid, text) cascade;

-- 2. Drop the posts tables (cascade drops their indexes, constraints, RLS policies,
--    and the join tables post_reads / post_saves / post_notes).
drop table if exists public.post_notes cascade;
drop table if exists public.post_saves cascade;
drop table if exists public.post_reads cascade;
drop table if exists public.posts cascade;

-- 3. Storage: remove the post-images policies.
--    The bucket itself is NOT deleted here: hosted Supabase forbids direct DELETEs on storage
--    tables ("Use the Storage API instead"). It only ever existed on databases that ran the removed
--    posts migrations; a database built from these files never creates it. If yours has an old
--    `post-images` bucket, delete it in the dashboard (Storage) or with the Storage API.
drop policy if exists "post images public read" on storage.objects;
drop policy if exists "post images insert own" on storage.objects;
drop policy if exists "post images delete own" on storage.objects;
