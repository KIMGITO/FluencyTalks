-- 0004: reporting, moderation, bans.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in ('harassment','spam','inappropriate','impersonation','underage','scam','other')),
  details text check (char_length(details) <= 1000),
  evidence jsonb not null default '[]',                  -- snapshot of recent messages at report time
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null, resolved_at timestamptz,
  created_at timestamptz not null default now());
create index on public.reports (status, created_at);
create index on public.reports (target_user_id, created_at);
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(), admin_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('suspend','ban','reinstate','dismiss_report','auto_suspend')), reason text, created_at timestamptz not null default now());
create table public.banned_emails (email_hash text primary key, created_at timestamptz not null default now());

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.banned_emails enable row level security;
create policy "admins read reports" on public.reports for select using (public.is_admin());
create policy "admins read actions" on public.moderation_actions for select using (public.is_admin());
-- banned_emails: no policies => no client access at all.

create function public.email_hash(p_email text) returns text language sql immutable as $$
  select encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex') $$;

-- Banned emails cannot sign up again.
create function public.block_banned_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from banned_emails where email_hash = public.email_hash(new.email)) then raise exception 'signup_not_allowed'; end if;
  return new;
end $$;
create trigger auth_block_banned before insert on auth.users for each row execute function public.block_banned_signup();

create function public.report_user(p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evidence jsonb := '[]'; v_recent int;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_report_self'; end if;
  if p_conversation is not null and public.can_access_conversation(p_conversation) then
    select coalesce(jsonb_agg(e order by e->>'created_at'), '[]') into v_evidence from (
      select jsonb_build_object('id', id, 'sender_id', sender_id, 'body', body, 'created_at', created_at) as e
      from messages where conversation_id = p_conversation order by created_at desc limit 20) t;
  end if;
  insert into reports (reporter_id, target_user_id, conversation_id, reason, details, evidence)
  values (auth.uid(), p_target, p_conversation, p_reason, left(p_details, 1000), v_evidence) returning id into v_id;

  -- Many independent reporters in a week => restrict until a human reviews. Cheap defence against abuse waves.
  select count(distinct reporter_id) into v_recent from reports where target_user_id = p_target and created_at > now() - interval '7 days';
  if v_recent >= 5 then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set status = 'suspended' where id = p_target and status = 'active' and role = 'user';
    insert into moderation_actions (target_user_id, action, reason) values (p_target, 'auto_suspend', v_recent || ' reports in 7 days');
  end if;
  return v_id;
end $$;

create function public.admin_list_reports(p_status text default 'open') returns setof public.reports
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from reports where status = p_status order by created_at limit 100;
end $$;

create function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default null, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'invalid_status'; end if;
  if exists (select 1 from profiles where id = p_user and role <> 'user') and not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then raise exception 'forbidden'; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set status = p_status where id = p_user;
  if p_status = 'banned' then
    select email into v_email from auth.users where id = p_user;
    if v_email is not null then insert into banned_emails (email_hash) values (public.email_hash(v_email)) on conflict do nothing; end if;
  elsif p_status = 'active' then
    delete from banned_emails where email_hash = (select public.email_hash(email) from auth.users where id = p_user);
  end if;
  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), p_user, case p_status when 'active' then 'reinstate' when 'banned' then 'ban' else 'suspend' end, p_reason);
  if p_report is not null then update reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now() where id = p_report; end if;
end $$;

create function public.admin_dismiss_report(p_report uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where id = p_report;
  insert into moderation_actions (admin_id, action, reason) values (auth.uid(), 'dismiss_report', p_report::text);
end $$;
