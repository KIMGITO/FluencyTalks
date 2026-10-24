-- End-to-end regression test: replays the exact RPC calls the app makes (same function and
-- parameter names as src/services/*.ts) for onboarding and the core flows after it.
-- Fails loudly (non-zero exit) on the first broken step.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/app_flow.sql
--
-- Run it on a THROWAWAY database after all migrations and seed.sql. It creates four test users
-- (auth.users rows) and leaves them behind. On a plain Postgres it needs stand-ins for
-- Supabase's auth.users / auth.uid(); on a `supabase start` database it runs as is.
\set ON_ERROR_STOP on

create schema if not exists tt;
create or replace function tt.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
create or replace function tt.expect_error(q text, needle text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin execute q;
  exception when others then
    if sqlerrm ilike '%' || needle || '%' then ok := true;
    else raise exception 'expected an error containing "%", got "%" for: %', needle, sqlerrm, q; end if;
  end;
  if not ok then raise exception 'expected an error containing "%" but it succeeded: %', needle, q; end if;
end $$;
grant usage on schema tt to authenticated;
grant execute on all functions in schema tt to authenticated;

-- ============ users (as the signup does) ============
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@test.ke'),
  ('00000000-0000-0000-0000-0000000000b2', 'linh@test.vn'),
  ('00000000-0000-0000-0000-0000000000c3', 'zed@test.com'),
  ('00000000-0000-0000-0000-0000000000d4', 'admin@test.com');
update public.profiles set role = 'admin', username = 'theadmin' where id = '00000000-0000-0000-0000-0000000000d4';

do $$ begin
  assert (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')) = 2, 'signup trigger must create profiles';
  assert (select status from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'active', 'new profile must be active';
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 100, 'new profile starts with 100 points';
  assert not (select onboarding_done from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'not onboarded yet';
end $$;

set role authenticated;

-- ============ 1. ONBOARDING, exactly as ProfileForm does it ============
-- Amina: native Swahili, learning Vietnamese. profileStore.save: setLanguageProfile, then saveProfile, then 3x recordConsent.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.set_language_profile(p_native => 'swh', p_learning => 'vie', p_level => 'A1');
select public.save_profile(p_username => 'amina', p_display_name => 'Amina', p_bio => '', p_timezone => 'Africa/Nairobi',
                           p_is_private => false, p_avatar_url => null, p_country => 'KE');
select public.record_consent(p_kind => 'age_18', p_version => '1');
select public.record_consent(p_kind => 'terms', p_version => '1');
select public.record_consent(p_kind => 'privacy', p_version => '1');
do $$ declare p public.profiles; begin
  select * into p from public.profiles where id = auth.uid();
  assert p.onboarding_done, 'onboarding must complete (username + native language)';
  assert p.native_language_id = 'swh' and p.learning_language_id = 'vie' and p.learning_level = 'A1', 'language columns saved';
  assert (select count(*) from public.user_languages where user_id = auth.uid()) = 2, 'derived user_languages rows';
  assert (select language_id from public.user_languages where user_id = auth.uid() and role = 'native') = 'swh', 'user_languages.language_id is what the app reads';
end $$;

-- The case from the bug report: a native language and NO learning language (p_learning/p_level null).
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
select public.set_language_profile(p_native => 'nld', p_learning => null, p_level => null);
select public.save_profile('zed', 'Zed', '', 'Europe/Amsterdam', false, null, null);
do $$ begin
  assert (select onboarding_done from public.profiles where id = auth.uid()), 'native-only onboarding must complete';
  assert (select learning_language_id from public.profiles where id = auth.uid()) is null;
end $$;

-- Linh: native Vietnamese, learning Swahili.
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
select public.set_language_profile('vie', 'swh', 'A2');
select public.save_profile('linh', 'Linh', '', 'Asia/Ho_Chi_Minh', false, null, 'VN');
do $$ begin assert (select onboarding_done from public.profiles where id = auth.uid()); end $$;

-- ============ 2. LANGUAGE RULES (enforced in the database) ============
select tt.expect_error($q$select public.set_language_profile('swh','swh','A1')$q$, 'language_same');
select tt.expect_error($q$select public.set_language_profile('ceb','vie','A1')$q$, 'language_unsupported');
select tt.expect_error($q$select public.set_language_profile(null,'vie','A1')$q$, 'language_required');
select tt.expect_error($q$select public.set_language_profile('vie','swh','Z9')$q$, 'invalid_level');
select tt.expect_error($q$update public.profiles set native_language_id = 'eng' where id = auth.uid()$q$, 'protected_profile_column');
select tt.expect_error($q$insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), 'eng', 'native', 'Native')$q$, 'row-level security');
select public.set_language_profile('vie', 'swh', 'B1');                 -- level-only change is free
select public.set_language_profile('vie', 'fra', 'A1');                 -- first real change is free
select tt.expect_error($q$select public.set_language_profile('vie','swh','A1')$q$, 'language_change_cooldown');
-- put Linh back for the matching tests below (bypass: this is test setup, run as superuser)
reset role;
select set_config('app.bypass_protect', 'on', false);   -- test setup only
update public.profiles set learning_language_id = 'swh', learning_level = 'A2', last_language_change_at = null where id = '00000000-0000-0000-0000-0000000000b2';
delete from public.user_languages where user_id = '00000000-0000-0000-0000-0000000000b2';
insert into public.user_languages (user_id, language_id, role, level) values ('00000000-0000-0000-0000-0000000000b2','vie','native','Native'),('00000000-0000-0000-0000-0000000000b2','swh','learning','A2');
select set_config('app.bypass_protect', 'off', false);
set role authenticated;

-- ============ 3. PROFILES AND HOME FEED ============
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ declare r jsonb; begin
  r := public.get_profile('amina');
  assert r is not null and r->>'username' = 'amina', 'get_profile works for another user';
  assert exists (select 1 from public.home_feed(10, 10) f where f.username = 'amina'), 'Amina (native Swahili) appears in Linh''s feed';
end $$;

-- ============ 4. MESSAGING ============
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table ctx as select public.start_conversation('00000000-0000-0000-0000-0000000000b2') as conv;
grant select on ctx to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select status from public.conversation_members where conversation_id = (select conv from ctx) and user_id = auth.uid()) = 'request', 'first message from a stranger is a request';
end $$;
select public.respond_message_request((select conv from ctx), true);
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table msg as select (public.send_message((select conv from ctx), 'Mimi ninapenda kujifunza', null)).id as id;
grant select on msg to public;

-- ============ 5. CORRECTION + POINTS ============
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
create temp table corr as select public.suggest_correction((select id from msg), 'Mimi ninapenda kujifunza Kivietinamu', 'added object') as id;
grant select on corr to public;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.accept_correction((select id from corr));   -- chatStore.accept
do $$ begin
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') = 105, 'corrector earns +5 for an accepted correction';
end $$;
-- the points exploit is gone: the old function no longer exists and the new one is not callable
select tt.expect_error($q$select public.adjust_user_points('00000000-0000-0000-0000-0000000000a1', 1000000)$q$, 'does not exist');
select tt.expect_error($q$select public.award_points('00000000-0000-0000-0000-0000000000a1', 1000000, 'correction_accepted', 'correction', gen_random_uuid())$q$, 'permission denied');
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.points_ledger where user_id = auth.uid() and delta = 5 and reason = 'correction_accepted') = 1, 'ledger has the +5 entry';
  assert (select count(*) from public.points_ledger) = 1, 'RLS: a user sees only their own ledger rows';
end $$;
select tt.expect_error($q$insert into public.points_ledger (user_id, delta, reason, ref_type, ref_id) values (auth.uid(), 999, 'correction_accepted', 'x', gen_random_uuid())$q$, 'row-level security');
-- farming limit: only 3 rewarded corrections per corrector for the same author per day
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table m2 as select (public.send_message((select conv from ctx), 'Habari yako rafiki', null)).id as id; grant select on m2 to public;
create temp table m3 as select (public.send_message((select conv from ctx), 'Ninakupenda sana', null)).id as id; grant select on m3 to public;
create temp table m4 as select (public.send_message((select conv from ctx), 'Tuonane kesho asubuhi', null)).id as id; grant select on m4 to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
create temp table c2 as select public.suggest_correction((select id from m2), 'Habari yako, rafiki', null) as id; grant select on c2 to public;
create temp table c3 as select public.suggest_correction((select id from m3), 'Ninakupenda sana sana', null) as id; grant select on c3 to public;
create temp table c4 as select public.suggest_correction((select id from m4), 'Tuonane kesho asubuhi.', null) as id; grant select on c4 to public;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.accept_correction((select id from c2));
select public.accept_correction((select id from c3));
select public.accept_correction((select id from c4));   -- 4th accepted for the same author today: accepted, but no reward
do $$ begin
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') = 115, 'pair cap: 3 rewards (5+5+5) + starting 100, the 4th earns nothing';
end $$;

-- ============ 5b. MESSAGE LANGUAGE, WHO MAY CORRECT, BOUNTIES ============
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare m public.messages; begin
  assert (select language_id from public.messages where id = (select id from msg)) = 'vie', 'message defaults to the sender''s learning language';
  m := public.send_message(p_conv => (select conv from ctx), p_body => 'Habari za asubuhi', p_language => 'swh');
  assert m.language_id = 'swh', 'sender can tag the message with their other language';
end $$;
select tt.expect_error($q$select public.send_message(p_conv => (select conv from ctx), p_body => 'x', p_language => 'eng')$q$, 'language_not_yours');
-- Zed (native Dutch) is not qualified to correct a Vietnamese message; Linh (native Vietnamese) is.
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
select tt.expect_error(format($q$select public.answer_bounty(%L, 'x', null)$q$, (select id from msg)), 'bounty_unavailable');

-- Amina posts a Vietnamese-tagged bounty: 100 - 50 = 50 points held.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table bnt as select (public.send_message(p_conv => (select conv from ctx), p_body => 'Toi muon hoc tieng Viet', p_language => 'vie', p_bounty => true)).id as id; grant select on bnt to public;
do $$ declare b record; begin
  select * into b from public.messages where id = (select id from bnt);
  assert b.is_bounty and b.bounty_status = 'open' and b.bounty_cost = 50, 'bounty is open and costs 50';
  assert (select points_balance from public.profiles where id = auth.uid()) = 50, 'points are held';
  assert (select count(*) from public.list_my_bounties()) = 1, 'my bounties lists it';
  assert not exists (select 1 from public.list_open_bounties() x where x.message_id = (select id from bnt)), 'the asker does not see their own bounty in the queue';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
do $$ begin assert not exists (select 1 from public.list_open_bounties() x where x.message_id = (select id from bnt)), 'an unqualified user does not see it'; end $$;
select tt.expect_error(format($q$select public.answer_bounty(%L, 'Toi muon hoc tieng Viet.', null)$q$, (select id from bnt)), 'not_qualified_to_correct');
-- Zed also cannot suggest a correction inside a chat he is not part of (and is unqualified anyway).
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin assert exists (select 1 from public.list_open_bounties() x where x.message_id = (select id from bnt) and x.cost = 50), 'a qualified native speaker sees the bounty'; end $$;
create temp table banswer as select public.answer_bounty((select id from bnt), 'Tôi muốn học tiếng Việt', 'diacritics') as id; grant select on banswer to public;
select tt.expect_error(format($q$select public.answer_bounty(%L, 'again', null)$q$, (select id from bnt)), 'already_answered');
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.accept_correction((select id from banswer));
do $$ begin
  assert (select bounty_status from public.messages where id = (select id from bnt)) = 'paid', 'bounty marked paid';
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') = 165, 'helper gets the 50 (115 + 50), not +5';
  assert (select points_balance from public.profiles where id = auth.uid()) = 50, 'asker keeps paying 50 only once';
end $$;
-- Expiry refund: an unanswered bounty comes back after it lapses.
create temp table bnt2 as select (public.send_message(p_conv => (select conv from ctx), p_body => 'Rafiki yangu', p_language => 'vie', p_bounty => true)).id as id; grant select on bnt2 to public;
do $$ begin assert (select points_balance from public.profiles where id = auth.uid()) = 0, '50 - 50 = 0'; end $$;
select tt.expect_error($q$select public.send_message(p_conv => (select conv from ctx), p_body => 'again', p_language => 'vie', p_bounty => true)$q$, 'insufficient_points');
reset role;
select set_config('app.bypass_protect', 'on', false);
update public.messages set bounty_expires_at = now() - interval '1 minute' where id = (select id from bnt2);
select set_config('app.bypass_protect', 'off', false);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from public.list_my_bounties() x where x.status = 'refunded') = 1, 'expired bounty is refunded';
  assert (select points_balance from public.profiles where id = auth.uid()) = 50, 'points returned';
end $$;
select tt.expect_error($q$select public.refund_expired_bounties()$q$, 'permission denied');
-- Refunding twice is impossible (one ledger row per event).
do $$ begin assert (select count(*) from public.points_ledger where reason = 'bounty_expired_refund') = 1; end $$;

-- ============ 6. SAFETY ============
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.report_user('00000000-0000-0000-0000-0000000000b2', 'fake_correction', 'test', (select conv from ctx));
select public.report_user('00000000-0000-0000-0000-0000000000c3', 'points_abuse', 'test', null);
select tt.expect_error($q$select public.report_user('00000000-0000-0000-0000-0000000000c3', 'not_a_reason', null, null)$q$, 'violates check');
select public.block_user('00000000-0000-0000-0000-0000000000b2');
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert public.get_profile('amina') is null, 'blocked users cannot see each other';
  assert not exists (select 1 from public.home_feed(10, 10) f where f.username = 'amina'), 'blocked user leaves the feed';
end $$;

-- ============ 7. ADMIN ============
select tt.as_user('00000000-0000-0000-0000-0000000000d4');
do $$ begin assert public.is_admin(), 'admin recognised'; assert (select count(*) from public.admin_report_queue('open')) >= 2, 'admin sees reports'; end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select count(*) from public.admin_report_queue('open')$q$, 'forbidden');

reset role;
select 'ALL APP-FLOW CHECKS PASSED' as result;
