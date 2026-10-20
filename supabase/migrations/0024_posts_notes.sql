-- 0024: learning notes (what I captured / learnt from a story or blog).
create or replace function public.add_post_note(p_id uuid, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if nullif(btrim(coalesce(p_note, '')), '') is null then raise exception 'empty_message'; end if;
  if not exists (select 1 from posts p join profiles a on a.id = p.author_id where p.id = p_id and a.status = 'active'
    and not public.is_blocked_between(auth.uid(), p.author_id)
    and (p.author_id = auth.uid() or public.post_visible_to(p.author_id, p.visibility))) then raise exception 'forbidden'; end if;
  insert into post_notes (post_id, user_id, note) values (p_id, auth.uid(), left(btrim(p_note), 2000)) returning id into v_id;
  return v_id;
end $$;
create or replace function public.list_post_notes(p_id uuid)
returns table (id uuid, note text, created_at timestamptz, user_id uuid, username text, display_name text, avatar_url text, mine boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  if not exists (select 1 from posts p join profiles a on a.id = p.author_id where p.id = p_id and a.status = 'active'
    and not public.is_blocked_between(auth.uid(), p.author_id)
    and (p.author_id = auth.uid() or public.post_visible_to(p.author_id, p.visibility))) then raise exception 'forbidden'; end if;
  return query select n.id, n.note, n.created_at, n.user_id, p.username, p.display_name, p.avatar_url, (n.user_id = auth.uid())
  from post_notes n join profiles p on p.id = n.user_id
  where n.post_id = p_id and (n.user_id = auth.uid() or exists (select 1 from posts x where x.id = p_id and x.author_id = auth.uid()))
  order by n.created_at desc limit 200;
end $$;
create or replace function public.delete_post_note(p_note uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v post_notes;
begin
  perform assert_active();
  select * into v from post_notes where id = p_note;
  if v.id is null then return; end if;
  if v.user_id <> auth.uid() and not public.is_admin()
    and not exists (select 1 from posts where id = v.post_id and author_id = auth.uid()) then raise exception 'forbidden'; end if;
  delete from post_notes where id = p_note;
end $$;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
