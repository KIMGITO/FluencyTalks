-- 0005: Notifications — avatars bucket, notifications table, trigger logic.
-- Stands alone; no other file merges into this concept.

-- ---------- Avatars bucket ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Notifications table ----------

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

-- ---------- Notification triggers ----------

-- Notify on follow/accept
create or replace function public.trg_notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.notify(new.followee_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  elsif old.status = 'pending' and new.status = 'accepted' then perform public.notify(new.follower_id, new.followee_id, 'follow_accepted'); end if;
  return null;
end $$;
create trigger follows_notify after insert or update on public.study_partners for each row execute function public.trg_notify_follow();

-- Notify on message correction
create or replace function public.trg_notify_correction() returns trigger language plpgsql security definer set search_path = public as $$
declare m message;
begin
  select * into m from messages where id = new.message_id;
  perform public.notify(m.sender_id, new.corrector_id, 'correction', jsonb_build_object('conversation_id', m.conversation_id, 'message_id', m.id));
  return null;
end $$;
create trigger corrections_notify after insert on public.message_corrections for each row execute function public.trg_notify_correction();

-- General notify function
create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_data jsonb default '{}') returns void language sql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type, data) values (p_user, p_actor, p_type, p_data) where p_user is distinct from p_actor;
end $$;