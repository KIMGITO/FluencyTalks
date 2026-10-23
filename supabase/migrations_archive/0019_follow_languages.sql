-- 0019: Follow lists carry languages so /followers and /following can print
-- the same chips as search/home without a second round trip.
-- Same payload shape as search_people/home_feed: user_languages_json(p.id).

begin;

drop function if exists public.list_follows(uuid, text, int, int);

create function public.list_follows(p_user uuid, p_kind text, p_limit int default 30, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, languages jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_private boolean;
begin
  if public.is_blocked_between(auth.uid(), p_user) then return; end if;
  select pr.is_private into v_private from profiles pr where pr.id = p_user;
  if v_private and p_user <> auth.uid() and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p_user and f.status = 'accepted') then return; end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_url,
      public.user_languages_json(p.id)
    from follows f
    join profiles p on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
    where f.status = 'accepted' and p.status = 'active'
      and ((p_kind = 'followers' and f.followee_id = p_user) or (p_kind = 'following' and f.follower_id = p_user))
      and not public.is_blocked_between(auth.uid(), p.id)
    order by f.created_at desc limit least(p_limit, 100) offset p_offset;
end $$;

revoke all on function public.list_follows(uuid, text, int, int) from public, anon;
grant execute on function public.list_follows(uuid, text, int, int) to authenticated, service_role;

commit;
