-- 0005: avatars bucket, notifications, consent records, data export, function grants.

-- ---------- Avatars (public read, users write only inside their own folder: avatars/<uid>/...) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow','follow_request','follow_accepted','message_request','correction')),
  data jsonb not null default '{}', read_at timestamptz, created_at timestamptz not null default now());
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);
alter publication supabase_realtime add table public.notifications;

create function public.notify(p_user uuid, p_actor uuid, p_type text, p_data jsonb default '{}') returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, type, data) select p_user, p_actor, p_type, p_data where p_user is distinct from p_actor $$;

create function public.trg_notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.notify(new.followee_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  elsif old.status = 'pending' and new.status = 'accepted' then perform public.notify(new.follower_id, new.followee_id, 'follow_accepted'); end if;
  return null;
end $$;
create trigger follows_notify after insert or update on public.follows for each row execute function public.trg_notify_follow();

create function public.trg_notify_request() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'request' then perform public.notify(new.user_id, (select created_by from conversations where id = new.conversation_id), 'message_request', jsonb_build_object('conversation_id', new.conversation_id)); end if;
  return null;
end $$;
create trigger members_notify after insert on public.conversation_members for each row execute function public.trg_notify_request();

create function public.trg_notify_correction() returns trigger language plpgsql security definer set search_path = public as $$
declare m messages;
begin
  select * into m from messages where id = new.message_id;
  perform public.notify(m.sender_id, new.corrector_id, 'correction', jsonb_build_object('conversation_id', m.conversation_id, 'message_id', m.id));
  return null;
end $$;
create trigger corrections_notify after insert on public.message_corrections for each row execute function public.trg_notify_correction();

create function public.mark_notifications_read(p_ids uuid[] default null) returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids)) $$;

-- ---------- Consent records (terms, privacy, 18+) ----------
create table public.consents (
  user_id uuid references public.profiles(id) on delete cascade, kind text not null check (kind in ('terms','privacy','age_18')),
  version text not null, accepted_at timestamptz not null default now(), primary key (user_id, kind, version));
alter table public.consents enable row level security;
create policy "read own consents" on public.consents for select using (auth.uid() = user_id);
create function public.record_consent(p_kind text, p_version text) returns void language sql security definer set search_path = public as $$
  insert into consents (user_id, kind, version) values (auth.uid(), p_kind, p_version) on conflict do nothing $$;

-- ---------- GDPR-style export (account deletion = Edge Function `delete-account`, FKs cascade) ----------
create function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'));
end $$;

-- ---------- Grants: only signed-in users may call functions. Re-run this block after adding new functions. ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
