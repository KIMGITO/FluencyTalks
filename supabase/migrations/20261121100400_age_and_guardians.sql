-- Age: the minimum age is 12. Everyone gives a full date of birth; 12 to 15 year olds also need a parent or
-- guardian's agreement before they can use the community (Vietnamese data law: a child's data needs the
-- guardian's consent). Spec: docs/LEARNING_PATH.md §Age and safeguarding.
--
-- Safeguards for under-16s, enforced here rather than in the app:
--   * until the date of birth is given, or while a guardian hasn't agreed, check_request lets through only the
--     account's own setup (age_gate_paths);
--   * nobody gives a date of birth without accepting the rules about members under 16 (set_birth_date,
--     consent kind 'minor_rules'), so every member, adult or not, has agreed to them;
--   * a call with an under-16 in it is voice only: the media token can't publish a camera (claim_call_join).
--     Under-16s may call adults, so an adult native speaker or advanced learner can assess them;
--   * an adult's first message to an under-16 is always a request they choose to accept (start_conversation);
--   * adults don't see under-16s in search, the home feed or match counts (minor_visible);
--   * a guardian who declines, or withdraws, has the child's account deleted at once (the guardian-consent function).
-- The date of birth is never shown to anyone else: the profiles column is not granted, and no function returns it
-- except to its owner.

alter table public.profiles
  add column birth_date date check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01'),
  add column guardian_status text not null default 'not_required'
    check (guardian_status in ('not_required', 'pending', 'confirmed', 'declined'));

create table public.guardian_requests (
  id uuid default gen_random_uuid() primary key,
  child_id uuid not null references public.profiles(id) on delete cascade,
  guardian_name text not null check (char_length(guardian_name) between 2 and 120),
  relationship text not null check (relationship in ('mother', 'father', 'legal_guardian', 'other_relative_guardian')),
  guardian_email text not null check (guardian_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(guardian_email) <= 254),
  guardian_email_hash text not null,
  -- Only the hash is stored; the link in the email carries the token. It also lets the guardian withdraw later.
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'withdrawn', 'superseded', 'expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  email_sent_at timestamptz,
  decided_at timestamptz,
  guardian_confirmed_adult boolean,
  decided_name text check (decided_name is null or char_length(decided_name) between 2 and 120)
);
alter table public.guardian_requests enable row level security;
create index guardian_requests_child_idx on public.guardian_requests (child_id, requested_at desc);

alter table public.consents drop constraint consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('terms', 'privacy', 'age_18', 'age', 'guardian', 'minor_rules'));

-- The wording is what the member ticks, word for word (src/lib/legalVersions.ts, checked by tests/unit/legalWording.test.ts).
insert into public.consent_documents (kind, version, wording, document_text) values
  ('age', '1', $w$My date of birth is correct and I am 12 or older. If I am under 16, I understand a parent or guardian must agree before I can use The Fluency Talks, and that if they refuse, my account and its data are deleted at once.$w$, null),
  ('minor_rules', '1', $w$I understand that members aged 12 to 15 use The Fluency Talks, and I agree to these rules. Calls with a member under 16 are voice only, with no camera. I will never ask a member under 16 for photos, their address, school, phone number or social media, never ask to meet them, and never move a conversation with them off The Fluency Talks. I will never send them, or ask them for, sexual, violent or other harmful content, gifts or money. Breaking these rules closes my account for good, and suspected abuse or grooming of a child is reported, with the evidence The Fluency Talks holds, to the police and the authorities responsible for protecting children. If I am under 16 and anyone makes me uncomfortable, I will stop the chat or call, use Report, and tell a parent or guardian.$w$, null),
  ('guardian', '1', $w$I am 18 or older, I am this child's parent or legal guardian, and I agree that they may use The Fluency Talks and that their personal data is processed as the Privacy Policy describes, including the protections for members under 16. I understand that they can chat with, and take voice-only calls with, members of any age, including adults who assess their speaking, and that every member has agreed to the rules about members under 16. I will supervise their use as a parent or guardian should. I can withdraw this agreement at any time from the link in this email, and their account and its data are then deleted at once.$w$, null);

-- ---------------------------------------------------------------- helpers

create function public.age_years(p_birth date) returns int language sql stable as $$
  select extract(year from age(current_date, p_birth))::int $$;

create function public.is_minor(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select birth_date > current_date - interval '16 years' from profiles where id = p_user), false) $$;

