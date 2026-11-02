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
select tt.expect_error($q$select public.set_language_profile('vie','swh','B1')$q$, 'level_must_be_earned');   -- a level is never raised by hand
select public.set_language_profile('vie', 'swh', 'A1');                 -- lowering is free
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

-- ============ 5c. COMMUNITY LIBRARY + SAVED PARTNERS ============
select tt.as_user('00000000-0000-0000-0000-0000000000c3');   -- Zed: native Dutch, not learning anything
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', 'vie', 'phrase', null, null)$q$, 'not_contribution_eligible');
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', null, 'phrase', null, null)$q$, 'language_required');
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', 'nld', 'spam', null, null)$q$, 'invalid_category');
select tt.expect_error($q$select public.post_contribution('Goedemorgen', 'Good morning', 'nld', 'phrase', null, 'http://evil.example/pixel.gif')$q$, 'invalid_image');
select public.post_contribution('Goedemorgen', 'Good morning', 'nld', 'phrase', null, 'https://images.unsplash.com/photo-1?w=800');
select tt.expect_error($q$select public.set_contribution_eligibility('00000000-0000-0000-0000-0000000000a1', 'native')$q$, 'does not exist');
do $$ begin assert (select count(*) from public.contribution_posts where user_id = auth.uid()) = 1, 'the valid post is stored'; end $$;
select tt.expect_error($q$insert into public.contribution_posts (user_id, phrase, category) values (auth.uid(), 'direct', 'phrase')$q$, 'row-level security');

