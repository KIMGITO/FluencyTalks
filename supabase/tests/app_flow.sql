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
begin perform set_config('request.jwt.claim.sub', u::text, false); perform set_config('request.jwt.claims', '', false); end $$;
-- A staff member after a full login: password, then an authenticator code.
create or replace function tt.as_staff(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u, 'aal', 'aal2', 'amr', jsonb_build_array(
    jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint + 1),
    jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)))::text, false);
end $$;
-- The same person who has only typed a password so far.
create or replace function tt.as_aal1(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u, 'aal', 'aal1', 'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)))::text, false);
end $$;
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
-- Sign-up now asks for a date of birth: test users are adults unless a test sets it.
create or replace function tt.adult_by_default() returns trigger language plpgsql as $$
begin new.birth_date := coalesce(new.birth_date, date '1990-01-01'); return new; end $$;
create trigger tt_adult_by_default before insert on public.profiles for each row execute function tt.adult_by_default();
-- Levels come from the learning path. Where a test only needs someone at a level, this passes every level up to
-- the level of topic `upto` directly (topic 4 is A1, topic 9 is B1).
create or replace function tt.pass_topics(u uuid, lang text, upto int) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into level_progress (user_id, language_id, band, passed_at, score_pct)
  select u, lang, l.band, now(), 90 from path_levels l where l.rank <= public.band_rank(public.topic_band(upto))
  on conflict (user_id, language_id, band) do update set passed_at = now(), score_pct = 90;
  insert into level_progress (user_id, language_id, band)
  select u, lang, l.band from path_levels l where l.rank = public.band_rank(public.topic_band(upto)) + 1 on conflict do nothing;
  perform public.evaluate_level(u);
end $$;
-- Two people as partners (an accepted connection), as request_connection + respond_connection would leave them.
create or replace function tt.connect(a uuid, b uuid) returns void language sql security definer set search_path = public as $$
  insert into connections (requester_id, addressee_id, status, accepted_at) values (a, b, 'accepted', now()) on conflict do nothing $$;
-- Chats that tests build straight into the tables stand for partners talking, so their members are made partners.
create or replace function tt.chat_means_partners() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into connections (requester_id, addressee_id, status, accepted_at)
  select new.user_id, m.user_id, 'accepted', now() from conversation_members m
  where m.conversation_id = new.conversation_id and m.user_id <> new.user_id and not public.is_connected(new.user_id, m.user_id)
  on conflict do nothing;
  return null;
end $$;
create trigger tt_chat_means_partners after insert on public.conversation_members for each row execute function tt.chat_means_partners();
create or replace function tt.ask(a uuid, b uuid) returns void language sql security definer set search_path = public as $$
  insert into connections (requester_id, addressee_id) values (a, b) on conflict do nothing $$;
grant usage on schema tt to authenticated;
grant execute on all functions in schema tt to authenticated;

-- ============ users (as the signup does) ============
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@test.ke'),
  ('00000000-0000-0000-0000-0000000000b2', 'linh@test.vn'),
  ('00000000-0000-0000-0000-0000000000c3', 'zed@test.com'),
  ('00000000-0000-0000-0000-0000000000d4', 'admin@test.com');
insert into public.admin_accounts (user_id, tier) values ('00000000-0000-0000-0000-0000000000d4', 'admin');
select set_config('app.staff_change', 'on', false);
update public.profiles set role = 'admin', username = 'theadmin' where id = '00000000-0000-0000-0000-0000000000d4';
select set_config('app.staff_change', 'off', false);

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
select tt.expect_error($q$update public.profiles set native_language_id = 'eng' where id = auth.uid()$q$, 'permission denied');
select tt.expect_error($q$insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), 'eng', 'native', 'Native')$q$, 'permission denied');
select tt.expect_error($q$select public.set_language_profile('vie','swh','B1')$q$, 'level_must_be_earned');   -- a level is never raised by hand
select public.set_language_profile('vie', 'swh', 'A1');                 -- lowering is free
select public.set_language_profile('vie', 'fra', 'A1');                 -- first real change is free
select tt.expect_error($q$select public.set_language_profile('vie','swh','A1')$q$, 'language_change_cooldown');
-- A week later the language being learned can change again. The native language waits the full 30 days.
reset role;
select set_config('app.bypass_protect', 'on', false);   -- test setup only
update public.profiles set last_language_change_at = now() - interval '8 days' where id = '00000000-0000-0000-0000-0000000000b2';
select set_config('app.bypass_protect', 'off', false);
set role authenticated;
select tt.expect_error($q$select public.set_language_profile('eng','fra','A1')$q$, 'language_change_cooldown');
select public.set_language_profile('vie', 'swh', 'A1');
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

-- ============ 3b. MATCHING: a swap is the best match, not a requirement ============
-- Extra users, created as superuser so the main flow's users stay untouched.
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'en@test.com'),   -- English, learning Chinese
  ('00000000-0000-0000-0000-0000000000e2', 'zh@test.com'),   -- Chinese, learning nothing
  ('00000000-0000-0000-0000-0000000000e3', 'fr@test.com'),   -- French, learning English
  ('00000000-0000-0000-0000-0000000000e4', 'sw@test.com'),   -- Chinese, learning English  (a swap)
  ('00000000-0000-0000-0000-0000000000e5', 'de@test.com');   -- German, learning Spanish (no link)
select set_config('app.bypass_protect', 'on', false);   -- test setup only: skip the protect-columns trigger
update public.profiles set username='m_en', display_name='En', onboarding_done=true, native_language_id='eng', learning_language_id='zho', learning_level='A2' where id='00000000-0000-0000-0000-0000000000e1';
update public.profiles set username='m_zh', display_name='Zh', onboarding_done=true, native_language_id='zho', learning_language_id=null where id='00000000-0000-0000-0000-0000000000e2';
update public.profiles set username='m_fr', display_name='Fr', onboarding_done=true, native_language_id='fra', learning_language_id='eng', learning_level='A2' where id='00000000-0000-0000-0000-0000000000e3';
update public.profiles set username='m_cn', display_name='Cn', onboarding_done=true, native_language_id='zho', learning_language_id='eng', learning_level='A2' where id='00000000-0000-0000-0000-0000000000e4';
update public.profiles set username='m_de', display_name='De', onboarding_done=true, native_language_id='deu', learning_language_id='spa', learning_level='A2' where id='00000000-0000-0000-0000-0000000000e5';
select set_config('app.bypass_protect', 'off', false);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select match_kind from public.home_feed(50, 50) where username = 'm_zh') = 'native', 'a Chinese speaker learning nothing still matches as a teacher';
  assert (select match_kind from public.home_feed(50, 50) where username = 'm_fr') = 'learning', 'a French speaker learning English matches although they do not speak Chinese';
  assert (select match_kind from public.home_feed(50, 50) where username = 'm_cn') = 'swap', 'a perfect swap is ranked as swap';
  assert (select match_kind from public.home_feed(50, 50) where username = 'm_de') = 'other', 'unrelated users are other';
  assert (select username from public.home_feed(50, 50) limit 1) = 'm_cn', 'the swap comes first';
  assert (select teachers from public.match_pool()) >= 2 and (select learners from public.match_pool()) >= 2, 'match_pool counts both sides';
end $$;
-- Someone who is learning nothing is matched to learners of their language.
select tt.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  assert (select match_kind from public.home_feed(50, 50) where username = 'm_en') = 'learning', 'a native with no learning language sees learners of their language';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');

-- ============ 4. MESSAGING ============
-- Like calls, only partners message each other.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.start_conversation('00000000-0000-0000-0000-0000000000b2')$q$, 'not_connected');
select tt.connect('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');
create temp table ctx as select public.start_conversation('00000000-0000-0000-0000-0000000000b2') as conv;
grant select on ctx to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select status from public.conversation_members where conversation_id = (select conv from ctx) and user_id = auth.uid()) = 'active', 'a partner''s chat opens straight away';
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
select tt.expect_error($q$insert into public.points_ledger (user_id, delta, reason, ref_type, ref_id) values (auth.uid(), 999, 'correction_accepted', 'x', gen_random_uuid())$q$, 'permission denied');
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
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ declare n record; begin
  select * into n from public.notifications where user_id = auth.uid() and type = 'bounty_paid';
  assert found and (n.data->>'points')::int = 50, 'the helper is told they earned 50 points';
  assert n.data->'conversation_id' is null, 'the helper is not given the asker''s chat id';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
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
-- Deleting the message behind an open bounty refunds it at once.
create temp table bnt3 as select (public.send_message(p_conv => (select conv from ctx), p_body => 'Nitakuona kesho', p_language => 'vie', p_bounty => true)).id as id; grant select on bnt3 to public;
do $$ begin assert (select points_balance from public.profiles where id = auth.uid()) = 0, 'held again'; end $$;
select public.delete_message((select id from bnt3));
do $$ begin
  assert (select points_balance from public.profiles where id = auth.uid()) = 50, 'deleting refunds immediately';
  assert (select bounty_status from public.messages where id = (select id from bnt3)) = 'refunded';
end $$;

-- Refunding twice is impossible (one ledger row per event).
do $$ begin assert (select count(*) from public.points_ledger where reason = 'bounty_expired_refund') = 2, 'exactly one refund row per refunded bounty (expired one + deleted one), never two for the same bounty'; end $$;
-- calling the sweep again changes nothing
select count(*) from public.list_my_bounties();
do $$ begin assert (select count(*) from public.points_ledger where reason = 'bounty_expired_refund') = 2, 'a second sweep does not refund again'; assert (select points_balance from public.profiles where id = auth.uid()) = 50; end $$;

-- ============ 5b2. BOUNTY LIFECYCLE (docs/CORRECTIONS_AND_BOUNTIES.md) ============
-- Hoa: native Vietnamese, NOT in Amina's chat (left un-onboarded so later feed checks don't count her). Linh: in the chat.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b7', 'hoa@test.vn');
select set_config('app.bypass_protect', 'on', false);
update public.profiles set username = 'hoa_vn', native_language_id = 'vie' where id = '00000000-0000-0000-0000-0000000000b7';
select set_config('app.bypass_protect', 'off', false);
set role authenticated;

select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table bnt4 as select (public.send_message(p_conv => (select conv from ctx), p_body => 'Hom nay toi di hoc', p_language => 'vie', p_bounty => true)).id as id; grant select on bnt4 to public;

-- Visibility: the bounty from the conversation is in BOTH eligible helpers' "I can answer", from the same row.
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ declare b record; begin
  select * into b from public.list_open_bounties() x where x.message_id = (select id from bnt4);
  assert found, 'the chat partner (eligible) sees the conversation bounty in I can answer';
  assert b.conversation_id = (select conv from ctx), 'the chat partner gets the chat link';
  assert b.answers = 0 and b.cost = 50;
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000b7');
do $$ declare b record; begin
  select * into b from public.list_open_bounties() x where x.message_id = (select id from bnt4);
  assert found, 'an eligible helper outside the chat sees it too';
  assert b.conversation_id is null, 'a helper outside the chat never gets the chat id';
  assert not exists (select 1 from public.list_open_bounties(50, 50) x where x.message_id = (select id from bnt4)), 'paging: offset skips rows';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
do $$ begin assert not exists (select 1 from public.list_open_bounties() x where x.message_id = (select id from bnt4)), 'an ineligible user does not see it'; end $$;

-- Hoa answers from the queue; Linh corrects inside the chat. Both count as answers.
select tt.as_user('00000000-0000-0000-0000-0000000000b7');
create temp table hoa1 as select public.answer_bounty((select id from bnt4), 'Hôm nay tôi đi học', null) as id; grant select on hoa1 to public;
do $$ begin
  assert exists (select 1 from public.message_corrections where id = (select id from hoa1)), 'a helper outside the chat can read their own answer';
  assert (select status from public.list_my_bounty_answers() x where x.correction_id = (select id from hoa1)) = 'pending', 'My answers shows it pending';
  assert not exists (select 1 from public.list_open_bounties() x where x.message_id = (select id from bnt4)), 'answered: it leaves I can answer';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
create temp table linh1 as select public.suggest_correction((select id from bnt4), 'Hôm nay tôi đi học rồi', null) as id; grant select on linh1 to public;
do $$ begin assert (select conversation_id from public.list_my_bounty_answers() x where x.correction_id = (select id from linh1)) = (select conv from ctx), 'an in-chat answer keeps its chat link'; end $$;

select tt.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert (select answers from public.list_my_bounties() x where x.message_id = (select id from bnt4)) = 2, 'the asker sees 2 answers waiting'; end $$;
select public.accept_correction((select id from linh1));
do $$ declare b record; begin
  select * into b from public.list_my_bounties() x where x.message_id = (select id from bnt4);
  assert b.status = 'paid' and b.paid_to_username = (select username from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'paid, and the asker sees to whom';
  assert (select decided_by from public.message_corrections where id = (select id from linh1)) = auth.uid(), 'accept records who decided';
  assert (select decided_at from public.message_corrections where id = (select id from linh1)) is not null, 'accept records when';
end $$;
select tt.expect_error(format($q$select public.accept_correction(%L)$q$, (select id from hoa1)), 'correction_unavailable');
select tt.as_user('00000000-0000-0000-0000-0000000000b7');
do $$ declare a record; begin
  select * into a from public.list_my_bounty_answers() x where x.correction_id = (select id from hoa1);
  assert a.status = 'superseded' and not a.paid_to_me and a.bounty_status = 'paid', 'the other answer is superseded, not left pending';
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'correction_superseded'), 'its author is told';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select paid_to_me from public.list_my_bounty_answers() x where x.correction_id = (select id from linh1)), 'the winner sees it was paid to them';
  assert exists (select 1 from public.points_ledger where user_id = auth.uid() and reason = 'bounty_answered_accepted' and ref_id = (select id from bnt4)), 'reward went to the accepted answer''s author';
end $$;

-- Invalid transitions are refused by the database itself, whoever tries.
reset role;
select tt.expect_error(format($q$update public.messages set bounty_status = 'open' where id = %L$q$, (select id from bnt4)), 'invalid_bounty_transition');
select tt.expect_error(format($q$update public.messages set bounty_paid_to = '00000000-0000-0000-0000-0000000000b7' where id = %L$q$, (select id from bnt4)), 'invalid_bounty_transition');
select tt.expect_error(format($q$update public.message_corrections set status = 'pending' where id = %L$q$, (select id from hoa1)), 'correction_already_decided');
select set_config('app.bypass_protect', 'on', false);
update public.profiles set points_balance = 100 where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('app.bypass_protect', 'off', false);
set role authenticated;

-- Decline needs a reason; only the asker can decline; the helper gets the reason; a reminder before expiry.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table bnt5 as select (public.send_message(p_conv => (select conv from ctx), p_body => 'Toi thich an pho', p_language => 'vie', p_bounty => true)).id as id; grant select on bnt5 to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b7');
create temp table hoa2 as select public.answer_bounty((select id from bnt5), 'Tôi thích ăn phở', 'diacritics') as id; grant select on hoa2 to public;
reset role;
update public.messages set bounty_expires_at = now() + interval '2 hours' where id = (select id from bnt5);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select count(*) from public.list_my_bounties();
select count(*) from public.list_my_bounties();
do $$ begin assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'bounty_reminder' and (data->>'message_id')::uuid = (select id from bnt5)) = 1, 'one reminder when answers wait and time is short, however often the sweep runs'; end $$;
select tt.expect_error(format($q$select public.decline_correction(%L, '  ')$q$, (select id from hoa2)), 'reason_required');
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
select tt.expect_error(format($q$select public.decline_correction(%L, 'no')$q$, (select id from hoa2)), 'correction_unavailable');
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.decline_correction((select id from hoa2), 'This changes the meaning');
do $$ declare c record; begin
  select * into c from public.message_corrections where id = (select id from hoa2);
  assert c.status = 'dismissed' and c.decision_note = 'This changes the meaning' and c.decided_by = auth.uid() and c.decided_at is not null, 'decline records status, reason, who and when';
  assert (select bounty_status from public.messages where id = (select id from bnt5)) = 'open', 'declining an answer keeps the bounty open';
end $$;
select tt.expect_error(format($q$select public.decline_correction(%L, 'again')$q$, (select id from hoa2)), 'correction_unavailable');
select tt.as_user('00000000-0000-0000-0000-0000000000b7');
do $$ declare n record; begin
  select * into n from public.notifications where user_id = auth.uid() and type = 'correction_declined';
  assert found and n.data->>'note' = 'This changes the meaning', 'the helper is told why';
  assert n.data->>'conversation_id' is null, 'a helper outside the chat is not given the chat id';
  assert (select decision_note from public.list_my_bounty_answers() x where x.correction_id = (select id from hoa2)) = 'This changes the meaning';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.delete_message((select id from bnt5));   -- tidy: refund, so later sections start from the same balance

-- ============ 5b3. NAV BADGES + MESSAGE PUSH ============
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
select public.mark_tab_seen('bounties');
select tt.expect_error($q$select public.mark_tab_seen('admin')$q$, 'invalid_tab');
do $$ begin
  assert (public.nav_badges()->>'bounties')::int = 0, 'nothing new right after opening Bounties';
  assert public.nav_badges() ? 'home' and public.nav_badges() ? 'library', 'every tab has a count';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table bnt6 as select (public.send_message(p_conv => (select conv from ctx), p_body => 'Toi yeu Viet Nam', p_language => 'vie', p_bounty => true)).id as id; grant select on bnt6 to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin assert (public.nav_badges()->>'bounties')::int = 1, 'a new bounty I can answer shows on the Bounties badge'; end $$;
select public.mark_tab_seen('bounties');
do $$ begin assert (public.nav_badges()->>'bounties')::int = 0, 'opening the tab clears it'; end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000b7');
select public.answer_bounty((select id from bnt6), 'Tôi yêu Việt Nam', null);
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert (public.nav_badges()->>'bounties')::int = 1, 'an answer waiting for my decision shows on my Bounties badge'; end $$;
select public.delete_message((select id from bnt6));
do $$ begin assert (public.nav_badges()->>'bounties')::int = 0, 'refunded: nothing left to decide'; end $$;

-- A chat message is queued for push to the other member's devices once push is configured.
reset role;
insert into public.push_settings (function_url, webhook_secret) values ('https://push.invalid/send-push', 'test-secret');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000b2', 'https://push.invalid/device', 'k', 'a');
create temp table queued as select (select count(*) from net.http_request_queue) as n;
grant select on queued to public;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.send_message((select conv from ctx), 'Push me', null);
reset role;
do $$ begin
  assert (select count(*) from net.http_request_queue) = (select n from queued) + 1, 'a new chat message queues exactly one push call';
  assert (select convert_from(body, 'utf8') from net.http_request_queue order by id desc limit 1) like '%message_id%', 'the call carries the message id';
end $$;
delete from public.push_subscriptions where endpoint = 'https://push.invalid/device'; delete from public.push_settings where id;
set role authenticated;

-- ============ 5c. COMMUNITY LIBRARY + SAVED PARTNERS ============
select tt.as_user('00000000-0000-0000-0000-0000000000c3');   -- Zed: native Dutch, not learning anything
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', 'vie', 'phrase', null, null)$q$, 'not_contribution_eligible');
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', null, 'phrase', null, null)$q$, 'language_required');
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', 'nld', 'spam', null, null)$q$, 'invalid_category');
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', 'nld', 'phrase', null, 'http://evil.example/pixel.gif')$q$, 'invalid_image');
select public.post_contribution('Goedemorgen', 'Good morning', 'nld', 'phrase', null, 'https://images.unsplash.com/photo-1?w=800');
select tt.expect_error($q$select public.set_contribution_eligibility('00000000-0000-0000-0000-0000000000a1', 'native')$q$, 'does not exist');
do $$ begin assert (select count(*) from public.contribution_posts where user_id = auth.uid()) = 1, 'the valid post is stored'; end $$;
select tt.expect_error($q$insert into public.contribution_posts (user_id, phrase, category) values (auth.uid(), 'direct', 'phrase')$q$, 'permission denied');

