-- Follows, blocks, saved partners, and finding people to talk to.

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  status text default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  primary key (follower_id, followee_id)
);
alter table public.follows enable row level security;
create index follows_followee_id_idx on public.follows (followee_id);
grant select on public.follows to authenticated;

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create index blocks_blocked_id_idx on public.blocks (blocked_id);
grant select on public.blocks to authenticated;

create table public.saved_partners (
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, partner_id)
);
alter table public.saved_partners enable row level security;
create index saved_partners_partner_idx on public.saved_partners (partner_id);
grant select on public.saved_partners to authenticated;

create function public.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) $$;

create function public.sync_follow_counts() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'accepted' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'UPDATE' and old.status <> 'accepted' and new.status = 'accepted' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'DELETE' and old.status = 'accepted' then
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end $$;

create function public.follow_user(p_target uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_private boolean;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_follow_self'; end if;
  select is_private into v_private from profiles where id = p_target and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), p_target) then raise exception 'user_unavailable'; end if;
  insert into follows (follower_id, followee_id, status) values (auth.uid(), p_target, case when v_private then 'pending' else 'accepted' end)
  on conflict (follower_id, followee_id) do nothing;
  return (select status from follows where follower_id = auth.uid() and followee_id = p_target);
end $$;

create function public.unfollow_user(p_target uuid) returns void language sql security definer set search_path = public as $$
  delete from follows where follower_id = auth.uid() and followee_id = p_target $$;

create function public.list_follow_requests() returns table (follower_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, f.created_at from follows f join profiles p on p.id = f.follower_id
  where f.followee_id = auth.uid() and f.status = 'pending' and not public.is_blocked_between(auth.uid(), p.id) order by f.created_at desc $$;

create function public.unblock_user(p_target uuid) returns void language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_target $$;

create function public.list_blocked() returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url from blocks b join profiles p on p.id = b.blocked_id where b.blocker_id = auth.uid() order by b.created_at desc $$;

create function public.trg_notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.notify(new.followee_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  elsif old.status = 'pending' and new.status = 'accepted' then perform public.notify(new.follower_id, new.followee_id, 'follow_accepted'); end if;
  return null;
end $$;

create function public.get_profile(p_username text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v profiles;
begin
  select * into v from profiles where lower(username) = lower(p_username) and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), v.id) then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'username', v.username, 'display_name', v.display_name, 'avatar_url', v.avatar_url, 'bio', v.bio,
    'timezone', v.timezone, 'country_code', v.country_code, 'is_private', v.is_private,
    'followers_count', v.followers_count, 'following_count', v.following_count,
    'languages', public.user_languages_json(v.id),
    'relationship', jsonb_build_object(
      'is_me', v.id = auth.uid(),
      'following', (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = v.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = v.id and f.followee_id = auth.uid() and f.status = 'accepted')));
end $$;

