-- Reports, restrictions, appeals and the accountability sweep over open decisions.

create table public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in ('harassment', 'spam', 'inappropriate', 'impersonation', 'underage', 'scam', 'fake_correction', 'points_abuse', 'other')),
  details text check (char_length(details) <= 1000),
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  post_id uuid
);
alter table public.reports enable row level security;
create index reports_resolved_at_idx on public.reports (resolved_at) where resolved_at is not null;
create index reports_target_user_id_created_at_idx on public.reports (target_user_id, created_at);
create index reports_status_created_at_idx on public.reports (status, created_at);
grant select on public.reports to authenticated;

create table public.moderation_actions (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('suspend', 'ban', 'reinstate', 'dismiss_report', 'auto_suspend')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;
create index moderation_actions_created_idx on public.moderation_actions (created_at);
grant select on public.moderation_actions to authenticated;

create table public.accountability_policy (
  id boolean default true primary key check (id),
  enabled boolean not null default true,
  first_reminder_hours int not null default 48 check (first_reminder_hours > 0),
  repeat_reminder_hours int not null default 48 check (repeat_reminder_hours > 0),
  deadline_hours int not null default 168 check (deadline_hours > 0),
  escalate_after_hours int not null default 72 check (escalate_after_hours >= 0),
  restrict_after_overdue int not null default 3 check (restrict_after_overdue > 0),
  restrict_notice_hours int not null default 72 check (restrict_notice_hours >= 0),
  extension_hours int not null default 168 check (extension_hours > 0),
  max_extensions int not null default 1 check (max_extensions >= 0),
  last_sweep_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.accountability_policy enable row level security;

create table public.accountability_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_user uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
alter table public.accountability_audit enable row level security;
create index accountability_audit_created_idx on public.accountability_audit (created_at);

create table public.decision_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null,
  item_id uuid not null unique,
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  viewed_at timestamptz,
  resolved_at timestamptz,
  resolution text check (resolution in ('decided', 'withdrawn', 'exempted')),
  resolved_note text,
  reminder_count int not null default 0,
  last_reminded_at timestamptz,
  overdue_notified_at timestamptz,
  escalated_at timestamptz,
  extensions int not null default 0,
  extension_reason text,
  clarification_asked_at timestamptz,
  constraint decision_items_check check ((resolved_at is null) = (resolution is null))
);
alter table public.decision_items enable row level security;
create index decision_items_open_idx on public.decision_items (due_at) where resolved_at is null;
create index decision_items_user_idx on public.decision_items (user_id, created_at desc);
grant select on public.decision_items to authenticated;

-- When someone was told a pause is coming. A pause can only follow a warning that has had time to be read.
create table public.accountability_warnings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  warned_at timestamptz not null default now()
);
alter table public.accountability_warnings enable row level security;

create table public.user_restrictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'new_posts' check (kind = 'new_posts'),
  reason text not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lift_reason text
);
alter table public.user_restrictions enable row level security;
create unique index user_restrictions_active_idx on public.user_restrictions (user_id, kind) where lifted_at is null;
grant select on public.user_restrictions to authenticated;