select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.save_partner(auth.uid())$q$, 'cannot_save_self');
select tt.expect_error($q$insert into public.saved_partners (user_id, partner_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c3')$q$, 'permission denied');
select public.save_partner('00000000-0000-0000-0000-0000000000b2');
do $$ begin assert (select count(*) from public.saved_partners where user_id = auth.uid()) = 1, 'partner saved'; end $$;

-- ============ 5d. LANGUAGE RULES: MATCH TIERS, POST LANGUAGE, POINTS ============
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005e5', 'sharesnative@test.com'),
  ('00000000-0000-0000-0000-0000000005f6', 'teacher@test.com'),
  ('00000000-0000-0000-0000-0000000005f7', 'swapper@test.com'),
  ('00000000-0000-0000-0000-0000000005a7', 'student@test.com'),
  ('00000000-0000-0000-0000-0000000005a8', 'sametarget@test.com');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000005e5');
select public.set_language_profile('swh', 'fra', 'A1'); select public.save_profile('sharesnative', 'S', '', 'Africa/Nairobi', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005f6');
select public.set_language_profile('vie', null, null); select public.save_profile('teacher', 'T', '', 'Not/AZone', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005f7');
select public.set_language_profile('vie', 'swh', 'A1'); select public.save_profile('swapper', 'Sw', '', 'Asia/Hanoi', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005a7');
select public.set_language_profile('eng', 'swh', 'B1'); select public.save_profile('student', 'St', '', 'Europe/London', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005a8');
select public.set_language_profile('fra', 'vie', 'A2'); select public.save_profile('sametarget', 'Sa', '', 'Europe/Paris', false, null, null);

-- Amina is native Swahili, learning Vietnamese. A bad timezone on a profile must not break her feed.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare kinds text[]; begin
  assert (select match_kind from public.home_feed(10, 10) where username = 'swapper') = 'swap', 'native Vietnamese learning Swahili is a perfect swap';
  assert (select match_language from public.home_feed(10, 10) where username = 'swapper') = 'vie', 'the swap names what they teach me';
  assert (select match_kind from public.home_feed(10, 10) where username = 'teacher') = 'native', 'native Vietnamese only: they teach me';
  assert (select match_kind from public.home_feed(10, 10) where username = 'student') = 'learning', 'learning Swahili: I teach them';
  assert (select match_language from public.home_feed(10, 10) where username = 'student') = 'swh', 'badge names the language they learn';
  assert (select match_kind from public.home_feed(10, 10) where username = 'sharesnative') = 'other', 'sharing a native language is not a match';
  assert (select match_kind from public.home_feed(10, 10) where username = 'sametarget') = 'other', 'sharing a target language is not a match';
  select array_agg(match_kind) into kinds from public.home_feed(10, 10);
  assert kinds[1:3] = array['swap', 'native', 'learning'], 'tiers come in order';
end $$;

-- Home leaves out someone I'm talking to, and brings them back once we've lost touch.
reset role;
insert into public.conversations (id, direct_key) values ('00000000-0000-0000-0000-0000000fee01', 'amina:teacher');
insert into public.conversation_members (conversation_id, user_id) values ('00000000-0000-0000-0000-0000000fee01', '00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000fee01', '00000000-0000-0000-0000-0000000005f6');
insert into public.messages (conversation_id, sender_id, body) values ('00000000-0000-0000-0000-0000000fee01', '00000000-0000-0000-0000-0000000005f6', 'Chao ban');
do $$ begin assert not exists (select 1 from public.home_feed(50, 50) where username = 'teacher'), 'a current chat is not a suggestion'; end $$;
update public.messages set created_at = now() - interval '45 days' where conversation_id = '00000000-0000-0000-0000-0000000fee01';
do $$ begin assert (select last_chatted_at from public.home_feed(50, 50) where username = 'teacher') < now() - interval '30 days', 'back after a long silence, saying when'; end $$;
delete from public.conversations where id = '00000000-0000-0000-0000-0000000fee01';
do $$ begin assert (select last_chatted_at from public.home_feed(50, 50) where username = 'teacher') is null, 'never chatted: nothing to say'; end $$;
set role authenticated;

-- Teaching (Library posts) is for native speakers only: a learner's level, even verified B1, doesn't open it.
select tt.expect_error($q$select public.post_contribution('Xin chào', null, 'vie', 'phrase', null, null)$q$, 'not_contribution_eligible');
select public.post_contribution('Habari', null, 'swh', 'phrase', null, null);
reset role; select set_config('app.bypass_protect', 'on', false);
update public.profiles set verified_level = 'B1' where id = '00000000-0000-0000-0000-0000000000a1';   -- as if earned
select set_config('app.bypass_protect', 'off', false); set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.post_contribution('Xin chào', null, 'vie', 'phrase', null, null)$q$, 'not_contribution_eligible');
reset role;
insert into public.contribution_posts (user_id, language_id, phrase) values ('00000000-0000-0000-0000-0000000000a1', 'vie', 'Xin chào');   -- posted under the old B1 rule
select set_config('app.bypass_protect', 'on', false);
update public.profiles set verified_level = null where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('app.bypass_protect', 'off', false); set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
-- An older post may keep its language, but nothing moves into that language.
select public.update_contribution((select id from public.contribution_posts where phrase = 'Xin chào'), 'Xin chào bạn', null, 'vie', 'phrase', null, null, 'left');
select tt.expect_error($q$select public.update_contribution((select id from public.contribution_posts where phrase = 'Habari'), 'Habari', null, 'vie', 'phrase', null, null, 'left')$q$, 'not_contribution_eligible');
do $$ begin
  assert (select public.matches_my_languages(c) from public.contribution_posts c where phrase = 'Habari'), 'my native language matches';
  assert (select public.matches_my_languages(c) from public.contribution_posts c where phrase = 'Xin chào bạn'), 'my learning language matches';
  assert not (select public.matches_my_languages(c) from public.contribution_posts c where phrase = 'Goedemorgen'), 'Dutch does not match Amina';
end $$;

-- Corrections: real edits only.
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
create temp table tagged as select (public.send_message((select conv from ctx), 'Mimi kwenda shule', null, 'swh')).id as id; grant select on tagged to public;
create temp table untagged as select (public.send_message((select conv from ctx), 'Mimi kula chakula', null, 'swh')).id as id; grant select on untagged to public;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.suggest_correction((select id from tagged), '  mimi KWENDA shule ', null)$q$, 'no_change');
select tt.expect_error($q$select public.suggest_correction((select id from tagged), '   ', null)$q$, 'empty_message');
create temp table ctagged as select public.suggest_correction((select id from tagged), 'Mimi ninakwenda shule', null) as id; grant select on ctagged to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
select public.accept_correction((select id from ctagged));
do $$ begin
  assert (select language_id from public.saved_phrases where user_id = auth.uid() and phrase = 'Mimi ninakwenda shule') = 'swh', 'the saved phrase keeps the message language';
end $$;
reset role;
do $$ begin assert (select count(*) from public.points_ledger where user_id = '00000000-0000-0000-0000-0000000000a1' and reason = 'correction_accepted') = 1, 'a tagged correction earns +5'; end $$;
update public.messages set language_id = null where id = (select id from untagged);   -- an old message from before language tags
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table cuntagged as select public.suggest_correction((select id from untagged), 'Mimi ninakula chakula', null) as id; grant select on cuntagged to public;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
select public.accept_correction((select id from cuntagged));
reset role;
do $$ begin
  assert (select status from public.message_corrections where id = (select id from cuntagged)) = 'accepted', 'an untagged correction can still be accepted';
  assert (select count(*) from public.points_ledger where user_id = '00000000-0000-0000-0000-0000000000a1' and reason = 'correction_accepted') = 1, 'an untagged correction earns nothing';
end $$;
-- 20 corrections in the last hour is the limit.
insert into public.message_corrections (message_id, corrector_id, suggested_text, created_at)
  select (select id from tagged), '00000000-0000-0000-0000-0000000000a1', 'spam ' || g, now() from generate_series(1, 20) g;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.suggest_correction((select id from tagged), 'one more', null)$q$, 'rate_limited');

-- ============ 5e. EARNED LEVELS AND HELPFULNESS ============
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e001', 'lena@test.com'),
  ('00000000-0000-0000-0000-00000000e002', 'native1@test.com'),
  ('00000000-0000-0000-0000-00000000e003', 'native2@test.com');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e002');
select public.set_language_profile('fra', null, null); select public.save_profile('native1', 'N1', '', 'Europe/Paris', false, null, null);
-- native2 is a native German speaker beginning French (A1), so Lena, once past B1, may correct them.
select tt.as_user('00000000-0000-0000-0000-00000000e003');
select public.set_language_profile('deu', 'fra', 'A1'); select public.save_profile('native2', 'N2', '', 'Europe/Berlin', false, null, null);
-- Lena claims C1 in French on day one: that is allowed, and it unlocks nothing.
select tt.as_user('00000000-0000-0000-0000-00000000e001');
select public.set_language_profile('eng', 'fra', 'C1'); select public.save_profile('lena', 'Lena', '', 'Europe/London', false, null, null);
select tt.expect_error($q$select public.post_contribution('Bonjour à tous', null, 'fra', 'phrase', null, null)$q$, 'not_contribution_eligible');
select tt.expect_error($q$update public.profiles set verified_level = 'C2' where id = auth.uid()$q$, 'permission denied');
select tt.expect_error($q$select public.evaluate_level(auth.uid())$q$, 'permission denied');
select tt.expect_error($q$select public.evaluate_band(auth.uid(), 'fra', 'A1')$q$, 'permission denied');
select public.set_language_profile('eng', 'fra', 'B2');
select tt.expect_error($q$select public.set_language_profile('eng','fra','C1')$q$, 'level_must_be_earned');
do $$ begin assert (public.my_path()->>'verified_level') is null, 'a claim verifies nothing'; end $$;

reset role;
create temp table lena_conv as select gen_random_uuid() as c1, gen_random_uuid() as c2; grant select on lena_conv to public;
insert into public.conversations (id, direct_key) select c1, 'lena:n1' from lena_conv union all select c2, 'lena:n2' from lena_conv;
insert into public.conversation_members (conversation_id, user_id)
  select c1, '00000000-0000-0000-0000-00000000e001'::uuid from lena_conv union all select c1, '00000000-0000-0000-0000-00000000e002' from lena_conv
  union all select c2, '00000000-0000-0000-0000-00000000e001' from lena_conv union all select c2, '00000000-0000-0000-0000-00000000e003' from lena_conv;
-- Spam: 200 identical messages over 10 days, and 3 too short, with replies.
insert into public.messages (conversation_id, sender_id, body, language_id, created_at)
  select c1, '00000000-0000-0000-0000-00000000e001', 'toujours le meme texte', 'fra', now() - (g % 10) * interval '1 day' - interval '1 hour' from lena_conv, generate_series(1, 200) g;
insert into public.messages (conversation_id, sender_id, body, language_id) select c1, '00000000-0000-0000-0000-00000000e002', 'Merci beaucoup', 'fra' from lena_conv;
-- 100 real messages over 10 days in two chats, every one corrected: plenty of practice, many errors.
insert into public.messages (conversation_id, sender_id, body, language_id, created_at)
  select case when g % 2 = 0 then c1 else c2 end, '00000000-0000-0000-0000-00000000e001', 'message reel numero ' || g, 'fra', now() - (10 + g % 10) * interval '1 day' from lena_conv, generate_series(1, 100) g;
insert into public.message_corrections (message_id, corrector_id, suggested_text)
  select m.id, '00000000-0000-0000-0000-00000000e002', 'corrected' from public.messages m where m.body like 'message reel numero %';
insert into public.messages (conversation_id, sender_id, body, language_id) select c2, '00000000-0000-0000-0000-00000000e003', 'Tres bien', 'fra' from lena_conv;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
-- Chat, however much, no longer moves a level: only passed topics do.
do $$ declare p jsonb := public.my_path(); begin
  assert (p->>'verified_level') is null, 'chatting promotes nobody: ' || (p->>'verified_level');
  assert p->>'current_band' = 'B2', 'a path starts at the level claimed at sign-up (B2)';
  assert (select state from jsonb_to_recordset(p->'levels') as x(band text, state text) where band = 'B1') = 'skipped';
end $$;
select tt.expect_error($q$select public.post_contribution('Bonjour à tous', null, 'fra', 'phrase', null, null)$q$, 'not_contribution_eligible');
reset role;
select tt.pass_topics('00000000-0000-0000-0000-00000000e001', 'fra', 9);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ declare p jsonb := public.my_path(); begin
  assert (p->>'verified_level') = 'B1', 'a passed B1 topic verifies B1: ' || (p->>'verified_level');
  assert (select learning_level from public.profiles where id = auth.uid()) = 'B2', 'the claimed level is kept';
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'level_up' and data->>'level' = 'B1'), 'told about the promotion';
  assert (select count(*) from public.list_notifications() n where n.type = 'level_up' and n.data->>'level' = 'B1') = 1, 'a notification with no actor still lists';
end $$;
-- Passing B1 lets her correct learners below her level, but teaching stays with native speakers.
select tt.expect_error($q$select public.post_contribution('Bonjour à tous', null, 'fra', 'phrase', null, null)$q$, 'not_contribution_eligible');
do $$ begin
  assert public.can_correct_language(auth.uid(), 'fra', '00000000-0000-0000-0000-00000000e003'), 'past B1, she may correct an A1 learner';
  assert not public.can_correct_language(auth.uid(), 'fra', '00000000-0000-0000-0000-00000000e002'), 'but never a native speaker';
end $$;
select public.set_language_profile('eng', 'fra', 'A1');
do $$ begin assert (select learning_level from public.profiles where id = auth.uid()) = 'B1', 'cannot go below what was earned'; end $$;

-- Helpfulness: Lena (B1) corrects native2's (A1) French. Ratings come from the message author only, after a reply.
select tt.as_user('00000000-0000-0000-0000-00000000e003');
create temp table n2_msg as select (public.send_message((select c2 from lena_conv), 'Je suis tres content de vous voir', null, 'fra')).id as id; grant select on n2_msg to public;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
create temp table lena_fix as select public.suggest_correction((select id from n2_msg), 'Je suis très content de vous voir', null) as id; grant select on lena_fix to public;
select tt.as_user('00000000-0000-0000-0000-00000000e003');
select tt.expect_error($q$select public.rate_correction((select id from lena_fix), true)$q$, 'correction_unavailable');   -- still pending
select public.accept_correction((select id from lena_fix));
select public.rate_correction((select id from lena_fix), true);
select tt.as_user('00000000-0000-0000-0000-00000000e001');
select tt.expect_error($q$select public.rate_correction((select id from lena_fix), false)$q$, 'correction_unavailable');   -- not the author
select tt.expect_error($q$update public.message_corrections set feedback = 'not_helpful' where id = (select id from lena_fix)$q$, 'permission denied');   -- clients don't write here
do $$ begin
  assert (select feedback from public.message_corrections where id = (select id from lena_fix)) = 'helpful', 'a corrector cannot rewrite their rating';
  assert (select points_balance from public.profiles where id = auth.uid()) = 105, 'a verified B1 learner earns +5';
  assert not (public.my_path()->>'rewards_paused')::boolean;
end $$;

-- One annoyed person cannot pause rewards; 3 different people with mostly negative ratings can.
reset role;
insert into public.message_corrections (message_id, corrector_id, suggested_text, status, feedback, feedback_at)
  select m.id, '00000000-0000-0000-0000-00000000e001', 'x', 'accepted', 'not_helpful', now()
  from (select id from public.messages where sender_id = '00000000-0000-0000-0000-00000000e002' limit 1) m, generate_series(1, 6);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ begin assert not (public.my_path()->>'rewards_paused')::boolean, 'all from one person: not paused'; end $$;
reset role;
insert into public.message_corrections (message_id, corrector_id, suggested_text, status, feedback, feedback_at)
  select m.id, '00000000-0000-0000-0000-00000000e001', 'x', 'accepted', 'not_helpful', now()
  from public.messages m where m.sender_id in ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000b2') and m.id in (
    (select id from public.messages where sender_id = '00000000-0000-0000-0000-00000000e003' limit 1),
    (select id from public.messages where sender_id = '00000000-0000-0000-0000-0000000000b2' limit 1));
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ begin assert (public.my_path()->>'rewards_paused')::boolean, '3 people, mostly negative: paused'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000e003');
create temp table n2_msg2 as select (public.send_message((select c2 from lena_conv), 'Nous allons au cinema ce soir', null, 'fra')).id as id; grant select on n2_msg2 to public;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
create temp table lena_fix2 as select public.suggest_correction((select id from n2_msg2), 'Nous allons au cinéma ce soir', null) as id; grant select on lena_fix2 to public;
select tt.as_user('00000000-0000-0000-0000-00000000e003');
select public.accept_correction((select id from lena_fix2));
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ begin assert (select points_balance from public.profiles where id = auth.uid()) = 105, 'paused: accepted, but no +5'; end $$;

-- A new language starts from nothing.
select public.set_language_profile('eng', 'deu', 'C2');
do $$ begin
  assert (select verified_level from public.profiles where id = auth.uid()) is null, 'evidence belongs to one language';
  assert not public.can_correct_language(auth.uid(), 'fra') and not public.can_correct_language(auth.uid(), 'deu'), 'rights go with it';
end $$;

-- ============ 5f. VOUCHING, VERIFIED LEVELS ON CARDS, PRESENCE ============
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f001', 'vera@test.com'),
  ('00000000-0000-0000-0000-00000000f002', 'native3@test.com'),
  ('00000000-0000-0000-0000-00000000f003', 'stranger@test.com');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000f002');
select public.set_language_profile('fra', null, null); select public.save_profile('native3', 'N3', '', 'Europe/Paris', false, null, null);
select tt.as_user('00000000-0000-0000-0000-00000000f003');
select public.set_language_profile('eng', null, null); select public.save_profile('strangeruser', 'St', '', 'Europe/London', false, null, null);
select tt.as_user('00000000-0000-0000-0000-00000000f001');
select public.set_language_profile('eng', 'fra', 'C1'); select public.save_profile('vera', 'Vera', '', 'Europe/London', false, null, null);
reset role;
update public.profiles set created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-00000000f002';
create temp table vera_conv as select gen_random_uuid() as c1, gen_random_uuid() as c2; grant select on vera_conv to public;
insert into public.conversations (id, direct_key) select c1, 'vera:n1' from vera_conv union all select c2, 'vera:n3' from vera_conv;
insert into public.conversation_members (conversation_id, user_id)
  select c1, '00000000-0000-0000-0000-00000000f001'::uuid from vera_conv union all select c1, '00000000-0000-0000-0000-00000000e002' from vera_conv
  union all select c2, '00000000-0000-0000-0000-00000000f001' from vera_conv union all select c2, '00000000-0000-0000-0000-00000000f002' from vera_conv;
insert into public.messages (conversation_id, sender_id, body, language_id, created_at)
  select c1, '00000000-0000-0000-0000-00000000f001', 'bonjour numero ' || g, 'fra', now() - (g % 3) * interval '1 day' - interval '1 hour' from vera_conv, generate_series(1, 4) g;
insert into public.messages (conversation_id, sender_id, body, language_id)
  select c1, '00000000-0000-0000-0000-00000000e002', 'Merci numero ' || g, 'fra' from vera_conv, generate_series(1, 5) g;
set role authenticated;

-- Vera passes topics 1 to 9 in French: B1, with the rights it brings. Her claim stays a claim.
reset role;
select tt.pass_topics('00000000-0000-0000-0000-00000000f001', 'fra', 9);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000f001');
do $$ begin
  assert (select verified_level from public.profiles where id = auth.uid()) = 'B1', 'passing a B1 topic reaches B1';
  assert public.can_correct_language(auth.uid(), 'fra', '00000000-0000-0000-0000-00000000e003'), 'and brings the right to correct those below her';
  assert not public.can_correct_language(auth.uid(), 'fra'), 'but not to teach';
  assert (select learning_level from public.profiles where id = auth.uid()) = 'C1', 'the claim stays a claim';
end $$;
-- Cards can tell the two apart.
select tt.as_user('00000000-0000-0000-0000-00000000f003');
do $$ declare l jsonb; begin
  select x into l from jsonb_array_elements(public.get_profile('vera')->'languages') x where x->>'role' = 'learning';
  assert l->>'level' = 'C1' and l->>'verified_level' = 'B1', 'a card sees claim and verified level: ' || l::text;
end $$;

-- Presence. Vera and native3 share an accepted chat; the stranger does not.
select tt.as_user('00000000-0000-0000-0000-00000000f001');
select public.touch_presence();
select tt.as_user('00000000-0000-0000-0000-00000000f003');
do $$ declare r record; begin
  select * into r from public.presence_of(array['00000000-0000-0000-0000-00000000f001']::uuid[]);
  assert r.online, 'a stranger sees online';
  assert r.last_seen_at is null, 'but not when they were last here';
  assert (select count(*) from public.user_presence) = 0, 'the table itself is closed';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000f002');
do $$ begin assert (select last_seen_at from public.presence_of(array['00000000-0000-0000-0000-00000000f001']::uuid[])) is not null, 'a chat partner sees last seen'; end $$;
reset role;
update public.user_presence set last_seen_at = now() - interval '5 minutes' where user_id = '00000000-0000-0000-0000-00000000f001';
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000f002');
do $$ begin assert not (select online from public.presence_of(array['00000000-0000-0000-0000-00000000f001']::uuid[])), 'no heartbeat: not online'; end $$;
-- Turning it off works both ways.
select public.set_show_activity(false);
select public.touch_presence();
do $$ begin assert (select count(*) from public.presence_of(array['00000000-0000-0000-0000-00000000f001']::uuid[])) = 0, 'hidden: I see nobody'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000f001');
select public.touch_presence();
do $$ begin assert (select count(*) from public.presence_of(array['00000000-0000-0000-0000-00000000f002']::uuid[])) = 0, 'hidden: nobody sees me'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000f002');
select public.set_show_activity(true);
-- A block hides it too.
do $$ begin assert (select count(*) from public.presence_of(array['00000000-0000-0000-0000-00000000f001']::uuid[])) = 1; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000f001');
select public.block_user('00000000-0000-0000-0000-00000000f002');
select tt.as_user('00000000-0000-0000-0000-00000000f002');
do $$ begin assert (select count(*) from public.presence_of(array['00000000-0000-0000-0000-00000000f001']::uuid[])) = 0, 'blocked people see no presence'; end $$;

-- ============ 5g. CONTRIBUTION REVIEW: THREADS, DECISIONS, NOTIFICATIONS, ACCOUNTABILITY ============
-- Dennis posts (native Swahili). Mary and John are native Swahili too; Peter only learns it, below B1; Admin moderates.
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000d001', 'dennis@test.com'),
  ('00000000-0000-0000-0000-00000000d002', 'mary@test.com'),
  ('00000000-0000-0000-0000-00000000d003', 'peter@test.com'),
  ('00000000-0000-0000-0000-00000000d004', 'john@test.com');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000d001'); select public.set_language_profile('swh', null, null); select public.save_profile('dennis', 'Dennis', '', 'Africa/Nairobi', false, null, null);
select tt.as_user('00000000-0000-0000-0000-00000000d002'); select public.set_language_profile('swh', null, null); select public.save_profile('mary', 'Mary', '', 'Africa/Nairobi', false, null, null);
select tt.as_user('00000000-0000-0000-0000-00000000d003'); select public.set_language_profile('eng', 'swh', 'A2'); select public.save_profile('peter', 'Peter', '', 'Africa/Nairobi', false, null, null);
select tt.as_user('00000000-0000-0000-0000-00000000d004'); select public.set_language_profile('swh', null, null); select public.save_profile('john', 'John', '', 'Africa/Nairobi', false, null, null);

select tt.as_user('00000000-0000-0000-0000-00000000d001');
create temp table dpost as select public.post_contribution('Habari gani', 'How are you', 'swh', 'phrase', null, null) as id; grant select on dpost to public;
create temp table keys as select gen_random_uuid() as k1, gen_random_uuid() as k2, gen_random_uuid() as k3, gen_random_uuid() as k4, gen_random_uuid() as k5, gen_random_uuid() as k6; grant select on keys to public;

-- Who may do what.
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', 'Mine', 'x', null, gen_random_uuid())$q$, 'owner_cannot_correct');
select tt.expect_error($q$select public.toggle_post_endorsement((select id from dpost))$q$, 'cannot_review_own');
select tt.as_user('00000000-0000-0000-0000-00000000d003');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', 'Wrong', 'Habari yako', null, gen_random_uuid())$q$, 'not_qualified_to_correct');
select tt.expect_error($q$select public.toggle_post_endorsement((select id from dpost))$q$, 'not_qualified_to_correct');
select tt.expect_error($q$insert into public.post_discussion (post_id, author_id, kind, body, client_key) values ((select id from dpost), auth.uid(), 'comment', 'direct', gen_random_uuid())$q$, 'permission denied');

-- Mary corrects Dennis. A correction needs a real change and an explanation.
select tt.as_user('00000000-0000-0000-0000-00000000d002');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', 'Same', 'habari GANI', null, gen_random_uuid())$q$, 'no_change');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', 'No proposal', null, null, gen_random_uuid())$q$, 'proposal_required');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', '   ', 'Habari yako', null, gen_random_uuid())$q$, 'explanation_required');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', 'x', 'y', null, null)$q$, 'missing_client_key');
create temp table cm as select public.submit_discussion((select id from dpost), null, 'correction', 'More natural', 'Habari yako', 'How are you doing', (select k1 from keys)) as id; grant select on cm to public;
-- A repeated tap: same row, one record, one notification.
do $$ begin
  assert public.submit_discussion((select id from dpost), null, 'correction', 'More natural', 'Habari yako', 'How are you doing', (select k1 from keys)) = (select id from cm), 'same key returns the same correction';
  assert (select count(*) from public.post_discussion where post_id = (select id from dpost)) = 1, 'one row after a repeated tap';
