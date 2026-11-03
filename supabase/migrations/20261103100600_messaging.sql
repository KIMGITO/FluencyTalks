-- Conversations, messages, reactions and read receipts.

create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  direct_key text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
grant select on public.conversations to authenticated;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'request', 'ignored')),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_members enable row level security;
create index conversation_members_user_id_status_idx on public.conversation_members (user_id, status);
grant select on public.conversation_members to authenticated;

create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check ((char_length(body) >= 1) and (char_length(body) <= 4000)),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  language_id text references public.languages(id),
  is_bounty boolean not null default false,
  bounty_cost int,
  bounty_status text not null default 'none' check (bounty_status in ('none', 'open', 'paid', 'refunded')),
  bounty_expires_at timestamptz,
  bounty_paid_to uuid references public.profiles(id) on delete set null,
  constraint messages_bounty_consistent check (is_bounty = (bounty_status <> 'none'))
);
alter table public.messages enable row level security;
create index messages_open_bounties_idx on public.messages (bounty_expires_at) where bounty_status = 'open';
create index messages_conv_created on public.messages (conversation_id, created_at desc);
create index messages_sender_id_created_at_idx on public.messages (sender_id, created_at desc);
grant select on public.messages to authenticated;

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 40),
  constraint message_reactions_one_per_user unique (message_id, user_id),
  primary key (message_id, user_id, emoji)
);
alter table public.message_reactions enable row level security;
grant select on public.message_reactions to authenticated;

alter table public.message_push_claims add constraint message_push_claims_message_id_fkey foreign key (message_id) references public.messages(id) on delete cascade;

create function public.can_access_conversation(p_conv uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members m where m.conversation_id = p_conv and m.user_id = auth.uid())
     and not exists (select 1 from conversation_members o where o.conversation_id = p_conv and o.user_id <> auth.uid() and public.is_blocked_between(auth.uid(), o.user_id)) $$;

