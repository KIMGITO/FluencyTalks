-- The notification feed, web push and the unread badges.

create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch', 'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed', 'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override', 'action_reminder', 'action_overdue', 'action_escalated', 'restriction_warning', 'restriction_applied', 'restriction_lifted', 'appeal_decided', 'correction_declined', 'correction_superseded', 'bounty_reminder', 'admin_report', 'admin_security', 'admin_appeal', 'admin_site', 'help_request', 'help_fix', 'help_thanked')),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text,
  push_claimed_at timestamptz
);
alter table public.notifications enable row level security;
create index notifications_read_at_idx on public.notifications (read_at) where read_at is not null;
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index notifications_user_time_idx on public.notifications (user_id, created_at desc, id);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
grant select on public.notifications to authenticated;

create table public.push_settings (
  id boolean default true primary key check (id),
  function_url text not null,
  webhook_secret text not null
);
alter table public.push_settings enable row level security;

create table public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null check ((char_length(endpoint) <= 1000) and (endpoint ~~ 'https://%')) unique,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
alter table public.push_subscriptions enable row level security;
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
grant select on public.push_subscriptions to authenticated;

create table public.message_push_claims (
  message_id uuid primary key,
  claimed_at timestamptz not null default now()
);
alter table public.message_push_claims enable row level security;
create index message_push_claims_claimed_idx on public.message_push_claims (claimed_at);

create table public.tab_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tab text not null check (tab in ('home', 'library', 'bounties')),
  seen_at timestamptz not null default now(),
  primary key (user_id, tab)
);
alter table public.tab_seen enable row level security;

create function public.notify(p_user uuid, p_actor uuid, p_type text, p_data jsonb default '{}') returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, type, data) select p_user, p_actor, p_type, p_data where p_user is distinct from p_actor $$;

create function public.mark_notifications_read(p_ids uuid[] default null) returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids)) $$;