end $$;
select tt.expect_error($q$select public.submit_discussion((select id from dpost), null, 'correction', 'Again', 'Habari yako', 'How are you doing', gen_random_uuid())$q$, 'duplicate_correction');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), (select id from cm), 'correction', 'Self', 'Mambo', null, gen_random_uuid())$q$, 'cannot_correct_self');
select tt.as_user('00000000-0000-0000-0000-00000000d001');
do $$ begin
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_correction') = 1, 'Dennis told once';
  assert (select review_status from public.contribution_posts where id = (select id from dpost)) = 'corrections_received', 'a correction waiting reads as feedback, not as a dispute';
  assert (select count(*) from public.decision_items where user_id = auth.uid() and resolved_at is null) = 1, 'a decision is owed';
  assert (select phrase from public.contribution_posts where id = (select id from dpost)) = 'Habari gani', 'original untouched';
  assert (select current_phrase from public.contribution_posts where id = (select id from dpost)) is null, 'nothing accepted yet';
end $$;
select tt.expect_error($q$select public.post_contribution('x', null, 'nld', 'phrase', null, null)$q$, 'not_contribution_eligible');   -- language rule still first in line for a non-owner language
select tt.expect_error($q$select public.delete_contribution((select id from dpost))$q$, 'post_has_open_decisions');
select tt.expect_error($q$select public.update_contribution((select id from dpost), 'Changed', 'How are you', 'swh', 'phrase', null, null, 'left')$q$, 'post_under_review');
select public.update_contribution((select id from dpost), 'Habari gani', 'How are you', 'swh', 'idiom', 'Heard in Nairobi', null, 'left');   -- context may change

-- Peter replies to Mary; he is not qualified to correct, but anyone may discuss.
select tt.as_user('00000000-0000-0000-0000-00000000d003');
create temp table rp as select public.submit_discussion((select id from dpost), (select id from cm), 'comment', 'I agree with Mary', null, null, (select k2 from keys)) as id; grant select on rp to public;
select public.toggle_correction_agreement((select id from cm));
select tt.expect_error($q$select public.submit_discussion((select id from dpost), gen_random_uuid(), 'comment', 'Orphan', null, null, gen_random_uuid())$q$, 'invalid_parent');

-- John challenges Mary's correction: a correction to a correction.
select tt.as_user('00000000-0000-0000-0000-00000000d004');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), (select id from rp), 'correction', 'Bad target', 'Mambo', null, gen_random_uuid())$q$, 'invalid_parent');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), (select id from cm), 'correction', 'Same as Mary', 'Habari yako', null, gen_random_uuid())$q$, 'no_change');
create temp table cj as select public.submit_discussion((select id from dpost), (select id from cm), 'correction', 'Friendlier', 'Mambo vipi', null, (select k3 from keys)) as id; grant select on cj to public;
do $$ begin
  assert (select depth from public.post_discussion where id = (select id from cj)) = 1, 'nested under Mary';
  assert (select parent_id from public.post_discussion where id = (select id from cj)) = (select id from cm), 'parent reference is exact';
end $$;
-- Mary answers John with evidence: two levels down.
select tt.as_user('00000000-0000-0000-0000-00000000d002');
create temp table rm as select public.submit_discussion((select id from dpost), (select id from cj), 'comment', 'The dictionary says otherwise', null, null, (select k4 from keys)) as id; grant select on rm to public;
do $$ declare t jsonb; begin
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_challenged' and data->>'item_id' = (select id::text from cj)) = 1, 'Mary told her correction was challenged';
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_reply') = 1, 'Mary told about Peter''s reply';
  t := public.get_post_thread((select id from dpost));
  assert jsonb_array_length(t->'items') = 4, 'all four in the thread';
  assert (t->'me'->>'can_review')::boolean, 'Mary may review';
  assert (select (x->>'agree_count')::int from jsonb_array_elements(t->'items') x where x->>'id' = (select id::text from cm)) = 1, 'Peter''s agreement counted';
  assert (select count(*) from jsonb_array_elements(t->'history')) = 4, 'every step on the record';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000d001');
do $$ begin
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_correction') = 2, 'Dennis told about John too: his post is affected';
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_reply') = 2, 'Dennis told about both replies on corrections to his post';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000d003');
do $$ begin
  assert (select count(*) from public.notifications where user_id = auth.uid() and type in ('post_challenged','post_correction')) = 0, 'Peter is not involved in John''s correction: no alert';
end $$;
-- What was written cannot be rewritten, or moved, by anyone calling the table.
reset role;
select tt.expect_error($q$update public.post_discussion set body = 'rewritten' where id = (select id from cm)$q$, 'discussion_is_immutable');
select tt.expect_error($q$update public.post_discussion set parent_id = (select id from cj) where id = (select id from cm)$q$, 'discussion_is_immutable');
set role authenticated;

-- Decisions: only the owner, never by reading, and not twice.
select tt.as_user('00000000-0000-0000-0000-00000000d004');
select tt.expect_error($q$select public.decide_correction((select id from cm), true, null)$q$, 'forbidden');
select tt.as_user('00000000-0000-0000-0000-00000000d001');
select public.mark_decisions_viewed((select id from dpost));
do $$ begin assert (select count(*) from public.decision_items where user_id = auth.uid() and resolved_at is null and viewed_at is not null) = 2, 'viewing records, and closes nothing'; end $$;
select public.decide_correction((select id from cm), true, 'Good catch');
select tt.expect_error($q$select public.decide_correction((select id from cm), false, null)$q$, 'already_decided');
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from dpost);
  assert p.phrase = 'Habari gani' and p.translation = 'How are you', 'accepting never touches the original';
  assert p.current_phrase = 'Habari yako' and p.current_translation = 'How are you doing', 'accepted value shown separately';
  assert p.accepted_item_id = (select id from cm);
  assert p.review_status = 'corrections_received', 'John''s proposal is still open';
  assert (select status from public.post_discussion where id = (select id from cj)) = 'pending', 'accepting Mary does not touch John';
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-00000000d002') = 105, 'Mary earns +5';
end $$;
-- Now John's: it wins only because Dennis decides it, and Mary's steps aside but stays on the record.
select public.decide_correction((select id from cj), true, null);
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from dpost);
  assert p.current_phrase = 'Mambo vipi', 'John''s phrase is now current';
  assert p.current_translation = 'How are you doing', 'John proposed no translation: the accepted one stays';
  assert p.review_status = 'reviewed';
  assert (select status from public.post_discussion where id = (select id from cm)) = 'superseded', 'Mary superseded';
  assert (select count(*) from public.decision_items where user_id = auth.uid() and resolved_at is null) = 0, 'nothing owed any more';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000d002');
do $$ begin assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_superseded') = 1, 'Mary told she was superseded'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000d004');
do $$ begin assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_accepted') = 1, 'John told he was accepted'; end $$;
select tt.expect_error($q$select public.withdraw_discussion((select id from cj))$q$, 'already_decided');

-- Withdrawing and declining; correction of a closed proposal is refused.
create temp table cw as select public.submit_discussion((select id from dpost), null, 'clarification', 'Which region is this from?', null, null, (select k5 from keys)) as id; grant select on cw to public;
select public.withdraw_discussion((select id from cw));
do $$ begin assert (select status from public.post_discussion where id = (select id from cw)) = 'withdrawn'; end $$;
select tt.expect_error($q$select public.resolve_clarification((select id from cw), 'late')$q$, 'already_decided');
select tt.as_user('00000000-0000-0000-0000-00000000d002');
select tt.expect_error($q$select public.submit_discussion((select id from dpost), (select id from cm), 'correction', 'Too late', 'Habari za leo', null, gen_random_uuid())$q$, 'parent_closed');

-- Moderators reverse with a reason, on the record.
select tt.as_user('00000000-0000-0000-0000-00000000d003');
select tt.expect_error($q$select public.admin_override_correction((select id from cj), 'declined', 'no')$q$, 'forbidden');
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
select tt.expect_error($q$select public.admin_override_correction((select id from cj), 'declined', '  ')$q$, 'reason_required');
select public.admin_override_correction((select id from cj), 'declined', 'Offensive in context');
do $$ begin
  assert (select current_phrase from public.contribution_posts where id = (select id from dpost)) is null, 'back to the original';
  assert exists (select 1 from jsonb_array_elements(public.admin_accountability()->'audit') x where x->>'action' like 'decision_override%' and x->>'reason' = 'Offensive in context'), 'audited';
end $$;

-- Mute and preferences: optional alerts stop; a required decision does not.
select tt.as_user('00000000-0000-0000-0000-00000000d001');
select public.set_thread_mute((select id from dpost), true);
select public.set_notification_prefs('{"corrections":false,"bogus":true}');
do $$ begin assert (select notification_prefs from public.profiles where id = auth.uid()) = '{"corrections":false}'::jsonb, 'only known categories kept'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000d002');
create temp table cq as select public.submit_discussion((select id from dpost), null, 'correction', 'Muted owner', 'Habari za asubuhi', null, gen_random_uuid()) as id; grant select on cq to public;
select public.submit_discussion((select id from dpost), null, 'comment', 'Just saying', null, null, gen_random_uuid());
select tt.as_user('00000000-0000-0000-0000-00000000d001');
do $$ begin
  assert (select count(*) from public.notifications where user_id = auth.uid() and data->>'item_id' = (select id::text from cq)) = 1, 'a required decision gets through';
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'post_reply' and data->>'parent_id' is null) = 0, 'an optional reply does not';
end $$;
select public.set_thread_mute((select id from dpost), false);
select public.set_notification_prefs('{}');

-- Notifications page: category filter, paging, read state persists, retries do not duplicate.
do $$ declare n int; first_at timestamptz; begin
  select count(*) into n from public.list_notifications(100, null, 'corrections');
  assert n >= 3, 'category filter returns corrections';
  assert not exists (select 1 from public.list_notifications(100, null, 'corrections') x where x.category <> 'corrections'), 'and only those';
  select min(x.created_at) into first_at from public.list_notifications(2) x;
  assert not exists (select 1 from public.list_notifications(100, first_at) x where x.created_at >= first_at), 'cursor pages older rows only';
end $$;
select public.mark_notifications_read();
do $$ begin
  assert public.count_unread_notifications() = 0;
  assert (select count(*) from public.notifications where user_id = auth.uid()) > 0, 'read is not deleted';
end $$;
select tt.expect_error($q$select public.notify(auth.uid(), null, 'correction', '{}')$q$, 'permission denied');
select tt.expect_error($q$select public.accountability_sweep()$q$, 'permission denied');

-- Accountability: time passes (test setup moves the clock on the rows).
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.decision_items set created_at = now() - interval '3 days' where item_id = (select id from cq);
select public.accountability_sweep();
do $$ begin
  assert (select reminder_count from public.decision_items where item_id = (select id from cq)) = 1, 'first reminder after 48 hours';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000d001' and type = 'action_reminder') = 1, 'Dennis reminded';
end $$;
select public.accountability_sweep();
do $$ begin assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000d001' and type = 'action_reminder') = 1, 'a second sweep does not repeat it'; end $$;
-- One overdue decision: notified, and no restriction.
update public.decision_items set due_at = now() - interval '1 hour' where item_id = (select id from cq);
select public.accountability_sweep();
do $$ begin
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000d001' and type = 'action_overdue') = 1, 'overdue notice to the owner';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000d002' and type = 'action_overdue') = 1, 'and to the person waiting';
  assert not exists (select 1 from public.user_restrictions where user_id = '00000000-0000-0000-0000-00000000d001'), 'one overdue item restricts nobody';
end $$;
update public.decision_items set due_at = now() - interval '4 days', overdue_notified_at = now() - interval '4 days' where item_id = (select id from cq);
select public.accountability_sweep();
do $$ begin
  assert (select escalated_at from public.decision_items where item_id = (select id from cq)) is not null, 'escalated after the grace period';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d4' and type = 'action_escalated') = 1, 'moderator told';
end $$;
-- Being active changes nothing: presence and viewing do not resolve anything.
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000d001');
select public.touch_presence();
select public.mark_decisions_viewed((select id from dpost));
do $$ begin assert (select resolved_at from public.decision_items where item_id = (select id from cq)) is null, 'being online decides nothing'; end $$;
-- Three overdue past the notice period: restriction on new posts only.
reset role;
insert into public.post_discussion (id, post_id, author_id, kind, body, proposed_phrase, status, client_key, parent_id, depth)
  select gen_random_uuid(), (select id from dpost), '00000000-0000-0000-0000-00000000d002', 'correction', 'more ' || g, 'Tena ' || g, 'pending', gen_random_uuid(), null, 0 from generate_series(1, 2) g;
insert into public.decision_items (user_id, post_id, item_id, due_at, overdue_notified_at)
  select '00000000-0000-0000-0000-00000000d001', d.post_id, d.id, now() - interval '5 days', now() - interval '5 days' from public.post_discussion d where d.body like 'more %';
select public.accountability_sweep();
do $$ begin
  assert not exists (select 1 from public.user_restrictions where user_id = '00000000-0000-0000-0000-00000000d001' and lifted_at is null), 'a warning comes first';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000d001' and type = 'restriction_warning') = 1, 'told what is coming and when';
end $$;
select public.accountability_sweep();
do $$ begin
  assert not exists (select 1 from public.user_restrictions where user_id = '00000000-0000-0000-0000-00000000d001' and lifted_at is null), 'the warning gets its notice period';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000d001' and type = 'restriction_warning') = 1, 'warned once, not on every sweep';
end $$;
update public.accountability_warnings set warned_at = now() - interval '4 days' where user_id = '00000000-0000-0000-0000-00000000d001';
select public.accountability_sweep();
do $$ begin assert exists (select 1 from public.user_restrictions where user_id = '00000000-0000-0000-0000-00000000d001' and lifted_at is null), 'restricted after notice'; end $$;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000d001');
select tt.expect_error($q$select public.post_contribution('Mpya', null, 'swh', 'phrase', null, null)$q$, 'posting_restricted');
select tt.expect_error($q$select public.request_decision_extension((select id from public.decision_items where item_id = (select id from cq)), '   ')$q$, 'reason_required');
do $$ declare a jsonb; begin
  a := public.my_accountability();
  assert jsonb_array_length(a->'items') = 3, 'all three owed';
  assert (a->'record'->>'overdue')::int = 3, 'and shown as overdue';
  assert a->'restriction' is not null and a->'restriction' <> 'null'::jsonb, 'restriction visible with its reason';
end $$;
-- Still allowed to reply and to decide. An extension brings it under the line, and the restriction lifts by itself.
select public.submit_discussion((select id from dpost), null, 'comment', 'Sorry, away this week', null, null, gen_random_uuid());
select public.request_decision_extension((select id from public.decision_items where item_id = (select id from cq)), 'Travelling');
select tt.expect_error($q$select public.request_decision_extension((select id from public.decision_items where item_id = (select id from cq)), 'Again')$q$, 'extension_limit');
do $$ begin
  assert not exists (select 1 from jsonb_array_elements(public.get_post_thread((select id from dpost))->'history') e where e->>'action' = 'extended' and e->>'note' is not null), 'the reason for an extension stays private';
  assert exists (select 1 from jsonb_array_elements(public.get_post_thread((select id from dpost))->'history') e where e->>'action' = 'extended'), 'but that it happened is on the record';
end $$;
do $$ begin
  assert not exists (select 1 from public.user_restrictions where user_id = auth.uid() and lifted_at is null), 'lifted once under the line';
  assert not exists (select 1 from public.accountability_warnings where user_id = auth.uid()), 'and the warning is spent';
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'restriction_lifted') = 1, 'told';
end $$;
select public.post_contribution('Mpya', null, 'swh', 'phrase', null, null);
-- Decisions lift it too, and an appeal granted clears the cause. A moderator's exemption does not count against them.
reset role;
update public.decision_items set due_at = now() - interval '5 days', overdue_notified_at = now() - interval '5 days' where item_id = (select id from cq);
select public.accountability_sweep();
update public.accountability_warnings set warned_at = now() - interval '4 days' where user_id = '00000000-0000-0000-0000-00000000d001';
select public.accountability_sweep();
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000d001');
create temp table rst as select id from public.user_restrictions where user_id = auth.uid() and lifted_at is null; grant select on rst to public;
select public.appeal_restriction((select id from rst), 'I was in hospital');
select tt.expect_error($q$select public.appeal_restriction((select id from rst), 'Again')$q$, 'already_appealed');
select tt.as_user('00000000-0000-0000-0000-00000000d002');
select tt.expect_error($q$select public.admin_accountability()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_set_accountability_policy('{"deadline_hours":1}', 'x')$q$, 'forbidden');
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
do $$ declare a jsonb := public.admin_accountability(); begin
  assert jsonb_array_length(a->'appeals') = 1 and jsonb_array_length(a->'restrictions') = 1, 'staff see the appeal and the restriction';
  assert jsonb_array_length(a->'audit') > 0;
end $$;
select tt.expect_error($q$select public.admin_decide_appeal((select (public.admin_accountability()->'appeals'->0->>'id')::uuid), true, ' ')$q$, 'reason_required');
select public.admin_decide_appeal((select (public.admin_accountability()->'appeals'->0->>'id')::uuid), true, 'Medical absence confirmed');
select public.admin_set_accountability_policy('{"deadline_hours":240}', 'Longer deadline for launch');
reset role;
select public.accountability_sweep();
do $$ begin
  assert not exists (select 1 from public.user_restrictions where user_id = '00000000-0000-0000-0000-00000000d001' and lifted_at is null), 'an upheld appeal stays lifted after the next sweep';
  assert (select deadline_hours from public.accountability_policy) = 240;
  assert (select count(*) from public.decision_items where user_id = '00000000-0000-0000-0000-00000000d001' and resolution = 'exempted') >= 1, 'exempted, so it is not on their record';
  assert (select (public.response_record('00000000-0000-0000-0000-00000000d001')->>'overdue')::int) = 0;
end $$;
update public.accountability_policy set deadline_hours = 168 where id;
set role authenticated;

-- Search and export from the last round.
select tt.as_user('00000000-0000-0000-0000-00000000d001');
do $$ declare e jsonb := public.export_my_data(); begin
  assert jsonb_array_length(e->'contributions') >= 2 and e ? 'decisions_owed' and e ? 'activity' and e ? 'level_progress' and e ? 'connections', 'export includes the new data';
  assert not exists (select 1 from public.search_people(null, 'fra', 'learning', 'C1') s where s.username = 'vera'), 'a C1 claim is not found as C1';
  assert exists (select 1 from public.search_people(null, 'fra', 'learning', 'B1') s where s.username = 'vera'), 'found at the level she earned';
  assert (select p.review_status from public.search_posts('Habari gani') p limit 1) is not null, 'search carries the review status';