create table public.restriction_appeals (
  id uuid default gen_random_uuid() primary key,
  restriction_id uuid not null references public.user_restrictions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check ((char_length(message) >= 1) and (char_length(message) <= 1000)),
  status text not null default 'open' check (status in ('open', 'granted', 'denied')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text
);
alter table public.restriction_appeals enable row level security;
create unique index restriction_appeals_open_idx on public.restriction_appeals (restriction_id) where status = 'open';
grant select on public.restriction_appeals to authenticated;

create function public.admin_list_reports(p_status text default 'open') returns setof public.reports
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from reports where status = p_status order by created_at limit 100;
end $$;

create function public.admin_dismiss_report(p_report uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where id = p_report;
  insert into moderation_actions (admin_id, action, reason) values (auth.uid(), 'dismiss_report', p_report::text);
end $$;

create function public.admin_recent_actions(p_limit int default 50)
returns table (id uuid, action text, reason text, created_at timestamptz, admin_name text, target_username text, target_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select a.id, a.action, a.reason, a.created_at, ap.display_name, tp.username, tp.display_name
    from moderation_actions a
    left join profiles ap on ap.id = a.admin_id
    left join profiles tp on tp.id = a.target_user_id
    order by a.created_at desc limit least(p_limit, 100);
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

create function public.admin_report_queue(p_status text default 'open')
returns table (id uuid, reason text, details text, evidence jsonb, status text, created_at timestamptz, conversation_id uuid,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_id uuid, target_username text, target_name text, target_status text, target_open_reports int, post_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.reason, r.details, r.evidence, r.status, r.created_at, r.conversation_id,
           r.reporter_id, rp.username, rp.display_name,
           r.target_user_id, tp.username, tp.display_name, tp.status,
           (select count(*)::int from reports x where x.target_user_id = r.target_user_id and x.status = 'open'),
           r.post_id
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    left join profiles tp on tp.id = r.target_user_id
    where r.status = p_status
    order by case when p_status = 'open' then r.created_at end asc nulls last, r.created_at desc
    limit 100;
end $$;

create function public.reconcile_restriction(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pol public.accountability_policy; v_overdue int; v_noticed int; r public.user_restrictions; me public.profiles; v_warned timestamptz;
begin
  select * into pol from accountability_policy;
  select * into me from profiles where id = p_user;
  select count(*), count(*) filter (where overdue_notified_at <= now() - make_interval(hours => pol.restrict_notice_hours)) into v_overdue, v_noticed
  from decision_items where user_id = p_user and resolved_at is null and due_at <= now();
  select * into r from user_restrictions where user_id = p_user and lifted_at is null;
  select warned_at into v_warned from accountability_warnings where user_id = p_user;

  if r.id is not null and (v_overdue < pol.restrict_after_overdue or me.accountability_exempt or not pol.enabled) then
    update user_restrictions set lifted_at = now(), lift_reason = 'Overdue decisions are answered' where id = r.id;
    update restriction_appeals set status = 'granted', decided_at = now(), decision_note = 'Closed: the restriction was lifted' where restriction_id = r.id and status = 'open';
    insert into accountability_audit (target_user, action, reason, ref_id) values (p_user, 'restriction_lifted', 'Overdue decisions are answered', r.id);
    perform public.notify_event(p_user, null, 'restriction_lifted', jsonb_build_object('restriction_id', r.id), 'restriction_lifted:' || r.id, true);
  elsif r.id is null and pol.enabled and not me.accountability_exempt and me.status = 'active' and v_noticed >= pol.restrict_after_overdue and v_warned is null then
    insert into accountability_warnings (user_id) values (p_user);
    insert into accountability_audit (target_user, action, reason) values (p_user, 'restriction_warned', v_noticed || ' decisions on your posts are overdue');
    perform public.notify_event(p_user, null, 'restriction_warning', jsonb_build_object('overdue', v_noticed, 'hours', pol.restrict_notice_hours), 'restriction_warning:' || p_user || ':' || extract(epoch from now())::bigint, true);
  elsif r.id is null and pol.enabled and not me.accountability_exempt and me.status = 'active' and v_noticed >= pol.restrict_after_overdue and v_warned <= now() - make_interval(hours => pol.restrict_notice_hours) then
    insert into user_restrictions (user_id, reason) values (p_user, v_noticed || ' decisions on your posts are overdue') returning * into r;
    insert into accountability_audit (target_user, action, reason, ref_id) values (p_user, 'restriction_applied', r.reason, r.id);
    perform public.notify_event(p_user, null, 'restriction_applied', jsonb_build_object('restriction_id', r.id, 'overdue', v_noticed), 'restriction_applied:' || r.id, true);
  end if;
  if v_overdue < pol.restrict_after_overdue then delete from accountability_warnings where user_id = p_user; end if;
end $$;

create function public.close_decision(p_item uuid, p_resolution text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  update decision_items set resolved_at = now(), resolution = p_resolution, resolved_note = p_note
  where item_id = p_item and resolved_at is null returning user_id into v_user;
  if v_user is not null then perform public.reconcile_restriction(v_user); end if;
end $$;

create function public.response_record(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'decided', count(*) filter (where resolution = 'decided'),
    'on_time', count(*) filter (where resolution = 'decided' and resolved_at <= due_at),
    'open', count(*) filter (where resolved_at is null),
    'overdue', count(*) filter (where resolved_at is null and due_at <= now()))
  from decision_items where user_id = p_user;
$$;

create function public.mark_decisions_viewed(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update decision_items set viewed_at = now() where post_id = p_post and user_id = auth.uid() and viewed_at is null and resolved_at is null;
$$;

create function public.my_accountability() returns jsonb
language plpgsql security definer set search_path = public as $$
declare pol public.accountability_policy;
begin
  perform assert_active();
  perform public.sweep_if_due();
  select * into pol from accountability_policy;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'post_id', i.post_id, 'item_id', i.item_id, 'kind', d.kind, 'created_at', i.created_at, 'due_at', i.due_at, 'viewed_at', i.viewed_at,
        'overdue', i.due_at <= now(), 'extensions', i.extensions, 'phrase', left(coalesce(p.current_phrase, p.phrase), 120),
        'proposed_phrase', d.proposed_phrase, 'author_name', u.display_name) order by i.due_at)
      from decision_items i join post_discussion d on d.id = i.item_id join contribution_posts p on p.id = i.post_id left join profiles u on u.id = d.author_id
      where i.user_id = auth.uid() and i.resolved_at is null), '[]'),
    'record', public.response_record(auth.uid()),
    'warned_at', (select warned_at from accountability_warnings where user_id = auth.uid()),
    'restriction', (select jsonb_build_object('id', r.id, 'reason', r.reason, 'created_at', r.created_at,
        'appeal', (select jsonb_build_object('status', a.status, 'message', a.message, 'decision_note', a.decision_note) from restriction_appeals a where a.restriction_id = r.id order by a.created_at desc limit 1))
      from user_restrictions r where r.user_id = auth.uid() and r.lifted_at is null),
    'policy', jsonb_build_object('deadline_hours', pol.deadline_hours, 'first_reminder_hours', pol.first_reminder_hours, 'restrict_after_overdue', pol.restrict_after_overdue, 'restrict_notice_hours', pol.restrict_notice_hours, 'extension_hours', pol.extension_hours, 'max_extensions', pol.max_extensions, 'enabled', pol.enabled));
end $$;

create function public.request_decision_extension(p_item uuid, p_reason text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare it public.decision_items; pol public.accountability_policy; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_due timestamptz;
begin
  perform assert_active();
  select * into it from decision_items where id = p_item and user_id = auth.uid() and resolved_at is null for update;
  if it.id is null then raise exception 'correction_unavailable'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  select * into pol from accountability_policy;
  if it.extensions >= pol.max_extensions then raise exception 'extension_limit'; end if;
  v_due := greatest(it.due_at, now()) + make_interval(hours => pol.extension_hours);
  update decision_items set due_at = v_due, extensions = extensions + 1, extension_reason = left(v_reason, 500), overdue_notified_at = null, escalated_at = null where id = it.id;
  perform public.log_discussion(it.post_id, it.item_id, 'extended', null, null);
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), auth.uid(), 'extension', left(v_reason, 500), it.id);
  perform public.reconcile_restriction(auth.uid());
  return v_due;
end $$;

create function public.appeal_restriction(p_restriction uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare v_msg text := nullif(btrim(coalesce(p_message, '')), ''); v_mod uuid;
begin
  perform assert_active();
  if not exists (select 1 from user_restrictions where id = p_restriction and user_id = auth.uid() and lifted_at is null) then raise exception 'correction_unavailable'; end if;
  if v_msg is null then raise exception 'reason_required'; end if;
  if exists (select 1 from restriction_appeals where restriction_id = p_restriction and status = 'open') then raise exception 'already_appealed'; end if;
  insert into restriction_appeals (restriction_id, user_id, message) values (p_restriction, auth.uid(), left(v_msg, 1000));
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), auth.uid(), 'appeal', left(v_msg, 1000), p_restriction);
end $$;

