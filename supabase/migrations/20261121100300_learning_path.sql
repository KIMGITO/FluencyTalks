-- The learning path: 25 discussion topics from A1 to C2. It replaces the evidence-based levels (level_rules,
-- level_evidence, vouches). Spec: docs/LEARNING_PATH.md.
--
-- A topic is passed by holding 1:1 calls about it with at least `partners_needed` different people and being
-- assessed by each of them. The cumulative score must reach `pass_pct`. Passing unlocks the next topic. The
-- learner's verified level is the CEFR band of the highest topic they've passed, so B1+ rights now follow the path.
-- Assessors: a native speaker of the language, or someone who passed a topic at least one band higher.

-- ---------------------------------------------------------------- tables

create table public.path_settings (
  id boolean default true primary key check (id),
  partners_needed int not null default 5 check (partners_needed between 1 and 20),
  pass_pct int not null default 80 check (pass_pct between 1 and 100),
  min_call_minutes int not null default 10 check (min_call_minutes between 1 and 120),
  assess_window_days int not null default 7 check (assess_window_days between 1 and 60),
  -- From B1 up a topic gives rights, so an assessor's score counts once their account is this old. Below B1 it counts at once.
  settle_days int not null default 7 check (settle_days between 0 and 60),
  updated_at timestamptz not null default now()
);
alter table public.path_settings enable row level security;
insert into public.path_settings default values;
grant select on public.path_settings to authenticated;

create table public.path_topics (
  no int primary key check (no between 1 and 25),
  band text not null check (band in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  slug text not null unique,
  title text not null,
  summary text not null,
  prompts text[] not null check (cardinality(prompts) between 3 and 8)
);
alter table public.path_topics enable row level security;
grant select on public.path_topics to authenticated;

create table public.topic_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  language_id text not null references public.languages(id) on delete cascade,
  topic_no int not null references public.path_topics(no),
  unlocked_at timestamptz not null default now(),
  passed_at timestamptz,
  score_pct int check (score_pct between 0 and 100),
  primary key (user_id, language_id, topic_no)
);
alter table public.topic_progress enable row level security;
create index topic_progress_passed_idx on public.topic_progress (language_id, user_id) where passed_at is not null;
grant select on public.topic_progress to authenticated;