-- Under-16s are visible to other under-16s and to themselves; adults don't see them.
create function public.minor_visible(p_viewer uuid, p_other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_minor(p_other) or public.is_minor(p_viewer) $$;

-- Null when the account may use the community; otherwise why not.
create function public.age_gate(p_user uuid) returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from admin_accounts where user_id = p_user) then null
    when p.birth_date is null then 'birth_date_required'
    when p.birth_date > current_date - interval '16 years' and p.guardian_status = 'declined' then 'guardian_declined'
    when p.birth_date > current_date - interval '16 years' and p.guardian_status <> 'confirmed' then 'guardian_pending'
  end
  from profiles p where p.id = p_user $$;

-- What a gated account may still do: finish its own setup, read and leave.
create function public.age_gate_paths() returns text[] language sql immutable as $$
  select array['/', '/rpc/get_app_status', '/rpc/accept_admin_invitation', '/rpc/get_my_profile', '/rpc/set_birth_date',
               '/rpc/save_profile', '/rpc/set_language_profile', '/rpc/record_consent', '/rpc/my_guardian_status',
               '/rpc/export_my_data', '/rpc/touch_presence'] $$;

-- ---------------------------------------------------------------- what the app calls

-- Set once. A correction goes through support, so an age can't be raised to get around the safeguards.
-- p_minor_rules is the version of the rules about members under 16 the person accepted on the same screen:
-- nobody gets past the age step without them, adults included.
create function public.set_birth_date(p_birth date, p_minor_rules text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me profiles; v_age int;
begin
  perform assert_active();
  select * into me from profiles where id = auth.uid() for update;
  if p_minor_rules is null or not exists (select 1 from consent_documents where kind = 'minor_rules' and version = p_minor_rules) then
    raise exception 'minor_rules_required';
  end if;
  if p_birth is null or p_birth > current_date or p_birth < date '1900-01-01' then raise exception 'invalid_birth_date'; end if;
  if me.birth_date is not null then
    if me.birth_date = p_birth then return jsonb_build_object('age', public.age_years(p_birth), 'gate', public.age_gate(me.id)); end if;
    raise exception 'birth_date_locked';
  end if;
  v_age := public.age_years(p_birth);
  -- Nothing is stored for under-12s: the app deletes the account straight after this refusal.
  if v_age < 12 then raise exception 'too_young'; end if;
  if v_age > 110 then raise exception 'invalid_birth_date'; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set birth_date = p_birth, guardian_status = case when v_age < 16 then 'pending' else 'not_required' end where id = me.id;
  insert into consents (user_id, kind, version) values (me.id, 'minor_rules', p_minor_rules) on conflict do nothing;
  return jsonb_build_object('age', v_age, 'gate', public.age_gate(me.id));
end $$;

create function public.my_guardian_status() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me profiles; g guardian_requests;
begin
  perform assert_active();
  select * into me from profiles where id = auth.uid();
  select * into g from guardian_requests where child_id = me.id and status <> 'superseded' order by requested_at desc limit 1;
  return jsonb_build_object(
    'birth_date', me.birth_date, 'age', case when me.birth_date is not null then public.age_years(me.birth_date) end,
    'minor', public.is_minor(me.id), 'status', me.guardian_status, 'gate', public.age_gate(me.id),
    'request', case when g.id is null then null else jsonb_build_object(
      'guardian_name', g.guardian_name, 'relationship', g.relationship,
      -- Masked: enough to recognise the address, not to read it off a shared screen.
      'guardian_email', regexp_replace(g.guardian_email, '^(.).*(@.*)$', '\1•••\2'),
      'status', g.status, 'requested_at', g.requested_at, 'expires_at', g.expires_at, 'email_sent', g.email_sent_at is not null) end,
    'can_send_at', (select max(requested_at) + interval '10 minutes' from guardian_requests where child_id = me.id));
end $$;

-- ---------------------------------------------------------------- the guardian-consent edge function (service role)

-- Returns the raw token for the email. The child never sees it, so they can't agree on their own behalf.
create function public.svc_guardian_request(p_child uuid, p_name text, p_relationship text, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); v_email text := lower(btrim(coalesce(p_email, ''))); v_id uuid;
begin
  select * into me from profiles where id = p_child for update;
  if me.id is null or me.status <> 'active' then raise exception 'user_unavailable'; end if;
  if not public.is_minor(me.id) or me.guardian_status = 'confirmed' then raise exception 'guardian_not_needed'; end if;
  -- A refusal is final: the account is being deleted, so the child can't keep asking someone else.
  if me.guardian_status = 'declined' then raise exception 'guardian_declined'; end if;
  if v_email = (select lower(email) from auth.users where id = me.id) then raise exception 'guardian_email_is_yours'; end if;
  if p_relationship not in ('mother', 'father', 'legal_guardian', 'other_relative_guardian') then raise exception 'invalid_relationship'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'guardian_name_required'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from guardian_requests where child_id = me.id and requested_at > now() - interval '10 minutes')
     or (select count(*) from guardian_requests where child_id = me.id and requested_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  update guardian_requests set status = 'superseded' where child_id = me.id and status = 'pending';
  insert into guardian_requests (child_id, guardian_name, relationship, guardian_email, guardian_email_hash, token_hash)
  values (me.id, left(btrim(p_name), 120), p_relationship, v_email, public.email_hash(v_email), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  returning id into v_id;
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set guardian_status = 'pending' where id = me.id;
  return jsonb_build_object('request_id', v_id, 'token', v_token, 'email', v_email, 'guardian_name', left(btrim(p_name), 120),
    'child_name', coalesce(me.display_name, me.username), 'child_age', public.age_years(me.birth_date));
end $$;

create function public.svc_guardian_mark_sent(p_request uuid) returns void language sql security definer set search_path = public as $$
  update guardian_requests set email_sent_at = now() where id = p_request $$;

-- What the guardian sees on the consent page. Nothing but what they need to decide.
create function public.svc_guardian_view(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare g guardian_requests; c profiles;
begin
  select * into g from guardian_requests where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if g.id is null or g.status in ('superseded') then return null; end if;
  if g.status = 'pending' and g.expires_at < now() then
    update guardian_requests set status = 'expired' where id = g.id;
    g.status := 'expired';
  end if;
  select * into c from profiles where id = g.child_id;
  return jsonb_build_object('status', g.status, 'guardian_name', g.guardian_name, 'relationship', g.relationship,
    'child_name', coalesce(c.display_name, c.username), 'child_username', c.username, 'child_age', public.age_years(c.birth_date),
    'expires_at', g.expires_at, 'decided_at', g.decided_at,
    'wording', (select wording from consent_documents where kind = 'guardian' and version = '1'), 'version', '1');
end $$;

-- p_decision: 'confirm', 'decline' (while pending) or 'withdraw' (after confirming). Proof goes to the consent ledger
-- twice: the child's consents row (keyed to the child's email) and an entry keyed to the guardian's email hash.
-- A decline or a withdrawal ends the account: the reply carries `delete_user`, and the guardian-consent function
-- deletes that account straight away (the ledger entry stays, keyed to the guardian's email hash). Until then the
-- account is shut by the request gate ('guardian_declined').
create function public.svc_guardian_decide(p_token text, p_decision text, p_name text default null, p_adult boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g guardian_requests;
begin
  select * into g from guardian_requests where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') for update;
  if g.id is null or g.status = 'superseded' then raise exception 'guardian_link_invalid'; end if;
  perform set_config('app.bypass_protect', 'on', true);
  if p_decision = 'confirm' then
    if g.status <> 'pending' then raise exception 'guardian_already_decided'; end if;
    if g.expires_at < now() then update guardian_requests set status = 'expired' where id = g.id; raise exception 'guardian_link_expired'; end if;
    if not coalesce(p_adult, false) then raise exception 'guardian_must_be_adult'; end if;
    if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'guardian_name_required'; end if;
    update guardian_requests set status = 'confirmed', decided_at = now(), guardian_confirmed_adult = true, decided_name = left(btrim(p_name), 120) where id = g.id;
    update profiles set guardian_status = 'confirmed' where id = g.child_id;
    insert into consents (user_id, kind, version) values (g.child_id, 'guardian', '1') on conflict do nothing;
    perform public.consent_ledger_append('given', g.child_id, g.guardian_email_hash, 'guardian_identity', '1', now());
  elsif p_decision = 'decline' then
    if g.status <> 'pending' then raise exception 'guardian_already_decided'; end if;
    update guardian_requests set status = 'declined', decided_at = now(), decided_name = nullif(left(btrim(coalesce(p_name, '')), 120), '') where id = g.id;
    update profiles set guardian_status = 'declined' where id = g.child_id;
    perform public.consent_ledger_append('ended', g.child_id, g.guardian_email_hash, 'guardian_identity', '1', now());
  elsif p_decision = 'withdraw' then
    if g.status <> 'confirmed' then raise exception 'guardian_not_confirmed'; end if;
    update guardian_requests set status = 'withdrawn', decided_at = now() where id = g.id;
    update profiles set guardian_status = 'declined' where id = g.child_id;
    delete from consents where user_id = g.child_id and kind = 'guardian';   -- the ledger records the end
    perform public.consent_ledger_append('ended', g.child_id, g.guardian_email_hash, 'guardian_identity', '1', now());
    perform public.finish_call(c.id, 'hung_up') from calls c join call_participants p on p.call_id = c.id
      where p.user_id = g.child_id and c.status in ('ringing', 'active');
  else
    raise exception 'invalid_decision';
  end if;
  if p_decision = 'confirm' then
    perform public.notify_event(g.child_id, null, 'guardian_decided', jsonb_build_object('decision', p_decision), 'guardian:' || g.id || ':' || p_decision, true);
    return public.svc_guardian_view(p_token);
  end if;
  -- Read before the account goes: deleting it removes this request too.
  return public.svc_guardian_view(p_token) || jsonb_build_object('status', case when p_decision = 'decline' then 'declined' else 'withdrawn' end, 'delete_user', g.child_id);
end $$;

-- A guardian's agreement can only be recorded by the guardian-consent function, never by the child.
create or replace function public.record_consent(p_kind text, p_version text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('terms', 'privacy', 'age', 'age_18') then raise exception 'invalid_consent_kind'; end if;
  if not exists (select 1 from consent_documents where kind = p_kind and version = p_version) then raise exception 'unknown_consent_version'; end if;
  insert into consents (user_id, kind, version) values (auth.uid(), p_kind, p_version) on conflict do nothing;
end $$;

-- birth_date and guardian_status change only through the functions above.
create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done
       or new.points_balance <> old.points_balance
       or new.native_language_id      is distinct from old.native_language_id
       or new.learning_language_id    is distinct from old.learning_language_id
       or new.learning_level          is distinct from old.learning_level
       or new.verified_level          is distinct from old.verified_level
       or new.level_checked_at        is distinct from old.level_checked_at
       or new.last_language_change_at is distinct from old.last_language_change_at
       or new.birth_date              is distinct from old.birth_date
       or new.guardian_status         is distinct from old.guardian_status then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- existing functions, with the age rules added

create or replace function public.check_request() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_path text := coalesce(current_setting('request.path', true), '');
  v_uid uuid; v_paused boolean := false; v_limited boolean := false; v_hits int; r record;
begin
  begin
    if auth.role() = 'service_role' then return; end if;
    v_uid := auth.uid();
    if v_path not in ('/', '/rpc/get_app_status', '/rpc/accept_admin_invitation') then
      v_paused := (select paused from app_status) and (v_uid is null or public.staff_tier(v_uid) is null);
    end if;
    if not v_paused and v_uid is not null and current_setting('transaction_read_only') = 'off' then
      for r in select path, max_hits, window_seconds from rate_limit_rules where path in ('*', v_path) order by path loop
        insert into rate_limit_counters (user_id, path, window_start)
        values (v_uid, r.path, to_timestamp(floor(extract(epoch from now()) / r.window_seconds) * r.window_seconds))
        on conflict (user_id, path, window_start) do update set hits = rate_limit_counters.hits + 1
        returning hits into v_hits;
        if v_hits > r.max_hits then v_limited := true; end if;
      end loop;
    end if;
  exception when others then
    return;
  end;
  if v_paused then raise sqlstate 'PT503' using message = 'app_paused'; end if;
  if v_limited then raise sqlstate 'PT429' using message = 'rate_limited'; end if;
  -- Until the date of birth is given, and for 12 to 15 year olds until a parent or guardian agrees, only the
  -- account's own setup works. Reads of reference tables (GET) stay open; RLS still applies to them.
  if v_uid is not null and public.age_gate(v_uid) is not null
     and v_path not in (select unnest(public.age_gate_paths()))
     and not (coalesce(current_setting('request.method', true), 'GET') in ('GET', 'HEAD') and v_path not like '/rpc/%') then
    raise sqlstate 'PT403' using message = public.age_gate(v_uid);
  end if;
end $$;

create or replace function public.can_call(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and a <> b
    and exists (select 1 from profiles where id = a and status = 'active')
    and exists (select 1 from profiles where id = b and status = 'active')
    and not exists (select 1 from admin_accounts where user_id in (a, b))
    and not public.is_blocked_between(a, b)
    -- Under-16s may call anyone, adults included, so they can be assessed; only once a guardian has agreed (the
    -- request gate covers the caller). Such a call is voice only (claim_call_join).
    and public.age_gate(a) is null and public.age_gate(b) is null
    and exists (select 1 from conversation_members x join conversation_members y on y.conversation_id = x.conversation_id
                where x.user_id = a and y.user_id = b and x.status = 'active' and y.status = 'active') $$;

-- A call with an under-16 in it carries sound only. The media token decides (no camera source), not the app.
create function public.call_is_voice_only(p_call uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from call_participants p where p.call_id = p_call and public.is_minor(p.user_id)) $$;

-- For the call screen, before a call exists: would a call with this person be voice only? Answers only about
-- someone you could call, so it can't be used to find out who is under 16.
create function public.call_voice_only_with(p_other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_minor(auth.uid()) or (public.can_call(auth.uid(), p_other) and public.is_minor(p_other)) $$;

-- As in the calls migration, plus `voice_only` for the token.
create or replace function public.claim_call_join(p_call uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare s call_settings; c calls; me call_participants; v_me uuid := auth.uid();
begin
  perform assert_active();
  perform public.expire_stale_calls();
  select * into s from call_settings;
  if not s.calls_enabled then return jsonb_build_object('ok', false, 'code', 'calls_disabled'); end if;
  if (select count(*) from call_join_failures where user_id = v_me and at > now() - interval '10 minutes') >= s.max_failed_joins then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  select * into c from calls where id = p_call for update;   -- serialises joins, so capacity holds under a race
  select * into me from call_participants where call_id = p_call and user_id = v_me;
  if c.id is null or me.id is null or me.invitation_status <> 'accepted' or me.presence = 'removed'
     or not (c.status = 'active' or (c.status = 'ringing' and me.role = 'host'))
     or exists (select 1 from call_participants o where o.call_id = p_call and o.user_id <> v_me and public.is_blocked_between(v_me, o.user_id))
     or (select count(*) from call_participants o where o.call_id = p_call and o.user_id <> v_me and o.presence in ('joining', 'joined')) >= c.max_participants then
    insert into call_join_failures (user_id) values (v_me);
    return jsonb_build_object('ok', false, 'code', 'call_unavailable');
  end if;
  update call_participants set presence = 'joining', presence_at = now(), left_at = null where id = me.id;
  update calls set last_empty_at = null where id = p_call;
  return jsonb_build_object('ok', true, 'call_id', c.id, 'room', c.provider_room, 'identity', v_me, 'ttl', s.token_ttl_seconds,
    'voice_only', public.call_is_voice_only(c.id));
end $$;

create or replace function public.start_conversation(p_target uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_key text; v_id uuid; v_status text;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_message_self'; end if;
  if not exists (select 1 from profiles where id = p_target and status = 'active') or public.is_blocked_between(auth.uid(), p_target) then raise exception 'user_unavailable'; end if;
  v_key := least(auth.uid()::text, p_target::text) || ':' || greatest(auth.uid()::text, p_target::text);
  select id into v_id from conversations where direct_key = v_key;
  if v_id is null then
    if (select count(*) from conversations where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;
    insert into conversations (direct_key, created_by) values (v_key, auth.uid()) returning id into v_id;
    -- An adult's first message to an under-16 is always a request they choose to accept, whoever follows whom.
    v_status := case when public.is_minor(p_target) and not public.is_minor(auth.uid()) then 'request' when exists (select 1 from follows where follower_id = p_target and followee_id = auth.uid() and status = 'accepted') then 'active' else 'request' end;
    insert into conversation_members (conversation_id, user_id, status) values (v_id, auth.uid(), 'active'), (v_id, p_target, v_status);
  end if;
  return v_id;
end $$;

create or replace function public.match_pool()
returns table (teachers int, learners int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from profiles p, profiles m where m.id = auth.uid() and m.learning_language_id is not null
       and p.native_language_id = m.learning_language_id and p.id <> m.id and p.status = 'active' and p.onboarding_done
       and not public.is_blocked_between(m.id, p.id) and public.minor_visible(m.id, p.id)),
    (select count(*)::int from profiles p, profiles m where m.id = auth.uid()
       and p.learning_language_id = m.native_language_id and p.id <> m.id and p.status = 'active' and p.onboarding_done
       and not public.is_blocked_between(m.id, p.id) and public.minor_visible(m.id, p.id));
$$;

create or replace function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text, last_chatted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    select me.native_language_id as native, me.learning_language_id as learning, me.timezone as tz
    from profiles me where me.id = auth.uid()
  ), chats as (
    select other.user_id as person, max(m.created_at) as last_at
    from conversation_members mem
    join conversation_members other on other.conversation_id = mem.conversation_id and other.user_id <> mem.user_id
    join messages m on m.conversation_id = mem.conversation_id
    where mem.user_id = auth.uid()
    group by other.user_id
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      public.user_languages_json(p.id) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when p.native_language_id = mine.learning and p.learning_language_id = mine.native then 'swap'
        when p.native_language_id = mine.learning then 'native'
        when p.learning_language_id = mine.native then 'learning'
        else 'other'
      end as match_kind,
      case
        when p.native_language_id = mine.learning then p.native_language_id
        when p.learning_language_id = mine.native then p.learning_language_id
      end as match_language,
      date_trunc('day', greatest(p.created_at,
        (select max(m.created_at) from messages m where m.sender_id = p.id),
        (select max(c.created_at) from contribution_posts c where c.user_id = p.id))) as active_day,
      public.tz_hours_apart(p.timezone, mine.tz) as tz_apart,
      chats.last_at as last_chatted_at
    from profiles p cross join mine left join chats on chats.person = p.id
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
      and public.minor_visible(auth.uid(), p.id)
      -- Home suggests new people and old friends. Someone you're talking to now is already in Messages.
      and (chats.last_at is null or chats.last_at < now() - interval '30 days')
  )
  -- Every column is table-qualified: plpgsql would treat a bare "id" or "languages" as the
  -- function's OUT parameter and refuse the query as ambiguous.
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language, feed.last_chatted_at
  from (
    (select c.* from candidates c where c.match_kind = 'swap'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'native'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'learning'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'other'
      order by c.active_day desc, c.tz_apart asc nulls last, c.created_at desc limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) feed
  order by array_position(array['swap', 'native', 'learning', 'other'], feed.match_kind),
    feed.active_day desc, feed.tz_apart asc nulls last, feed.created_at desc;
end $$;

create or replace function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text; v_role text; v_level text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;

  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  v_role := nullif(btrim(coalesce(p_role, '')), '');
  if v_role is not null and v_role not in ('native', 'learning') then v_role := null; end if;
  v_level := nullif(btrim(coalesce(p_level, '')), '');
  if v_level is not null and v_level not in ('A1','A2','B1','B2','C1','C2','Native') then v_level := null; end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count,
    public.user_languages_json(p.id),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and public.minor_visible(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    and ((v_lang is null and v_role is null and v_level is null)
      or exists (select 1 from user_languages ul
           join languages l on l.id = ul.language_id
           where ul.user_id = p.id
             and (v_lang is null or l.id = v_lang)
             and (v_role is null or ul.role = v_role)
             and (v_level is null or (case when ul.role = 'learning' then p.verified_level else ul.level end) = v_level)))
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

create or replace function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_country text;
begin
  perform assert_active();
  select c.code into v_country from public.countries c where c.code = upper(btrim(coalesce(p_country, '')));
  update profiles set username = lower(p_username), display_name = left(btrim(p_display_name), 60), bio = left(coalesce(p_bio, ''), 300),
    timezone = p_timezone, is_private = coalesce(p_is_private, false), avatar_url = coalesce(p_avatar_url, avatar_url),
    country_code = v_country
  where id = auth.uid();
  if exists (select 1 from profiles where id = auth.uid() and username is not null and native_language_id is not null and birth_date is not null) then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set onboarding_done = true where id = auth.uid();
  end if;
end $$;

insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('/rpc/set_birth_date', 10, 3600)
on conflict (path) do nothing;

revoke all on function
  public.age_years(date),
  public.is_minor(uuid),
  public.minor_visible(uuid, uuid),
  public.age_gate(uuid),
  public.age_gate_paths(),
  public.set_birth_date(date, text),
  public.my_guardian_status(),
  public.call_is_voice_only(uuid),
  public.call_voice_only_with(uuid),
  public.svc_guardian_request(uuid, text, text, text),
  public.svc_guardian_mark_sent(uuid),
  public.svc_guardian_view(text),
  public.svc_guardian_decide(text, text, text, boolean),
  public.record_consent(text, text)
from public, anon, authenticated, service_role;

grant execute on function
  public.set_birth_date(date, text),
  public.my_guardian_status(),
  public.call_voice_only_with(uuid),
  public.record_consent(text, text)
to authenticated, service_role;

grant execute on function
  public.age_gate(uuid),
  public.age_gate_paths(),
  public.age_years(date),
  public.is_minor(uuid),
  public.minor_visible(uuid, uuid),
  public.call_is_voice_only(uuid),
  public.svc_guardian_request(uuid, text, text, text),
  public.svc_guardian_mark_sent(uuid),
  public.svc_guardian_view(text),
  public.svc_guardian_decide(text, text, text, boolean)
to service_role;

notify pgrst, 'reload config';