create function public.admin_accountability() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'policy', (select to_jsonb(p) from accountability_policy p),
    'escalated', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'item_id', i.item_id, 'post_id', i.post_id, 'due_at', i.due_at, 'owner_name', u.display_name, 'phrase', left(coalesce(c.current_phrase, c.phrase), 120), 'kind', d.kind) order by i.due_at)
      from decision_items i join profiles u on u.id = i.user_id join contribution_posts c on c.id = i.post_id join post_discussion d on d.id = i.item_id
      where i.resolved_at is null and i.escalated_at is not null), '[]'),
    'restrictions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'name', u.display_name, 'reason', r.reason, 'created_at', r.created_at) order by r.created_at desc)
      from user_restrictions r join profiles u on u.id = r.user_id where r.lifted_at is null), '[]'),
    'appeals', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', u.display_name, 'message', a.message, 'created_at', a.created_at) order by a.created_at)
      from restriction_appeals a join profiles u on u.id = a.user_id where a.status = 'open'), '[]'),
    'audit', coalesce((select jsonb_agg(x order by x.created_at desc) from (select e.id, e.action, e.reason, e.created_at, a.display_name as actor_name, t.display_name as target_name
      from accountability_audit e left join profiles a on a.id = e.actor_id left join profiles t on t.id = e.target_user order by e.created_at desc limit 50) x), '[]'));