select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select tt.expect_error($q$select public.save_partner(auth.uid())$q$, 'cannot_save_self');
select tt.expect_error($q$insert into public.saved_partners (user_id, partner_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000c3')$q$, 'row-level security');
select public.save_partner('00000000-0000-0000-0000-0000000000b2');
do $$ begin assert (select count(*) from public.saved_partners where user_id = auth.uid()) = 1, 'partner saved'; end $$;

-- ============ 5d. LANGUAGE RULES: MATCH TIERS, POST LANGUAGE, POINTS ============
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005e5', 'sharesnative@test.com'),
  ('00000000-0000-0000-0000-0000000005f6', 'teacher@test.com'),
  ('00000000-0000-0000-0000-0000000005a7', 'student@test.com'),
  ('00000000-0000-0000-0000-0000000005a8', 'sametarget@test.com');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000005e5');
select public.set_language_profile('swh', 'fra', 'A1'); select public.save_profile('sharesnative', 'S', '', 'Africa/Nairobi', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005f6');
select public.set_language_profile('vie', null, null); select public.save_profile('teacher', 'T', '', 'Not/AZone', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005a7');
select public.set_language_profile('eng', 'swh', 'B1'); select public.save_profile('student', 'St', '', 'Europe/London', false, null, null);
select tt.as_user('00000000-0000-0000-0000-0000000005a8');
select public.set_language_profile('fra', 'vie', 'A2'); select public.save_profile('sametarget', 'Sa', '', 'Europe/Paris', false, null, null);

-- Amina is native Swahili, learning Vietnamese. A bad timezone on a profile must not break her feed.
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare kinds text[]; begin
  assert (select match_kind from public.home_feed(10, 10) where username = 'linh') = 'swap', 'native Vietnamese learning Swahili is a perfect swap';
  assert (select match_language from public.home_feed(10, 10) where username = 'linh') = 'vie', 'the swap names what they teach me';
  assert (select match_kind from public.home_feed(10, 10) where username = 'teacher') = 'native', 'native Vietnamese only: they teach me';
  assert (select match_kind from public.home_feed(10, 10) where username = 'student') = 'learning', 'learning Swahili: I teach them';
  assert (select match_language from public.home_feed(10, 10) where username = 'student') = 'swh', 'badge names the language they learn';
  assert (select match_kind from public.home_feed(10, 10) where username = 'sharesnative') = 'other', 'sharing a native language is not a match';
  assert (select match_kind from public.home_feed(10, 10) where username = 'sametarget') = 'other', 'sharing a target language is not a match';
  select array_agg(match_kind) into kinds from public.home_feed(10, 10);
  assert kinds[1:3] = array['swap', 'native', 'learning'], 'tiers come in order';
end $$;

-- A learner posts in their learning language only from B1; the native language always works.
select tt.expect_error($q$select public.post_contribution('Xin chào', null, 'vie', 'phrase', null, null)$q$, 'not_contribution_eligible');
select public.post_contribution('Habari', null, 'swh', 'phrase', null, null);
reset role; select set_config('app.bypass_protect', 'on', false);
update public.profiles set verified_level = 'B1' where id = '00000000-0000-0000-0000-0000000000a1';   -- as if earned
select set_config('app.bypass_protect', 'off', false); set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
select public.post_contribution('Xin chào', null, 'vie', 'phrase', null, null);
reset role; select set_config('app.bypass_protect', 'on', false);
update public.profiles set verified_level = null where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('app.bypass_protect', 'off', false); set role authenticated;
select tt.as_user('00000000-0000-0000-0000-0000000000a1');
-- Below B1 again: the post may keep its language, but nothing moves into that language.
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
select tt.as_user('00000000-0000-0000-0000-00000000e003');
select public.set_language_profile('fra', null, null); select public.save_profile('native2', 'N2', '', 'Europe/Paris', false, null, null);
-- Lena claims C1 in French on day one: that is allowed, and it unlocks nothing.
select tt.as_user('00000000-0000-0000-0000-00000000e001');
select public.set_language_profile('eng', 'fra', 'C1'); select public.save_profile('lena', 'Lena', '', 'Europe/London', false, null, null);
select tt.expect_error($q$select public.post_contribution('Bonjour à tous', null, 'fra', 'phrase', null, null)$q$, 'not_contribution_eligible');
select tt.expect_error($q$update public.profiles set verified_level = 'C2' where id = auth.uid()$q$, 'protected_profile_column');
select tt.expect_error($q$select public.evaluate_level(auth.uid())$q$, 'permission denied');
select tt.expect_error($q$select public.level_evidence('00000000-0000-0000-0000-0000000000a1', 'vie')$q$, 'permission denied');
select public.set_language_profile('eng', 'fra', 'B2');
select tt.expect_error($q$select public.set_language_profile('eng','fra','C1')$q$, 'level_must_be_earned');
do $$ begin assert (public.my_level_progress()->>'verified_level') is null, 'a claim verifies nothing'; end $$;

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
do $$ begin assert (public.my_level_progress()->>'verified_level') = 'A1', 'practice alone earns A1: partners new to the app do not count as reviewers'; end $$;
reset role;
update public.profiles set created_at = now() - interval '30 days' where id in ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000e003');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ declare p jsonb := public.my_level_progress(); begin
  assert (p->>'verified_level') = 'A1', 'every message corrected: still A1';
  assert (p->'evidence'->>'messages')::int = 101, 'identical messages count once';
  assert (p->'evidence'->>'partners')::int = 2, 'two native partners replied';
  assert (p->'evidence'->>'error_pct')::int = 98, 'latest 50 reviewed: 49 corrected, the one spam line was not';
end $$;
select tt.expect_error($q$select public.post_contribution('Bonjour à tous', null, 'fra', 'phrase', null, null)$q$, 'not_contribution_eligible');
-- Lena improves: 50 newer messages with no corrections. Her old errors drop out of the window.
reset role;
insert into public.messages (conversation_id, sender_id, body, language_id, created_at)
  select c1, '00000000-0000-0000-0000-00000000e001', 'phrase sans erreur ' || g, 'fra', now() - interval '30 minutes' from lena_conv, generate_series(1, 50) g;
insert into public.messages (conversation_id, sender_id, body, language_id) select c1, '00000000-0000-0000-0000-00000000e002', 'Parfait', 'fra' from lena_conv;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ declare p jsonb := public.my_level_progress(); begin
  assert (p->>'verified_level') = 'B1', 'fewer errors earn B1, not more: ' || p::text;
  assert (p->>'next_level') = 'B2';
  assert (select learning_level from public.profiles where id = auth.uid()) = 'B2', 'the claimed level is kept';
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'level_up' and data->>'level' = 'B1'), 'told about the promotion';
  assert (select count(*) from public.list_notifications() n where n.type = 'level_up' and n.data->>'level' = 'B1') = 1, 'a notification with no actor still lists';
end $$;
select public.post_contribution('Bonjour à tous', null, 'fra', 'phrase', null, null);
select public.set_language_profile('eng', 'fra', 'A1');
do $$ begin assert (select learning_level from public.profiles where id = auth.uid()) = 'B1', 'cannot go below what was earned'; end $$;

-- Helpfulness: Lena (B1) corrects native2's French. Ratings come from the message author only, after a reply.
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
update public.message_corrections set feedback = 'not_helpful' where id = (select id from lena_fix);   -- no update policy: changes nothing
do $$ begin
  assert (select feedback from public.message_corrections where id = (select id from lena_fix)) = 'helpful', 'a corrector cannot rewrite their rating';
  assert (select points_balance from public.profiles where id = auth.uid()) = 105, 'a verified B1 learner earns +5';
  assert not (public.my_level_progress()->>'rewards_paused')::boolean;
end $$;

-- One annoyed person cannot pause rewards; 3 different people with mostly negative ratings can.
reset role;
insert into public.message_corrections (message_id, corrector_id, suggested_text, status, feedback, feedback_at)
  select m.id, '00000000-0000-0000-0000-00000000e001', 'x', 'accepted', 'not_helpful', now()
  from (select id from public.messages where sender_id = '00000000-0000-0000-0000-00000000e002' limit 1) m, generate_series(1, 6);
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ begin assert not (public.my_level_progress()->>'rewards_paused')::boolean, 'all from one person: not paused'; end $$;
reset role;
insert into public.message_corrections (message_id, corrector_id, suggested_text, status, feedback, feedback_at)
  select m.id, '00000000-0000-0000-0000-00000000e001', 'x', 'accepted', 'not_helpful', now()
  from public.messages m where m.sender_id in ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000b2') and m.id in (
    (select id from public.messages where sender_id = '00000000-0000-0000-0000-00000000e003' limit 1),
    (select id from public.messages where sender_id = '00000000-0000-0000-0000-0000000000b2' limit 1));
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e001');
do $$ begin assert (public.my_level_progress()->>'rewards_paused')::boolean, '3 people, mostly negative: paused'; end $$;
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

-- Native1 has barely talked to Vera; Lena is not a French native; Vera cannot vouch for herself.
select tt.as_user('00000000-0000-0000-0000-00000000e002');
select tt.expect_error($q$select public.vouch_for('00000000-0000-0000-0000-00000000f001')$q$, 'vouch_not_enough_chat');
do $$ begin assert (public.vouch_status('00000000-0000-0000-0000-00000000f001')->>'blocker') = 'not_enough_chat'; end $$;
select tt.as_user('00000000-0000-0000-0000-00000000f003');
select tt.expect_error($q$select public.vouch_for('00000000-0000-0000-0000-00000000f001')$q$, 'vouch_not_native');
do $$ begin assert public.vouch_status('00000000-0000-0000-0000-00000000f001') is null, 'nothing offered outside my language'; end $$;
select tt.expect_error($q$insert into public.level_vouches (voucher_id, learner_id, language_id) values (auth.uid(), '00000000-0000-0000-0000-00000000f001', 'fra')$q$, 'row-level security');

reset role;
insert into public.messages (conversation_id, sender_id, body, language_id, created_at)
  select c1, '00000000-0000-0000-0000-00000000f001', 'vraie phrase numero ' || g, 'fra', now() - (g % 3) * interval '1 day' - interval '1 hour' from vera_conv, generate_series(1, 15) g;
insert into public.messages (conversation_id, sender_id, body, language_id, created_at)
  select c2, '00000000-0000-0000-0000-00000000f001', 'autre phrase numero ' || g, 'fra', now() - (g % 3) * interval '1 day' - interval '1 hour' from vera_conv, generate_series(1, 15) g;
insert into public.messages (conversation_id, sender_id, body, language_id)
  select c2, '00000000-0000-0000-0000-00000000f002', 'Merci encore ' || g, 'fra' from vera_conv, generate_series(1, 5) g;
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000e002');
select public.vouch_for('00000000-0000-0000-0000-00000000f001');
select tt.as_user('00000000-0000-0000-0000-00000000f001');
do $$ declare p jsonb := public.my_level_progress(); begin
  assert (p->>'vouches')::int = 1 and (p->>'vouches_needed')::int = 2;
  assert public.level_rank(p->>'verified_level') < public.level_rank('B1'), 'one vouch is not enough: ' || p::text;
  assert exists (select 1 from public.notifications where user_id = auth.uid() and type = 'level_vouch'), 'told about the vouch';
end $$;
select tt.as_user('00000000-0000-0000-0000-00000000f002');
select public.vouch_for('00000000-0000-0000-0000-00000000f001');
select public.vouch_for('00000000-0000-0000-0000-00000000f001');   -- twice is harmless
select tt.as_user('00000000-0000-0000-0000-00000000f001');
do $$ begin
  assert (select verified_level from public.profiles where id = auth.uid()) = 'B1', 'two vouches reach B1';
  assert public.can_correct_language(auth.uid(), 'fra'), 'and bring the rights';
  assert (select learning_level from public.profiles where id = auth.uid()) = 'C1', 'the claim stays a claim';
end $$;
-- Cards can tell the two apart.
select tt.as_user('00000000-0000-0000-0000-00000000f003');
do $$ declare l jsonb; begin
  select x into l from jsonb_array_elements(public.get_profile('vera')->'languages') x where x->>'role' = 'learning';
  assert l->>'level' = 'C1' and l->>'verified_level' = 'B1', 'a card sees claim and verified level: ' || l::text;
end $$;
-- Withdrawing does not demote; the monthly limit holds.
select tt.as_user('00000000-0000-0000-0000-00000000f002');
select public.withdraw_vouch('00000000-0000-0000-0000-00000000f001');
reset role;
do $$ begin assert (select verified_level from public.profiles where id = '00000000-0000-0000-0000-00000000f001') = 'B1', 'a verified level never falls'; end $$;
insert into public.level_vouches (voucher_id, learner_id, language_id) values
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000a1', 'vie'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000b2', 'swh'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000c3', 'nld');
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000f002');
select tt.expect_error($q$select public.vouch_for('00000000-0000-0000-0000-00000000f001')$q$, 'vouch_limit');

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
select tt.expect_error($q$insert into public.post_discussion (post_id, author_id, kind, body, client_key) values ((select id from dpost), auth.uid(), 'comment', 'direct', gen_random_uuid())$q$, 'row-level security');

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
  assert (select review_status from public.contribution_posts where id = (select id from dpost)) = 'disputed', 'post shows as disputed';
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
  assert p.review_status = 'disputed', 'John''s proposal is still open, so it is still disputed';
  assert (select status from public.post_discussion where id = (select id from cj)) = 'pending', 'accepting Mary does not touch John';
  assert (select points_balance from public.profiles where id = '00000000-0000-0000-0000-00000000d002') = 105, 'Mary earns +5';
end $$;
-- Now John's: it wins only because Dennis decides it, and Mary's steps aside but stays on the record.
select public.decide_correction((select id from cj), true, null);
do $$ declare p public.contribution_posts; begin
  select * into p from public.contribution_posts where id = (select id from dpost);
  assert p.current_phrase = 'Mambo vipi', 'John''s phrase is now current';
  assert p.current_translation = 'How are you doing', 'John proposed no translation: the accepted one stays';
  assert p.review_status = 'corrected';
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
select tt.as_user('00000000-0000-0000-0000-0000000000d4');
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
  assert (select count(*) from public.notifications where user_id = auth.uid() and type = 'restriction_lifted') = 1, 'told';
end $$;
select public.post_contribution('Mpya', null, 'swh', 'phrase', null, null);
-- Decisions lift it too, and an appeal granted clears the cause. A moderator's exemption does not count against them.
reset role;
update public.decision_items set due_at = now() - interval '5 days', overdue_notified_at = now() - interval '5 days' where item_id = (select id from cq);
select public.accountability_sweep();
set role authenticated;
select tt.as_user('00000000-0000-0000-0000-00000000d001');
create temp table rst as select id from public.user_restrictions where user_id = auth.uid() and lifted_at is null; grant select on rst to public;
select public.appeal_restriction((select id from rst), 'I was in hospital');
select tt.expect_error($q$select public.appeal_restriction((select id from rst), 'Again')$q$, 'already_appealed');
select tt.as_user('00000000-0000-0000-0000-00000000d002');
select tt.expect_error($q$select public.admin_accountability()$q$, 'forbidden');
select tt.expect_error($q$select public.admin_set_accountability_policy('{"deadline_hours":1}', 'x')$q$, 'forbidden');
select tt.as_user('00000000-0000-0000-0000-0000000000d4');
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
  assert jsonb_array_length(e->'contributions') >= 2 and e ? 'decisions_owed' and e ? 'activity' and e ? 'vouches_received', 'export includes the new data';
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
select tt.expect_error($q$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://direct', 'k', 'a')$q$, 'row-level security');
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