create function public.start_conversation(p_target uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_key text; v_id uuid; v_status text;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_message_self'; end if;
  if not exists (select 1 from profiles where id = p_target and status = 'active') or public.is_blocked_between(auth.uid(), p_target) then raise exception 'user_unavailable'; end if;
  v_key := least(auth.uid()::text, p_target::text) || ':' || greatest(auth.uid()::text, p_target::text);
  select id into v_id from conversations where direct_key = v_key;
  if v_id is null then
    if (select count(*) from conversations where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;
    insert into conversations (direct_key, created_by) values (v_key, auth.uid()) returning id into v_id;
    v_status := case when exists (select 1 from follows where follower_id = p_target and followee_id = auth.uid() and status = 'accepted') then 'active' else 'request' end;
    insert into conversation_members (conversation_id, user_id, status) values (v_id, auth.uid(), 'active'), (v_id, p_target, v_status);
  end if;
  return v_id;
end $$;

create function public.respond_message_request(p_conv uuid, p_accept boolean) returns void language sql security definer set search_path = public as $$
  update conversation_members set status = case when p_accept then 'active' else 'ignored' end
  where conversation_id = p_conv and user_id = auth.uid() and status = 'request' $$;

create function public.mark_read(p_conv uuid) returns void language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = auth.uid() $$;

create function public.edit_message(p_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update messages set body = left(btrim(p_body), 4000), edited_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null and char_length(btrim(p_body)) > 0;
end $$;

create function public.trg_notify_request() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'request' then perform public.notify(new.user_id, (select created_by from conversations where id = new.conversation_id), 'message_request', jsonb_build_object('conversation_id', new.conversation_id)); end if;
  return null;
end $$;

create function public.search_messages(p_query text default null, p_conversation uuid default null, p_limit int default 20, p_offset int default 0)
returns table (message_id uuid, conversation_id uuid, body text, created_at timestamptz, sender_id uuid, sender_name text, sender_username text, sender_avatar text, other_id uuid, other_name text, other_username text, other_avatar text)
language plpgsql security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  v_q := nullif(btrim(coalesce(p_query, '')), '');
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select m.id, m.conversation_id, m.body, m.created_at,
    s.id, s.display_name, s.username, s.avatar_url,
    o.id, o.display_name, o.username, o.avatar_url
  from messages m
  join conversation_members me on me.conversation_id = m.conversation_id and me.user_id = auth.uid() and me.status in ('active', 'request')
  join profiles s on s.id = m.sender_id
  join conversation_members om on om.conversation_id = m.conversation_id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  where m.deleted_at is null and o.status = 'active'
    and not public.is_blocked_between(auth.uid(), o.id)
    and not public.is_blocked_between(auth.uid(), s.id)
    and (p_conversation is null or m.conversation_id = p_conversation)
    and (v_like is null or m.body ilike v_like)
  order by m.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

create function public.toggle_reaction(p_message uuid, p_emoji text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  perform assert_active();
  select conversation_id into v_conv from messages where id = p_message;
  if v_conv is null or not public.can_access_conversation(v_conv) then raise exception 'conversation_unavailable'; end if;
  if exists (select 1 from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji) then
    delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji; return false;
  end if;
  delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji <> p_emoji;
  insert into message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji); return true;
end $$;

create function public.list_conversations(p_status text default 'active')
returns table (conversation_id uuid, other_user_id uuid, other_name text, other_username text, other_avatar text, last_body text, last_at timestamptz, unread_count bigint, status text)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.display_name, o.username, o.avatar_url,
    lm.body,
    c.last_message_at,
    (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null and m.body <> '[deleted]' and m.created_at > me.last_read_at),
    me.status
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members om on om.conversation_id = c.id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  left join lateral (select body from messages where conversation_id = c.id and deleted_at is null and body <> '[deleted]' order by created_at desc limit 1) lm on true
  where me.user_id = auth.uid() and me.status = p_status and not public.is_blocked_between(auth.uid(), o.id)
  order by c.last_message_at desc limit 50 $$;

create function public.send_message(p_conv uuid, p_body text, p_reply_to uuid default null,
                                    p_language text default null, p_bounty boolean default false)
returns public.messages language plpgsql security definer set search_path = public as $$
declare
  m public.messages; v_other_status text; v_body text := btrim(p_body);
  me public.profiles; v_lang text := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
begin
  perform assert_active();
  if not public.can_access_conversation(p_conv) then raise exception 'conversation_unavailable'; end if;
  if v_body is null or char_length(v_body) = 0 then raise exception 'empty_message'; end if;
  select * into me from public.profiles where id = auth.uid();

  if v_lang is null then
    v_lang := coalesce(me.learning_language_id, me.native_language_id);
  elsif v_lang is distinct from me.native_language_id and v_lang is distinct from me.learning_language_id then
    raise exception 'language_not_yours';
  end if;

  select status into v_other_status from public.conversation_members where conversation_id = p_conv and user_id <> auth.uid();
  if v_other_status = 'request' and exists (select 1 from public.messages where conversation_id = p_conv and sender_id = auth.uid()) then raise exception 'awaiting_acceptance'; end if;
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then raise exception 'rate_limited'; end if;
  if p_reply_to is not null and not exists (select 1 from public.messages where id = p_reply_to and conversation_id = p_conv) then raise exception 'invalid_reply'; end if;

  if coalesce(p_bounty, false) then
    perform public.refund_expired_bounties();
    if v_lang is null then raise exception 'bounty_needs_language'; end if;
    if (select count(*) from public.messages where sender_id = auth.uid() and bounty_status = 'open') >= 3 then raise exception 'too_many_bounties'; end if;
    if me.points_balance < 50 then raise exception 'insufficient_points'; end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body, reply_to, language_id, is_bounty, bounty_cost, bounty_status, bounty_expires_at)
  values (p_conv, auth.uid(), v_body, p_reply_to, v_lang, coalesce(p_bounty, false),
          case when coalesce(p_bounty, false) then 50 end,
          case when coalesce(p_bounty, false) then 'open' else 'none' end,
          case when coalesce(p_bounty, false) then now() + interval '48 hours' end)
  returning * into m;
  if coalesce(p_bounty, false) then
    perform public.award_points(auth.uid(), -50, 'bounty_posted', 'message', m.id);
  end if;
  update public.conversations set last_message_at = m.created_at where id = p_conv;
  update public.conversation_members set last_read_at = m.created_at where conversation_id = p_conv and user_id = auth.uid();
  return m;
end $$;

create function public.delete_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.messages set deleted_at = now(), body = '[deleted]' where id = p_id and sender_id = auth.uid();
  perform public.refund_expired_bounties();
end $$;

create function public.presence_of(p_users uuid[])
returns table (user_id uuid, online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pr.user_id,
    pr.last_seen_at > now() - interval '70 seconds',
    case when exists (
      select 1 from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
      where a.user_id = auth.uid() and b.user_id = pr.user_id and a.status = 'active' and b.status = 'active'
    ) then pr.last_seen_at end
  from user_presence pr
  join profiles p on p.id = pr.user_id and p.status = 'active' and p.show_activity
  where pr.user_id = any((p_users)[1:100]) and pr.user_id <> auth.uid()
    and (select show_activity from profiles where id = auth.uid())
    and not public.is_blocked_between(auth.uid(), pr.user_id);
$$;

create function public.peer_read_at(p_conv uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select m.last_read_at from conversation_members m
  where m.conversation_id = p_conv and m.user_id <> auth.uid() and public.can_access_conversation(p_conv)
  order by m.last_read_at desc limit 1
$$;

create function public.avatar_room_left(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) < 5 or bool_or(o.name = p_name) from storage.objects o
  where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = auth.uid()::text $$;

create trigger members_notify after insert on public.conversation_members for each row execute function public.trg_notify_request();
create trigger staff_refused before insert on public.conversation_members for each row execute function public.refuse_staff_learner_action();
create trigger staff_refused before insert on public.conversations for each row execute function public.refuse_staff_learner_action();
create trigger staff_refused before insert on public.message_reactions for each row execute function public.refuse_staff_learner_action();
create trigger messages_push after insert on public.messages for each row execute function public.trg_push_message();
create trigger staff_refused before insert on public.messages for each row execute function public.refuse_staff_learner_action();

create policy "closed during a pause" on public.conversation_members as restrictive for select to authenticated using ((select public.app_open()));
create policy "read members" on public.conversation_members for select using (public.can_access_conversation(conversation_id));
create policy "read my conversations" on public.conversations for select using (public.can_access_conversation(id));
create policy "closed during a pause" on public.message_reactions as restrictive for select to authenticated using ((select public.app_open()));
create policy "read reactions" on public.message_reactions for select using (exists (select 1 from public.messages m where m.id = message_id));
create policy "closed during a pause" on public.messages as restrictive for select to authenticated using ((select public.app_open()));
create policy "read messages" on public.messages for select using (public.can_access_conversation(conversation_id));
create policy "chat members receive typing" on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast' and realtime.topic() like 'ft-chat:%'
  and public.can_access_conversation(substr(realtime.topic(), 9)::uuid) and (select public.app_open()));
create policy "chat members send typing" on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast' and realtime.topic() like 'ft-chat:%'
  and public.can_access_conversation(substr(realtime.topic(), 9)::uuid) and (select public.app_open()));
create policy "avatars insert own" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  and lower(name) ~ '\.(jpe?g|png|webp)$'
  and public.avatar_room_left(name));

alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.messages;

revoke all on function
  public.can_access_conversation(uuid),
  public.start_conversation(uuid),
  public.respond_message_request(uuid, boolean),
  public.mark_read(uuid),
  public.edit_message(uuid, text),
  public.trg_notify_request(),
  public.search_messages(text, uuid, integer, integer),
  public.toggle_reaction(uuid, text),
  public.list_conversations(text),
  public.send_message(uuid, text, uuid, text, boolean),
  public.delete_message(uuid),
  public.presence_of(uuid[]),
  public.peer_read_at(uuid),
  public.avatar_room_left(text)
from public, anon, authenticated, service_role;

grant execute on function
  public.avatar_room_left(text)
to authenticated;

grant execute on function
  public.can_access_conversation(uuid),
  public.start_conversation(uuid),
  public.respond_message_request(uuid, boolean),
  public.mark_read(uuid),
  public.edit_message(uuid, text),
  public.trg_notify_request(),
  public.search_messages(text, uuid, integer, integer),
  public.toggle_reaction(uuid, text),
  public.list_conversations(text),
  public.send_message(uuid, text, uuid, text, boolean),
  public.delete_message(uuid),
  public.presence_of(uuid[]),
  public.peer_read_at(uuid)
to authenticated, service_role;
