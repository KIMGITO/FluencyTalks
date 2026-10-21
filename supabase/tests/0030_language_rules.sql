-- Manual smoke test for migration 0030 (language rules). Not run automatically.
-- Run on a THROWAWAY database after all migrations and seed.sql, e.g.:
--   psql "$DB_URL" -f supabase/tests/0030_language_rules.sql
-- Expected: T2..T7 and T10, T11 each print the error named in their label; T1, T8, T9, T12+ succeed.
-- It inserts three auth.users rows (it needs a database where that is allowed) and leaves them behind.
\set ON_ERROR_STOP off
select count(*) filter (where is_supported_learning) as launch_langs, count(*) as total from languages;
select id, english_name from languages where is_supported_learning and id in ('swh','vie');
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','amina@x.ke'),('00000000-0000-0000-0000-0000000000b2','linh@x.vn'),('00000000-0000-0000-0000-0000000000c3','zed@x.com');
select 'profiles auto-created', count(*) from profiles;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
\echo '--- T1 Amina: native swh learning vie A1'
select set_language_profile('swh','vie','A1');
select native_language_id, learning_language_id, learning_level from profiles where id=auth.uid();
select role, language_id, level from user_languages where user_id=auth.uid() order by role;
\echo '--- T2 same language (expect language_same)'
select set_language_profile('swh','swh','A1');
\echo '--- T3 unsupported language ceb (expect language_unsupported)'
select set_language_profile('swh','ceb','A1');
\echo '--- T4 no native (expect language_required)'
select set_language_profile(null,'vie','A1');
\echo '--- T5 bad level (expect invalid_level)'
select set_language_profile('swh','vie','Z9');
\echo '--- T6 direct profile edit (expect protected_profile_column)'
update profiles set native_language_id='eng' where id=auth.uid();
\echo '--- T7 direct user_languages insert (expect RLS violation)'
insert into user_languages(user_id,language_id,role,level) values (auth.uid(),'eng','native','Native');
\echo '--- T8 level-only change is free'
select set_language_profile('swh','vie','B1');
select learning_level, last_language_change_at is null as no_cooldown_started from profiles where id=auth.uid();
\echo '--- T9 first real change is free (vie->fra)'
select set_language_profile('swh','fra','A2');
select learning_language_id, last_language_change_at is not null as cooldown_started from profiles where id=auth.uid();
\echo '--- T10 second change inside 30 days (expect language_change_cooldown)'
select set_language_profile('swh','vie','A2');
\echo '--- T11 clients cannot call adjust_user_points (expect permission denied)'
select adjust_user_points('00000000-0000-0000-0000-0000000000b2', 1000000);
\echo '--- T12 Linh native vie learning swh; onboarding gate'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select set_language_profile('vie','swh','A2');
select save_profile('linh','Linh','', 'Asia/Ho_Chi_Minh', false);
select onboarding_done from profiles where id=auth.uid();
\echo '--- T13 Zed: native eng, no learning; has no username -> not onboarded'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
select set_language_profile('eng');
select save_profile('zed','Zed','', 'UTC', false);
select onboarding_done, learning_language_id from profiles where id=auth.uid();
\echo '--- T14 Amina finishes onboarding then home_feed (Linh should be a native match on vie)'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select save_profile('amina','Amina','', 'Africa/Nairobi', false);
select username, match_kind, match_language from home_feed();