create function public.respond_follow_request(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_follower = auth.uid() then raise exception 'cannot_follow_self'; end if;
  if p_accept then
    update follows set status = 'accepted'
    where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
    if not found then return; end if;
    if public.is_blocked_between(auth.uid(), p_follower) then
      delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'accepted';
      raise exception 'user_unavailable';
    end if;
    insert into follows (follower_id, followee_id, status)
    values (auth.uid(), p_follower, 'accepted')
    on conflict (follower_id, followee_id) do update set status = 'accepted';
  else
    delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  end if;
end $$;

create function public.list_follows(p_user uuid, p_kind text, p_limit int default 30, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, languages jsonb)
language plpgsql security definer set search_path = public as $$
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

create function public.delete_partner(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  delete from public.saved_partners where user_id = auth.uid() and partner_id = p_partner;
end $$;

create function public.list_saved_partner_ids()
returns table (partner_id uuid) language sql stable security definer set search_path = public as $$
  select partner_id from public.saved_partners where user_id = auth.uid();
$$;

create function public.save_partner(p_partner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_partner is null or p_partner = auth.uid() then raise exception 'cannot_save_self'; end if;
  if not exists (select 1 from public.profiles where id = p_partner and status = 'active' and onboarding_done)
     or public.is_blocked_between(auth.uid(), p_partner) then
    raise exception 'user_unavailable';
  end if;
  if not exists (select 1 from public.saved_partners where user_id = auth.uid() and partner_id = p_partner)
     and (select count(*) from public.saved_partners where user_id = auth.uid()) >= 100 then
    raise exception 'partner_limit';
  end if;
  insert into public.saved_partners (user_id, partner_id) values (auth.uid(), p_partner) on conflict do nothing;
end $$;

create function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_block_self'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  delete from public.follows where (follower_id = auth.uid() and followee_id = p_target) or (follower_id = p_target and followee_id = auth.uid());
  delete from public.saved_partners where (user_id = auth.uid() and partner_id = p_target) or (user_id = p_target and partner_id = auth.uid());
end $$;

create function public.match_pool()
returns table (teachers int, learners int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from profiles p, profiles m where m.id = auth.uid() and m.learning_language_id is not null
       and p.native_language_id = m.learning_language_id and p.id <> m.id and p.status = 'active' and p.onboarding_done
       and not public.is_blocked_between(m.id, p.id)),
    (select count(*)::int from profiles p, profiles m where m.id = auth.uid()
       and p.learning_language_id = m.native_language_id and p.id <> m.id and p.status = 'active' and p.onboarding_done
       and not public.is_blocked_between(m.id, p.id));
$$;

create function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    select me.native_language_id as native, me.learning_language_id as learning, me.timezone as tz
    from profiles me where me.id = auth.uid()
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      public.user_languages_json(p.id) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when p.native_language_id = mine.learning and p.learning_language_id = mine.native then 'swap'
        when p.native_language_id = mine.learning then 'native'
        when p.learning_language_id = mine.native then 'learning'
        else 'other'
      end as match_kind,
      case
        when p.native_language_id = mine.learning then p.native_language_id
        when p.learning_language_id = mine.native then p.learning_language_id
      end as match_language,
      date_trunc('day', greatest(p.created_at,
        (select max(m.created_at) from messages m where m.sender_id = p.id),
        (select max(c.created_at) from contribution_posts c where c.user_id = p.id))) as active_day,
      public.tz_hours_apart(p.timezone, mine.tz) as tz_apart
    from profiles p cross join mine
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  -- Every column is table-qualified: plpgsql would treat a bare "id" or "languages" as the
  -- function's OUT parameter and refuse the query as ambiguous.
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language
  from (
    (select c.* from candidates c where c.match_kind = 'swap'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'native'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'learning'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'other'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) feed
  order by array_position(array['swap', 'native', 'learning', 'other'], feed.match_kind),
    feed.active_day desc, feed.tz_apart asc nulls last, feed.created_at desc;
end $$;

create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text; v_role text; v_level text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;

  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  v_role := nullif(btrim(coalesce(p_role, '')), '');
  if v_role is not null and v_role not in ('native', 'learning') then v_role := null; end if;
  v_level := nullif(btrim(coalesce(p_level, '')), '');
  if v_level is not null and v_level not in ('A1','A2','B1','B2','C1','C2','Native') then v_level := null; end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count,
    public.user_languages_json(p.id),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    and ((v_lang is null and v_role is null and v_level is null)
      or exists (select 1 from user_languages ul
           join languages l on l.id = ul.language_id
           where ul.user_id = p.id
             and (v_lang is null or l.id = v_lang)
             and (v_role is null or ul.role = v_role)
             and (v_level is null or (case when ul.role = 'learning' then p.verified_level else ul.level end) = v_level)))
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

create trigger follows_counts after insert or update or delete on public.follows for each row execute function public.sync_follow_counts();
create trigger follows_notify after insert or update on public.follows for each row execute function public.trg_notify_follow();
create trigger staff_refused before insert on public.follows for each row execute function public.refuse_staff_learner_action();
create trigger staff_refused before insert on public.saved_partners for each row execute function public.refuse_staff_learner_action();

create policy "see own blocks" on public.blocks for select using (auth.uid() = blocker_id);
create policy "see own follow rows" on public.follows for select using (auth.uid() in (follower_id, followee_id));
create policy "profiles readable unless blocked" on public.profiles for select to authenticated
  using (auth.uid() = id or (status = 'active' and not public.is_blocked_between(auth.uid(), id)));
create policy "Users can view their own saved partners"
  on public.saved_partners for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on function
  public.is_blocked_between(uuid, uuid),
  public.sync_follow_counts(),
  public.follow_user(uuid),
  public.unfollow_user(uuid),
  public.list_follow_requests(),
  public.unblock_user(uuid),
  public.list_blocked(),
  public.trg_notify_follow(),
  public.get_profile(text),
  public.respond_follow_request(uuid, boolean),
  public.list_follows(uuid, text, integer, integer),
  public.delete_partner(uuid),
  public.list_saved_partner_ids(),
  public.save_partner(uuid),
  public.block_user(uuid),
  public.match_pool(),
  public.home_feed(integer, integer),
  public.search_people(text, text, text, text, text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.is_blocked_between(uuid, uuid),
  public.sync_follow_counts(),
  public.follow_user(uuid),
  public.unfollow_user(uuid),
  public.list_follow_requests(),
  public.unblock_user(uuid),
  public.list_blocked(),
  public.trg_notify_follow(),
  public.get_profile(text),
  public.respond_follow_request(uuid, boolean),
  public.list_follows(uuid, text, integer, integer),
  public.delete_partner(uuid),
  public.list_saved_partner_ids(),
  public.save_partner(uuid),
  public.block_user(uuid),
  public.match_pool(),
  public.home_feed(integer, integer),
  public.search_people(text, text, text, text, text, integer, integer)
to authenticated, service_role;