end $$;

-- ============ 5h. WEB PUSH (the database half: delivery itself needs the edge function) ============
select tt.as_user('00000000-0000-0000-0000-00000000d002');
select public.save_push_subscription('https://push.example/one', 'keyA', 'authA');
select public.save_push_subscription('https://push.example/one', 'keyB', 'authB');   -- same device again: updated, not doubled
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 1, 'one row per device';
  assert (select p256dh from public.push_subscriptions) = 'keyB';
end $$;
select tt.expect_error($q$select public.save_push_subscription('http://insecure.example', 'k', 'a')$q$, 'check');
select tt.expect_error($q$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://direct', 'k', 'a')$q$, 'permission denied');
select tt.as_user('00000000-0000-0000-0000-00000000d004');
do $$ begin assert (select count(*) from public.push_subscriptions) = 0, 'another person sees no one else''s devices'; end $$;
select public.delete_push_subscription('https://push.example/one');   -- not theirs: nothing happens
-- The same phone, a different person signed in: it follows them.
select public.save_push_subscription('https://push.example/one', 'keyC', 'authC');
do $$ begin assert (select count(*) from public.push_subscriptions) = 1, 'the device moved to who is signed in now'; end $$;
select public.delete_push_subscription('https://push.example/one');
do $$ begin assert (select count(*) from public.push_subscriptions) = 0, 'removed'; end $$;
do $$ begin assert (select count(*) from public.push_settings) = 0, 'the webhook secret is not readable'; end $$;

-- ============ 6. SAFETY ============
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.report_user('00000000-0000-0000-0000-0000000000b2', 'fake_correction', 'test', (select conv from ctx));
select public.report_user('00000000-0000-0000-0000-0000000000c3', 'points_abuse', 'test', null);
select tt.expect_error($q$select public.report_user('00000000-0000-0000-0000-0000000000c3', 'not_a_reason', null, null)$q$, 'violates check');
select public.block_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin assert (select count(*) from public.saved_partners where user_id = auth.uid()) = 0, 'blocking removes the saved partner'; end $$;
-- A long silence would bring Amina back to Linh's feed, so only the block can be keeping her out.
reset role;
update public.messages set created_at = now() - interval '45 days' where conversation_id = (select conv from ctx);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert public.get_profile('amina') is null, 'blocked users cannot see each other';
  assert not exists (select 1 from public.home_feed(10, 10) f where f.username = 'amina'), 'blocked user leaves the feed';
end $$;

-- ============ 7. ADMIN ============
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
do $$ begin assert public.is_admin(), 'admin recognised'; assert (select count(*) from public.admin_report_queue('open')) >= 2, 'admin sees reports'; end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select count(*) from public.admin_report_queue('open')$q$, 'forbidden');

reset role;

-- ============ staff accounts and MFA ============
-- Fixtures: the real ones come from the bootstrap script and invitations.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ee05', 'inv@test.com'),
  ('00000000-0000-0000-0000-00000000ee06', 'other-mod@test.com');
update public.profiles set username = 'invited' where id = '00000000-0000-0000-0000-00000000ee05';
update public.profiles set username = 'othermod' where id = '00000000-0000-0000-0000-00000000ee06';

-- The reserved address cannot come in through signup, and only the bootstrap window lets it in.
select tt.expect_error($q$insert into auth.users (email) values ('SUPERADMIN@thefluencytalks.com')$q$, 'reserved_email');
select tt.expect_error($q$update auth.users set email = 'superadmin@thefluencytalks.com' where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'reserved_email');
select public.svc_open_super_bootstrap();
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000ee01', 'superadmin@thefluencytalks.com');
select tt.expect_error($q$select public.svc_finish_super_bootstrap('00000000-0000-0000-0000-0000000000a1')$q$, 'not_the_reserved_account');
select public.svc_finish_super_bootstrap('00000000-0000-0000-0000-00000000ee01');
select tt.expect_error($q$select public.svc_open_super_bootstrap()$q$, 'super_admin_exists');
select tt.expect_error($q$update auth.users set email = 'moved@test.com' where id = '00000000-0000-0000-0000-00000000ee01'$q$, 'super_admin_email_is_fixed');
select tt.expect_error($q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'only through an invitation');
select tt.expect_error($q$insert into public.admin_accounts (user_id, tier) values ('00000000-0000-0000-0000-0000000000a1', 'super')$q$, 'admin_accounts_one_super');

do $$ begin
  assert not has_function_privilege('authenticated', 'public.svc_open_super_bootstrap()', 'execute'), 'bootstrap closed to users';
  assert not has_function_privilege('authenticated', 'public.svc_finish_super_bootstrap(uuid)', 'execute'), 'bootstrap closed to users';
  assert not has_function_privilege('authenticated', 'public.svc_break_glass_mfa(text)', 'execute'), 'break glass closed to users';
  assert not has_function_privilege('authenticated', 'public.set_staff_role(uuid, text)', 'execute'), 'role setter closed to users';
  assert not has_function_privilege('authenticated', 'public.admin_audit(text, uuid, jsonb)', 'execute'), 'audit writer closed to users';
  assert not has_function_privilege('anon', 'public.accept_admin_invitation(text)', 'execute'), 'anon cannot accept';
end $$;

-- Only staff can have factors.
select tt.expect_error($q$insert into auth.mfa_factors (user_id) values ('00000000-0000-0000-0000-0000000000a1')$q$, 'mfa_is_for_staff');
insert into auth.mfa_factors (id, user_id, friendly_name) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000d4', 'Phone');
update auth.mfa_factors set status = 'verified' where id = '00000000-0000-0000-0000-00000000f001';
do $$ begin assert (select count(*) from public.admin_audit_log where action = 'mfa_factor_verified') = 1, 'enrolment is on the record'; end $$;
select tt.expect_error($q$delete from auth.mfa_factors where id = '00000000-0000-0000-0000-00000000f001'$q$, 'cannot_remove_last_factor');
insert into auth.mfa_factors (id, user_id, friendly_name, status) values ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000d4', 'Backup', 'verified');
delete from auth.mfa_factors where id = '00000000-0000-0000-0000-00000000f002';
do $$ begin assert (select count(*) from public.admin_audit_log where action = 'mfa_factor_removed') = 1, 'removing a backup is on the record'; end $$;
select tt.expect_error($q$update public.admin_audit_log set action = 'x' where id > 0$q$, 'append-only');
select tt.expect_error($q$delete from public.admin_audit_log where id > 0$q$, 'append-only');

set role authenticated;
-- An ordinary person: no way in, by any door.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, 'permission denied');
select tt.expect_error($q$insert into public.admin_accounts (user_id, tier) values (auth.uid(), 'admin')$q$, 'permission denied');
do $$ begin assert (select count(*) from public.admin_recovery_codes) = 0 and (select count(*) from public.admin_accounts) = 0, 'staff tables are closed'; end $$;
select tt.expect_error($q$select public.admin_create_invitation('x@test.com')$q$, 'forbidden');
select tt.expect_error($q$select public.admin_list_team()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_system_health()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_logs()$q$, 'forbidden');
select tt.expect_error($q$select public.staff_assert('staff')$q$, 'forbidden');
select tt.expect_error($q$select public.accept_admin_invitation('made-up')$q$, 'invite_invalid');
do $$ begin assert public.my_staff_status()->>'is_staff' = 'false', 'a learner is not staff'; end $$;

-- A password alone proves nothing: a real admin with no authenticator step has no powers.
select tt.as_aal1('00000000-0000-0000-0000-0000000000d4');
do $$ begin
  assert not public.is_admin(), 'aal1 is not admin';
  assert (public.my_staff_status()->>'is_staff')::boolean and not (public.my_staff_status()->>'session_ok')::boolean, 'the gate can tell';
end $$;
select tt.expect_error($q$select public.admin_overview()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_set_user_status('00000000-0000-0000-0000-0000000000a1', 'suspended', 'x')$q$, 'forbidden');
select tt.expect_error($q$select public.admin_set_accountability_policy('{}', 'x')$q$, 'forbidden');
select tt.expect_error($q$select count(*) from public.admin_report_queue('open')$q$, 'forbidden');
-- Nor does Google + TOTP: aal2, but no password.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000000d4', 'aal', 'aal2', 'amr', jsonb_build_array(
  jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint + 1), jsonb_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint)))::text, false);
do $$ begin assert not public.is_admin(), 'admins must use their password'; end $$;

-- An invited admin: runs the place, but cannot invite, and cannot touch the super admin or a peer.
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
do $$ begin
  assert public.is_admin() and public.is_full_admin() and not public.is_super_admin(), 'tier d4';
  assert not public.staff_can_manage('00000000-0000-0000-0000-00000000ee01'), 'nobody manages the super admin';
  assert not public.staff_can_manage('00000000-0000-0000-0000-0000000000d4'), 'nobody manages themselves';
  assert public.staff_can_manage('00000000-0000-0000-0000-0000000000a1'), 'admins manage learners';
  assert public.admin_system_health()->'database'->>'size_bytes' is not null, 'health reports the database';
  assert (public.admin_overview()->>'users_total')::int > 0, 'overview counts people';
end $$;
select tt.expect_error($q$select public.admin_set_user_status('00000000-0000-0000-0000-00000000ee01', 'banned', 'x')$q$, 'forbidden');
select tt.expect_error($q$select public.admin_create_invitation('x@test.com')$q$, 'forbidden');
select tt.expect_error($q$select public.admin_remove_staff('00000000-0000-0000-0000-00000000ee01', 'x')$q$, 'forbidden');
select tt.expect_error($q$select public.admin_prepare_mfa_reset('00000000-0000-0000-0000-00000000ee01', 'x')$q$, 'forbidden');

-- The super admin invites. The token only works for the invited, confirmed address.
select tt.as_staff('00000000-0000-0000-0000-00000000ee01');
select tt.expect_error($q$select public.admin_create_invitation('superadmin@thefluencytalks.com')$q$, 'reserved_email');
select tt.expect_error($q$select public.admin_create_invitation('admin@test.com')$q$, 'already_staff');
select tt.expect_error($q$select public.admin_remove_staff('00000000-0000-0000-0000-00000000ee01', 'x')$q$, 'forbidden');
create temp table invite on commit preserve rows as select public.admin_create_invitation('INV@test.com') as v;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error(format('select public.accept_admin_invitation(%L)', (select v->>'token' from invite)), 'invite_email_mismatch');
select tt.as_user('00000000-0000-0000-0000-00000000ee05');
do $$ begin
  assert public.accept_admin_invitation((select v->>'token' from invite)) = 'admin', 'invited person accepts';
  assert public.accept_admin_invitation((select v->>'token' from invite)) = 'admin', 'a retry is harmless';
  assert not public.is_admin(), 'accepting does not skip MFA';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
select tt.expect_error(format('select public.accept_admin_invitation(%L)', (select v->>'token' from invite)), 'invite_invalid');
reset role;
do $$ begin assert (select role from public.profiles where id = '00000000-0000-0000-0000-00000000ee05') = 'admin', 'role mirrors the account'; end $$;
set role authenticated;

-- Peers cannot manage each other; the super admin can.
select tt.as_staff('00000000-0000-0000-0000-00000000ee05');
select tt.expect_error($q$select public.admin_set_user_status('00000000-0000-0000-0000-0000000000d4', 'suspended', 'x')$q$, 'forbidden');

-- Reports land with everyone who decides.
select tt.as_user('00000000-0000-0000-0000-0000000000c3');
select public.report_user('00000000-0000-0000-0000-0000000000a1', 'spam', 'again');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'admin_report' and user_id in ('00000000-0000-0000-0000-00000000ee01','00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-00000000ee05')) >= 3, 'all admins told';
end $$;
set role authenticated;

-- Recovery codes: once each, wrong guesses lock the account, and old tokens stop working.
select tt.as_staff('00000000-0000-0000-0000-00000000ee05');
create temp table codes on commit preserve rows as select public.admin_generate_recovery_codes() as c;
do $$ begin assert array_length((select c from codes), 1) = 10, 'ten codes'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000ee05');
select tt.expect_error(format('select public.admin_redeem_recovery_code(%L)', (select c[1] from codes)), 'forbidden');   -- no password step at all
-- A Google sign-in can't use a code; a mailbox reset link can, but it still isn't a staff login.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-00000000ee05', 'aal', 'aal1', 'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', 1)))::text, false);
select tt.expect_error(format('select public.admin_redeem_recovery_code(%L)', (select c[1] from codes)), 'forbidden');
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-00000000ee05', 'aal', 'aal2', 'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint + 1), jsonb_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint)))::text, false);
do $$ begin assert not public.is_admin(), 'a reset link plus a code is not a password login'; end $$;
select tt.as_aal1('00000000-0000-0000-0000-00000000ee05');
do $$ begin
  assert public.admin_redeem_recovery_code('wrong') is false, 'a wrong code fails';
  assert public.admin_redeem_recovery_code((select c[1] from codes)), 'a right code works';
  assert public.admin_redeem_recovery_code((select c[1] from codes)) is false, 'a code works once';
end $$;
reset role;
select pg_sleep(1.1);
set role authenticated;
-- The aal2 token from before the reset no longer counts.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-00000000ee05', 'aal', 'aal2', 'amr', jsonb_build_array(
  jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - 3600), jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - 3600)))::text, false);
do $$ begin assert not public.is_admin(), 'old sessions are cut off'; end $$;
select tt.as_aal1('00000000-0000-0000-0000-00000000ee05');
do $$ begin
  for i in 1..4 loop assert public.admin_redeem_recovery_code('wrong') is false; end loop;   -- the re-used code above was the first strike
end $$;
select tt.expect_error(format('select public.admin_redeem_recovery_code(%L)', (select c[2] from codes)), 'recovery_locked');

-- Logs: anyone signed in can report an error, nobody can read or flood them.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.log_client_error('boom', '{"path":"/home"}');
do $$ begin for i in 1..30 loop perform public.log_client_error('flood'); end loop; end $$;
do $$ begin assert (select count(*) from public.app_logs) = 0, 'logs are closed'; end $$;
reset role;
do $$ begin assert (select count(*) from public.app_logs where user_id = '00000000-0000-0000-0000-0000000000a1') = 20, 'errors are throttled per person'; end $$;
select public.system_heartbeat();
do $$ begin assert public.uptime_percent('1 day') is not null, 'uptime has a number once a beat exists'; end $$;
set role authenticated;

-- Removing an admin takes their powers at once.
select tt.as_staff('00000000-0000-0000-0000-00000000ee01');
select public.admin_remove_staff('00000000-0000-0000-0000-00000000ee05', 'left the team');
select tt.as_staff('00000000-0000-0000-0000-00000000ee05');
do $$ begin assert not public.is_admin(), 'removed admin has no powers'; end $$;

-- Staff run the app, they don't use it.
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
select tt.expect_error($q$select public.start_conversation('00000000-0000-0000-0000-0000000000a1')$q$, 'staff_account');
select tt.expect_error($q$select public.follow_user('00000000-0000-0000-0000-0000000000a1')$q$, 'staff_account');
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.start_conversation('00000000-0000-0000-0000-0000000000d4')$q$, 'staff_account');
do $$ begin
  assert not exists (select 1 from public.search_people('theadmin') where username = 'theadmin'), 'staff are not listed to learners';
end $$;

-- A hand edit can't leave the profile and the staff record disagreeing, and someone leaving staff is listed again.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000ee09', 'handmade@test.com');
select set_config('app.bypass_protect', 'on', false);
update public.profiles set native_language_id = (select id from public.languages limit 1), onboarding_done = true where id = '00000000-0000-0000-0000-00000000ee09';
select set_config('app.bypass_protect', 'off', false);
insert into public.admin_accounts (user_id, tier) values ('00000000-0000-0000-0000-00000000ee09', 'moderator');
do $$ begin assert (select role = 'moderator' and not onboarding_done from public.profiles where id = '00000000-0000-0000-0000-00000000ee09'), 'staff record sets the role and unlists'; end $$;
delete from public.admin_accounts where user_id = '00000000-0000-0000-0000-00000000ee09';
do $$ begin assert (select role = 'user' and onboarding_done from public.profiles where id = '00000000-0000-0000-0000-00000000ee09'), 'leaving staff restores the learner'; end $$;
set role authenticated;

-- ============ HELP POSTS ============
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000fade0001', 'newbie@test.com'),
  ('00000000-0000-0000-0000-0000fade0002', 'native@test.com'),
  ('00000000-0000-0000-0000-0000fade0003', 'other@test.com'),
  ('00000000-0000-0000-0000-0000fade0004', 'native2@test.com'),
  ('00000000-0000-0000-0000-0000fade0005', 'nolearn@test.com');
select set_config('app.bypass_protect', 'on', false);
update public.profiles set onboarding_done = true, native_language_id = 'swh', learning_language_id = 'jpn', learning_level = 'A1' where id = '00000000-0000-0000-0000-0000fade0001';
update public.profiles set onboarding_done = true, native_language_id = 'jpn', created_at = now() - interval '30 days' where id in ('00000000-0000-0000-0000-0000fade0002', '00000000-0000-0000-0000-0000fade0004');
update public.profiles set onboarding_done = true, native_language_id = 'swh', learning_language_id = 'jpn', learning_level = 'A1' where id = '00000000-0000-0000-0000-0000fade0003';
update public.profiles set onboarding_done = true, native_language_id = 'jpn' where id = '00000000-0000-0000-0000-0000fade0005';
select set_config('app.bypass_protect', 'off', false);
set role authenticated;

-- No level needed, and only in the language you are learning.
select tt.as_user('00000000-0000-0000-0000-0000fade0005');
select tt.expect_error($q$select public.post_help_request('correct_me', 'Hello there', null)$q$, 'learning_language_required');
select tt.as_user('00000000-0000-0000-0000-0000fade0001');
select tt.expect_error($q$select public.post_help_request('library', 'Hello there', null)$q$, 'invalid_post_type');
select tt.expect_error($q$select public.post_help_request('correct_me', '   ', null)$q$, 'empty_phrase');
select tt.expect_error($q$select public.post_help_request('correct_me', repeat('x', 281), null)$q$, 'text_too_long');
create temp table hp as select public.post_help_request('correct_me', 'Watashi wa gakkou ni iku deshita', 'I went to school') as id;
do $$ begin
  assert (select verified_level is null from public.profiles where id = auth.uid()), 'posting did not need a level';
  assert (select post_type = 'correct_me' and review_status = 'awaiting_feedback' and language_id = 'jpn' from public.contribution_posts where id = (select id from hp)), 'a new help post awaits feedback';
  assert not exists (select 1 from public.search_posts('gakkou')), 'help posts stay out of search';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.notifications where type = 'help_request' and user_id = '00000000-0000-0000-0000-0000fade0002') = 1, 'a qualified person hears about it';
  assert not exists (select 1 from public.notifications where type = 'help_request' and user_id = '00000000-0000-0000-0000-0000fade0003'), 'an unqualified learner does not';
end $$;
set role authenticated;

select public.post_help_request('how_do_i_say', 'How do I say good morning?', null);
do $$ begin assert public.help_supply('jpn') >= 2, 'helpers are counted'; end $$;
reset role;
do $$ begin assert (select count(*) from public.notifications where type = 'help_request' and user_id = '00000000-0000-0000-0000-0000fade0002') = 1, 'nobody hears more than once in 6 hours'; end $$;
set role authenticated;
select public.post_help_request('correct_me', 'Third post of the day', null);
select public.post_help_request('correct_me', 'Fourth post of the day', null);
select public.post_help_request('correct_me', 'Fifth post of the day', null);
select tt.expect_error($q$select public.post_help_request('correct_me', 'Sixth post of the day', null)$q$, 'practice_limit');

-- Only qualified people can fix it, and fixes create no duty for the author.
select tt.as_user('00000000-0000-0000-0000-0000fade0003');
select tt.expect_error($q$select public.submit_discussion((select id from hp), null, 'correction', 'Fix', 'Better', null, gen_random_uuid())$q$, 'not_qualified_to_correct');
select public.submit_discussion((select id from hp), null, 'comment', 'Good luck!', null, null, gen_random_uuid());
select tt.as_user('00000000-0000-0000-0000-0000fade0002');
select tt.expect_error($q$select public.submit_discussion((select id from hp), null, 'clarification', 'What?', null, null, gen_random_uuid())$q$, 'help_post_fix_only');
create temp table fix1 as select public.submit_discussion((select id from hp), null, 'correction', 'Past tense takes ikimashita', 'Watashi wa gakkou ni ikimashita', null, gen_random_uuid()) as id;
select tt.as_user('00000000-0000-0000-0000-0000fade0004');
select tt.expect_error($q$select public.submit_discussion((select id from hp), null, 'correction', 'Same again', 'Watashi wa gakkou ni ikimashita', null, gen_random_uuid())$q$, 'duplicate_correction');   -- somebody else's proposal: agree with it instead
select public.submit_discussion((select id from hp), (select id from fix1), 'correction', 'A little more natural', 'Gakkou e ikimashita', null, gen_random_uuid());
create temp table fix2 as select public.submit_discussion((select id from hp), null, 'correction', 'Another way', 'Gakkou ni ikimashita', null, gen_random_uuid()) as id;
reset role;
do $$ begin
  assert not exists (select 1 from public.decision_items where post_id = (select id from hp)), 'a help post creates no decisions';
  assert (select review_status = 'corrections_received' from public.contribution_posts where id = (select id from hp)), 'a fix shows as received';
  assert exists (select 1 from public.notifications where type = 'help_fix' and user_id = '00000000-0000-0000-0000-0000fade0001'), 'the author hears about the fix';
