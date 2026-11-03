-- Staff and learners get different notifications. Staff had the learner tabs (corrections, decisions, reminders),
-- none of which apply to them, while their own alerts sat under "System". Each side now sees only its own kind.

create function public.is_staff_notification(p_type text) returns boolean language sql immutable as $$
  select p_type in ('admin_report','admin_appeal','action_escalated','admin_security','admin_site') $$;
revoke execute on function public.is_staff_notification(text) from public, anon, authenticated;

create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('post_correction','post_challenged','post_clarification','post_reply','post_endorsed','correction','correction_accepted','help_request','help_fix','help_thanked') then 'corrections'
    when p_type in ('post_accepted','post_declined','post_withdrawn','post_superseded','post_resolved','post_reverted','post_override',
                    'correction_declined','correction_superseded') then 'decisions'
    when p_type in ('action_reminder','action_overdue','bounty_reminder') then 'reminders'
    when p_type = 'admin_report' then 'reports'
    when p_type in ('admin_appeal','action_escalated') then 'escalations'
    when p_type in ('admin_security','admin_site') then 'security'
    else 'system' end;
$$;

-- Someone removed from staff stops seeing report details the moment they leave. A staff member's name also never
-- reaches a learner: a moderator's override reads "A moderator", and carries no link to their account.
create or replace function public.list_notifications(p_limit integer default 30, p_before timestamptz default null, p_category text default null)
returns table (id uuid, type text, data jsonb, read_at timestamptz, created_at timestamptz, actor_id uuid, actor_username text, actor_name text, actor_avatar text, category text)
language sql stable security definer set search_path = public as $$
  select n.id, n.type, n.data, n.read_at, n.created_at, p.id, p.username, p.display_name, p.avatar_url, public.notification_category(n.type)
  from notifications n left join profiles p on p.id = n.actor_id and p.role = 'user'
  where n.user_id = auth.uid() and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
    and public.is_staff_notification(n.type) = (select public.staff_tier() is not null)
    and (p_before is null or n.created_at < p_before)
    and (p_category is null or public.notification_category(n.type) = p_category)
  order by n.created_at desc limit least(p_limit, 100) $$;

create or replace function public.count_unread_notifications() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications n
  where n.user_id = auth.uid() and n.read_at is null and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
    and public.is_staff_notification(n.type) = (select public.staff_tier() is not null) $$;

-- Appeals only showed as a number on the nav. Every moderator can answer one, so all staff hear about it.
create function public.notify_staff_of_appeal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_staff uuid;
begin
  for v_staff in select a.user_id from admin_accounts a join profiles p on p.id = a.user_id where p.status = 'active' loop
    perform public.notify_event(v_staff, null, 'admin_appeal', jsonb_build_object('appeal_id', new.id), 'appeal:' || new.id, true);
  end loop;
  return new;
end $$;
revoke execute on function public.notify_staff_of_appeal() from public, anon, authenticated;
create trigger restriction_appeals_notify_staff after insert on public.restriction_appeals for each row execute function public.notify_staff_of_appeal();
