-- Call entries (missed, incoming, outgoing) can be deleted, for me only.
--
-- A call is shared by both people and backs topic assessments, so the call itself is never deleted: each person
-- hides it from their own chat and call history. The other person still sees it; nothing else changes.
-- Rollback: drop the column and the function, and re-create the two list functions from 20261121100000 and
-- 20261121100500 (they only gained the `hidden_at is null` filter).

alter table public.call_participants add column if not exists hidden_at timestamptz;

-- Hide one finished call from my chat and call history. A call still ringing or live can't be hidden.
create function public.hide_call(p_call uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if not exists (select 1 from calls c join call_participants me on me.call_id = c.id and me.user_id = auth.uid()
                 where c.id = p_call and c.status not in ('ringing', 'active')) then
    raise exception 'call_not_found';
  end if;
  update call_participants set hidden_at = now() where call_id = p_call and user_id = auth.uid() and hidden_at is null;
end $$;

create or replace function public.list_calls_with(p_other uuid, p_limit int default 50)
returns table (call_id uuid, status text, end_reason text, created_at timestamptz, started_at timestamptz, ended_at timestamptz, outgoing boolean, attended boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  return query
  select c.id, c.status, c.end_reason, c.created_at, c.started_at, c.ended_at, c.initiated_by = auth.uid(), me.joined_at is not null
  from call_participants me
  join calls c on c.id = me.call_id and c.status not in ('ringing', 'active')
  join call_participants o on o.call_id = c.id and o.user_id = p_other
  where me.user_id = auth.uid() and me.hidden_at is null and p_other <> auth.uid() and public.is_call_member(c.id)
  order by c.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;

create or replace function public.list_call_history(p_limit int default 30, p_before timestamptz default null)
returns table (call_id uuid, status text, end_reason text, created_at timestamptz, started_at timestamptz, ended_at timestamptz, outgoing boolean,
               my_invitation text, attended boolean, participant_count int, other_id uuid, other_name text, other_username text, other_avatar text)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.expire_stale_calls();
  return query
  select c.id, c.status, c.end_reason, c.created_at, c.started_at, c.ended_at, c.initiated_by = auth.uid(),
    me.invitation_status, me.joined_at is not null,
    (select count(*)::int from call_participants x where x.call_id = c.id),
    o.id, o.display_name, o.username, o.avatar_url
  from call_participants me
  join calls c on c.id = me.call_id
  left join lateral (select pr.* from call_participants op join profiles pr on pr.id = op.user_id
                     where op.call_id = c.id and op.user_id <> auth.uid() order by op.invited_at limit 1) o on true
  where me.user_id = auth.uid() and me.hidden_at is null and public.is_call_member(c.id) and (p_before is null or c.created_at < p_before)
  order by c.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;

insert into public.rate_limit_rules (path, max_hits, window_seconds) values ('/rpc/hide_call', 120, 60) on conflict (path) do nothing;

revoke all on function public.hide_call(uuid) from public, anon, authenticated, service_role;
grant execute on function public.hide_call(uuid) to authenticated, service_role;
