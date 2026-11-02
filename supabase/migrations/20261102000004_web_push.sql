-- Web push for notifications. NEW migration. Never edit past migrations.
--
-- A notifications row is still the one source of truth: push only delivers it, and only rows that
-- passed notify_event's preferences and mutes exist at all. After a row commits, pg_net calls the
-- send-push edge function, which claims the row (push_claimed_at) so it can go out once.
-- Nothing is sent until push_settings is filled in after deploy; until then this file changes nothing.

-- pg_net makes the call to the edge function. Not fatal where it can't be enabled: push just stays off.
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable (%), push stays off', sqlerrm;
end $$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  last_success_at timestamptz);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "read own push subscriptions" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

-- One row, written by hand after deploy. No policies: only security definer code reads it.
create table public.push_settings (
  id boolean primary key default true check (id),
  function_url text not null,
  webhook_secret text not null);
alter table public.push_settings enable row level security;

alter table public.notifications add column if not exists push_claimed_at timestamptz;

-- A device belongs to whoever is signed in on it now: signing in as someone else takes it over.
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

-- Runs after commit (pg_net queues it), so a rolled-back event never buzzes a phone.
-- Push failing must never stop the event that caused it.
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
create trigger notifications_push after insert on public.notifications for each row execute function public.trg_push_notification();

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant  execute on function public.save_push_subscription(text, text, text) to authenticated, service_role;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant  execute on function public.delete_push_subscription(text) to authenticated, service_role;
revoke execute on function public.trg_push_notification() from public, anon, authenticated;
