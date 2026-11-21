-- Incoming and missed call notifications, through the existing notification feed and web push.
-- One row per event (dedupe keys), so the realtime banner and a push never make two notifications.
-- The incoming-call row is removed as soon as the invitation is answered, so the bell never shows a stale ring.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch', 'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed', 'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override', 'action_reminder', 'action_overdue', 'action_escalated', 'restriction_warning', 'restriction_applied', 'restriction_lifted', 'appeal_decided', 'correction_declined', 'correction_superseded', 'bounty_reminder', 'admin_report', 'admin_security', 'admin_appeal', 'admin_site', 'help_request', 'help_fix', 'help_thanked', 'call_incoming', 'call_missed'));

create function public.trg_call_invite_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.invitation_status = 'pending' then
      -- Required: a call can't wait for someone to look at their preferences. Blocks still suppress it.
      perform public.notify_event(new.user_id, new.invited_by, 'call_incoming', jsonb_build_object('call_id', new.call_id), 'call:' || new.call_id || ':incoming', true);
    end if;
  elsif old.invitation_status = 'pending' and new.invitation_status <> 'pending' then
    delete from notifications where user_id = new.user_id and dedupe_key = 'call:' || new.call_id || ':incoming';
    if new.invitation_status in ('expired', 'cancelled') then
      perform public.notify_event(new.user_id, new.invited_by, 'call_missed', jsonb_build_object('call_id', new.call_id), 'call:' || new.call_id || ':missed', false);
    end if;
  end if;
  return null;
end $$;

create trigger call_invite_notify after insert or update of invitation_status on public.call_participants
  for each row execute function public.trg_call_invite_notify();

revoke all on function public.trg_call_invite_notify() from public, anon, authenticated, service_role;
