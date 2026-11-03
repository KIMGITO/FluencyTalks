-- What the API roles can touch directly, checked against the catalog. test-db.sh runs this right after the migrations,
-- before it opens the tables up for the flow tests. A new table with a default grant fails here.
\set ON_ERROR_STOP on
do $$
declare v text;
begin
  select string_agg(c.relname, ', ') into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  assert v is null, 'tables without RLS: ' || coalesce(v, '');

  select string_agg(c.relname, ', ') into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not in ('languages', 'countries', 'app_status')
    and has_table_privilege('anon', c.oid, 'select');
  assert v is null, 'signed-out visitors can read: ' || coalesce(v, '');

  select string_agg(c.relname, ', ') into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and (has_table_privilege('anon', c.oid, 'insert,update,delete,truncate,references,trigger')
      or has_table_privilege('authenticated', c.oid, 'insert,update,truncate,references,trigger'));
  assert v is null, 'clients can write directly to: ' || coalesce(v, '');

  select string_agg(c.relname, ', ') into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not in ('saved_phrases', 'translation_history')
    and has_table_privilege('authenticated', c.oid, 'delete');
  assert v is null, 'clients can delete directly from: ' || coalesce(v, '');

  assert not has_table_privilege('authenticated', 'public.profiles', 'select'), 'profiles must not be readable as a whole table';
  select string_agg(a.attname, ', ') into v from pg_attribute a where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'username', 'display_name', 'avatar_url') and has_column_privilege('authenticated', a.attrelid, a.attnum, 'select');
  assert v is null, 'profile columns readable by any member: ' || coalesce(v, '');

  -- Drafts stay with staff, even on a live post: only the published columns are public.
  select string_agg(a.attname, ', ') into v from pg_attribute a where a.attrelid = 'public.blog_posts'::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname in ('draft', 'draft_saved_at', 'is_live', 'created_at') and (has_column_privilege('anon', a.attrelid, a.attnum, 'select') or has_column_privilege('authenticated', a.attrelid, a.attnum, 'select'));
  assert v is null, 'blog columns readable by the public: ' || coalesce(v, '');

  select string_agg(p.proname, ', ') into v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and p.proname not in ('get_app_status', 'check_request', 'provider_avatar');
  assert v is null, 'signed-out visitors can call: ' || coalesce(v, '');

  -- Internal helpers: nobody calls these from the outside.
  select string_agg(p.proname, ', ') into v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('notify', 'notify_event', 'app_log', 'admin_audit', 'set_staff_role', 'accountability_sweep_on_clock', 'rate_limit_cleanup')
    and has_function_privilege('authenticated', p.oid, 'execute');
  assert v is null, 'members can call internal: ' || coalesce(v, '');
end $$;