end $$;
set role authenticated;

-- Thanking is optional, pays once and never replaces the text.
select tt.as_user('00000000-0000-0000-0000-0000fade0004');
select tt.expect_error($q$select public.rate_help_fix((select id from fix2), true)$q$, 'forbidden');
select tt.as_user('00000000-0000-0000-0000-0000fade0001');
select public.rate_help_fix((select id from fix1), true);
select public.rate_help_fix((select id from fix2), false);
select tt.expect_error($q$select public.rate_help_fix((select id from fix1), true)$q$, 'already_decided');
select tt.expect_error($q$select public.decide_correction((select id from fix1), true, null)$q$, 'already_decided');
reset role;
do $$ begin
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-0000fade0002') = 105, 'a thank-you pays 5';
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-0000fade0004') = 100, 'not helpful pays nothing';
  assert (select phrase = 'Watashi wa gakkou ni iku deshita' and current_phrase is null and accepted_item_id is null from public.contribution_posts where id = (select id from hp)), 'the original stays';
  assert (select feedback = 'helpful' from public.post_discussion where id = (select id from fix1)), 'the rating is kept';
end $$;
-- The accepted-version route can never touch a help post.
do $$ begin
  begin
    update public.contribution_posts set accepted_item_id = (select id from fix1) where id = (select id from hp);
    assert false, 'a help post cannot take an accepted version';
  exception when check_violation then null; end;
end $$;
-- Back to awaiting feedback when the only fix is rated not helpful.
select tt.as_user('00000000-0000-0000-0000-0000fade0001');
create temp table hp2 as select (select id from public.contribution_posts where user_id = auth.uid() and phrase = 'Third post of the day') as id;
select tt.as_user('00000000-0000-0000-0000-0000fade0002');
create temp table fix3 as select public.submit_discussion((select id from hp2), null, 'correction', 'Try this', 'Better third post', null, gen_random_uuid()) as id;
select tt.as_user('00000000-0000-0000-0000-0000fade0001');
select public.rate_help_fix((select id from fix3), false);
do $$ begin assert (select review_status = 'awaiting_feedback' from public.contribution_posts where id = (select id from hp2)), 'still awaiting a useful fix'; end $$;

-- Levels: posts alone reach A2, but B1 still needs real chat.
reset role;
insert into public.contribution_posts (user_id, language_id, phrase, post_type, review_status, created_at)
select '00000000-0000-0000-0000-0000fade0003', 'jpn', 'Practice sentence number ' || g, 'correct_me', 'awaiting_feedback', now() - (g % 8) * interval '1 day' from generate_series(1, 100) g;
insert into public.post_discussion (post_id, author_id, kind, body, proposed_phrase, status, client_key)
select c.id, n.id, 'correction', 'Fix', 'Fixed sentence', 'pending', gen_random_uuid()
from public.contribution_posts c cross join (values ('00000000-0000-0000-0000-0000fade0002'::uuid), ('00000000-0000-0000-0000-0000fade0004'::uuid)) n(id)
where c.user_id = '00000000-0000-0000-0000-0000fade0003';
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000fade0003');
do $$ declare p jsonb := public.my_path(); begin
  assert p->>'verified_level' is null, format('posts never reach a level by themselves, got %s', p->>'verified_level');
end $$;
reset role;
do $$ begin
  assert not public.can_correct_language('00000000-0000-0000-0000-0000fade0003', 'jpn'), 'posts alone give no right to correct';
end $$;
set role authenticated;

-- ============ THE WHOLE CONTRIBUTION SYSTEM (docs/CONTRIBUTION_SYSTEM.md) ============
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000c0de0001', 'beginner@test.com'),
  ('00000000-0000-0000-0000-0000c0de0002', 'teacher@test.com'),
  ('00000000-0000-0000-0000-0000c0de0003', 'b2learner@test.com'),
  ('00000000-0000-0000-0000-0000c0de0004', 'teacher2@test.com'),
  ('00000000-0000-0000-0000-0000c0de0005', 'fresh@test.com');
select set_config('app.bypass_protect', 'on', false);
update public.profiles set onboarding_done = true, native_language_id = 'swh', learning_language_id = 'nld', learning_level = 'A1', created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-0000c0de0001';
update public.profiles set onboarding_done = true, native_language_id = 'nld', created_at = now() - interval '30 days' where id in ('00000000-0000-0000-0000-0000c0de0002', '00000000-0000-0000-0000-0000c0de0004');
update public.profiles set onboarding_done = true, native_language_id = 'swh', learning_language_id = 'nld', learning_level = 'B2', verified_level = 'B2', created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-0000c0de0003';
update public.profiles set onboarding_done = true, native_language_id = 'nld', created_at = now() where id = '00000000-0000-0000-0000-0000c0de0005';
select tt.pass_topics('00000000-0000-0000-0000-0000c0de0003', 'nld', 56);   -- B2 passed on calls, as the level above says
select set_config('app.bypass_protect', 'off', false);
set role authenticated;

-- A beginner can write from day one, in every practice type, with limits that make sense for each.
select tt.as_user('00000000-0000-0000-0000-0000c0de0001');
select tt.expect_error($q$select public.post_help_request('story', 'Mijn dag', null, '   ')$q$, 'empty_body');
select tt.expect_error($q$select public.post_help_request('story', 'Mijn dag', null, repeat('x', 5001))$q$, 'text_too_long');
select tt.expect_error($q$select public.post_help_request('question', 'Wat?', null, repeat('x', 2001))$q$, 'text_too_long');
select tt.expect_error($q$select public.post_help_request('photo', 'Mijn hond', null, null, null)$q$, 'invalid_image');
select tt.expect_error($q$select public.post_help_request('photo', 'Mijn hond', null, null, 'https://evil.example/x.jpg')$q$, 'invalid_image');
select tt.expect_error($q$select public.post_help_request('photo', repeat('x', 121), null, null, 'https://images.unsplash.com/a', 'overlay')$q$, 'overlay_too_long');
-- A lesson teaches, so it stays with people who know the language.
select tt.expect_error($q$select public.post_contribution('Les', null, 'nld', 'grammar', null, null, 'left', 'lesson', 'Tekst')$q$, 'not_contribution_eligible');
select tt.expect_error($q$select public.post_contribution('Hallo', null, 'nld', 'phrase', null, null)$q$, 'not_contribution_eligible');
-- 😀 is one character here and two in a browser: positions are counted in characters, so this body catches a mismatch.
create temp table st as select public.post_help_request('story', 'Mijn dag', null, 'Ik ben 😀 blij. Gisteren ik ga naar school. Het was leuk.') as id; grant select on st to public;
create temp table qu as select public.post_help_request('question', 'Wanneer zeg je "alsjeblieft"?', null, 'Ik hoor het overal.') as id; grant select on qu to public;
create temp table ph as select public.post_help_request('photo', 'Mijn hond', null, null, 'https://images.unsplash.com/photo-1', 'overlay') as id; grant select on ph to public;
do $$ begin
  assert (select verified_level is null from public.profiles where id = auth.uid()), 'none of it needed a level';
  assert (select image_layout = 'overlay' and unsplash_image_url is not null from public.contribution_posts where id = (select id from ph)), 'text can sit on the photo';
  assert not exists (select 1 from public.search_posts('Mijn dag')), 'practice stays out of the Library search';
end $$;

-- A long post is corrected a stretch at a time.
select tt.as_user('00000000-0000-0000-0000-0000c0de0002');
select tt.expect_error($q$select public.submit_discussion((select id from st), null, 'correction', 'Hele tekst', 'Alles nieuw', null, gen_random_uuid())$q$, 'sentence_required');
select tt.expect_error($q$select public.submit_discussion((select id from st), null, 'correction', 'Buiten de tekst', 'x', null, gen_random_uuid(), 50, 9000)$q$, 'sentence_required');
select tt.expect_error($q$select public.submit_discussion((select id from st), null, 'correction', 'Geen verschil', 'Gisteren ik ga naar school.', null, gen_random_uuid(), 15, 42)$q$, 'no_change');
create temp table s1 as select public.submit_discussion((select id from st), null, 'correction', 'Past tense', 'Gisteren ging ik naar school.', null, gen_random_uuid(), 15, 42) as id; grant select on s1 to public;
create temp table s2 as select public.submit_discussion((select id from st), null, 'correction', 'Word order', 'Ik ben blij 😀.', null, gen_random_uuid(), 0, 14) as id; grant select on s2 to public;
select tt.expect_error($q$select public.submit_discussion((select id from qu), null, 'correction', 'Nee', 'Beter', null, gen_random_uuid())$q$, 'help_post_fix_only');
do $$ begin
  assert (select target_text = 'Gisteren ik ga naar school.' from public.post_discussion where id = (select id from s1)), 'the server reads the sentence itself, in characters';
  assert not exists (select 1 from public.decision_items where post_id = (select id from st)), 'no duty on a story';
end $$;
-- A question takes replies from anyone, and shows that it has been answered.
select tt.as_user('00000000-0000-0000-0000-0000c0de0003');
select public.submit_discussion((select id from qu), null, 'comment', 'Vooral bij vragen.', null, null, gen_random_uuid());
do $$ begin assert (select review_status = 'corrections_received' from public.contribution_posts where id = (select id from qu)), 'a replied question shows the replies'; end $$;
-- Someone qualified can improve a fix, and flag one they think is wrong. A beginner can't flag.
create temp table s3 as select public.submit_discussion((select id from st), (select id from s1), 'correction', 'Sounds more natural', 'Gisteren ging ik naar de school.', null, gen_random_uuid()) as id; grant select on s3 to public;
do $$ begin assert (select target_start = 15 and target_end = 42 from public.post_discussion where id = (select id from s3)), 'an improvement covers the same words'; end $$;
do $$ begin assert public.toggle_correction_agreement((select id from s1)), 'agree'; assert public.toggle_correction_flag((select id from s1)), 'a flag replaces the agreement'; end $$;
do $$ declare it jsonb; begin
  select x into it from jsonb_array_elements(public.get_post_thread((select id from st))->'items') x where x->>'id' = (select id::text from s1);
  assert (it->>'agree_count')::int = 0 and (it->>'flag_count')::int = 1 and (it->>'i_flagged')::boolean, 'one stance per person';
end $$;
do $$ begin assert not public.toggle_correction_flag((select id from s1)), 'and it can be taken back'; end $$;
select tt.as_user('00000000-0000-0000-0000-0000c0de0001');
select tt.expect_error($q$select public.toggle_correction_flag((select id from s1))$q$, 'not_qualified_to_correct');

-- The author thanks fixes: the original stays, the corrected reading appears, and the fix goes to their phrasebook.
select public.rate_help_fix((select id from s1), true);
select public.rate_help_fix((select id from s2), true);
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from st);
  assert p.body = 'Ik ben 😀 blij. Gisteren ik ga naar school. Het was leuk.', 'the original is never changed';
  assert p.current_body = 'Ik ben blij 😀. Gisteren ging ik naar school. Het was leuk.', format('both fixes applied, got %s', p.current_body);
  assert p.review_status = 'corrections_received', 'one improvement is still open';
  assert (select source_post_id = p.id and language_id = 'nld' from public.saved_phrases where user_id = auth.uid() and phrase = 'Gisteren ging ik naar school.'), 'an accepted fix is in the phrasebook, with where it came from';
end $$;
select public.rate_help_fix((select id from s3), true, 'Thanks');
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from st);
  assert p.current_body = 'Ik ben blij 😀. Gisteren ging ik naar de school. Het was leuk.', 'the newest decision on the same words wins';
  assert p.review_status = 'reviewed', 'all answered';
end $$;
select tt.expect_error($q$select public.update_contribution((select id from st), 'Mijn dag', null, 'nld', 'phrase', null, null, 'left', 'Nieuw verhaal')$q$, 'post_under_review');

-- Levels: a B2 learner counts as a reviewer where natives are few, a new account counts for A1 and A2 only, and it updates on its own.
select tt.as_user('00000000-0000-0000-0000-0000c0de0005');
select public.submit_discussion((select id from public.contribution_posts where user_id = '00000000-0000-0000-0000-0000c0de0001' and post_type = 'photo'), null, 'correction', 'Fresh account', 'Onze hond', null, gen_random_uuid());
reset role;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000c0de0003');
select public.toggle_post_endorsement((select id from ph));
reset role;
insert into public.contribution_posts (user_id, language_id, phrase, post_type, created_at)
select '00000000-0000-0000-0000-0000c0de0001', 'nld', 'Oefenzin nummer ' || g, 'correct_me', now() - interval '2 days' from generate_series(1, 3) g;
do $$ begin
  assert (select verified_level is null from public.profiles where id = '00000000-0000-0000-0000-0000c0de0001'), 'reviews and writing alone verify nothing: the path does';
end $$;
-- Corrections given: an explanation counts in full, none counts half, and one friend can't carry it.
insert into public.conversations (id, direct_key) values ('00000000-0000-0000-0000-0000c0de00c1', 'c0de-test');
insert into public.conversation_members (conversation_id, user_id) values ('00000000-0000-0000-0000-0000c0de00c1', '00000000-0000-0000-0000-0000c0de0001'), ('00000000-0000-0000-0000-0000c0de00c1', '00000000-0000-0000-0000-0000c0de0003');
insert into public.messages (id, conversation_id, sender_id, body, language_id)
select ('00000000-0000-0000-0000-0000c0dea' || lpad(g::text, 3, '0'))::uuid, '00000000-0000-0000-0000-0000c0de00c1', '00000000-0000-0000-0000-0000c0de0001', 'Bericht nummer ' || g, 'nld' from generate_series(1, 30) g;
insert into public.message_corrections (message_id, corrector_id, suggested_text, note, status, decided_at, created_at)
select ('00000000-0000-0000-0000-0000c0dea' || lpad(g::text, 3, '0'))::uuid, '00000000-0000-0000-0000-0000c0de0003', 'Beter ' || g, case when g <= 1 then 'Why' end, 'accepted', now() - g * interval '1 day', now() - g * interval '1 day' from generate_series(1, 4) g;
insert into public.message_corrections (message_id, corrector_id, suggested_text, note, status, decided_at, created_at)
select ('00000000-0000-0000-0000-0000c0dea' || lpad(g::text, 3, '0'))::uuid, '00000000-0000-0000-0000-0000c0de0003', 'Beter ' || g, 'Why', 'accepted', now() - g * interval '1 day', now() - g * interval '1 day' from generate_series(5, 30) g;
delete from public.message_corrections where corrector_id = '00000000-0000-0000-0000-0000c0de0003';
delete from public.messages where conversation_id = '00000000-0000-0000-0000-0000c0de00c1';
delete from public.conversations where id = '00000000-0000-0000-0000-0000c0de00c1';
set role authenticated;

-- A lesson: qualified author, sentence corrections, and the author decides. Asking first restarts the clock, once.
select tt.as_user('00000000-0000-0000-0000-0000c0de0002');
select tt.expect_error($q$select public.post_contribution('Hallo', null, 'nld', 'phrase', null, null, 'left', 'correct_me')$q$, 'invalid_post_type');
select tt.expect_error($q$select public.post_contribution('Les', null, 'nld', 'grammar', null, null, 'left', 'lesson', '  ')$q$, 'empty_body');
create temp table le as select public.post_contribution('De of het', null, 'nld', 'grammar', null, null, 'left', 'lesson', 'Dutch has two articles. Het is for neuter words.') as id; grant select on le to public;
select tt.as_user('00000000-0000-0000-0000-0000c0de0004');
create temp table lc as select public.submit_discussion((select id from le), null, 'correction', 'Clearer', 'Dutch has two definite articles.', null, gen_random_uuid(), 0, 23) as id; grant select on lc to public;
create temp table lc2 as select public.submit_discussion((select id from le), null, 'correction', 'Name them', 'Het is the article for neuter words.', null, gen_random_uuid(), 24, 48) as id; grant select on lc2 to public;
select tt.as_user('00000000-0000-0000-0000-0000c0de0002');
do $$ begin
  assert exists (select 1 from public.decision_items where item_id = (select id from lc) and resolved_at is null), 'a teaching post does ask for a decision';
  assert exists (select 1 from public.search_posts('De of het')), 'lessons are in the Library';
end $$;
select tt.expect_error($q$select public.ask_about_correction((select id from lc), '  ', gen_random_uuid())$q$, 'reason_required');
reset role;
update public.decision_items set due_at = now() + interval '1 hour' where item_id = (select id from lc);
set role authenticated;
select public.ask_about_correction((select id from lc), 'Do you mean only de and het?', gen_random_uuid());
select tt.expect_error($q$select public.ask_about_correction((select id from lc), 'And again?', gen_random_uuid())$q$, 'already_asked');
do $$ begin
  assert (select due_at > now() + interval '6 days' from public.decision_items where item_id = (select id from lc)), 'asking gives the full time back';
  assert (select status = 'pending' from public.post_discussion where id = (select id from lc)), 'and decides nothing';
end $$;
reset role;
do $$ begin assert exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000c0de0004' and type = 'post_reply'), 'the corrector hears the question'; end $$;
update public.decision_items set due_at = now() - interval '5 days' where item_id = (select id from lc2);
select public.accountability_sweep();
do $$ begin assert (select review_status = 'under_review' from public.contribution_posts where id = (select id from le)), 'with the moderators, and it says so'; end $$;
set role authenticated;
select public.decide_correction((select id from lc), true, null);
select public.decide_correction((select id from lc2), true, null);
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from le);
  assert p.current_body = 'Dutch has two definite articles. Het is the article for neuter words.', format('both sentences read corrected, got %s', p.current_body);
  assert p.accepted_item_id is null, 'a sentence is not a new version of the whole post';
  assert p.review_status = 'reviewed', 'reviewed once nothing is open';
  assert exists (select 1 from public.saved_phrases where user_id = auth.uid() and phrase = 'Dutch has two definite articles.'), 'to the phrasebook here too';
end $$;
select public.revert_accepted((select id from le), 'Changed my mind');
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from le);
  assert p.current_body is null and p.review_status = 'awaiting_feedback', 'going back undoes every sentence';
end $$;
select tt.expect_error($q$select public.revert_accepted((select id from st), 'No')$q$, 'forbidden');
select tt.as_user('00000000-0000-0000-0000-0000c0de0001');
select tt.expect_error($q$select public.revert_accepted((select id from st), 'No')$q$, 'correction_unavailable');

-- Being paused for overdue teaching decisions never stops anyone asking for help.
reset role;
insert into public.user_restrictions (user_id, reason) values ('00000000-0000-0000-0000-0000c0de0001', 'Test');
set role authenticated;
select public.post_help_request('correct_me', 'Ik mag nog steeds vragen', null);
select tt.expect_error($q$select public.post_contribution('Habari', null, 'swh', 'phrase', null, null)$q$, 'posting_restricted');
reset role;
delete from public.user_restrictions where user_id = '00000000-0000-0000-0000-0000c0de0001';
do $$ begin
  assert not has_function_privilege('authenticated', 'public.keep_correction(uuid, text, text, uuid)', 'execute'), 'nobody can write into someone else''s phrasebook';
  assert not has_function_privilege('authenticated', 'public.applied_body(uuid)', 'execute');
  assert not has_function_privilege('authenticated', 'public.evaluate_band(uuid, text, text)', 'execute');
end $$;
set role authenticated;

-- Retention and archiving (docs/DATA_RETENTION.md). The file work is in archive-run; everything that decides what may be deleted is checked here.
reset role;
do $$ begin
  assert not has_function_privilege('authenticated', 'public.svc_archive_next_batch()', 'execute'), 'members cannot drive the archive';
  assert not has_function_privilege('authenticated', 'public.svc_archive_seal(uuid, bigint, bigint, text, text, text, date)', 'execute'), 'members cannot delete rows through the archive';
  assert not has_function_privilege('authenticated', 'public.archive_purge()', 'execute'), 'members cannot run the purge';
  assert not has_function_privilege('authenticated', 'public.archive_pseudonym(uuid)', 'execute'), 'members cannot look up a pseudonym';
  assert has_function_privilege('service_role', 'public.svc_archive_next_batch()', 'execute'), 'the edge function can';
  assert (select not public from storage.buckets where id = 'archives'), 'the archive bucket is private';
  assert pg_get_functiondef('public.system_heartbeat()'::regprocedure) not like '%app_logs%', 'the heartbeat no longer deletes logs';
end $$;
-- Anything older in the flows above would get in the way of counting exact batches.
delete from public.app_logs where created_at < now() - interval '29 days';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000a2c41001', 'archive-subject@example.test');

-- Logs: a whole day past the hot window moves, a recent row stays. Ids become pseudonyms, context never leaves.
insert into public.app_logs (level, source, message, context, user_id, created_at) values
  ('error', 'browser', 'old with account', '{"stack": "secret stack"}', '00000000-0000-0000-0000-0000a2c41001', now() - interval '40 days'),
  ('error', 'browser', 'old, account gone', '{}', '00000000-0000-0000-0000-00000000dead', now() - interval '40 days'),
  ('error', 'browser', 'still hot', '{}', '00000000-0000-0000-0000-0000a2c41001', now() - interval '5 days');