end $$;

create function public.admin_decide_appeal(p_appeal uuid, p_grant boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.restriction_appeals; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_post uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_note is null then raise exception 'reason_required'; end if;
  select * into a from restriction_appeals where id = p_appeal and status = 'open' for update;
  if a.id is null then raise exception 'already_decided'; end if;
  update restriction_appeals set status = case when p_grant then 'granted' else 'denied' end, decided_by = auth.uid(), decided_at = now(), decision_note = v_note where id = a.id;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), a.user_id, case when p_grant then 'appeal_granted' else 'appeal_denied' end, v_note, a.id);
  if p_grant then
    for v_post in update decision_items set resolved_at = now(), resolution = 'exempted', resolved_note = v_note where user_id = a.user_id and resolved_at is null and due_at <= now() returning post_id loop
      perform public.refresh_post_review(v_post);
    end loop;
    update user_restrictions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_note where id = a.restriction_id and lifted_at is null;
  end if;
  perform public.notify_event(a.user_id, auth.uid(), 'appeal_decided', jsonb_build_object('granted', p_grant, 'note', v_note), 'appeal:' || a.id, true);
end $$;

create function public.admin_lift_restriction(p_restriction uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.user_restrictions; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_post uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update user_restrictions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_reason where id = p_restriction and lifted_at is null returning * into r;
  if r.id is null then raise exception 'already_decided'; end if;
  for v_post in update decision_items set resolved_at = now(), resolution = 'exempted', resolved_note = v_reason where user_id = r.user_id and resolved_at is null and due_at <= now() returning post_id loop
    perform public.refresh_post_review(v_post);
  end loop;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), r.user_id, 'restriction_lifted_by_staff', v_reason, r.id);
  perform public.notify_event(r.user_id, auth.uid(), 'restriction_lifted', jsonb_build_object('restriction_id', r.id, 'note', v_reason), 'restriction_lifted:' || r.id, true);
end $$;

create function public.admin_exempt_decision(p_decision uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_post uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update decision_items set resolved_at = now(), resolution = 'exempted', resolved_note = v_reason where id = p_decision and resolved_at is null returning user_id, post_id into v_user, v_post;
  if v_user is null then raise exception 'already_decided'; end if;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), v_user, 'decision_exempted', v_reason, p_decision);
  perform public.refresh_post_review(v_post);
  perform public.reconcile_restriction(v_user);
end $$;