-- Which call was about which topic, and for whom. One learner per call: the person who started it.
create table public.topic_calls (
  call_id uuid primary key references public.calls(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  language_id text not null references public.languages(id) on delete cascade,
  topic_no int not null references public.path_topics(no),
  created_at timestamptz not null default now()
);
alter table public.topic_calls enable row level security;
create index topic_calls_partner_idx on public.topic_calls (partner_id, created_at desc);
create index topic_calls_learner_idx on public.topic_calls (learner_id, language_id, topic_no);

-- Five criteria scored 1 to 5. score_pct = sum × 4, so 80% means an average of 4 out of 5.
create table public.topic_assessments (
  id uuid default gen_random_uuid() primary key,
  call_id uuid references public.calls(id) on delete set null,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  assessor_id uuid not null references public.profiles(id) on delete cascade,
  language_id text not null references public.languages(id) on delete cascade,
  topic_no int not null references public.path_topics(no),
  basis text not null check (basis in ('native', 'passed')),
  fluency smallint not null check (fluency between 1 and 5),
  vocabulary smallint not null check (vocabulary between 1 and 5),
  grammar smallint not null check (grammar between 1 and 5),
  pronunciation smallint not null check (pronunciation between 1 and 5),
  interaction smallint not null check (interaction between 1 and 5),
  score_pct int generated always as ((fluency + vocabulary + grammar + pronunciation + interaction) * 4) stored,
  comment text check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  -- "Five different people": one assessment per person per topic.
  constraint topic_assessments_once unique (learner_id, language_id, topic_no, assessor_id),
  constraint topic_assessments_not_self check (learner_id <> assessor_id)
);
alter table public.topic_assessments enable row level security;
create index topic_assessments_assessor_idx on public.topic_assessments (assessor_id, created_at desc);

-- ---------------------------------------------------------------- the 25 topics
-- Members from 12 years old take the same path, often with adult partners, so every topic and prompt suits a
-- 12 to 15 year old: no politics, crime or adult themes, and no prompt asks for an address, a school or a timetable.

insert into public.path_topics (no, band, slug, title, summary, prompts) values
 (1, 'A1', 'introductions', 'Introducing yourself', 'Say who you are, which country you are from and what you do.',
  array['Tell your partner your first name and which country you are from.', 'Say what you do: study, work or something else.', 'Ask your partner three simple questions about themselves.', 'Say one thing you like and one thing you don''t.']),
 (2, 'A1', 'family-friends', 'Family and friends', 'Describe the people close to you.',
  array['Who is in your family?', 'Describe your best friend: what are they like?', 'What do you do together with your family?', 'Ask about your partner''s family.']),
 (3, 'A1', 'daily-routine', 'My day', 'Talk about your daily routine and the time.',
  array['Are you a morning person or an evening person?', 'Describe a normal weekday morning.', 'What do you like doing in the evening?', 'Compare your weekday with your weekend.']),
 (4, 'A1', 'food-drink', 'Food and drink', 'Talk about what you eat and order in a café.',
  array['What do you usually eat for breakfast?', 'What is your favourite food? Why?', 'Order a drink and a snack: your partner is the waiter.', 'Is there a food you never eat?']),
 (5, 'A2', 'towns-places', 'Towns and places', 'Describe homes and towns and give simple directions.',
  array['Describe your favourite room and what you like about it.', 'What does a good town need: shops, parks, a library?', 'Imagine a small town together, then give directions from the station to the park.', 'What would you change about towns in your country?']),
 (6, 'A2', 'shopping-money', 'Shopping and money', 'Buy things, compare prices and talk about spending.',
  array['Do you prefer shopping online or in a shop? Why?', 'Role-play: return something you bought that is broken.', 'What makes something good value?', 'If you saved up for something special, what would it be?']),
 (7, 'A2', 'free-time', 'Free time and hobbies', 'Talk about hobbies, sport and how often you do them.',
  array['What do you do in your free time?', 'How often do you do sport?', 'Describe a hobby you would like to start.', 'Make a plan with your partner for next weekend.']),
 (8, 'A2', 'travel-transport', 'Travel and transport', 'Talk about trips, transport and buying tickets.',
  array['What is the best way to travel in your country?', 'Describe a trip you took.', 'Role-play: buy a train or bus ticket.', 'Where would you like to travel next? Why?']),
 (9, 'B1', 'past-experiences', 'Memories and experiences', 'Tell stories about the past in detail.',
  array['Tell a story about a memorable day in your childhood.', 'Describe a time something went wrong and how you fixed it.', 'What is the best decision you have made?', 'Ask follow-up questions about your partner''s story.']),
 (10, 'B1', 'work-study', 'Work and study', 'Discuss studies and jobs, likes and challenges.',
  array['What is your favourite subject, or the one you use most at work? Why?', 'What is difficult about studying or working?', 'Describe your ideal job.', 'Give your partner advice about a choice they are making.']),
 (11, 'B1', 'health-wellbeing', 'Health and wellbeing', 'Talk about staying healthy and explain problems.',
  array['What do you do to stay healthy?', 'Role-play: explain a cold or a sports injury to a doctor.', 'Why do people find it hard to sleep or eat well?', 'How do you relax before a test or a busy day?']),
 (12, 'B1', 'plans-ambitions', 'Plans, hopes and ambitions', 'Talk about the future, conditions and dreams.',
  array['What are your plans for next year?', 'If you could live anywhere, where would it be?', 'What would you do with a year off?', 'What is a goal you have, and what is stopping you?']),
 (13, 'B2', 'technology', 'Technology in everyday life', 'Weigh the benefits and drawbacks of technology.',
  array['How has your phone changed the way you live?', 'At what age should people get their first smartphone?', 'Which invention could you not live without?', 'Argue for or against a screen-free day every week.']),
 (14, 'B2', 'media-news', 'Media and the news', 'Discuss where news comes from and how to judge it.',
  array['Where do you get your news?', 'How can you tell if a story is fake?', 'Summarise a recent news story for your partner.', 'How can people stay safe and kind online?']),
 (15, 'B2', 'environment', 'The environment', 'Discuss climate, responsibility and solutions.',
  array['What environmental problem worries you most?', 'Who is more responsible: governments, companies or individuals?', 'What have you changed in your own life?', 'Propose one rule your city should introduce.']),
 (16, 'B2', 'traditions', 'Traditions and customs', 'Explain and compare cultural traditions.',
  array['Explain an important celebration in your culture.', 'Which tradition would you like to keep, and which change?', 'Describe a cultural misunderstanding you have seen.', 'Compare a custom in your country and your partner''s.']),
 (17, 'B2', 'education', 'Education', 'Compare education systems and argue a point of view.',
  array['What was good and bad about your school?', 'Should university be free?', 'Is it better to learn from teachers or from the internet?', 'Design the ideal school day.']),
 (18, 'C1', 'future-of-work', 'The future of work', 'Discuss automation, careers and work-life balance.',
  array['Which jobs will disappear in twenty years?', 'Would a four-day school or work week be better?', 'How should people prepare for jobs that do not exist yet?', 'Defend a position you do not personally hold.']),
 (19, 'C1', 'science-discovery', 'Science and discovery', 'Debate how discoveries change the world and who should decide how they are used.',
  array['Which discovery has changed life the most?', 'Should we spend money exploring space or fixing problems on Earth?', 'Should robots and computers ever make decisions for people?', 'Summarise your partner''s argument and respond to it.']),
 (20, 'C1', 'globalisation-identity', 'Globalisation and identity', 'Explore how a connected world shapes who we are.',
  array['Does globalisation make cultures more alike?', 'What makes you feel part of a place?', 'Are global brands good or bad for local shops?', 'How does learning a language change your identity?']),
 (21, 'C1', 'arts-creativity', 'Arts and creativity', 'Interpret art and debate its value.',
  array['Describe a book, film or song that changed how you think.', 'Should governments fund the arts?', 'Can a machine be creative?', 'Interpret a piece of art your partner describes.']),
 (22, 'C2', 'language-persuasion', 'Language and persuasion', 'Analyse rhetoric, tone and how language shapes opinion.',
  array['Analyse an advertisement that persuaded you.', 'Is it ever fair to exaggerate to win an argument?', 'How does word choice change the meaning of the same fact?', 'Persuade your partner to change a small habit.']),
 (23, 'C2', 'rules-fairness', 'Rules and fairness', 'Debate why rules exist and what makes them fair, with nuance.',
  array['Why do schools, teams and countries need rules?', 'Is a rule always fair? Discuss one you think is not.', 'Tell the story of someone who stood up for what was right.', 'Where is the line between privacy and safety online?']),
 (24, 'C2', 'opportunity-community', 'Opportunity and community', 'Discuss chances in life and how communities help each other, in depth.',
  array['Should everyone have the same chances in life? What would make that possible?', 'How does advertising try to make young people buy things?', 'Evaluate a project that helps people in your community.', 'What would you do first if you led your town for a year?']),
 (25, 'C2', 'meaning-happiness', 'Meaning, freedom and happiness', 'Hold an open philosophical discussion.',
  array['What makes a life meaningful?', 'Are young people freer than their grandparents were?', 'Can happiness be measured?', 'Conclude by summarising what you both learned.']);

-- ---------------------------------------------------------------- remove the evidence-based levels

drop trigger if exists messages_check_level on public.messages;
drop trigger if exists contribution_posts_recheck_level on public.contribution_posts;
drop trigger if exists post_discussion_recheck_level on public.post_discussion;
drop trigger if exists post_endorsements_recheck_level on public.post_endorsements;
drop trigger if exists saved_posts_recheck_level on public.saved_posts;
drop trigger if exists message_corrections_recheck_level on public.message_corrections;
drop function public.trg_check_level();
drop function public.trg_recheck_level();
drop function public.recheck_level(uuid, text);
drop function public.my_level_progress();
drop function public.level_rule_met(jsonb, public.level_rules);
drop function public.level_evidence(uuid, text);
drop function public.vouch_for(uuid);
drop function public.withdraw_vouch(uuid);
drop function public.vouch_status(uuid);
drop function public.valid_vouches(uuid, text);
drop function public.vouches_by_standing(uuid, text);
drop function public.vouch_blocker(uuid, uuid, text);
drop table public.level_vouches;
drop table public.level_rules;
delete from public.notifications where type = 'level_vouch';

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed', 'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override', 'action_reminder', 'action_overdue', 'action_escalated', 'restriction_warning', 'restriction_applied', 'restriction_lifted', 'appeal_decided', 'correction_declined', 'correction_superseded', 'bounty_reminder', 'admin_report', 'admin_security', 'admin_appeal', 'admin_site', 'help_request', 'help_fix', 'help_thanked', 'call_incoming', 'call_missed', 'topic_assess_due', 'topic_assessed', 'topic_passed', 'guardian_decided'));

-- ---------------------------------------------------------------- helpers (internal)

create function public.topic_band(p_topic int) returns text language sql stable set search_path = public as $$
  select band from path_topics where no = p_topic $$;

-- The topic a new path starts at: the first topic of the band the learner gave at sign-up. Passing it still needs
-- five assessors, so declaring a high band gives no rights by itself.
create function public.path_start_topic(p_level text) returns int language sql stable set search_path = public as $$
  select coalesce((select min(no) from path_topics where band = coalesce(p_level, 'A1')), 1) $$;

create function public.ensure_path(p_user uuid, p_lang text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_lang is null then return; end if;
  if not exists (select 1 from topic_progress where user_id = p_user and language_id = p_lang) then
    insert into topic_progress (user_id, language_id, topic_no)
    values (p_user, p_lang, public.path_start_topic((select learning_level from profiles where id = p_user and learning_language_id = p_lang)))
    on conflict do nothing;
  end if;
end $$;

-- The topic being worked on: the lowest unlocked one not yet passed.
create function public.current_topic(p_user uuid, p_lang text) returns int language sql stable security definer set search_path = public as $$
  select min(topic_no) from topic_progress where user_id = p_user and language_id = p_lang and passed_at is null $$;

-- Why someone may assess a topic in a language: 'native', 'passed' (a topic one band or more higher), or null.
create function public.assessor_basis(p_assessor uuid, p_lang text, p_topic int) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from profiles where id = p_assessor and status = 'active' and native_language_id = p_lang) then 'native'
    when exists (select 1 from topic_progress tp join path_topics t on t.no = tp.topic_no
                 join profiles p on p.id = tp.user_id and p.status = 'active'
                 where tp.user_id = p_assessor and tp.language_id = p_lang and tp.passed_at is not null
                   and public.level_rank(t.band) > public.level_rank(public.topic_band(p_topic))) then 'passed'
  end $$;

-- Minutes both people were in the call together.
create function public.topic_call_minutes(p_call uuid) returns numeric language sql stable security definer set search_path = public as $$
  select greatest(0, extract(epoch from (
           least(coalesce(l.left_at, c.ended_at, now()), coalesce(p.left_at, c.ended_at, now()))
           - greatest(l.joined_at, p.joined_at))) / 60)
  from topic_calls tc join calls c on c.id = tc.call_id
  join call_participants l on l.call_id = c.id and l.user_id = tc.learner_id
  join call_participants p on p.call_id = c.id and p.user_id = tc.partner_id
  where tc.call_id = p_call and l.joined_at is not null and p.joined_at is not null $$;

-- Null when p_assessor may assess this call now, otherwise the reason they can't.
create function public.assessment_blocker(p_call uuid, p_assessor uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare tc topic_calls; c calls; s path_settings;
begin
  select * into s from path_settings;
  select * into tc from topic_calls where call_id = p_call;
  select * into c from calls where id = p_call;
  if tc.call_id is null or tc.partner_id is distinct from p_assessor then return 'not_partner'; end if;
  if c.status in ('ringing', 'active') then return 'call_not_ended'; end if;
  if coalesce(public.topic_call_minutes(p_call), 0) < s.min_call_minutes then return 'too_short'; end if;
  if c.ended_at < now() - make_interval(days => s.assess_window_days) then return 'window_closed'; end if;
  if exists (select 1 from topic_assessments a where a.learner_id = tc.learner_id and a.language_id = tc.language_id
             and a.topic_no = tc.topic_no and a.assessor_id = p_assessor) then return 'already_assessed'; end if;
  if public.assessor_basis(p_assessor, tc.language_id, tc.topic_no) is null then return 'not_eligible'; end if;
  return null;
end $$;

-- Which assessments count now: active assessors, and from B1 up only those whose account has settled.
create function public.topic_tally(p_user uuid, p_lang text, p_topic int)
returns table (counting int, waiting int, score_pct numeric) language sql stable security definer set search_path = public as $$
  with s as (select * from path_settings),
  a as (
    select x.assessor_id, x.score_pct,
      public.level_rank(public.topic_band(p_topic)) < public.level_rank('B1')
        or p.created_at <= now() - make_interval(days => (select settle_days from s)) as counts
    from topic_assessments x join profiles p on p.id = x.assessor_id and p.status = 'active'
    where x.learner_id = p_user and x.language_id = p_lang and x.topic_no = p_topic)
  select (count(distinct assessor_id) filter (where counts))::int,
         (count(distinct assessor_id) filter (where not counts))::int,
         round(avg(score_pct) filter (where counts), 1)
  from a $$;

-- Passing is cumulative: every counting assessment for the topic is averaged. Running it twice changes nothing.
create function public.evaluate_topic(p_user uuid, p_lang text, p_topic int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s path_settings; t record; v_passed timestamptz;
begin
  select * into s from path_settings;
  select passed_at into v_passed from topic_progress where user_id = p_user and language_id = p_lang and topic_no = p_topic for update;
  if not found or v_passed is not null then return false; end if;
  select * into t from public.topic_tally(p_user, p_lang, p_topic);
  if t.counting < s.partners_needed or coalesce(t.score_pct, 0) < s.pass_pct then return false; end if;
  update topic_progress set passed_at = now(), score_pct = round(t.score_pct) where user_id = p_user and language_id = p_lang and topic_no = p_topic;
  if p_topic < 25 then
    insert into topic_progress (user_id, language_id, topic_no) values (p_user, p_lang, p_topic + 1) on conflict do nothing;
  end if;
  perform public.notify_event(p_user, null, 'topic_passed', jsonb_build_object('topic', p_topic, 'language', p_lang, 'score', round(t.score_pct)),
    'topic:' || p_lang || ':' || p_topic || ':passed', true);
  perform public.check_level_safely(p_user);
  return true;
end $$;

-- The level is the band of the highest topic passed in the language being learned.
create or replace function public.evaluate_level(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_new text;
begin
  select * into me from profiles where id = p_user;
  if not found or me.learning_language_id is null then return null; end if;
  select t.band into v_new from topic_progress tp join path_topics t on t.no = tp.topic_no
  where tp.user_id = p_user and tp.language_id = me.learning_language_id and tp.passed_at is not null
  order by tp.topic_no desc limit 1;
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set level_checked_at = now() where id = p_user;
  if v_new is distinct from me.verified_level then
    update profiles set verified_level = v_new,
      learning_level = case when public.level_rank(v_new) > public.level_rank(learning_level) then v_new else learning_level end
    where id = p_user;
    update user_languages ul set level = p.learning_level from profiles p
    where p.id = p_user and ul.user_id = p_user and ul.role = 'learning';
    if public.level_rank(v_new) > public.level_rank(me.verified_level) then
      perform public.notify(p_user, null, 'level_up', jsonb_build_object('level', v_new, 'language', me.learning_language_id));
    end if;
  end if;
  return v_new;
end $$;

-- Assessments from new accounts start counting once they settle; this picks those up without anyone visiting.
create function public.sweep_settling_topics() returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct tp.user_id, tp.language_id, tp.topic_no from topic_progress tp
           join topic_assessments a on a.learner_id = tp.user_id and a.language_id = tp.language_id and a.topic_no = tp.topic_no
           where tp.passed_at is null limit 500 loop
    perform public.evaluate_topic(r.user_id, r.language_id, r.topic_no);
  end loop;
end $$;

-- After a topic call ends, ask the partner for their assessment (once, and only if it can count).
create function public.trg_topic_call_ended() returns trigger language plpgsql security definer set search_path = public as $$
declare tc topic_calls;
begin
  if new.status in ('ended') and old.status is distinct from new.status then
    select * into tc from topic_calls where call_id = new.id;
    if tc.call_id is not null and public.assessment_blocker(new.id, tc.partner_id) is null then
      perform public.notify_event(tc.partner_id, tc.learner_id, 'topic_assess_due',
        jsonb_build_object('call_id', new.id, 'topic', tc.topic_no, 'language', tc.language_id), 'topic-call:' || new.id || ':assess', true);
    end if;
  end if;
  return null;
end $$;
create trigger topic_call_ended after update of status on public.calls for each row execute function public.trg_topic_call_ended();

-- ---------------------------------------------------------------- what the app calls

-- My path in the language I'm learning: every topic with its state, the current topic's tally, and what I owe others.
create function public.my_path() returns jsonb language plpgsql security definer set search_path = public as $$
declare me profiles; s path_settings; v_cur int; t record; v_rated int; v_bad int;
begin
  perform assert_active();
  select * into s from path_settings;
  select * into me from profiles where id = auth.uid();
  if me.learning_language_id is not null then
    perform public.ensure_path(me.id, me.learning_language_id);
    v_cur := public.current_topic(me.id, me.learning_language_id);
    if v_cur is not null then perform public.evaluate_topic(me.id, me.learning_language_id, v_cur); end if;
    v_cur := public.current_topic(me.id, me.learning_language_id);
    if v_cur is not null then select * into t from public.topic_tally(me.id, me.learning_language_id, v_cur); end if;
    perform public.check_level_safely(me.id);
    select * into me from profiles where id = auth.uid();
  end if;
  select count(*), count(*) filter (where feedback = 'not_helpful') into v_rated, v_bad from (
    select feedback from message_corrections where corrector_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days'
    union all
    select feedback from post_discussion where author_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days') x;
  return jsonb_build_object(
    'language', me.learning_language_id,
    'verified_level', me.verified_level,
    'settings', jsonb_build_object('partners_needed', s.partners_needed, 'pass_pct', s.pass_pct, 'min_call_minutes', s.min_call_minutes,
                                   'assess_window_days', s.assess_window_days, 'settle_days', s.settle_days),
    'current_topic', v_cur,
    'topics', (select coalesce(jsonb_agg(jsonb_build_object('no', pt.no, 'band', pt.band, 'slug', pt.slug, 'title', pt.title, 'summary', pt.summary,
        'prompts', to_jsonb(pt.prompts),
        'state', case when tp.passed_at is not null then 'passed' when tp.topic_no is not null then 'open'
                      -- Below the topic this path started at: the learner placed above it at sign-up.
                      when pt.no < (select min(z.topic_no) from topic_progress z where z.user_id = me.id and z.language_id = me.learning_language_id) then 'skipped'
                      else 'locked' end,
        'passed_at', tp.passed_at, 'score_pct', tp.score_pct) order by pt.no), '[]'::jsonb)
      from path_topics pt left join topic_progress tp on tp.topic_no = pt.no and tp.user_id = me.id and tp.language_id = me.learning_language_id),
    'current', case when v_cur is null then null else jsonb_build_object(
        'topic', v_cur, 'counting', t.counting, 'waiting', t.waiting, 'score_pct', t.score_pct,
        -- Learners see what was said and the criteria averages, never who scored what: assessors stay honest.
        'criteria', (select jsonb_build_object('fluency', round(avg(fluency), 1), 'vocabulary', round(avg(vocabulary), 1), 'grammar', round(avg(grammar), 1),
                                               'pronunciation', round(avg(pronunciation), 1), 'interaction', round(avg(interaction), 1))
                     from topic_assessments where learner_id = me.id and language_id = me.learning_language_id and topic_no = v_cur),
        'comments', (select coalesce(jsonb_agg(jsonb_build_object('comment', comment, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
                     from topic_assessments where learner_id = me.id and language_id = me.learning_language_id and topic_no = v_cur and nullif(btrim(comment), '') is not null)) end,
    'owed', (select coalesce(jsonb_agg(o order by o->>'ended_at'), '[]'::jsonb) from (
        select jsonb_build_object('call_id', tc.call_id, 'topic', tc.topic_no, 'title', pt.title, 'band', pt.band, 'language', tc.language_id,
                                  'learner_id', l.id, 'learner_name', l.display_name, 'learner_username', l.username, 'learner_avatar', l.avatar_url,
                                  'ended_at', c.ended_at, 'due_at', c.ended_at + make_interval(days => s.assess_window_days)) as o
        from topic_calls tc join calls c on c.id = tc.call_id join profiles l on l.id = tc.learner_id join path_topics pt on pt.no = tc.topic_no
        where tc.partner_id = me.id and c.ended_at > now() - make_interval(days => s.assess_window_days)
          and public.assessment_blocker(tc.call_id, me.id) is null) owed),
    'rated', v_rated,
    'not_helpful', v_bad,
    'rewards_paused', not public.corrector_in_good_standing(auth.uid()),
    'contribution', jsonb_build_object(
      'posts', (select count(*) from contribution_posts where user_id = auth.uid()),
      'corrections_given', (select count(*) from post_discussion where author_id = auth.uid() and kind = 'correction') + (select count(*) from message_corrections where corrector_id = auth.uid()),
      'corrections_accepted', (select count(*) from post_discussion where author_id = auth.uid() and kind = 'correction' and status = 'accepted') + (select count(*) from message_corrections where corrector_id = auth.uid() and status = 'accepted'),
      'points', me.points_balance,
      'response', public.response_record(auth.uid())));
end $$;

-- People I can call for my current topic: an accepted chat, callable, eligible to assess, and not already counted.
create function public.list_topic_partners()
returns table (id uuid, username text, display_name text, avatar_url text, basis text)
language plpgsql security definer set search_path = public as $$
declare me profiles; v_cur int;
begin
  perform assert_active();
  select * into me from profiles where profiles.id = auth.uid();
  if me.learning_language_id is null then return; end if;
  perform public.ensure_path(me.id, me.learning_language_id);
  v_cur := public.current_topic(me.id, me.learning_language_id);
  if v_cur is null then return; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, public.assessor_basis(p.id, me.learning_language_id, v_cur)
  from profiles p
  where p.id <> me.id
    and exists (select 1 from conversation_members x join conversation_members y on y.conversation_id = x.conversation_id
                where x.user_id = me.id and y.user_id = p.id and x.status = 'active' and y.status = 'active')
    and public.can_call(me.id, p.id)
    and public.assessor_basis(p.id, me.learning_language_id, v_cur) is not null
    and not exists (select 1 from topic_assessments a where a.learner_id = me.id and a.language_id = me.learning_language_id
                    and a.topic_no = v_cur and a.assessor_id = p.id)
  order by p.display_name nulls last limit 50;
end $$;

-- Start a call about my current topic. The partner must be someone who can assess it.
create function public.start_topic_call(p_partner uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles; v_cur int; v_call uuid;
begin
  perform assert_active();
  select * into me from profiles where id = auth.uid();
  if me.learning_language_id is null then raise exception 'no_learning_language'; end if;
  perform public.ensure_path(me.id, me.learning_language_id);
  v_cur := public.current_topic(me.id, me.learning_language_id);
  if v_cur is null then raise exception 'path_complete'; end if;
  if public.assessor_basis(p_partner, me.learning_language_id, v_cur) is null then raise exception 'partner_not_eligible'; end if;
  if exists (select 1 from topic_assessments a where a.learner_id = me.id and a.language_id = me.learning_language_id
             and a.topic_no = v_cur and a.assessor_id = p_partner) then raise exception 'partner_already_assessed'; end if;
  v_call := public.start_call(p_partner);
  insert into topic_calls (call_id, learner_id, partner_id, language_id, topic_no) values (v_call, me.id, p_partner, me.learning_language_id, v_cur);
  return v_call;
end $$;

-- What a call was about, for the people in it: drives the topic card during a call and the assessment form after.
create function public.get_topic_call(p_call uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare tc topic_calls; pt path_topics;
begin
  perform assert_active();
  select * into tc from topic_calls where call_id = p_call;
  if tc.call_id is null or auth.uid() not in (tc.learner_id, tc.partner_id) then return null; end if;
  select * into pt from path_topics where no = tc.topic_no;
  return jsonb_build_object('call_id', tc.call_id, 'topic', pt.no, 'band', pt.band, 'title', pt.title, 'summary', pt.summary,
    'prompts', to_jsonb(pt.prompts), 'language', tc.language_id, 'learner_id', tc.learner_id, 'partner_id', tc.partner_id,
    'i_am', case when auth.uid() = tc.learner_id then 'learner' else 'partner' end,
    'minutes', round(coalesce(public.topic_call_minutes(p_call), 0), 1),
    'min_minutes', (select min_call_minutes from path_settings),
    'assess_blocker', case when auth.uid() = tc.partner_id then public.assessment_blocker(p_call, auth.uid()) end);
end $$;

create function public.submit_topic_assessment(p_call uuid, p_fluency int, p_vocabulary int, p_grammar int, p_pronunciation int, p_interaction int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare tc topic_calls; v_block text;
begin
  perform assert_active();
  select * into tc from topic_calls where call_id = p_call;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(tc.learner_id::text, '') || ':' || coalesce(tc.topic_no, 0), 11));
  v_block := public.assessment_blocker(p_call, auth.uid());
  if v_block is not null then raise exception 'assessment_%', v_block; end if;
  if least(p_fluency, p_vocabulary, p_grammar, p_pronunciation, p_interaction) < 1
     or greatest(p_fluency, p_vocabulary, p_grammar, p_pronunciation, p_interaction) > 5 then raise exception 'invalid_score'; end if;
  insert into topic_assessments (call_id, learner_id, assessor_id, language_id, topic_no, basis, fluency, vocabulary, grammar, pronunciation, interaction, comment)
  values (p_call, tc.learner_id, auth.uid(), tc.language_id, tc.topic_no, public.assessor_basis(auth.uid(), tc.language_id, tc.topic_no),
          p_fluency, p_vocabulary, p_grammar, p_pronunciation, p_interaction, nullif(btrim(left(coalesce(p_comment, ''), 600)), ''));
  delete from notifications where user_id = auth.uid() and dedupe_key = 'topic-call:' || p_call || ':assess';
  perform public.notify_event(tc.learner_id, null, 'topic_assessed', jsonb_build_object('topic', tc.topic_no, 'language', tc.language_id),
    'topic-call:' || p_call || ':assessed', false);
  perform public.evaluate_topic(tc.learner_id, tc.language_id, tc.topic_no);
end $$;

-- ---------------------------------------------------------------- existing data

-- Levels earned under the old rules are not carried over: from now on only the path verifies a level.
do $$ begin
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set verified_level = null where verified_level is not null;
  insert into public.topic_progress (user_id, language_id, topic_no)
  select id, learning_language_id, public.path_start_topic(learning_level) from public.profiles where learning_language_id is not null
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------- export, policies, grants

create or replace function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'translations', coalesce((select jsonb_agg(to_jsonb(t)) from translation_history t where t.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'),
    'activity', (select to_jsonb(u) - 'user_id' from user_presence u where u.user_id = auth.uid()),
    'topic_progress', coalesce((select jsonb_agg(to_jsonb(tp) - 'user_id') from topic_progress tp where tp.user_id = auth.uid()), '[]'),
    -- Scores I received, without who gave them; and the ones I gave, which are mine.
    'assessments_received', coalesce((select jsonb_agg(to_jsonb(a) - 'assessor_id' - 'learner_id' - 'call_id') from topic_assessments a where a.learner_id = auth.uid()), '[]'),
    'assessments_given', coalesce((select jsonb_agg(to_jsonb(a) - 'assessor_id') from topic_assessments a where a.assessor_id = auth.uid()), '[]'),
    'contributions', coalesce((select jsonb_agg(to_jsonb(c)) from contribution_posts c where c.user_id = auth.uid()), '[]'),
    'post_discussion', coalesce((select jsonb_agg(to_jsonb(d) - 'client_key') from post_discussion d where d.author_id = auth.uid()), '[]'),
    'decisions_owed', coalesce((select jsonb_agg(to_jsonb(i)) from decision_items i where i.user_id = auth.uid()), '[]'),
    'restrictions', coalesce((select jsonb_agg(to_jsonb(r)) from user_restrictions r where r.user_id = auth.uid()), '[]'),
    'restriction_warning', (select to_jsonb(w) from accountability_warnings w where w.user_id = auth.uid()));
end $$;

create trigger staff_refused before insert on public.topic_assessments for each row execute function public.refuse_staff_learner_action();

create policy "path settings readable" on public.path_settings for select to authenticated using (true);
create policy "topics readable" on public.path_topics for select to authenticated using (true);
create policy "read own progress" on public.topic_progress for select to authenticated using (auth.uid() = user_id);

insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('/rpc/start_topic_call', 20, 3600),
  ('/rpc/submit_topic_assessment', 30, 3600),
  ('/rpc/my_path', 120, 60)
on conflict (path) do nothing;

revoke all on function
  public.topic_band(integer),
  public.path_start_topic(text),
  public.ensure_path(uuid, text),
  public.current_topic(uuid, text),
  public.assessor_basis(uuid, text, integer),
  public.topic_call_minutes(uuid),
  public.assessment_blocker(uuid, uuid),
  public.topic_tally(uuid, text, integer),
  public.evaluate_topic(uuid, text, integer),
  public.evaluate_level(uuid),
  public.sweep_settling_topics(),
  public.trg_topic_call_ended(),
  public.my_path(),
  public.list_topic_partners(),
  public.start_topic_call(uuid),
  public.get_topic_call(uuid),
  public.submit_topic_assessment(uuid, integer, integer, integer, integer, integer, text),
  public.export_my_data()
from public, anon, authenticated, service_role;

grant execute on function
  public.my_path(),
  public.list_topic_partners(),
  public.start_topic_call(uuid),
  public.get_topic_call(uuid),
  public.submit_topic_assessment(uuid, integer, integer, integer, integer, integer, text),
  public.export_my_data()
to authenticated, service_role;

grant execute on function
  public.evaluate_level(uuid),
  public.evaluate_topic(uuid, text, integer),
  public.sweep_settling_topics()
to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-path-settle', '17 * * * *', 'select public.sweep_settling_topics()');
exception when others then
  raise notice 'pg_cron unavailable (%), settling assessments count on the learner''s next visit', sqlerrm;
end $$;
