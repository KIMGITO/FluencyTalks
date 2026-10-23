-- 20241023000003: Safety & Social
-- Consolidates: 0004, 0005, 0015, 0017, 0031

-- ---------- 1. Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 2. Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow','follow_request','follow_accepted','message_request','correction')),
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "delete own notifications" on public.notifications for delete using (auth.uid() = user_id);
alter publication supabase_realtime add table public.notifications;

-- ---------- 3. Reports & Moderation ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in (
    'harassment', 'spam', 'inappropriate', 'impersonation', 'underage', 'scam',
    'fake_correction', 'points_abuse', 'other')),
  details text check (char_length(details) <= 1000),
  evidence jsonb not null default '[]',
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reports (status, created_at);
create index on public.reports (target_user_id, created_at);
alter table public.reports enable row level security;
create policy "admins read reports" on public.reports for select using (public.is_admin());

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('suspend','ban','reinstate','dismiss_report','auto_suspend')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;
create policy "admins read actions" on public.moderation_actions for select using (public.is_admin());


-- ---------- Functions ----------
create function public.respond_follow_request(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_follower = auth.uid() then raise exception 'cannot_follow_self'; end if;
  if p_accept then
    update follows set status = 'accepted' where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
    if not found then return; end if;
    if public.is_blocked_between(auth.uid(), p_follower) then
      delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'accepted';
      raise exception 'user_unavailable';
    end if;
    insert into follows (follower_id, followee_id, status) values (auth.uid(), p_follower, 'accepted')
    on conflict (follower_id, followee_id) do update set status = 'accepted';
  else
    delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  end if;
end $$;

create function public.report_user(p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evidence jsonb := '[]'; v_recent int;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_report_self'; end if;
  if p_conversation is not null and public.can_access_conversation(p_conversation) then
    select coalesce(jsonb_agg(e order by e->>'created_at'), '[]') into v_evidence from (
      select jsonb_build_object('id', id, 'sender_id', sender_id, 'body', body, 'created_at', created_at) as e
      from messages where conversation_id = p_conversation and deleted_at is null and body <> '[deleted]' order by created_at desc limit 20) t;
  end if;
  insert into reports (reporter_id, target_user_id, conversation_id, reason, details, evidence)
  values (auth.uid(), p_target, p_conversation, p_reason, left(p_details, 1000), v_evidence) returning id into v_id;

  select count(distinct reporter_id) into v_recent from reports where target_user_id = p_target and created_at > now() - interval '7 days';
  if v_recent >= 5 then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set status = 'suspended' where id = p_target and status = 'active' and role = 'user';
    insert into moderation_actions (target_user_id, action, reason) values (p_target, 'auto_suspend', v_recent || ' reports in 7 days');
  end if;
  return v_id;
end $$;

grant execute on all functions in schema public to authenticated, service_role;