create temp table b1 as select public.svc_archive_next_batch() as b;
create temp table p1 as select public.svc_archive_export_page(((select b from b1)->>'id')::uuid, 0, 1000) as rows;
do $$
declare v_rows jsonb := (select rows from p1); v_batch uuid := ((select b from b1)->>'id')::uuid; v_pseudonym uuid;
begin
  assert (select b->>'table_name' from b1) = 'app_logs', 'the old logs are next';
  assert (select b->>'object_path' from b1) like 'app_logs/____/__/____-__-__.p1.ndjson.gz', 'file path';
  assert jsonb_array_length(v_rows) = 2, format('two rows in the day, got %s', v_rows);
  assert v_rows::text not like '%secret stack%' and v_rows::text not like '%a2c41001%', 'no context and no raw user id in a file';
  assert (select pseudonym from public.archive_subjects where user_id = '00000000-0000-0000-0000-0000a2c41001')::text = (select r->>'user_id' from jsonb_array_elements(v_rows) r where r->>'message' = 'old with account'), 'written as a pseudonym';
  assert (select (r->'user_id') = 'null'::jsonb from jsonb_array_elements(v_rows) r where r->>'message' = 'old, account gone'), 'an account already gone stays unlinked';
  perform public.svc_archive_export_page(v_batch, 0, 1000);
end $$;
-- A file that doesn't match the table deletes nothing.
select tt.expect_error(format('select public.svc_archive_seal(%L, 1, 10, %L, %L, %L, %L)', (select b->>'id' from b1), 'abc', 'archives/w', 'v1', '2099-01-01'), 'row_count_changed');
do $$ begin
  assert (select count(*) from public.app_logs where message like 'old%') = 2, 'a mismatch deletes nothing';
  assert public.svc_archive_seal(((select b->>'id' from b1))::uuid, 2, 10, 'abc', 'archives/w', 'v1', (now() + interval '50 years')::date) = 2, 'seal returns the rows it removed';
  assert (select count(*) from public.app_logs where message like 'old%') = 0, 'sealed rows left Postgres';
  assert (select count(*) from public.app_logs where message = 'still hot') = 1, 'recent rows stay';
  assert (select status = 'released' and row_count = 2 and retain_until = day + 395 from public.archive_batches where id = ((select b->>'id' from b1))::uuid), 'the file is on record';
end $$;
select tt.expect_error(format('select public.svc_archive_seal(%L, 0, 0, %L, null, null, null)', (select b->>'id' from b1), ''), 'batch_not_open');

-- A row turning up late for a finished day gets its own file: the sealed one is never overwritten.
insert into public.app_logs (level, source, message, created_at) select 'info', 'test', 'late', (day::timestamp at time zone 'UTC') + interval '1 hour' from public.archive_batches where id = ((select b->>'id' from b1))::uuid;
create temp table b1b as select public.svc_archive_next_batch() as b;
do $$ declare v jsonb := (select b from b1b); begin
  assert (v->>'part')::int = 2 and v->>'object_path' like '%.p2.ndjson.gz', format('a new part, got %s', v);
  assert public.svc_archive_seal((v->>'id')::uuid, 1, 10, 'abc', 'archives/w', 'v1', (now() + interval '50 years')::date) = 1, 'late row sealed';
end $$;

-- Rows gone before the seal: no empty file on record.
insert into public.app_logs (level, source, message, created_at) values ('info', 'test', 'vanishes', now() - interval '60 days');
create temp table b1c as select public.svc_archive_next_batch() as b;
delete from public.app_logs where message = 'vanishes';
do $$ declare v_id uuid := ((select b from b1c)->>'id')::uuid; begin
  assert public.svc_archive_seal(v_id, 0, 0, '', null, null, null) = 0, 'nothing to seal';
  assert not exists (select 1 from public.archive_batches where id = v_id), 'no record of an empty file';
end $$;

-- Reports: an open one never moves however old. A resolved one moves, with the sender inside the evidence pseudonymised too.
insert into public.reports (reporter_id, target_user_id, reason, status, created_at) values
  ('00000000-0000-0000-0000-0000fade0001', '00000000-0000-0000-0000-0000fade0002', 'spam', 'open', now() - interval '900 days');
insert into public.reports (reporter_id, target_user_id, reason, status, created_at, resolved_at, evidence) values
  ('00000000-0000-0000-0000-0000fade0001', '00000000-0000-0000-0000-0000fade0002', 'spam', 'dismissed', now() - interval '500 days', now() - interval '400 days',
   '[{"id": "00000000-0000-0000-0000-0000000000e1", "sender_id": "00000000-0000-0000-0000-0000a2c41001", "body": "the words", "created_at": "2025-01-01"}]');
create temp table b2 as select public.svc_archive_next_batch() as b;
create temp table p2 as select public.svc_archive_export_page(((select b from b2)->>'id')::uuid, 0, 1000) as rows;
do $$ declare v_rows jsonb := (select rows from p2); begin
  assert (select b->>'table_name' from b2) = 'reports' and jsonb_array_length(v_rows) = 1, format('only the resolved report, got %s', v_rows);
  assert v_rows::text not like '%a2c41001%' and v_rows::text not like '%fade000%', 'no raw ids, evidence included';
  assert v_rows->0->'evidence'->0->>'body' = 'the words', 'the evidence itself is kept';
  assert v_rows->0->'evidence'->0->>'sender_id' = (select pseudonym::text from public.archive_subjects where user_id = '00000000-0000-0000-0000-0000a2c41001'), 'same person, same pseudonym';
  assert public.svc_archive_seal(((select b->>'id' from b2))::uuid, 1, 10, 'abc', 'archives/w', 'v1', (now() + interval '50 years')::date) = 1, 'report sealed';
  assert exists (select 1 from public.reports where status = 'open' and created_at < now() - interval '800 days'), 'the open report stays';
end $$;

-- The audit log stays append-only, except for rows in a batch being sealed.
insert into public.admin_audit_log (actor_email, action, target_id, target_email, detail, created_at) values
  ('staff@example.test', 'staff_invited', '00000000-0000-0000-0000-0000a2c41001', 'someone@example.test', '{"email": "someone@example.test", "tier": "admin"}', now() - interval '400 days');
select tt.expect_error($q$delete from public.admin_audit_log where action = 'staff_invited' and created_at < now() - interval '399 days'$q$, 'append-only');
create temp table b3 as select public.svc_archive_next_batch() as b;
create temp table p3 as select public.svc_archive_export_page(((select b from b3)->>'id')::uuid, 0, 1000) as rows;
do $$ declare v_rows jsonb := (select rows from p3); begin
  assert (select b->>'table_name' from b3) = 'admin_audit_log', 'the audit row is next';
  assert v_rows::text not like '%someone@example.test%' and v_rows::text not like '%a2c41001%', 'the target is not named';
  assert v_rows->0->>'actor_email' = 'staff@example.test', 'staff stay named';
  assert v_rows->0->'detail'->>'tier' = 'admin', 'the rest of the detail is kept';
end $$;
select tt.expect_error(format('update public.admin_audit_log set action = %L where created_at < now() - interval %L', 'x', '399 days'), 'append-only');
select public.svc_archive_seal(((select b->>'id' from b3))::uuid, 1, 10, 'abc', 'archives/w', 'v1', (now() + interval '50 years')::date);
do $$ begin assert not exists (select 1 from public.admin_audit_log where action = 'staff_invited' and created_at < now() - interval '399 days'), 'sealed audit rows left Postgres'; end $$;
insert into public.admin_audit_log (actor_email, action, created_at) values ('staff@example.test', 'later', now() - interval '401 days');
select tt.expect_error($q$delete from public.admin_audit_log where action = 'later'$q$, 'append-only');
-- That row can't be removed, so the audit log sits out the rest of these checks.
update public.retention_policies set enabled = false where table_name = 'admin_audit_log';

-- Erasure: deleting the account breaks the link, and later files can't re-create it.
delete from auth.users where id = '00000000-0000-0000-0000-0000a2c41001';
do $$ begin
  assert not exists (select 1 from public.archive_subjects where user_id = '00000000-0000-0000-0000-0000a2c41001'), 'the link is gone with the account';
  assert public.archive_pseudonym('00000000-0000-0000-0000-0000a2c41001') is null, 'no new link for an account that is gone';
end $$;

-- A batch that keeps failing stops its table, keeps its rows, and shows up on the health page.
insert into public.app_logs (level, source, message, created_at) values ('info', 'test', 'cannot upload', now() - interval '50 days');
create temp table b4 as select public.svc_archive_next_batch() as b;
update public.archive_batches set attempts = 5 where id = ((select b->>'id' from b4))::uuid;
select public.svc_archive_fail(((select b->>'id' from b4))::uuid, 'upload: storage is down');
insert into public.app_logs (level, source, message, created_at) values ('info', 'test', 'next day', now() - interval '49 days');
do $$ declare v jsonb; begin
  assert (select status = 'failed' and last_error like 'upload:%' from public.archive_batches where id = ((select b->>'id' from b4))::uuid), 'marked failed';
  v := public.svc_archive_next_batch();
  assert v is null or v->>'table_name' <> 'app_logs', format('the table waits for someone to look, got %s', v);
  assert (select count(*) from public.app_logs where message in ('cannot upload', 'next day')) = 2, 'nothing lost while it waits';
end $$;

-- Destruction runs on the date unless a hold covers the file. The record of it stays.
update public.archive_batches set retain_until = (now() at time zone 'UTC')::date - 1 where id = ((select b->>'id' from b2))::uuid;
insert into public.archive_legal_holds (table_name, from_day, to_day, reason, placed_by)
select 'reports', day - 1, day + 1, 'Claim 123', 'owner' from public.archive_batches where id = ((select b->>'id' from b2))::uuid;
do $$ declare v_id uuid := ((select b from b2)->>'id')::uuid; begin
  assert public.svc_archive_due_for_destruction() = '[]', 'a held file is not due';
  perform public.svc_archive_mark_destroyed(v_id);
  assert (select status from public.archive_batches where id = v_id) = 'released', 'a held file cannot be marked destroyed';
  update public.archive_legal_holds set released_at = now(), released_by = 'owner' where reason = 'Claim 123';
  assert public.svc_archive_due_for_destruction()->0->>'id' = v_id::text, 'due once released';
  perform public.svc_archive_mark_destroyed(v_id);
  assert (select status = 'destroyed' and destroyed_at is not null and sha256 = 'abc' from public.archive_batches where id = v_id), 'the record stays';
end $$;

-- Purge: old heartbeats and read notifications go. Unread ones stay however old.
insert into public.system_heartbeats (minute) values (date_trunc('minute', now()) - interval '100 days'), (date_trunc('minute', now()) - interval '1 day');
insert into public.notifications (user_id, type, created_at, read_at) values
  ('00000000-0000-0000-0000-0000fade0001', 'follow', now() - interval '300 days', now() - interval '200 days'),
  ('00000000-0000-0000-0000-0000fade0001', 'follow', now() - interval '300 days', null);
select public.archive_purge();
do $$ begin
  assert not exists (select 1 from public.system_heartbeats where minute < now() - interval '91 days'), 'old heartbeats go';
  assert exists (select 1 from public.system_heartbeats where minute > now() - interval '2 days'), 'recent heartbeats stay';
  assert not exists (select 1 from public.notifications where read_at < now() - interval '181 days'), 'old read notifications go';
  assert exists (select 1 from public.notifications where read_at is null and created_at < now() - interval '299 days'), 'unread ones stay';
end $$;

-- The health page: staff only.
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000fade0001');
select tt.expect_error('select public.admin_archive_status()', 'forbidden');
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
do $$ declare v jsonb := public.admin_archive_status(); begin
  assert (v->>'failed')::int = 1 and (v->>'destroyed')::int = 1 and not (v->>'configured')::boolean, format('status, got %s', v);
  assert v->>'oldest_waiting' is not null, 'the stuck logs count as waiting';
end $$;

-- Proof of consent outlives the account, says what was agreed to, and can't be changed. Decree 356/2025 Art. 6.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000c0a5e001', 'Consent.Person@example.test');
insert into public.consents (user_id, kind, version) values ('00000000-0000-0000-0000-0000c0a5e001', 'privacy', '2');
do $$ declare l public.consent_ledger; begin
  select * into l from public.consent_ledger where user_id = '00000000-0000-0000-0000-0000c0a5e001';
  assert l.event = 'given' and l.email_hash = public.email_hash('consent.person@example.test'), 'who agreed';
  assert l.document_sha256 = (select sha256 from public.consent_documents where kind = 'privacy' and version = '2'), 'what they agreed to';
  assert (select document_text like '%13 months%' from public.consent_documents where kind = 'privacy' and version = '2'), 'the words themselves are kept';
  assert l::text not like '%Consent.Person%' and l::text not like '%consent.person%', 'no plain email';
end $$;
delete from auth.users where id = '00000000-0000-0000-0000-0000c0a5e001';
do $$ begin
  assert (select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000c0a5e001') = 0, 'the live row went with the account';
  assert (select array_agg(event order by seq) from public.consent_ledger where user_id = '00000000-0000-0000-0000-0000c0a5e001') = array['given', 'ended'], 'the proof stays, and shows when it ended';
  assert (select email_hash from public.consent_ledger where user_id = '00000000-0000-0000-0000-0000c0a5e001' and event = 'ended') = public.email_hash('consent.person@example.test'), 'still matches the address';
end $$;
select tt.expect_error($q$update public.consent_ledger set version = '9' where user_id = '00000000-0000-0000-0000-0000c0a5e001'$q$, 'append-only');
select tt.expect_error($q$delete from public.consent_ledger where user_id = '00000000-0000-0000-0000-0000c0a5e001'$q$, 'append-only');
select tt.expect_error('truncate public.consent_ledger', 'append-only');
select tt.expect_error($q$update public.consent_documents set wording = 'x' where kind = 'privacy'$q$, 'append-only');
select tt.expect_error('truncate public.admin_audit_log', 'append-only');
do $$ begin
  assert not has_function_privilege('authenticated', 'public.consent_ledger_append(text, uuid, text, text, text, timestamptz)', 'execute'), 'members cannot write proof';
  assert not has_function_privilege('authenticated', 'public.svc_archive_seal(uuid, bigint, bigint, text, text, text, date)', 'execute'), 'members cannot seal';
  assert (public.svc_integrity_check()->>'ok')::boolean, format('chains are whole: %s', public.svc_integrity_check());
end $$;

-- No write-once copy, no delete: the rows stay.
insert into public.app_logs (level, source, message, created_at) values ('info', 'test', 'needs worm', now() - interval '70 days');
update public.archive_batches set status = 'destroyed', destroyed_at = now() where status = 'failed' and table_name = 'app_logs';
create temp table b5 as select public.svc_archive_next_batch() as b;
select tt.expect_error(format('select public.svc_archive_seal(%L, 1, 10, %L, null, null, null)', (select b->>'id' from b5), 'abc'), 'worm_copy_required');
select tt.expect_error(format('select public.svc_archive_seal(%L, 1, 10, %L, %L, %L, %L)', (select b->>'id' from b5), 'abc', 'k', 'v', '2000-01-01'), 'worm_lock_too_short');
do $$ begin
  assert exists (select 1 from public.app_logs where message = 'needs worm'), 'rows stay without the copy';
  assert (select worm_retain_until is null from public.archive_batches where id = ((select b->>'id' from b5))::uuid), 'nothing recorded';
  assert public.svc_archive_seal(((select b->>'id' from b5))::uuid, 1, 10, 'abc', 'archives/x', 'v5', public.svc_archive_retain_until(((select b->>'id' from b5))::uuid)) = 1, 'sealed with the copy';
end $$;

-- A sealed register entry can't be altered, and tampering past the triggers is caught by the chain.
select tt.expect_error(format('update public.archive_batches set sha256 = %L where id = %L', 'forged', (select b->>'id' from b5)), 'cannot be changed');
select tt.expect_error(format('delete from public.archive_batches where id = %L', (select b->>'id' from b5)), 'cannot be deleted');
select tt.expect_error('truncate public.archive_batches cascade', 'append-only');
create temp table head as select (select max(seq) from public.consent_ledger) as seq, (select entry_hash from public.consent_ledger order by seq desc limit 1) as hash;
do $$ declare v jsonb; begin
  v := public.svc_integrity_check((select seq from head), (select hash from head));
  assert (v->>'ok')::boolean and (v->>'matches_checkpoint')::boolean, format('matches the checkpoint: %s', v);
  v := public.svc_integrity_check((select seq from head), repeat('f', 64));
  assert not (v->>'ok')::boolean and not (v->>'matches_checkpoint')::boolean, 'a rewritten history does not match write-once storage';
end $$;
-- As someone with full database access would do it: triggers off, one entry changed.
alter table public.consent_ledger disable trigger consent_ledger_no_change;
update public.consent_ledger set version = 'forged' where seq = (select seq from head);
alter table public.consent_ledger enable trigger consent_ledger_no_change;
do $$ declare v jsonb := public.svc_integrity_check(); begin
  assert (v->>'consent_bad_seq')::bigint = (select seq from head) and not (v->>'ok')::boolean, format('forgery found: %s', v);
end $$;
alter table public.consent_ledger disable trigger consent_ledger_no_change;
update public.consent_ledger set version = '2' where seq = (select seq from head);
alter table public.consent_ledger enable trigger consent_ledger_no_change;

-- Checkpoints: due when there's something new, not otherwise.
do $$ declare p jsonb := public.svc_checkpoint_plan(); begin
  assert (p->>'due')::boolean and (p->>'consent_through')::bigint = (select seq from head), format('due, got %s', p);
  assert jsonb_array_length(public.svc_consent_export_page(0, (p->>'consent_through')::bigint, 1000)) > 0, 'ledger exports';
  perform public.svc_checkpoint_record((p->>'consent_through')::bigint, p->>'consent_head', (p->>'register_through')::bigint, p->>'register_head', 'checkpoints/a.json', 'v1', null, null, '{"ok": true}');
  assert not (public.svc_checkpoint_plan()->>'due')::boolean, 'nothing new';
end $$;
select tt.expect_error($q$delete from public.archive_checkpoints where checkpoint_key = 'checkpoints/a.json'$q$, 'append-only');

-- The blog: staff write and publish, drafts stay private, and the public only ever sees what was published.
select tt.as_user('00000000-0000-0000-0000-00000000d003');
select tt.expect_error($q$select public.admin_blog_list()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'mine', '{}')$q$, 'forbidden');
select tt.expect_error($q$select public.admin_blog_publish((select id from public.blog_posts limit 1))$q$, 'forbidden');
select tt.expect_error($q$select public.admin_blog_delete((select id from public.blog_posts limit 1))$q$, 'forbidden');
select tt.as_staff('00000000-0000-0000-0000-0000000000d4');
select tt.expect_error($q$select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'Not A Slug', '{}')$q$, 'blog_invalid_slug');
select tt.expect_error($q$select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'what-is-a-language-exchange', '{}')$q$, 'blog_slug_taken');
select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'flow-post', '{"title":"First","extra":"dropped","body":{"type":"doc","content":[]}}');
select tt.expect_error($q$select public.admin_blog_publish('00000000-0000-0000-0000-00000000b109')$q$, 'blog_description_required');
select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'flow-post', '{"title":"First","description":"D","summary":"S","kicker":null,"seo_title":null,"cover_url":null,"cover_alt":null,"body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"one two three"}]}]}}');
do $$ begin
  assert (select draft ? 'extra' from public.blog_posts where slug = 'flow-post') is false, 'only known fields are kept';
  assert (select title is null from public.blog_posts where slug = 'flow-post'), 'saving publishes nothing';
end $$;
reset role; set role anon;
do $$ begin
  assert (select count(*) from public.blog_posts where slug = 'flow-post') = 0, 'a draft is not public';
  assert (select count(*) from public.blog_posts where slug = 'what-is-a-language-exchange') = 1, 'a live post is public';
end $$;
reset role; set role authenticated;
do $$ declare v jsonb; begin
  v := public.admin_blog_publish('00000000-0000-0000-0000-00000000b109');
  assert (v->>'is_live')::boolean and not (v->>'has_changes')::boolean, 'published with nothing left to publish';
  assert (select read_minutes from public.blog_posts where slug = 'flow-post') = 1, 'reading time';
end $$;
-- Editing a live post leaves the public copy alone until it is published again.
select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'flow-post', '{"title":"Second","description":"D","summary":"S","body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"new"}]}]}}');
do $$ begin
  assert (select title from public.blog_posts where slug = 'flow-post') = 'First', 'the site still has the old version';
  assert (public.admin_blog_get('00000000-0000-0000-0000-00000000b109')->>'has_changes')::boolean, 'staff see there are changes';
end $$;
select tt.expect_error($q$select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'new-address', '{"title":"x"}')$q$, 'blog_slug_locked');
select tt.expect_error($q$select public.admin_blog_save('00000000-0000-0000-0000-00000000b109', 'flow-post', '{"title":"x"}', '2020-01-01')$q$, 'blog_changed');
select public.admin_blog_unpublish('00000000-0000-0000-0000-00000000b109');
reset role; set role anon;
do $$ begin assert (select count(*) from public.blog_posts where slug = 'flow-post') = 0, 'off the site'; end $$;
reset role; set role authenticated;
select public.admin_blog_delete('00000000-0000-0000-0000-00000000b109');
do $$ begin assert (public.admin_blog_get('00000000-0000-0000-0000-00000000b109')) is null, 'deleted'; end $$;
reset role;
do $$ begin assert (select count(*) from public.admin_audit_log where action in ('blog_publish', 'blog_unpublish', 'blog_delete') and detail->>'slug' = 'flow-post') = 3, 'on the record'; end $$;

reset role;

