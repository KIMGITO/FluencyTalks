-- 0017: notification deletes. "Mark all as read" reads + deletes the feed,
-- and each row gets its own delete button. Deletes go through a security-definer
-- function (RLS has no delete policy otherwise), plus a direct delete policy so
-- the client can also delete via PostgREST if needed.
create policy "delete own notifications" on public.notifications for delete using (auth.uid() = user_id);

create function public.delete_notifications(p_ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  delete from notifications where user_id = auth.uid() and (p_ids is null or id = any(p_ids)) $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;