create function public.admin_set_user_exempt(p_user uuid, p_exempt boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update profiles set accountability_exempt = coalesce(p_exempt, false) where id = p_user;
  insert into accountability_audit (actor_id, target_user, action, reason) values (auth.uid(), p_user, case when p_exempt then 'user_exempted' else 'user_exemption_removed' end, v_reason);
  perform public.reconcile_restriction(p_user);
end $$;

create function public.accountability_sweep() returns int
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
    if i.due_at > now() and not i.exempt and (
         (i.reminder_count = 0 and i.created_at <= now() - make_interval(hours => pol.first_reminder_hours))
      or (i.reminder_count > 0 and i.last_reminded_at <= now() - make_interval(hours => pol.repeat_reminder_hours))) then
      update decision_items set reminder_count = reminder_count + 1, last_reminded_at = now() where id = i.id;
      perform public.notify_event(i.user_id, null, 'action_reminder', v_data, 'reminder:' || i.id || ':' || (i.reminder_count + 1), true);
      n := n + 1;
    end if;
    if i.due_at <= now() and i.overdue_notified_at is null and not i.exempt then
      update decision_items set overdue_notified_at = now() where id = i.id;
      perform public.notify_event(i.user_id, null, 'action_overdue', v_data, 'overdue:' || i.id || ':' || extract(epoch from i.due_at)::bigint, true);
      perform public.notify_event(i.item_author, null, 'action_overdue', v_data || '{"waiting":true}', 'overdue_waiting:' || i.id || ':' || extract(epoch from i.due_at)::bigint);
      insert into post_discussion_events (post_id, item_id, action, note) values (i.post_id, i.item_id, 'overdue', 'The decision passed its deadline');
      n := n + 1;
    end if;
    if i.escalated_at is null and (i.due_at <= now() - make_interval(hours => pol.escalate_after_hours) or i.owner_status <> 'active') then
      update decision_items set escalated_at = now() where id = i.id;
      for v_mod in select id from profiles where role in ('admin','moderator') and status = 'active' and id <> i.user_id loop
        perform public.notify_event(v_mod, null, 'action_escalated', v_data, 'escalated:' || i.id);
      end loop;
      insert into post_discussion_events (post_id, item_id, action, note) values (i.post_id, i.item_id, 'escalated', 'Passed to moderators');
      perform public.refresh_post_review(i.post_id);
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

create function public.admin_set_accountability_policy(p_policy jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
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

create function public.notify_admins_of_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_admin uuid;
begin
  for v_admin in select a.user_id from admin_accounts a join profiles p on p.id = a.user_id where a.tier in ('super','admin') and p.status = 'active' and a.user_id <> new.target_user_id loop
    perform public.notify_event(v_admin, null, 'admin_report', jsonb_build_object('report_id', new.id, 'reason', left(new.reason, 80)), 'report:' || new.id, true);
  end loop;
  return new;
end $$;

create function public.sweep_if_due() returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select paused from app_status) then return; end if;
  if coalesce((select last_sweep_at from accountability_policy), 'epoch') < now() - interval '10 minutes' then
    perform public.accountability_sweep();
  end if;
end $$;

create function public.accountability_sweep_on_clock() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (select paused from app_status) then perform public.accountability_sweep(); end if;
end $$;

create function public.notify_staff_of_appeal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_staff uuid;
begin
  for v_staff in select a.user_id from admin_accounts a join profiles p on p.id = a.user_id where p.status = 'active' loop
    perform public.notify_event(v_staff, null, 'admin_appeal', jsonb_build_object('appeal_id', new.id), 'appeal:' || new.id, true);
  end loop;
  return new;
end $$;

create trigger reports_notify_admins after insert on public.reports for each row execute function public.notify_admins_of_report();
create trigger staff_refused before insert on public.reports for each row execute function public.refuse_staff_learner_action();
create trigger restriction_appeals_notify_staff after insert on public.restriction_appeals for each row execute function public.notify_staff_of_appeal();

create policy "read own decisions" on public.decision_items for select to authenticated using (user_id = auth.uid());
create policy "admins read actions" on public.moderation_actions for select using (public.is_admin());
create policy "admins read reports" on public.reports for select using (public.is_admin());
create policy "read own appeals" on public.restriction_appeals for select to authenticated using (user_id = auth.uid());
create policy "read own restrictions" on public.user_restrictions for select to authenticated using (user_id = auth.uid());

revoke all on function
  public.admin_list_reports(text),
  public.admin_dismiss_report(uuid),
  public.admin_recent_actions(integer),
  public.report_user(uuid, text, text, uuid),
  public.admin_report_queue(text),
  public.reconcile_restriction(uuid),
  public.close_decision(uuid, text, text),
  public.response_record(uuid),
  public.mark_decisions_viewed(uuid),
  public.my_accountability(),
  public.request_decision_extension(uuid, text),
  public.appeal_restriction(uuid, text),
  public.admin_accountability(),
  public.admin_decide_appeal(uuid, boolean, text),
  public.admin_lift_restriction(uuid, text),
  public.admin_exempt_decision(uuid, text),
  public.admin_set_user_exempt(uuid, boolean, text),
  public.accountability_sweep(),
  public.admin_set_accountability_policy(jsonb, text),
  public.notify_admins_of_report(),
  public.sweep_if_due(),
  public.accountability_sweep_on_clock(),
  public.notify_staff_of_appeal()
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_list_reports(text),
  public.admin_dismiss_report(uuid),
  public.admin_recent_actions(integer),
  public.report_user(uuid, text, text, uuid),
  public.admin_report_queue(text),
  public.mark_decisions_viewed(uuid),
  public.my_accountability(),
  public.request_decision_extension(uuid, text),
  public.appeal_restriction(uuid, text),
  public.admin_accountability(),
  public.admin_decide_appeal(uuid, boolean, text),
  public.admin_lift_restriction(uuid, text),
  public.admin_exempt_decision(uuid, text),
  public.admin_set_user_exempt(uuid, boolean, text),
  public.admin_set_accountability_policy(jsonb, text)
to authenticated, service_role;

grant execute on function
  public.reconcile_restriction(uuid),
  public.close_decision(uuid, text, text),
  public.response_record(uuid),
  public.accountability_sweep(),
  public.sweep_if_due()
to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-accountability-sweep', '*/15 * * * *', 'select public.accountability_sweep_on_clock()');
exception when others then
  raise notice 'pg_cron unavailable (%), the sweep runs from app activity instead', sqlerrm;
end $$;
