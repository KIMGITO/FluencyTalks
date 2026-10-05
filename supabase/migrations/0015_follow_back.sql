-- 0015: answering a follow request follows back — "Follow back" + "Cancel", not Accept/Decline.
-- Accepting marks their pending follow accepted AND creates my accepted follow to them,
-- so both lists stay mutual. Works even if the follower is private (an accepted row
-- bypasses their request queue). Cancel just deletes their pending request.
create or replace function public.respond_follow_request(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_follower = auth.uid() then raise exception 'cannot_follow_self'; end if;
  if p_accept then
    update follows set status = 'accepted'
    where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
    if not found then return; end if;
    if public.is_blocked_between(auth.uid(), p_follower) then
      delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'accepted';
      raise exception 'user_unavailable';
    end if;
    -- My side: an accepted row regardless of their privacy (they already asked to connect).
    insert into follows (follower_id, followee_id, status)
    values (auth.uid(), p_follower, 'accepted')
    on conflict (follower_id, followee_id) do update set status = 'accepted';
  else
    delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  end if;
end $$;
