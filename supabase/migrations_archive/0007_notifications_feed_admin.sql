-- 0007: notification feed (with actor details) and the read-side functions the admin screens need.
-- Writes still go through the functions from 0004 (admin_set_user_status, admin_dismiss_report).

-- ---------- Notifications: feed + unread count (hide anything from people I have a block with) ----------
create function public.list_notifications(p_limit int default 30)
returns table (id uuid, type text, data jsonb, read_at timestamptz, created_at timestamptz, actor_id uuid, actor_username text, actor_name text, actor_avatar text)
language sql stable security definer set search_path = public as $$
  select n.id, n.type, n.data, n.read_at, n.created_at, n.actor_id, p.username, p.display_name, p.avatar_url
  from notifications n left join profiles p on p.id = n.actor_id
  where n.user_id = auth.uid() and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
  order by n.created_at desc limit least(p_limit, 100) $$;

create function public.count_unread_notifications() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications n
  where n.user_id = auth.uid() and n.read_at is null and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id)) $$;

-- ---------- Admin: report queue with names, target status and how many open reports the target has ----------
create function public.admin_report_queue(p_status text default 'open')
returns table (id uuid, reason text, details text, evidence jsonb, status text, created_at timestamptz, conversation_id uuid,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_id uuid, target_username text, target_name text, target_status text, target_open_reports int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.reason, r.details, r.evidence, r.status, r.created_at, r.conversation_id,
           r.reporter_id, rp.username, rp.display_name,
           r.target_user_id, tp.username, tp.display_name, tp.status,
           (select count(*)::int from reports x where x.target_user_id = r.target_user_id and x.status = 'open')
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    left join profiles tp on tp.id = r.target_user_id
    where r.status = p_status
    order by case when p_status = 'open' then r.created_at end asc nulls last, r.created_at desc   -- open: oldest first
    limit 100;
end $$;

-- ---------- Admin: find a person (no query = suspended/banned people first, then newest) ----------
create function public.admin_search_users(p_query text default null)
returns table (id uuid, username text, display_name text, role text, status text, created_at timestamptz, open_reports int)
language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), ''); v_like text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
    select p.id, p.username, p.display_name, p.role, p.status, p.created_at,
           (select count(*)::int from reports r where r.target_user_id = p.id and r.status = 'open')
    from profiles p
    where p.username is not null and (v_like is null or p.username ilike v_like or p.display_name ilike v_like)
    order by (p.status <> 'active') desc, p.created_at desc
    limit 50;
end $$;

-- ---------- Admin: recent moderation activity ----------
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

-- Re-apply grants for the new functions (signed-in users only; the admin ones check is_admin() themselves).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
