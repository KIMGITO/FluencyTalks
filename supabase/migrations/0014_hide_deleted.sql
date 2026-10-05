-- 0014: deleted messages vanish globally — never a placeholder, never searchable.
-- list_conversations previews the last *visible* message (deleted rows are skipped,
-- "No messages yet" falls out as null), correction history drops deleted originals,
-- and report evidence snapshots skip deleted rows. Every reader checks deleted_at
-- first so a deleted body can never leak back into any UI.
create or replace function public.list_conversations(p_status text default 'active')
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

-- Correction history: a deleted original is gone everywhere, not kept as "[deleted]".
create or replace function public.list_my_corrections()
returns table (
  id uuid, message_id uuid, conversation_id uuid, original_text text,
  suggested_text text, note text, status text,
  corrector_id uuid, corrector_name text, corrector_username text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mc.id, mc.message_id, m.conversation_id,
         m.body,
         mc.suggested_text, mc.note, mc.status,
         mc.corrector_id, coalesce(p.display_name, p.username), p.username, mc.created_at
  from message_corrections mc
  join messages m on m.id = mc.message_id
  join profiles p on p.id = mc.corrector_id
  where m.sender_id = auth.uid()
    and m.deleted_at is null and m.body <> '[deleted]'
    and public.can_access_conversation(m.conversation_id)
  order by mc.created_at desc
  limit 200 $$;

-- Report evidence: snapshot only visible messages so moderators never see "[deleted]".
create or replace function public.report_user(p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null) returns uuid
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
