-- 0023: eye-reads (tap = I have read), saves, learning notes.
create or replace function public.toggle_post_read(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v posts; v_has boolean;
begin
  perform assert_active();
  select * into v from posts p join profiles a on a.id = p.author_id
  where p.id = p_id and a.status = 'active' and not public.is_blocked_between(auth.uid(), p.author_id)
    and (p.author_id = auth.uid() or public.post_visible_to(p.author_id, p.visibility));
  if v.id is null then raise exception 'forbidden'; end if;
  select exists (select 1 from post_reads where post_id = p_id and user_id = auth.uid()) into v_has;
  if v_has then delete from post_reads where post_id = p_id and user_id = auth.uid(); return false;
  else insert into post_reads (post_id, user_id) values (p_id, auth.uid()) on conflict do nothing; return true; end if;
end $$;
create or replace function public.list_post_readers(p_id uuid)
returns table (id uuid, username text, display_name text, avatar_url text, read_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v posts;
begin
  perform assert_active();
  select * into v from posts where id = p_id;
  if v.id is null then raise exception 'forbidden'; end if;
  if v.author_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  return query select p.id, p.username, p.display_name, p.avatar_url, r.created_at
  from post_reads r join profiles p on p.id = r.user_id
  where r.post_id = p_id and not public.is_blocked_between(auth.uid(), p.id)
  order by r.created_at desc limit 200;
end $$;
create or replace function public.toggle_post_save(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_has boolean;
begin
  perform assert_active();
  if not exists (select 1 from posts p join profiles a on a.id = p.author_id where p.id = p_id and a.status = 'active'
    and not public.is_blocked_between(auth.uid(), p.author_id)
    and (p.author_id = auth.uid() or public.post_visible_to(p.author_id, p.visibility))) then raise exception 'forbidden'; end if;
  select exists (select 1 from post_saves where post_id = p_id and user_id = auth.uid()) into v_has;
  if v_has then delete from post_saves where post_id = p_id and user_id = auth.uid(); return false;
  else insert into post_saves (post_id, user_id) values (p_id, auth.uid()) on conflict do nothing; return true; end if;
end $$;
