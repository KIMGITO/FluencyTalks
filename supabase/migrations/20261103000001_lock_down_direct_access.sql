-- The app reads through RLS and writes through functions, but the tables still carried Supabase's default
-- grants, so anything RLS happened to allow could be done straight from the REST API, around those functions.
-- Each table now has only what the app actually uses. Details: docs/SECURITY.md.

-- ---------- 1. Table privileges ----------
revoke all on all tables in schema public from anon, authenticated;
-- A new table starts closed. Grant what it needs in the migration that creates it.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Signed out: the language and country lists, and whether the app is up. Nothing about any person.
grant select on public.languages, public.countries, public.app_status to anon;

grant select on public.languages, public.countries, public.app_status, public.level_rules,
  public.blocks, public.consents, public.contribution_posts, public.conversation_members, public.conversations,
  public.decision_items, public.follows, public.message_corrections, public.message_reactions, public.messages,
  public.moderation_actions, public.notifications, public.points_ledger, public.post_discussion, public.push_subscriptions,
  public.reports, public.restriction_appeals, public.saved_partners, public.saved_phrases, public.saved_posts,
  public.translation_history, public.user_languages, public.user_restrictions
to authenticated;
grant delete on public.saved_phrases, public.translation_history to authenticated;

-- ---------- 2. Profiles ----------
-- What a post or a correction shows about its author, and no more. A full profile comes from get_profile(),
-- which respects blocks. This hides role (who is staff), points, notification settings, timezone and private bios.
grant select (id, username, display_name, avatar_url) on public.profiles to authenticated;
-- Writes go through save_profile() and friends. The update policy let anyone set their own accountability_exempt.
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "profiles readable unless blocked" on public.profiles;
create policy "profiles readable unless blocked" on public.profiles for select to authenticated
  using (auth.uid() = id or (status = 'active' and not public.is_blocked_between(auth.uid(), id)));

-- Your own row, in full. The columns above can't express "all of them, but only for me".
create function public.get_my_profile() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid() $$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;

-- ---------- 3. Rows anyone could read or change around the rules ----------
-- Readable by anyone with the public API key, signed in or not. The app only reads its own; profiles use user_languages_json().
drop policy if exists "languages readable" on public.user_languages;
create policy "read own languages" on public.user_languages for select to authenticated using (auth.uid() = user_id);

-- Direct delete skipped delete_contribution(), and with it the rule about open decisions.
drop policy if exists "Users can delete their own contribution posts" on public.contribution_posts;
drop policy if exists "delete own notifications" on public.notifications;

-- Direct writes skipped save_phrase(). Public phrases are served by search_phrases(); this policy also put
-- everyone's public phrases into "my phrasebook" reads, which have no filter of their own.
drop policy if exists "own phrases" on public.saved_phrases;
drop policy if exists "read public phrases" on public.saved_phrases;
create policy "read own phrases" on public.saved_phrases for select to authenticated using (auth.uid() = user_id);
create policy "delete own phrases" on public.saved_phrases for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "own translations" on public.translation_history;
create policy "read own translations" on public.translation_history for select to authenticated using (auth.uid() = user_id);
create policy "delete own translations" on public.translation_history for delete to authenticated using (auth.uid() = user_id);

-- Told anyone holding a conversation id when its members last read it.
create or replace function public.peer_read_at(p_conv uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select m.last_read_at from conversation_members m
  where m.conversation_id = p_conv and m.user_id <> auth.uid() and public.can_access_conversation(p_conv)
  order by m.last_read_at desc limit 1
$$;

-- ---------- 4. Avatars ----------
-- The bucket stays public, so a photo opens from its URL and needs no read policy for that. This policy only
-- added the ability to list the bucket, which hands out every user id with a photo.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- One photo each, plus a little room: without a cap, one account could fill the project's storage.
-- A function, because a policy on storage.objects that reads storage.objects is refused as recursive.
-- Replacing a file you already have takes no more room, so that always passes.
create function public.avatar_room_left(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) < 5 or bool_or(o.name = p_name) from storage.objects o
  where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = auth.uid()::text $$;
revoke execute on function public.avatar_room_left(text) from public, anon;
grant execute on function public.avatar_room_left(text) to authenticated;

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  and lower(name) ~ '\.(jpe?g|png|webp)$'
  and public.avatar_room_left(name));

create policy "no uploads during a pause" on storage.objects as restrictive for all to authenticated
  using ((select public.app_open())) with check ((select public.app_open()));

-- profiles.avatar_url loads in other people's browsers, so a URL of the user's choosing could log who views
-- them. Only their own folder here or a sign-in provider's photo. Signup metadata and auth.updateUser() both
-- pass through here too. An existing value stays, so nobody loses a photo over this.
create function public.is_allowed_avatar_url(p_user uuid, p_url text) returns boolean
language sql stable set search_path = public as $$
  select p_url ~ ('^https?://([a-z0-9-]+\.supabase\.co|127\.0\.0\.1(:[0-9]+)?|localhost(:[0-9]+)?)/storage/v1/object/public/avatars/' || p_user::text || '/[^/?#]+([?][^/#]*)?$')
      or p_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/[^[:space:]]*$' $$;
revoke execute on function public.is_allowed_avatar_url(uuid, text) from public, anon, authenticated;

create function public.guard_avatar_url() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is null or (tg_op = 'UPDATE' and new.avatar_url is not distinct from old.avatar_url) then return new; end if;
  if not public.is_allowed_avatar_url(new.id, new.avatar_url) then
    new.avatar_url := case when tg_op = 'UPDATE' then old.avatar_url end;
  end if;
  return new;
end $$;
revoke execute on function public.guard_avatar_url() from public, anon, authenticated;
create trigger profiles_guard_avatar before insert or update of avatar_url on public.profiles for each row execute function public.guard_avatar_url();

-- ---------- 5. Typing indicators ----------
-- A public realtime channel: anyone holding a conversation id could listen in or fake typing. It's private now,
-- so joining and sending are checked here. Old bundles keep their public channel; it just stops mattering.
create policy "chat members receive typing" on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast' and realtime.topic() like 'ft-chat:%'
  and public.can_access_conversation(substr(realtime.topic(), 9)::uuid) and (select public.app_open()));
create policy "chat members send typing" on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast' and realtime.topic() like 'ft-chat:%'
  and public.can_access_conversation(substr(realtime.topic(), 9)::uuid) and (select public.app_open()));
