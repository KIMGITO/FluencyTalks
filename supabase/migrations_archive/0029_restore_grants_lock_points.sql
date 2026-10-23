-- 0029: repair after 0028 and close the points exploit.
--
-- 1. 0028 ran `revoke execute on all functions ... from authenticated, service_role`
--    and never granted it back, so after 0028 signed-in clients could not call any RPC
--    (and any RLS policy that calls a function, such as is_admin(), could fail).
--    Restore the project convention: signed-in users and the service role only.
-- 2. adjust_user_points() let any signed-in client credit ANY other user an unlimited
--    amount through a direct RPC call. It is now internal-only: security definer
--    functions (accept_correction, later the bounty functions) still call it, but
--    clients cannot.
--
-- Safe to run more than once.

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Internal only: no direct client access.
revoke execute on function public.adjust_user_points(uuid, int) from public, anon, authenticated;
