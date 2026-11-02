-- Fix: 20261102000003 had two UPDATEs with no WHERE, on the one-row accountability_policy table. Plain Postgres
-- allows that. Real Supabase refuses it through the API ("UPDATE requires a WHERE clause"), and
-- post_contribution calls the sweep, so creating a post failed. A new migration, not an edit, so this also
-- repairs a database where 20261102000003 has already run.

create or replace function public.accountability_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare pol public.accountability_policy; i record; v_data jsonb; n int := 0; v_user uuid; v_mod uuid;
begin
  select * into pol from accountability_policy;
  update accountability_policy set last_sweep_at = now() where id;   -- real Supabase refuses an UPDATE with no WHERE
  if not pol.enabled then return 0; end if;
  for i in
    select d.*, p.phrase, p.current_phrase, u.accountability_exempt as exempt, u.status as owner_status, x.author_id as item_author
    from decision_items d join contribution_posts p on p.id = d.post_id join profiles u on u.id = d.user_id join post_discussion x on x.id = d.item_id
    where d.resolved_at is null
  loop
    v_data := jsonb_build_object('post_id', i.post_id, 'item_id', i.item_id, 'phrase', left(coalesce(i.current_phrase, i.phrase), 80), 'due_at', i.due_at);
    -- Before the deadline: remind, then keep reminding.
    if i.due_at > now() and not i.exempt and (
         (i.reminder_count = 0 and i.created_at <= now() - make_interval(hours => pol.first_reminder_hours))
      or (i.reminder_count > 0 and i.last_reminded_at <= now() - make_interval(hours => pol.repeat_reminder_hours))) then
      update decision_items set reminder_count = reminder_count + 1, last_reminded_at = now() where id = i.id;
      perform public.notify_event(i.user_id, null, 'action_reminder', v_data, 'reminder:' || i.id || ':' || (i.reminder_count + 1), true);
      n := n + 1;
    end if;
    -- Past the deadline: say so, to the owner and to the person waiting.
    if i.due_at <= now() and i.overdue_notified_at is null and not i.exempt then
      update decision_items set overdue_notified_at = now() where id = i.id;
      perform public.notify_event(i.user_id, null, 'action_overdue', v_data, 'overdue:' || i.id || ':' || extract(epoch from i.due_at)::bigint, true);
      perform public.notify_event(i.item_author, null, 'action_overdue', v_data || '{"waiting":true}', 'overdue_waiting:' || i.id || ':' || extract(epoch from i.due_at)::bigint);
      insert into post_discussion_events (post_id, item_id, action, note) values (i.post_id, i.item_id, 'overdue', 'The decision passed its deadline');
      n := n + 1;
    end if;
    -- Still nothing: moderators can step in. A deactivated owner goes straight here.
    if i.escalated_at is null and (i.due_at <= now() - make_interval(hours => pol.escalate_after_hours) or i.owner_status <> 'active') then
      update decision_items set escalated_at = now() where id = i.id;
      for v_mod in select id from profiles where role in ('admin','moderator') and status = 'active' and id <> i.user_id loop
        perform public.notify_event(v_mod, null, 'action_escalated', v_data, 'escalated:' || i.id);
      end loop;
      insert into post_discussion_events (post_id, item_id, action, note) values (i.post_id, i.item_id, 'escalated', 'Passed to moderators');
      n := n + 1;
    end if;
  end loop;
  for v_user in
    select distinct user_id from decision_items where resolved_at is null and due_at <= now()
    union select user_id from user_restrictions where lifted_at is null
  loop
    perform public.reconcile_restriction(v_user);
  end loop;
  return n;
end $$;

create or replace function public.admin_set_accountability_policy(p_policy jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update accountability_policy set
    enabled = coalesce((p_policy->>'enabled')::boolean, enabled),
    first_reminder_hours = coalesce((p_policy->>'first_reminder_hours')::int, first_reminder_hours),
    repeat_reminder_hours = coalesce((p_policy->>'repeat_reminder_hours')::int, repeat_reminder_hours),
    deadline_hours = coalesce((p_policy->>'deadline_hours')::int, deadline_hours),
    escalate_after_hours = coalesce((p_policy->>'escalate_after_hours')::int, escalate_after_hours),
    restrict_after_overdue = coalesce((p_policy->>'restrict_after_overdue')::int, restrict_after_overdue),
    restrict_notice_hours = coalesce((p_policy->>'restrict_notice_hours')::int, restrict_notice_hours),
    extension_hours = coalesce((p_policy->>'extension_hours')::int, extension_hours),
    max_extensions = coalesce((p_policy->>'max_extensions')::int, max_extensions),
    updated_at = now(), updated_by = auth.uid()
  where id;
  insert into accountability_audit (actor_id, action, reason) values (auth.uid(), 'policy_changed', v_reason || ' ' || p_policy::text);
end $$;

-- create or replace keeps grants, and these stay internal where they were closed.
revoke execute on function public.accountability_sweep() from public, anon, authenticated;
