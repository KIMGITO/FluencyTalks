-- Counts for the navigation badges. NEW migration. Never edit past migrations.
-- "New" means since you last opened that tab, remembered per account (not per device) in tab_seen.
--   home      new people who match your languages (they teach you, or you teach them)
--   library   new posts by others in your two languages
--   bounties  answers waiting for your decision + new bounties you can answer
-- Messages and the bell are counted from their own tables by the app already.

create table public.tab_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tab text not null check (tab in ('home', 'library', 'bounties')),
  seen_at timestamptz not null default now(),
  primary key (user_id, tab));
alter table public.tab_seen enable row level security;   -- no policies: only the functions below touch it

create function public.mark_tab_seen(p_tab text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_tab not in ('home', 'library', 'bounties') then raise exception 'invalid_tab'; end if;
  insert into tab_seen (user_id, tab) values (auth.uid(), p_tab)
  on conflict (user_id, tab) do update set seen_at = now();
end $$;

create function public.nav_badges() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; v_home timestamptz; v_library timestamptz; v_bounties timestamptz;
        v_default timestamptz := now() - interval '3 days';   -- first visit: only what's fairly fresh
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.status <> 'active' then return '{}'::jsonb; end if;
  select coalesce(max(seen_at) filter (where tab = 'home'), v_default),
         coalesce(max(seen_at) filter (where tab = 'library'), v_default),
         coalesce(max(seen_at) filter (where tab = 'bounties'), v_default)
    into v_home, v_library, v_bounties
  from tab_seen where user_id = auth.uid();
  return jsonb_build_object(
    'home', (select count(*) from (select 1 from profiles p
              where p.created_at > v_home and p.id <> me.id and p.status = 'active' and p.onboarding_done
                and ((me.learning_language_id is not null and p.native_language_id = me.learning_language_id)
                  or (me.native_language_id is not null and p.learning_language_id = me.native_language_id))
                and not public.is_blocked_between(me.id, p.id) limit 100) x),
    'library', (select count(*) from (select 1 from contribution_posts c
              where c.created_at > v_library and c.user_id <> me.id
                and c.language_id in (me.native_language_id, me.learning_language_id)
                and not public.is_blocked_between(me.id, c.user_id) limit 100) x),
    'bounties',
      (select count(*) from message_corrections mc join messages m on m.id = mc.message_id
        where m.sender_id = me.id and m.bounty_status = 'open' and mc.status = 'pending')
      + (select count(*) from (select 1 from messages m
          where m.bounty_status = 'open' and m.deleted_at is null and m.created_at > v_bounties and m.sender_id <> me.id
            and m.bounty_expires_at > now() and public.can_correct_language(me.id, m.language_id) and m.language_id is not null
            and not public.is_blocked_between(me.id, m.sender_id)
            and not exists (select 1 from message_corrections mc where mc.message_id = m.id and mc.corrector_id = me.id) limit 100) x));
end $$;

revoke execute on function public.mark_tab_seen(text) from public, anon;
grant  execute on function public.mark_tab_seen(text) to authenticated, service_role;
revoke execute on function public.nav_badges() from public, anon;
grant  execute on function public.nav_badges() to authenticated, service_role;