-- The FAQ: admins and moderators manage it from the same screen, members can't, and the public only sees what isn't hidden.
select set_config('app.staff_change', 'on', false);
insert into public.admin_accounts (user_id, tier) values ('00000000-0000-0000-0000-00000000ee09', 'moderator');
select set_config('app.staff_change', 'off', false);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000d003');
select tt.expect_error($q$select public.admin_faq_list()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_faq_save(null, 'points', 'Mine?', 'Yes', false, true)$q$, 'forbidden');
select tt.expect_error($q$select public.admin_faq_move((select id from public.faq_items limit 1), 1)$q$, 'forbidden');
select tt.expect_error($q$select public.admin_faq_delete((select id from public.faq_items limit 1))$q$, 'forbidden');
select tt.expect_error($q$update public.faq_items set answer = 'x' where section = 'points'$q$, 'permission denied');
select tt.expect_error($q$insert into public.faq_items (section, question, answer, position) values ('points', 'q', 'a', 1)$q$, 'permission denied');
select tt.as_staff('00000000-0000-0000-0000-00000000ee09');   -- a moderator
select tt.expect_error($q$select public.admin_faq_save(null, 'nope', 'Q flow?', 'A', false, true)$q$, 'faq_invalid_section');
select tt.expect_error($q$select public.admin_faq_save(null, 'points', '   ', 'A', false, true)$q$, 'faq_question_required');
select tt.expect_error($q$select public.admin_faq_save(null, 'points', 'Q flow?', '  ', false, true)$q$, 'faq_answer_required');
select tt.expect_error($q$select public.admin_faq_save(null, 'points', repeat('q', 201), 'A', false, true)$q$, 'faq_question_too_long');
select tt.expect_error($q$select public.admin_faq_save(null, 'points', 'Q flow?', repeat('a', 2001), false, true)$q$, 'faq_answer_too_long');
select tt.expect_error($q$select public.admin_faq_save(null, 'points', 'WHAT IS A BOUNTY?', 'A', false, true)$q$, 'faq_question_taken');
do $$ declare v jsonb; v2 jsonb; last_id uuid; n int;
begin
  v := public.admin_faq_save(null, 'points', '  Q flow?  ', ' Answer. ', true, true);
  assert v->>'question' = 'Q flow?' and v->>'answer' = 'Answer.', 'trimmed';
  assert (v->>'position')::int = (select max(position) from public.faq_items where section = 'points'), 'new questions go last';
  -- Up one, then down again. Past either end nothing happens.
  select id into last_id from public.faq_items where section = 'points' and position = (v->>'position')::int - 1;
  perform public.admin_faq_move((v->>'id')::uuid, -1);
  assert (select position from public.faq_items where id = (v->>'id')::uuid) = (v->>'position')::int - 1, 'moved up';
  assert (select position from public.faq_items where id = last_id) = (v->>'position')::int, 'the other one swapped';
  perform public.admin_faq_move((v->>'id')::uuid, 1);
  perform public.admin_faq_move((v->>'id')::uuid, 1);
  assert (select position from public.faq_items where id = (v->>'id')::uuid) = (v->>'position')::int, 'stays at the end';
  -- Someone else saved since this was loaded.
  begin
    perform public.admin_faq_save((v->>'id')::uuid, 'points', 'Q flow?', 'Stale', true, true, '2020-01-01');
    assert false, 'a stale save was accepted';
  exception when raise_exception then assert sqlerrm = 'faq_changed', sqlerrm; end;
  -- To another section: goes to its end.
  select max(position) into n from public.faq_items where section = 'safety';
  v2 := public.admin_faq_save((v->>'id')::uuid, 'safety', 'Q flow?', 'Answer.', true, false);
  assert (v2->>'position')::int = n + 1, 'end of the new section';
  assert not (v2->>'is_live')::boolean, 'hidden';
  select count(*) into n from jsonb_array_elements(public.admin_faq_list()) e where e->>'question' = 'Q flow?';
  assert n = 1, 'staff still see a hidden question';
end $$;
reset role; set role anon;
do $$ begin
  assert (select count(*) from public.faq_items where question = 'Q flow?') = 0, 'a hidden question is not public';
  assert (select count(*) from public.faq_items where on_home) > 0, 'the home page has questions';
  assert (select count(*) from public.faq_items) = 24, 'the seeded questions are public';
end $$;
reset role; set role authenticated;
select tt.as_staff('00000000-0000-0000-0000-00000000ee09');
do $$ begin perform public.admin_faq_delete((select (e->>'id')::uuid from jsonb_array_elements(public.admin_faq_list()) e where e->>'question' = 'Q flow?')); end $$;
select tt.expect_error($q$select public.admin_faq_delete('00000000-0000-0000-0000-00000000b110')$q$, 'faq_not_found');
reset role;
do $$ begin
  assert (select count(*) from public.faq_items where question = 'Q flow?') = 0, 'deleted';
  assert (select count(*) from public.admin_audit_log where action in ('faq_create', 'faq_update', 'faq_move', 'faq_delete') and detail->>'question' = 'Q flow?') = 5, 'on the record';
end $$;
select set_config('app.staff_change', 'on', false);
delete from public.admin_accounts where user_id = '00000000-0000-0000-0000-00000000ee09';
select set_config('app.staff_change', 'off', false);

reset role;
-- ============ calls: one-to-one, invitation only ============
-- f1 calls f2 (partners). f3 is a stranger, f4 only has a partner request, f5 blocked f1.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'call1@test.com'), ('00000000-0000-0000-0000-0000000000f2', 'call2@test.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'call3@test.com'), ('00000000-0000-0000-0000-0000000000f4', 'call4@test.com'),
  ('00000000-0000-0000-0000-0000000000f5', 'call5@test.com');
create temp table tc (k text primary key, id uuid);
grant all on tc to authenticated;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
select tt.connect('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
select tt.connect('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f5');
do $$ declare c uuid; begin
  c := public.start_conversation('00000000-0000-0000-0000-0000000000f2'); insert into tc values ('chat12', c);
  perform tt.ask(auth.uid(), '00000000-0000-0000-0000-0000000000f4');   -- asked, not accepted
  c := public.start_conversation('00000000-0000-0000-0000-0000000000f5'); insert into tc values ('chat15', c);
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
select public.respond_message_request((select id from tc where k = 'chat12'), true);
select tt.as_user('00000000-0000-0000-0000-0000000000f5');
select public.respond_message_request((select id from tc where k = 'chat15'), true);
select public.block_user('00000000-0000-0000-0000-0000000000f1');

select tt.as_user('00000000-0000-0000-0000-0000000000f1');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f1')$q$, 'cannot_call_self');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f3')$q$, 'user_unavailable');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f4')$q$, 'user_unavailable');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f5')$q$, 'user_unavailable');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000d4')$q$, 'user_unavailable');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000ff')$q$, 'user_unavailable');
do $$ declare c uuid; r jsonb; begin
  c := public.start_call('00000000-0000-0000-0000-0000000000f2'); insert into tc values ('call1', c);
  r := public.get_call(c);
  assert r->>'status' = 'ringing', 'a new call rings';
  assert jsonb_array_length(r->'participants') = 2, 'caller and callee';
  assert not (r ? 'provider_room'), 'members never see the room name';
  r := public.claim_call_join(c);
  assert (r->>'ok')::boolean and r->>'identity' = '00000000-0000-0000-0000-0000000000f1' and r->>'room' like 'ftc_%', 'the caller may join while it rings';
  perform public.report_call_connected(c);
end $$;
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f2')$q$, 'already_in_call');
select tt.expect_error($q$update public.calls set status = 'ended' where id is not null$q$, 'permission denied');
select tt.expect_error($q$insert into public.calls (max_participants, ring_expires_at) values (2, now())$q$, 'permission denied');

select tt.as_user('00000000-0000-0000-0000-0000000000f2');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f1')$q$, 'already_in_call');
select tt.expect_error($q$update public.call_participants set role = 'host' where id is not null$q$, 'permission denied');
select tt.expect_error($q$insert into public.call_participants (call_id, user_id, role, invitation_status) select id, '00000000-0000-0000-0000-0000000000f3', 'participant', 'accepted' from tc where k = 'call1'$q$, 'permission denied');
do $$ declare c uuid := (select id from tc where k = 'call1'); r jsonb; begin
  assert (select count(*) from public.list_live_calls() where call_id = c and my_invitation = 'pending') = 1, 'the callee sees it ringing';
  assert (select count(*) from public.list_notifications() n where n.type = 'call_incoming' and n.data->>'call_id' = c::text) = 1, 'and gets an incoming-call notification';
  assert not (public.claim_call_join(c)->>'ok')::boolean, 'no media before answering';
  assert (select p->>'rang_at' from jsonb_array_elements(public.get_call(c)->'participants') p where p->>'user_id' = auth.uid()::text) is null, 'not rung yet';
  perform public.report_call_ringing(c);
  assert (select p->>'rang_at' from jsonb_array_elements(public.get_call(c)->'participants') p where p->>'user_id' = auth.uid()::text) is not null, 'the caller can see it rang here';
  perform public.respond_call_invite(c, true);
  perform public.report_call_ringing(c);   -- harmless once answered
  assert (select count(*) from public.list_calls_with('00000000-0000-0000-0000-0000000000f1') where call_id = c) = 0, 'a live call is not in the chat log yet';
  r := public.get_call(c);
  assert r->>'status' = 'active' and r->>'started_at' is not null, 'answering starts the call';
  r := public.claim_call_join(c);
  assert (r->>'ok')::boolean and r->>'identity' = '00000000-0000-0000-0000-0000000000f2', 'the callee joins as themselves';
  perform public.report_call_connected(c);
  assert (select presence from public.call_participants where call_id = c and user_id = auth.uid()) = 'joined', 'connected';
end $$;
select tt.expect_error($q$select public.respond_call_invite((select id from tc where k = 'call1'), true)$q$, 'call_unavailable');

select tt.as_user('00000000-0000-0000-0000-0000000000f3');
do $$ declare c uuid := (select id from tc where k = 'call1'); begin
  assert (select count(*) from public.calls where id = c) = 0, 'a stranger cannot see the call';
  assert (select count(*) from public.call_participants where call_id = c) = 0, 'or who is in it';
  assert not (public.claim_call_join(c)->>'ok')::boolean, 'or get into it';
  assert public.claim_call_join(c)->>'code' = 'call_unavailable', 'with a generic refusal';
  perform public.report_call_ringing(c);
  assert (select count(*) from public.list_calls_with('00000000-0000-0000-0000-0000000000f1')) = 0, 'a stranger sees no calls with someone';
end $$;
select tt.expect_error($q$select public.get_call((select id from tc where k = 'call1'))$q$, 'call_unavailable');
select tt.expect_error($q$select public.respond_call_invite((select id from tc where k = 'call1'), true)$q$, 'call_unavailable');
select tt.expect_error($q$select public.end_call((select id from tc where k = 'call1'))$q$, 'call_unavailable');

-- Capacity: a third accepted member (as a future invite would add) is refused while both seats are taken.
reset role;
insert into public.call_participants (call_id, user_id, role, invitation_status) select id, '00000000-0000-0000-0000-0000000000f3', 'participant', 'accepted' from tc where k = 'call1';
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000f3');
do $$ begin assert not (public.claim_call_join((select id from tc where k = 'call1'))->>'ok')::boolean, 'a full call refuses another join'; end $$;
reset role;
delete from public.call_participants where user_id = '00000000-0000-0000-0000-0000000000f3';
delete from public.call_join_failures where id is not null;
set role authenticated;

-- Only the host ends it for everyone; hanging up in a one-to-one call ends it too.
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
select tt.expect_error($q$select public.end_call((select id from tc where k = 'call1'))$q$, 'call_unavailable');
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid := (select id from tc where k = 'call1'); r jsonb; begin
  perform public.leave_call(c);
  r := public.get_call(c);
  assert r->>'status' = 'ended' and r->>'end_reason' = 'hung_up', 'hanging up ends a one-to-one call';
  assert (select count(*) from jsonb_array_elements(r->'participants') p where p->>'presence' in ('joining', 'joined')) = 0, 'nobody is left in it';
  assert (select count(*) from public.list_calls_with('00000000-0000-0000-0000-0000000000f2') l where l.call_id = c and l.outgoing and l.attended and l.end_reason = 'hung_up') = 1,
    'an ended call is in the chat log, as an outgoing call that was answered';
  perform public.leave_call(c);   -- twice is harmless
  assert not (public.claim_call_join(c)->>'ok')::boolean, 'an ended call takes no joins';
  assert (select count(*) from public.list_call_history() h where h.call_id = c and h.outgoing and h.attended) = 1, 'in my history';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ begin
  assert (select count(*) from public.list_call_history() h where h.call_id = (select id from tc where k = 'call1') and not h.outgoing) = 1, 'in theirs';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f3');
do $$ begin assert (select count(*) from public.list_call_history()) = 0, 'not in a stranger''s'; end $$;
-- Deleting a call entry hides it for me only; a stranger can't touch it, and the call itself stays.
select tt.expect_error(format('select public.hide_call(%L)', (select id from tc where k = 'call1')), 'call_not_found');
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ declare c uuid := (select id from tc where k = 'call1'); begin
  perform public.hide_call(c);
  perform public.hide_call(c);   -- twice is harmless
  assert (select count(*) from public.list_call_history() h where h.call_id = c) = 0, 'a deleted call leaves my history';
  assert (select count(*) from public.list_calls_with('00000000-0000-0000-0000-0000000000f1') l where l.call_id = c) = 0, 'and my chat';
  assert exists (select 1 from public.calls where id = c), 'the call itself is kept';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid := (select id from tc where k = 'call1'); begin
  assert (select count(*) from public.list_call_history() h where h.call_id = c) = 1, 'the other person still sees it';
  assert (select count(*) from public.list_calls_with('00000000-0000-0000-0000-0000000000f2') l where l.call_id = c) = 1, 'in their chat too';
end $$;

-- Declined, cancelled and unanswered calls can't be joined.
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid; begin c := public.start_call('00000000-0000-0000-0000-0000000000f2'); insert into tc values ('call2', c); end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ declare c uuid := (select id from tc where k = 'call2'); r jsonb; begin
  perform public.respond_call_invite(c, false);
  r := public.get_call(c);
  assert r->>'status' = 'ended' and r->>'end_reason' = 'declined', 'declined';
  assert not (public.claim_call_join(c)->>'ok')::boolean, 'a declined invitation cannot join';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid; begin
  c := public.start_call('00000000-0000-0000-0000-0000000000f2'); insert into tc values ('call3', c);
  perform public.leave_call(c);
  assert public.get_call(c)->>'status' = 'cancelled', 'the caller hanging up before an answer cancels';
end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
select tt.expect_error($q$select public.respond_call_invite((select id from tc where k = 'call3'), true)$q$, 'call_unavailable');
reset role;
update public.calls set created_at = created_at - interval '1 hour' where initiated_by = '00000000-0000-0000-0000-0000000000f1';
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid; begin c := public.start_call('00000000-0000-0000-0000-0000000000f2'); insert into tc values ('call4', c); end $$;
reset role;
update public.calls set ring_expires_at = now() - interval '1 second' where id = (select id from tc where k = 'call4');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
select tt.expect_error($q$select public.respond_call_invite((select id from tc where k = 'call4'), true)$q$, 'call_unavailable');
do $$ declare r jsonb := public.get_call((select id from tc where k = 'call4')); begin
  assert r->>'status' = 'expired' and r->>'end_reason' = 'no_answer', 'unanswered calls expire';
  assert (select p->>'invitation_status' from jsonb_array_elements(r->'participants') p where p->>'user_id' = '00000000-0000-0000-0000-0000000000f2') = 'expired', 'and so does the invitation';
end $$;

-- Limits: the same person 3 times in 10 minutes, and failed joins.
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare i int; begin for i in 1..2 loop perform public.leave_call(public.start_call('00000000-0000-0000-0000-0000000000f2')); end loop; end $$;
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f2')$q$, 'rate_limited');
select tt.as_user('00000000-0000-0000-0000-0000000000f3');
do $$ declare i int; begin
  for i in 1..10 loop perform public.claim_call_join((select id from tc where k = 'call1')); end loop;
  assert public.claim_call_join((select id from tc where k = 'call1'))->>'code' = 'rate_limited', 'repeated failed joins are limited';
end $$;
reset role;
update public.calls set created_at = created_at - interval '1 day' where initiated_by = '00000000-0000-0000-0000-0000000000f1';

-- The kill switch.
update public.call_settings set calls_enabled = false where id;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
select tt.expect_error($q$select public.start_call('00000000-0000-0000-0000-0000000000f2')$q$, 'calls_disabled');
reset role;
update public.call_settings set calls_enabled = true where id;
set role authenticated;

-- A block during a call: no more joins, and the call disappears for both.
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid; begin c := public.start_call('00000000-0000-0000-0000-0000000000f2'); insert into tc values ('call5', c); end $$;
select tt.as_user('00000000-0000-0000-0000-0000000000f2');
select public.respond_call_invite((select id from tc where k = 'call5'), true);
select public.block_user('00000000-0000-0000-0000-0000000000f1');
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid := (select id from tc where k = 'call5'); begin
  assert not (public.claim_call_join(c)->>'ok')::boolean, 'blocked: no join';
  reset role; assert (select status from public.calls where id = c) = 'ended', 'a block ends the call'; set role authenticated;
  assert (select count(*) from public.calls where id = c) = 0, 'blocked: hidden';
  assert (select count(*) from public.list_call_history() where call_id = c) = 0, 'blocked: not in history';
end $$;
select tt.expect_error($q$select public.get_call((select id from tc where k = 'call5'))$q$, 'call_unavailable');

-- Deleting an account mid-call ends the call for the other person.
select tt.as_user('00000000-0000-0000-0000-0000000000f4');
select public.respond_connection('00000000-0000-0000-0000-0000000000f1', true);
select tt.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ declare c uuid; begin c := public.start_call('00000000-0000-0000-0000-0000000000f4'); insert into tc values ('call6', c); end $$;
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f4';
do $$ begin
  assert (select end_reason from public.calls where id = (select id from tc where k = 'call6')) = 'account_gone', 'a deleted callee ends the call';
  assert (select count(*) from public.call_participants where call_id = (select id from tc where k = 'call6')) = 1, 'only the caller''s row is left';
end $$;
do $$
declare f2 uuid := '00000000-0000-0000-0000-0000000000f2';
  k1 text := 'call:' || (select id from tc where k = 'call1'); k2 text := 'call:' || (select id from tc where k = 'call2');
  k3 text := 'call:' || (select id from tc where k = 'call3'); k4 text := 'call:' || (select id from tc where k = 'call4');
begin
  assert (select count(*) from public.notifications where user_id = f2 and type = 'call_incoming') = 0, 'answered, declined or missed rings leave the bell';
  assert not exists (select 1 from public.notifications where user_id = f2 and dedupe_key in (k1 || ':missed', k2 || ':missed')), 'answered or declined calls are not missed';
  assert (select count(*) from public.notifications where user_id = f2 and dedupe_key = k3 || ':missed' and type = 'call_missed') = 1, 'a cancelled call is a missed call';
  assert (select count(*) from public.notifications where user_id = f2 and dedupe_key = k4 || ':missed') = 1, 'an unanswered call is a missed call, once';
  assert (select data->>'call_id' from public.notifications where user_id = f2 and dedupe_key = k4 || ':missed') = (select id from tc where k = 'call4')::text, 'it points at the call';
end $$;
do $$ begin
  assert not has_table_privilege('anon', 'public.calls', 'select') and not has_table_privilege('anon', 'public.call_participants', 'select'), 'signed-out visitors see no calls';
  assert not has_function_privilege('anon', 'public.start_call(uuid)', 'execute') and not has_function_privilege('anon', 'public.claim_call_join(uuid)', 'execute'), 'or start or join one';
  assert not has_function_privilege('authenticated', 'public.expire_stale_calls()', 'execute') and not has_function_privilege('authenticated', 'public.finish_call(uuid, text)', 'execute'), 'internal call helpers stay internal';
end $$;

-- ============ learning path: topic calls, five assessors, 80% cumulative (docs/LEARNING_PATH.md) ============
reset role;
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000aa' || lpad(g::text, 2, '0'))::uuid, 'path' || g || '@test.com' from generate_series(1, 9) g;
set role authenticated;
-- aa01 learns Spanish from A1; aa02..aa07 are Spanish natives; aa08 is a Spanish learner who passed only A1; aa09 is new and adult.
select tt.as_user('00000000-0000-0000-0000-00000000aa01'); select public.set_language_profile('eng', 'spa', 'A1'); select public.save_profile('pathlearner', 'PL', '', 'Europe/London', false, null, null);
do $$ declare g int; begin for g in 2..7 loop
  perform tt.as_user(('00000000-0000-0000-0000-00000000aa' || lpad(g::text, 2, '0'))::uuid);
  perform public.set_language_profile('spa', null, null); perform public.save_profile('pathnative' || g, 'PN' || g, '', 'Europe/Madrid', false, null, null);
end loop; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000aa08'); select public.set_language_profile('eng', 'spa', 'A1'); select public.save_profile('pathpeer', 'PP', '', 'Europe/London', false, null, null);
reset role;
select tt.pass_topics('00000000-0000-0000-0000-00000000aa08', 'spa', 4);
-- An accepted chat with each of them: calls need one.
insert into public.conversations (id, direct_key) select ('00000000-0000-0000-0000-00000000ab' || lpad(g::text, 2, '0'))::uuid, 'path:' || g from generate_series(2, 8) g;
insert into public.conversation_members (conversation_id, user_id)
  select ('00000000-0000-0000-0000-00000000ab' || lpad(g::text, 2, '0'))::uuid, u from generate_series(2, 8) g,
    lateral (values ('00000000-0000-0000-0000-00000000aa01'::uuid), (('00000000-0000-0000-0000-00000000aa' || lpad(g::text, 2, '0'))::uuid)) v(u);
