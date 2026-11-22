-- Call feedback: the caller sees "Ringing" once the other person's device has the call (and "Trying to reach"
-- until then), and a chat shows the calls between its two people.

alter table public.call_participants add column if not exists rang_at timestamptz;

-- The person being called reports that the call reached a device of theirs (banner or call screen showing).
-- Only their own row, only while it is ringing; the first report is kept.
create function public.report_call_ringing(p_call uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update call_participants p set rang_at = now()
  where p.call_id = p_call and p.user_id = auth.uid() and p.invitation_status = 'pending' and p.rang_at is null
    and exists (select 1 from calls c where c.id = p_call and c.status = 'ringing');
end $$;

create or replace function public.get_call(p_call uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c calls;
begin
  perform assert_active();
  perform public.expire_stale_calls();
  select * into c from calls where id = p_call;
  if c.id is null or not public.is_call_member(p_call) then raise exception 'call_unavailable'; end if;
  return jsonb_build_object('id', c.id, 'status', c.status, 'host_id', c.host_id, 'initiated_by', c.initiated_by,
    'created_at', c.created_at, 'ring_expires_at', c.ring_expires_at, 'started_at', c.started_at, 'ended_at', c.ended_at, 'end_reason', c.end_reason,
    'max_participants', c.max_participants,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', pr.username, 'display_name', pr.display_name,
        'avatar_url', pr.avatar_url, 'role', p.role, 'invitation_status', p.invitation_status, 'presence', p.presence,
        'joined_at', p.joined_at, 'left_at', p.left_at, 'rang_at', p.rang_at) order by p.invited_at, p.role), '[]'::jsonb)
      from call_participants p join profiles pr on pr.id = p.user_id where p.call_id = c.id));
end $$;

-- Finished calls between me and one other person, newest first, for the chat with them. Blocks hide them,
-- as in list_call_history.
create function public.list_calls_with(p_other uuid, p_limit int default 50)
returns table (call_id uuid, status text, end_reason text, created_at timestamptz, started_at timestamptz, ended_at timestamptz, outgoing boolean, attended boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  return query
  select c.id, c.status, c.end_reason, c.created_at, c.started_at, c.ended_at, c.initiated_by = auth.uid(), me.joined_at is not null
  from call_participants me
  join calls c on c.id = me.call_id and c.status not in ('ringing', 'active')
  join call_participants o on o.call_id = c.id and o.user_id = p_other
  where me.user_id = auth.uid() and p_other <> auth.uid() and public.is_call_member(c.id)
  order by c.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('/rpc/report_call_ringing', 60, 60),
  ('/rpc/list_calls_with', 60, 60)
on conflict (path) do nothing;

revoke all on function public.report_call_ringing(uuid), public.list_calls_with(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.report_call_ringing(uuid), public.list_calls_with(uuid, integer) to authenticated, service_role;
