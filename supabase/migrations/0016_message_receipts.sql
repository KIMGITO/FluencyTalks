-- 0016: message read receipts. The other member's last_read_at is the only new
-- signal: any of my messages created at or before it has been read. No new
-- tables, no per-message writes — ticks derive from conversation_members,
-- which members can already read (policy "read members" in 0003).
create or replace function public.peer_read_at(p_conv uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select m.last_read_at from conversation_members m
  where m.conversation_id = p_conv and m.user_id <> auth.uid()
  order by m.last_read_at desc limit 1
$$;
grant execute on function public.peer_read_at(uuid) to authenticated, service_role;
-- Live ticks: the app subscribes to UPDATEs on conversation_members (ChatThread),
-- so the peer's row must be in the realtime publication.
alter publication supabase_realtime add table public.conversation_members;