create table tt.path_calls (k int primary key, call_id uuid); grant all on tt.path_calls to authenticated;
-- Both people joined the call `mins` minutes ago and it has just ended.
create or replace function tt.finish_topic_call(c uuid, mins int) returns void language plpgsql security definer set search_path = public as $$
begin
  update call_participants set invitation_status = 'accepted', presence = 'joined', joined_at = now() - make_interval(mins => mins), responded_at = now() where call_id = c;
  update calls set status = 'active', started_at = now() - make_interval(mins => mins) where id = c;
  perform public.finish_call(c, 'hung_up');
end $$;
grant execute on function tt.finish_topic_call(uuid, int) to authenticated;
set role authenticated;

select tt.as_user('00000000-0000-0000-0000-00000000aa01');
do $$ declare p jsonb := public.my_path(); begin
  assert p->>'current_band' = 'A1' and p->>'verified_level' is null, 'an A1 path starts at A1: ' || p::text;
  assert jsonb_array_length(p->'levels') = 6, 'six levels';
  assert (select (x->>'topics')::int from jsonb_array_elements(p->'levels') x where x->>'band' = 'A1') >= 10, 'many topics per level';
  assert (p->'settings'->>'partners_needed')::int = 5 and (p->'settings'->>'pass_pct')::int = 80;
end $$;
do $$ begin assert (select count(*) from public.list_topic_partners()) = 6, 'the six natives can assess; a peer at the same level cannot'; end $$;
select tt.expect_error($q$select public.start_topic_call('00000000-0000-0000-0000-00000000aa08')$q$, 'partner_not_eligible');
-- Any topic of my level, never one from another level.
select tt.expect_error($q$select public.start_topic_call('00000000-0000-0000-0000-00000000aa02', 9)$q$, 'topic_not_at_level');
-- A call that's too short can't be assessed.
do $$ begin insert into tt.path_calls values (0, public.start_topic_call('00000000-0000-0000-0000-00000000aa02')); end $$;
select tt.finish_topic_call((select call_id from tt.path_calls where k = 0), 4);
select tt.as_user('00000000-0000-0000-0000-00000000aa02');
select tt.expect_error($q$select public.submit_topic_assessment((select call_id from tt.path_calls where k = 0), 5, 5, 5, 5, 5)$q$, 'assessment_too_short');
do $$ begin assert (public.get_topic_call((select call_id from tt.path_calls where k = 0))->>'assess_blocker') = 'too_short'; end $$;
-- Five partners score 76% each: five people, but under 80%.
do $$ declare g int; c uuid; begin for g in 2..6 loop
  perform tt.as_user('00000000-0000-0000-0000-00000000aa01');
  c := public.start_topic_call(('00000000-0000-0000-0000-00000000aa' || lpad(g::text, 2, '0'))::uuid);
  insert into tt.path_calls values (g, c);
  perform tt.finish_topic_call(c, 12);
  perform tt.as_user(('00000000-0000-0000-0000-00000000aa' || lpad(g::text, 2, '0'))::uuid);
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'topic_assess_due'), 'the partner is asked to assess';
  perform public.submit_topic_assessment(c, 4, 4, 4, 4, 3, 'Bien hecho');
end loop; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000aa02');
select tt.expect_error($q$select public.submit_topic_assessment((select call_id from tt.path_calls where k = 2), 5, 5, 5, 5, 5)$q$, 'assessment_already_assessed');
select tt.expect_error($q$select public.submit_topic_assessment((select call_id from tt.path_calls where k = 3), 5, 5, 5, 5, 5)$q$, 'assessment_not_partner');
select tt.as_user('00000000-0000-0000-0000-00000000aa01');
select tt.expect_error($q$select public.start_topic_call('00000000-0000-0000-0000-00000000aa02')$q$, 'partner_already_assessed');
select tt.expect_error($q$select public.submit_topic_assessment((select call_id from tt.path_calls where k = 2), 5, 5, 5, 5, 5)$q$, 'assessment_not_partner');
select tt.expect_error($q$insert into public.topic_assessments (learner_id, assessor_id, language_id, topic_no, basis, fluency, vocabulary, grammar, pronunciation, interaction) values (auth.uid(), '00000000-0000-0000-0000-00000000aa02', 'spa', 1, 'native', 5,5,5,5,5)$q$, 'permission denied');
do $$ declare p jsonb := public.my_path(); begin
  assert p->>'current_band' = 'A1', 'five people at 76% do not pass: ' || p::text;
  assert (p->'current'->>'counting')::int = 5 and (p->'current'->>'score_pct')::numeric = 76;
  assert (p->'current'->'criteria'->>'interaction')::numeric = 3;
  assert jsonb_array_length(p->'current'->'comments') = 5 and not (p->'current'->'comments'->0 ? 'assessor_id'), 'comments without names';
end $$;
-- A sixth partner, on a different A1 topic, at 100% lifts the cumulative average to 80%: A1 passed, A2 opens.
do $$ declare c uuid; begin
  c := public.start_topic_call('00000000-0000-0000-0000-00000000aa07', 26); insert into tt.path_calls values (7, c);
  assert (public.get_topic_call(c)->>'topic')::int = 26 and jsonb_array_length(public.get_topic_call(c)->'ideas') > 0, 'the chosen topic, with ideas';
  perform tt.finish_topic_call(c, 15);
  perform tt.as_user('00000000-0000-0000-0000-00000000aa07');
  perform public.submit_topic_assessment(c, 5, 5, 5, 5, 5, null);
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000aa01');
do $$ declare p jsonb := public.my_path(); begin
  assert p->>'current_band' = 'A2', 'cumulative 80% passes: ' || p::text;
  assert p->>'verified_level' = 'A1';
  assert (select score_pct from public.level_progress where user_id = auth.uid() and language_id = 'spa' and band = 'A1') = 80;
  assert (public.get_topic_call((select call_id from tt.path_calls where k = 7))->>'score_pct')::int = 100, 'the learner sees the call''s score';
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'topic_passed'), 'told about the pass';
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('authenticated', 'public.sweep_settling_levels()', 'execute');
  assert not has_function_privilege('anon', 'public.my_path()', 'execute');
  assert not has_function_privilege('authenticated', 'public.evaluate_band(uuid, text, text)', 'execute');
end $$;

-- ============ connections, call votes, home pulse ============
set role authenticated;
-- aa02 and aa08 have never chatted: no call until they connect.
select tt.as_user('00000000-0000-0000-0000-00000000aa02');
do $$ declare s record; begin
  select * into s from public.person_status(array['00000000-0000-0000-0000-00000000aa08'::uuid]);
  assert s.connection = 'none' and not s.can_call, 'strangers can''t call: ' || s::text;
  assert public.request_connection('00000000-0000-0000-0000-00000000aa08') = 'pending';
  select * into s from public.person_status(array['00000000-0000-0000-0000-00000000aa08'::uuid]);
  assert s.connection = 'outgoing' and not s.can_call;
end $$;
select tt.expect_error($q$select public.request_connection(auth.uid())$q$, 'cannot_connect_self');
select tt.as_user('00000000-0000-0000-0000-00000000aa08');
do $$ declare s record; begin
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'connection_request'), 'asked';
  assert (select count(*) from public.list_connection_requests()) = 1;
  select * into s from public.person_status(array['00000000-0000-0000-0000-00000000aa02'::uuid]);
  assert s.connection = 'incoming';
  perform public.respond_connection('00000000-0000-0000-0000-00000000aa02', true);
  select * into s from public.person_status(array['00000000-0000-0000-0000-00000000aa02'::uuid]);
  assert s.connection = 'connected' and s.can_call and not s.in_call, 'connected people can call: ' || s::text;
  assert exists (select 1 from public.list_connections() c where c.id = '00000000-0000-0000-0000-00000000aa02');
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000aa02');
do $$ begin
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'connection_accepted'), 'told it was accepted';
  perform public.remove_connection('00000000-0000-0000-0000-00000000aa08');
  assert (select connection from public.person_status(array['00000000-0000-0000-0000-00000000aa08'::uuid])) = 'none';
end $$;
-- Asking someone who already asked me connects at once.
select tt.as_user('00000000-0000-0000-0000-00000000aa03'); select public.request_connection('00000000-0000-0000-0000-00000000aa08');
select tt.as_user('00000000-0000-0000-0000-00000000aa08');
do $$ begin assert public.request_connection('00000000-0000-0000-0000-00000000aa03') = 'connected', 'mutual asks connect'; end $$;
select tt.expect_error($q$insert into public.connections (requester_id, addressee_id) values (auth.uid(), '00000000-0000-0000-0000-00000000aa04')$q$, 'permission denied');
-- A block ends the connection.
select public.block_user('00000000-0000-0000-0000-00000000aa03');
do $$ begin assert not exists (select 1 from public.connections where '00000000-0000-0000-0000-00000000aa03' in (requester_id, addressee_id) and '00000000-0000-0000-0000-00000000aa08' in (requester_id, addressee_id)); end $$;

-- Votes: only after a call both joined, one per person and kept once given; profiles show a count of good calls.
select tt.as_user('00000000-0000-0000-0000-00000000aa01');
select tt.expect_error($q$select public.vote_call((select call_id from tt.path_calls where k = 7), 'meh')$q$, 'invalid_input');
select public.vote_call((select call_id from tt.path_calls where k = 7), 'good');
select tt.expect_error($q$select public.vote_call((select call_id from tt.path_calls where k = 7), 'no_connect')$q$, 'call_already_rated');
do $$ begin
  assert public.my_call_vote((select call_id from tt.path_calls where k = 7)) = 'good';
  assert (select good_calls from public.person_status(array['00000000-0000-0000-0000-00000000aa07'::uuid])) = 1, 'one good call';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000aa05');
select tt.expect_error($q$select public.vote_call((select call_id from tt.path_calls where k = 7), 'good')$q$, 'call_unavailable');
do $$ declare h jsonb := public.home_pulse(); begin
  assert h ? 'online' and h ? 'live_calls' and jsonb_array_length(h->'languages') > 0 and jsonb_array_length(h->'popular_topics') > 0, 'home pulse: ' || h::text;
  assert not (h::text like '%00000000-0000-0000-0000-00000000aa%'), 'no one is named';
end $$;
-- Likes: one per person, toggled; the post carries the count.
select tt.as_user('00000000-0000-0000-0000-00000000aa01');
do $$ declare p uuid; n int; begin
  select id, like_count into p, n from public.contribution_posts limit 1;
  assert p is not null, 'a post to like';
  assert public.toggle_post_like(p), 'liked';
  assert (select like_count from public.contribution_posts where id = p) = n + 1, 'counted';
  assert exists (select 1 from public.post_likes where post_id = p), 'I see my own like';
  assert not public.toggle_post_like(p), 'unliked';
  assert (select like_count from public.contribution_posts where id = p) = n, 'uncounted';
end $$;
select tt.expect_error($q$update public.contribution_posts set like_count = 999 where true$q$, 'permission denied');
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.home_pulse()', 'execute');
  assert not has_function_privilege('authenticated', 'public.is_connected(uuid, uuid)', 'execute');
end $$;

-- ============ age: minimum 12, a guardian for 12 to 15, separation from adults ============
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ac01', 'kid1@test.com'), ('00000000-0000-0000-0000-00000000ac02', 'kid2@test.com'),
  ('00000000-0000-0000-0000-00000000ac03', 'grown@test.com'), ('00000000-0000-0000-0000-00000000ac04', 'tiny@test.com');
-- They sign up without a date of birth, as the app does.
select set_config('app.bypass_protect', 'on', false);
update public.profiles set birth_date = null where id in ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-00000000ac04');
select set_config('app.bypass_protect', 'off', false);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000ac04');
do $$ begin assert public.my_guardian_status()->>'gate' = 'birth_date_required'; end $$;
select tt.expect_error($q$select public.set_birth_date((current_date - interval '14 years')::date, null)$q$, 'minor_rules_required');
select tt.expect_error($q$select public.set_birth_date((current_date - interval '14 years')::date, '99')$q$, 'minor_rules_required');
select tt.expect_error($q$select public.set_birth_date((current_date - interval '11 years')::date, '1')$q$, 'too_young');
do $$ begin assert (select birth_date is null from public.profiles where id = auth.uid()), 'nothing stored for an under-12'; end $$;
select tt.expect_error($q$select public.set_birth_date((current_date + 1), '1')$q$, 'invalid_birth_date');
select tt.expect_error($q$update public.profiles set birth_date = '1990-01-01' where id = auth.uid()$q$, 'permission denied');
select tt.as_user('00000000-0000-0000-0000-00000000ac01');
select public.set_birth_date((current_date - interval '14 years')::date, '1');
select tt.expect_error($q$select public.set_birth_date('1990-01-01', '1')$q$, 'birth_date_locked');
do $$ begin assert exists (select 1 from public.consents where user_id = auth.uid() and kind = 'minor_rules' and version = '1'), 'the rules about minors are on record'; end $$;
select public.set_language_profile('vie', 'eng', 'A1'); select public.save_profile('kidone', 'Kid1', '', 'Asia/Ho_Chi_Minh', false, null, null);
do $$ declare g jsonb := public.my_guardian_status(); begin
  assert g->>'gate' = 'guardian_pending' and (g->>'minor')::boolean and (g->>'age')::int = 14, 'a 14-year-old waits for a guardian: ' || g::text;
  assert (select onboarding_done from public.profiles where id = auth.uid()), 'setup still completes';
end $$;
select tt.expect_error($q$select public.record_consent('guardian', '1')$q$, 'invalid_consent_kind');
-- The request gate: while waiting, only setup paths get through.
do $$ begin
  perform set_config('request.path', '/rpc/get_my_profile', true); perform public.check_request();
  perform set_config('request.path', '/rpc/send_message', true);
  begin perform public.check_request(); assert false, 'send_message should be refused';
  exception when others then assert sqlerrm = 'guardian_pending', 'refused as guardian_pending, got ' || sqlerrm; end;
  perform set_config('request.path', '', true);
end $$;
reset role;
create temp table kid_token as select public.svc_guardian_request('00000000-0000-0000-0000-00000000ac01', 'Mai Nguyen', 'mother', 'mai@test.com') as r;
do $$ begin
  assert (select status from public.guardian_requests where child_id = '00000000-0000-0000-0000-00000000ac01') = 'pending';
  assert (select token_hash <> (select r->>'token' from kid_token) from public.guardian_requests where child_id = '00000000-0000-0000-0000-00000000ac01'), 'only a hash is stored';
end $$;
select tt.expect_error($q$select public.svc_guardian_request('00000000-0000-0000-0000-00000000ac01', 'X', 'mother', 'other@test.com')$q$, 'guardian_name_required');
select tt.expect_error($q$select public.svc_guardian_request('00000000-0000-0000-0000-00000000ac01', 'Mai Nguyen', 'mother', 'kid1@test.com')$q$, 'guardian_email_is_yours');
select tt.expect_error($q$select public.svc_guardian_decide((select r->>'token' from kid_token), 'confirm', 'Mai Nguyen', false)$q$, 'guardian_must_be_adult');
select public.svc_guardian_decide((select r->>'token' from kid_token), 'confirm', 'Mai Nguyen', true);
do $$ begin
  assert public.age_gate('00000000-0000-0000-0000-00000000ac01') is null, 'the guardian agreed: open';
  assert exists (select 1 from public.consents where user_id = '00000000-0000-0000-0000-00000000ac01' and kind = 'guardian');
  assert exists (select 1 from public.consent_ledger where user_id = '00000000-0000-0000-0000-00000000ac01' and kind = 'guardian_identity' and email_hash = public.email_hash('mai@test.com')), 'proof names the guardian by hash';
  assert (public.svc_guardian_view((select r->>'token' from kid_token))->>'status') = 'confirmed';
  assert not has_function_privilege('authenticated', 'public.svc_guardian_decide(text, text, text, boolean)', 'execute'), 'only the edge function decides';
end $$;
-- A second minor (confirmed) and an adult.
select set_config('app.bypass_protect', 'on', false);
update public.profiles set birth_date = current_date - interval '13 years', guardian_status = 'confirmed' where id = '00000000-0000-0000-0000-00000000ac02';
select set_config('app.bypass_protect', 'off', false);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000ac02'); select public.set_language_profile('eng', 'vie', 'A1'); select public.save_profile('kidtwo', 'Kid2', '', 'Europe/London', false, null, null);
select tt.as_user('00000000-0000-0000-0000-00000000ac03'); select public.set_language_profile('eng', 'vie', 'A1'); select public.save_profile('grownup', 'Grown', '', 'Europe/London', false, null, null);
-- Kid1 follows the adult; the adult still can't message them. Only once kid1 asks to be partners and the adult accepts.
select tt.as_user('00000000-0000-0000-0000-00000000ac01'); select public.follow_user('00000000-0000-0000-0000-00000000ac03');
select tt.as_user('00000000-0000-0000-0000-00000000ac03');
select tt.expect_error($q$select public.start_conversation('00000000-0000-0000-0000-00000000ac01')$q$, 'not_connected');
select tt.as_user('00000000-0000-0000-0000-00000000ac01'); select public.request_connection('00000000-0000-0000-0000-00000000ac03');
select tt.as_user('00000000-0000-0000-0000-00000000ac03'); select public.respond_connection('00000000-0000-0000-0000-00000000ac01', true);
do $$ declare c uuid := public.start_conversation('00000000-0000-0000-0000-00000000ac01'); begin
  assert (select status from public.conversation_members where conversation_id = c and user_id = '00000000-0000-0000-0000-00000000ac01') = 'active', 'the minor chose the partnership, so the chat is open';
  assert not exists (select 1 from public.search_people('kid') s where s.username in ('kidone', 'kidtwo')), 'adults do not find minors';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000ac01');
select public.respond_message_request((select conversation_id from public.conversation_members where user_id = auth.uid() limit 1), true);
do $$ begin
  assert exists (select 1 from public.search_people('grown') s where s.username = 'grownup'), 'minors can find adults';
  assert exists (select 1 from public.search_people('kidtwo') s), 'minors find each other';
end $$;
-- A minor may call an adult they talk to (so adults can assess them), but only with sound.
do $$ declare c uuid; j jsonb; begin
  assert public.call_voice_only_with('00000000-0000-0000-0000-00000000ac03'), 'a minor''s calls are voice only';
  c := public.start_call('00000000-0000-0000-0000-00000000ac03');
  j := public.claim_call_join(c);
  assert (j->>'ok')::boolean and (j->>'voice_only')::boolean, 'the media token is told: no camera ' || j::text;
  perform public.leave_call(c);
  perform tt.as_user('00000000-0000-0000-0000-00000000ac03');
  assert public.call_voice_only_with('00000000-0000-0000-0000-00000000ac01'), 'the adult''s side is voice only too';
  assert not public.call_voice_only_with('00000000-0000-0000-0000-00000000ac02'), 'no answer about someone you can''t call';
  perform tt.as_user('00000000-0000-0000-0000-00000000ac01');
end $$;
select tt.connect('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ac02');
do $$ declare c uuid := public.start_conversation('00000000-0000-0000-0000-00000000ac02'); begin
  perform tt.as_user('00000000-0000-0000-0000-00000000ac02');
  perform public.respond_message_request(c, true);
  perform tt.as_user('00000000-0000-0000-0000-00000000ac01');
  perform public.leave_call(public.start_call('00000000-0000-0000-0000-00000000ac02'));
end $$;
-- Withdrawal closes it again, and hands the account to the edge function for deletion.
reset role;
do $$ declare v jsonb := public.svc_guardian_decide((select r->>'token' from kid_token), 'withdraw'); begin
  assert v->>'delete_user' = '00000000-0000-0000-0000-00000000ac01' and v->>'status' = 'withdrawn', 'withdrawal deletes the account: ' || v::text;
end $$;
do $$ begin
  assert public.age_gate('00000000-0000-0000-0000-00000000ac01') = 'guardian_declined';
  assert not exists (select 1 from public.consents where user_id = '00000000-0000-0000-0000-00000000ac01' and kind = 'guardian');
  assert not public.can_call('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ac02');
end $$;
select tt.expect_error($q$select public.svc_guardian_request('00000000-0000-0000-0000-00000000ac01', 'Mai Nguyen', 'mother', 'mai2@test.com')$q$, 'guardian_declined');
-- A refusal: the account is handed over for deletion, and the refusal is on the ledger under the guardian's email.
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000ac04');
select public.set_birth_date((current_date - interval '13 years')::date, '1');
reset role;
create temp table tiny_token as select public.svc_guardian_request('00000000-0000-0000-0000-00000000ac04', 'Lan Tran', 'father', 'lan@test.com') as r;
do $$ declare v jsonb := public.svc_guardian_decide((select r->>'token' from tiny_token), 'decline'); begin
  assert v->>'delete_user' = '00000000-0000-0000-0000-00000000ac04' and v->>'status' = 'declined', 'a refusal deletes the account: ' || v::text;
  assert public.age_gate('00000000-0000-0000-0000-00000000ac04') = 'guardian_declined', 'shut until it is gone';
  assert exists (select 1 from public.consent_ledger where user_id = '00000000-0000-0000-0000-00000000ac04' and event = 'ended' and kind = 'guardian_identity' and email_hash = public.email_hash('lan@test.com')), 'the refusal is on record';
end $$;
reset role;
select 'ALL APP-FLOW CHECKS PASSED' as result;