create function public.delete_notifications(p_ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  delete from notifications where user_id = auth.uid() and (p_ids is null or id = any(p_ids)) $$;

create function public.notify_event(p_user uuid, p_actor uuid, p_type text, p_data jsonb, p_key text, p_required boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  if not p_required then
    if coalesce((select (notification_prefs->>public.notification_category(p_type))::boolean from profiles where id = p_user), true) is false then return; end if;
    if exists (select 1 from post_thread_mutes m where m.user_id = p_user and m.post_id = (p_data->>'post_id')::uuid) then return; end if;
  end if;
  if p_actor is not null and public.is_blocked_between(p_user, p_actor) then return; end if;
  insert into notifications (user_id, actor_id, type, data, dedupe_key) values (p_user, p_actor, p_type, p_data, p_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

create function public.set_notification_prefs(p_prefs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update profiles set notification_prefs = (
    select coalesce(jsonb_object_agg(k, (p_prefs->>k)::boolean), '{}') from unnest(array['corrections','decisions','system']) k where p_prefs ? k)
  where id = auth.uid();
end $$;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if (select count(*) from push_subscriptions where user_id = auth.uid() and endpoint <> p_endpoint) >= 10 then raise exception 'rate_limited'; end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create function public.trg_push_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.push_settings;
begin
  select * into cfg from push_settings;
  if cfg.function_url is null or not exists (select 1 from push_subscriptions where user_id = new.user_id) then return new; end if;
  perform net.http_post(
    url := cfg.function_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', cfg.webhook_secret));
  return new;
exception when others then
  raise warning 'push not queued: %', sqlerrm;
  return new;
end $$;

create function public.mark_tab_seen(p_tab text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_tab not in ('home', 'library', 'bounties') then raise exception 'invalid_tab'; end if;
  insert into tab_seen (user_id, tab) values (auth.uid(), p_tab)
  on conflict (user_id, tab) do update set seen_at = now();
end $$;

create function public.trg_push_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.push_settings;
begin
  select * into cfg from push_settings;
  if cfg.function_url is null then return new; end if;
  if not exists (select 1 from conversation_members cm join push_subscriptions s on s.user_id = cm.user_id
                 where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id and cm.status = 'active') then
    return new;
  end if;
  perform net.http_post(
    url := cfg.function_url,
    body := jsonb_build_object('message_id', new.id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', cfg.webhook_secret));
  return new;
exception when others then
  raise warning 'message push not queued: %', sqlerrm;
  return new;
end $$;

create function public.nav_badges() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; v_home timestamptz; v_library timestamptz; v_bounties timestamptz;
        v_default timestamptz := now() - interval '3 days';
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
            and not exists (select 1 from message_corrections mc where mc.message_id = m.id and mc.corrector_id = me.id) limit 100) x)
      + (select count(*) from (select 1 from contribution_posts c
          where c.post_type not in ('library', 'lesson') and c.review_status = 'awaiting_feedback' and c.created_at > v_bounties and c.user_id <> me.id
            and public.can_correct_language(me.id, c.language_id) and not public.is_blocked_between(me.id, c.user_id) limit 100) x));
end $$;

create function public.is_staff_notification(p_type text) returns boolean language sql immutable as $$
  select p_type in ('admin_report','admin_appeal','action_escalated','admin_security','admin_site') $$;

create function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('post_correction','post_challenged','post_clarification','post_reply','post_endorsed','correction','correction_accepted','help_request','help_fix','help_thanked') then 'corrections'
    when p_type in ('post_accepted','post_declined','post_withdrawn','post_superseded','post_resolved','post_reverted','post_override',
                    'correction_declined','correction_superseded') then 'decisions'
    when p_type in ('action_reminder','action_overdue','bounty_reminder','restriction_warning') then 'reminders'
    when p_type = 'admin_report' then 'reports'
    when p_type in ('admin_appeal','action_escalated') then 'escalations'
    when p_type in ('admin_security','admin_site') then 'security'
    else 'system' end;
$$;

create function public.list_notifications(p_limit integer default 30, p_before timestamptz default null, p_category text default null)
returns table (id uuid, type text, data jsonb, read_at timestamptz, created_at timestamptz, actor_id uuid, actor_username text, actor_name text, actor_avatar text, category text)
language sql stable security definer set search_path = public as $$
  select n.id, n.type, n.data, n.read_at, n.created_at, p.id, p.username, p.display_name, p.avatar_url, public.notification_category(n.type)
  from notifications n left join profiles p on p.id = n.actor_id and p.role = 'user'
  where n.user_id = auth.uid() and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
    and public.is_staff_notification(n.type) = (select public.staff_tier() is not null)
    and (p_before is null or n.created_at < p_before)
    and (p_category is null or public.notification_category(n.type) = p_category)
  order by n.created_at desc limit least(p_limit, 100) $$;

create function public.count_unread_notifications() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications n
  where n.user_id = auth.uid() and n.read_at is null and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
    and public.is_staff_notification(n.type) = (select public.staff_tier() is not null) $$;

create trigger notifications_push after insert on public.notifications for each row execute function public.trg_push_notification();

create policy "closed during a pause" on public.notifications as restrictive for select to authenticated using ((select public.app_open()));
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "read own push subscriptions" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

revoke all on function
  public.notify(uuid, uuid, text, jsonb),
  public.mark_notifications_read(uuid[]),
  public.delete_notifications(uuid[]),
  public.notify_event(uuid, uuid, text, jsonb, text, boolean),
  public.set_notification_prefs(jsonb),
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text),
  public.trg_push_notification(),
  public.mark_tab_seen(text),
  public.trg_push_message(),
  public.nav_badges(),
  public.is_staff_notification(text),
  public.notification_category(text),
  public.list_notifications(integer, timestamp with time zone, text),
  public.count_unread_notifications()
from public, anon, authenticated, service_role;

grant execute on function
  public.mark_notifications_read(uuid[]),
  public.delete_notifications(uuid[]),
  public.set_notification_prefs(jsonb),
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text),
  public.mark_tab_seen(text),
  public.nav_badges(),
  public.notification_category(text),
  public.list_notifications(integer, timestamp with time zone, text),
  public.count_unread_notifications()
to authenticated, service_role;

grant execute on function
  public.notify(uuid, uuid, text, jsonb),
  public.notify_event(uuid, uuid, text, jsonb, text, boolean)
to service_role;

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable (%), push stays off', sqlerrm;
end $$;
