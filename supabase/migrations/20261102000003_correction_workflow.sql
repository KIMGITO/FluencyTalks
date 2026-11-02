-- Contribution review: hierarchical corrections, decisions, accountability, notifications. NEW migration.
-- Never edit past migrations.
--
-- 1. post_discussion holds everything said about a library post. A correction (target, proposed change,
--    author, status, decision history) is a different thing from a comment (no proposal, no status), and
--    the table constraints enforce that. Parent, author, kind and proposal cannot change once written, so
--    a thread cannot be rewritten or made circular.
-- 2. The original post is never overwritten. The accepted value lives in current_phrase/current_translation.
--    Accepting supersedes only the previously accepted correction; other proposals stay open and disputed.
--    Newest does not win: only a decision changes the accepted value.
-- 3. The post's owner decides; moderators can decide once escalated and can reverse, with a reason.
-- 4. Accountability: a decision needed from the owner is a decision_items row with a deadline. Only an
--    actual decision (or withdrawal/exemption) closes it. Viewing or being online never does.
--    Reminders, then overdue, then escalation, and only then a restriction on new posts, which lifts by itself
--    once the decisions are answered. Extensions and appeals exist. Every step is audited.
-- 5. Notifications are idempotent (dedupe_key), follow the real record relationships, respect category
--    preferences and thread mutes, and never hide a decision someone is required to make.

-- ---------- Yes to both from the last round ----------
create or replace function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text; v_role text; v_level text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
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
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    -- One user_languages row has to satisfy every filter at once, and each filter also works
    -- on its own. The join to languages is what makes the id a real reference, not a string.
    and ((v_lang is null and v_role is null and v_level is null)
      or exists (select 1 from user_languages ul
           join languages l on l.id = ul.language_id
           where ul.user_id = p.id
             and (v_lang is null or l.id = v_lang)
             and (v_role is null or ul.role = v_role)
             -- Learners are found by the level they have earned, the same one their card shows.
             and (v_level is null or (case when ul.role = 'learning' then p.verified_level else ul.level end) = v_level)))
  -- Relevance first: exact handle, then handle prefix, then name prefix, then anything else.
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;


drop function if exists public.search_posts(text, text, int, int);
create function public.search_posts(p_query text default null, p_language text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, user_id uuid, language_id text, phrase text, translation text, category text, source_context text,
  unsplash_image_url text, text_align text, pinned_at timestamptz, created_at timestamptz, updated_at timestamptz, certified_at timestamptz,
  author_username text, author_name text, author_avatar text, saved boolean,
  current_phrase text, current_translation text, review_status text, open_corrections int, thread_count int, endorse_count int)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_like is null and v_lang is null then return; end if;   -- nothing to search for

  return query
  select c.id, c.user_id, c.language_id, c.phrase, c.translation, c.category, c.source_context,
    c.unsplash_image_url, c.text_align, c.pinned_at, c.created_at, c.updated_at, c.certified_at,
    a.username, a.display_name, a.avatar_url,
    exists (select 1 from saved_posts s where s.user_id = auth.uid() and s.post_id = c.id),
    c.current_phrase, c.current_translation, c.review_status, c.open_corrections, c.thread_count, c.endorse_count
  from contribution_posts c
  join profiles a on a.id = c.user_id
  where (a.status = 'active' or a.id = auth.uid())
    and not public.is_blocked_between(auth.uid(), c.user_id)
    and (v_lang is null or c.language_id = v_lang)
    and (v_like is null or c.phrase ilike v_like or c.translation ilike v_like or c.source_context ilike v_like
         or a.display_name ilike v_like or a.username ilike v_like)
  -- Relevance: the phrase itself starts with the query, then the phrase contains it, then the rest; newest first within each.
  order by case
      when v_q is null then 2
      when lower(c.phrase) like v_q || '%' then 0
      when c.phrase ilike v_like then 1
      else 2 end,
    c.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;
revoke execute on function public.search_posts(text, text, int, int) from public, anon;
grant  execute on function public.search_posts(text, text, int, int) to authenticated, service_role;

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
    'vouches_given', coalesce((select jsonb_agg(jsonb_build_object('learner_id', v.learner_id, 'language_id', v.language_id, 'created_at', v.created_at)) from level_vouches v where v.voucher_id = auth.uid()), '[]'),
    'vouches_received', coalesce((select jsonb_agg(jsonb_build_object('language_id', v.language_id, 'created_at', v.created_at)) from level_vouches v where v.learner_id = auth.uid()), '[]'),
    'contributions', coalesce((select jsonb_agg(to_jsonb(c)) from contribution_posts c where c.user_id = auth.uid()), '[]'),
    'post_discussion', coalesce((select jsonb_agg(to_jsonb(d) - 'client_key') from post_discussion d where d.author_id = auth.uid()), '[]'),
    'decisions_owed', coalesce((select jsonb_agg(to_jsonb(i)) from decision_items i where i.user_id = auth.uid()), '[]'),
    'restrictions', coalesce((select jsonb_agg(to_jsonb(r)) from user_restrictions r where r.user_id = auth.uid()), '[]'));
end $$;

-- ---------- 1. Threads ----------
alter table public.contribution_posts
  add column if not exists current_phrase text,
  add column if not exists current_translation text,
  add column if not exists accepted_item_id uuid,
  add column if not exists review_status text not null default 'unreviewed' check (review_status in ('unreviewed','confirmed','disputed','corrected')),
  add column if not exists open_corrections int not null default 0,
  add column if not exists thread_count int not null default 0,
  add column if not exists endorse_count int not null default 0;

create table public.post_discussion (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  parent_id uuid,
  depth int not null default 0 check (depth between 0 and 12),
  author_id uuid references public.profiles(id) on delete set null,   -- history outlives an account
  kind text not null check (kind in ('correction','clarification','comment')),
  body text not null check (char_length(body) between 1 and 1000),
  proposed_phrase text check (char_length(proposed_phrase) between 1 and 500),
  proposed_translation text check (char_length(proposed_translation) between 1 and 500),
  status text check (status in ('pending','accepted','declined','superseded','withdrawn','resolved')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 500),
  client_key uuid not null,   -- a repeated tap or retry sends the same key and gets the same row
  created_at timestamptz not null default now(),
  unique (id, post_id),
  unique (author_id, client_key),
  foreign key (parent_id, post_id) references public.post_discussion (id, post_id) on delete cascade,   -- a parent is always in the same post
  check (parent_id is distinct from id),
  check ((parent_id is null) = (depth = 0)),
  -- What each kind is allowed to be.
  check (kind <> 'comment' or (status is null and proposed_phrase is null and proposed_translation is null)),
  check (kind <> 'correction' or (status in ('pending','accepted','declined','superseded','withdrawn') and (proposed_phrase is not null or proposed_translation is not null))),
  check (kind <> 'clarification' or (status in ('pending','resolved','withdrawn') and proposed_phrase is null and proposed_translation is null)));
create index post_discussion_post_idx on public.post_discussion (post_id, created_at);
create index post_discussion_parent_idx on public.post_discussion (parent_id);
create index post_discussion_author_idx on public.post_discussion (author_id, created_at desc);
alter table public.contribution_posts drop constraint if exists contribution_posts_accepted_item_fkey;
alter table public.contribution_posts add constraint contribution_posts_accepted_item_fkey foreign key (accepted_item_id) references public.post_discussion(id) on delete set null;
alter table public.post_discussion enable row level security;
create policy "read discussion unless blocked" on public.post_discussion for select to authenticated
  using (not public.is_blocked_between(auth.uid(), author_id));
alter publication supabase_realtime add table public.post_discussion;

-- What was said stays as it was said. Only the outcome can move.
create function public.protect_discussion() returns trigger language plpgsql as $$
begin
  if new.post_id <> old.post_id or new.parent_id is distinct from old.parent_id or new.kind <> old.kind or new.body <> old.body
     or new.proposed_phrase is distinct from old.proposed_phrase or new.proposed_translation is distinct from old.proposed_translation
     or new.created_at <> old.created_at or new.depth <> old.depth
     or (new.author_id is distinct from old.author_id and new.author_id is not null) then
    raise exception 'discussion_is_immutable';
  end if;
  return new;
end $$;
create trigger post_discussion_protect before update on public.post_discussion for each row execute function public.protect_discussion();

-- Decision history. Append-only: nothing updates or deletes it except the post itself going away.
create table public.post_discussion_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  item_id uuid references public.post_discussion(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,   -- null: the system
  action text not null,
  from_status text, to_status text, note text,
  created_at timestamptz not null default now());
create index post_discussion_events_post_idx on public.post_discussion_events (post_id, id);
alter table public.post_discussion_events enable row level security;   -- no policies: read through get_post_thread

create table public.post_endorsements (
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id));
alter table public.post_endorsements enable row level security;

create table public.correction_agreements (
  item_id uuid not null references public.post_discussion(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id));
alter table public.correction_agreements enable row level security;

create table public.post_thread_mutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  primary key (user_id, post_id));
alter table public.post_thread_mutes enable row level security;

alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
alter table public.points_ledger add constraint points_ledger_reason_check check (reason in (
  'correction_accepted', 'bounty_posted', 'bounty_answered_accepted', 'bounty_expired_refund', 'post_correction_accepted'));

-- ---------- 2. Notifications ----------
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_user_time_idx on public.notifications (user_id, created_at desc, id);
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'level_vouch',
  'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed',
  'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override',
  'action_reminder', 'action_overdue', 'action_escalated', 'restriction_applied', 'restriction_lifted', 'appeal_decided'));
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}',
  add column if not exists accountability_exempt boolean not null default false;

create function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('post_correction','post_challenged','post_clarification','post_reply','post_endorsed','correction','correction_accepted') then 'corrections'
    when p_type in ('post_accepted','post_declined','post_withdrawn','post_superseded','post_resolved','post_reverted','post_override') then 'decisions'
    when p_type in ('action_reminder','action_overdue','action_escalated') then 'reminders'
    else 'system' end;
$$;

-- The one way workflow events reach someone. Same key, same person: one notification, however often it is retried.
-- p_required: this person has to act, so preferences and mutes do not apply.
create function public.notify_event(p_user uuid, p_actor uuid, p_type text, p_data jsonb, p_key text, p_required boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  if not p_required then
    if coalesce((select (notification_prefs->>public.notification_category(p_type))::boolean from profiles where id = p_user), true) is false then return; end if;
    if exists (select 1 from post_thread_mutes m where m.user_id = p_user and m.post_id = (p_data->>'post_id')::uuid) then return; end if;
  end if;
  if p_actor is not null and public.is_blocked_between(p_user, p_actor) then return; end if;
  insert into notifications (user_id, actor_id, type, data, dedupe_key) values (p_user, p_actor, p_type, p_data, p_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

drop function if exists public.list_notifications(int);
create function public.list_notifications(p_limit int default 30, p_before timestamptz default null, p_category text default null)
returns table (id uuid, type text, data jsonb, read_at timestamptz, created_at timestamptz, actor_id uuid, actor_username text, actor_name text, actor_avatar text, category text)
language sql stable security definer set search_path = public as $$
  select n.id, n.type, n.data, n.read_at, n.created_at, n.actor_id, p.username, p.display_name, p.avatar_url, public.notification_category(n.type)
  from notifications n left join profiles p on p.id = n.actor_id
  where n.user_id = auth.uid() and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
    and (p_before is null or n.created_at < p_before)
    and (p_category is null or public.notification_category(n.type) = p_category)
  order by n.created_at desc limit least(p_limit, 100) $$;

create function public.set_notification_prefs(p_prefs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update profiles set notification_prefs = (
    select coalesce(jsonb_object_agg(k, (p_prefs->>k)::boolean), '{}') from unnest(array['corrections','decisions','system']) k where p_prefs ? k)
  where id = auth.uid();
end $$;

create function public.set_thread_mute(p_post uuid, p_muted boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_muted then insert into post_thread_mutes (user_id, post_id) values (auth.uid(), p_post) on conflict do nothing;
  else delete from post_thread_mutes where user_id = auth.uid() and post_id = p_post; end if;
end $$;

-- ---------- 3. Accountability tables ----------
create table public.accountability_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  first_reminder_hours int not null default 48 check (first_reminder_hours > 0),
  repeat_reminder_hours int not null default 48 check (repeat_reminder_hours > 0),
  deadline_hours int not null default 168 check (deadline_hours > 0),
  escalate_after_hours int not null default 72 check (escalate_after_hours >= 0),   -- after the deadline
  restrict_after_overdue int not null default 3 check (restrict_after_overdue > 0),   -- 3 overdue decisions at once
  restrict_notice_hours int not null default 72 check (restrict_notice_hours >= 0),   -- how long the oldest of those has been known to be overdue
  extension_hours int not null default 168 check (extension_hours > 0),
  max_extensions int not null default 1 check (max_extensions >= 0),
  last_sweep_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null);
insert into public.accountability_policy (id) values (true);
alter table public.accountability_policy enable row level security;

create table public.decision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  item_id uuid not null unique references public.post_discussion(id) on delete cascade,
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  viewed_at timestamptz,        -- when they opened it. Informational: it never closes anything.
  resolved_at timestamptz,
  resolution text check (resolution in ('decided','withdrawn','exempted')),
  resolved_note text,
  reminder_count int not null default 0,
  last_reminded_at timestamptz,
  overdue_notified_at timestamptz,
  escalated_at timestamptz,
  extensions int not null default 0,
  extension_reason text,
  check ((resolved_at is null) = (resolution is null)));
create index decision_items_open_idx on public.decision_items (due_at) where resolved_at is null;
create index decision_items_user_idx on public.decision_items (user_id, created_at desc);
alter table public.decision_items enable row level security;
create policy "read own decisions" on public.decision_items for select to authenticated using (user_id = auth.uid());

create table public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'new_posts' check (kind in ('new_posts')),
  reason text not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lift_reason text);
create unique index user_restrictions_active_idx on public.user_restrictions (user_id, kind) where lifted_at is null;
alter table public.user_restrictions enable row level security;
create policy "read own restrictions" on public.user_restrictions for select to authenticated using (user_id = auth.uid());

create table public.restriction_appeals (
  id uuid primary key default gen_random_uuid(),
  restriction_id uuid not null references public.user_restrictions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'open' check (status in ('open','granted','denied')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text);
create unique index restriction_appeals_open_idx on public.restriction_appeals (restriction_id) where status = 'open';
alter table public.restriction_appeals enable row level security;
create policy "read own appeals" on public.restriction_appeals for select to authenticated using (user_id = auth.uid());

create table public.accountability_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,   -- null: the system
  target_user uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now());
alter table public.accountability_audit enable row level security;

-- ---------- 4. Internals ----------
create function public.post_snippet(p public.contribution_posts) returns text language sql immutable as $$
  select left(coalesce(p.current_phrase, p.phrase), 80);
$$;

create function public.log_discussion(p_post uuid, p_item uuid, p_action text, p_from text, p_to text, p_note text default null) returns void
language sql security definer set search_path = public as $$
  insert into post_discussion_events (post_id, item_id, actor_id, action, from_status, to_status, note)
  values (p_post, p_item, auth.uid(), p_action, p_from, p_to, p_note);
$$;

create function public.refresh_post_review(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update contribution_posts c set
    open_corrections = o.open, thread_count = o.total, endorse_count = o.endorsed,
    review_status = case when o.open > 0 then 'disputed' when c.accepted_item_id is not null then 'corrected' when o.endorsed > 0 then 'confirmed' else 'unreviewed' end
  from (select
          (select count(*)::int from post_discussion d where d.post_id = p_post and d.status = 'pending') as open,
          (select count(*)::int from post_discussion d where d.post_id = p_post) as total,
          (select count(*)::int from post_endorsements e where e.post_id = p_post) as endorsed) o
  where c.id = p_post;
$$;

-- Posting restrictions follow the overdue count: they lift as soon as it is no longer met.
create function public.reconcile_restriction(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pol public.accountability_policy; v_overdue int; v_noticed int; r public.user_restrictions; me public.profiles;
begin
  select * into pol from accountability_policy;
  select * into me from profiles where id = p_user;
  select count(*), count(*) filter (where overdue_notified_at <= now() - make_interval(hours => pol.restrict_notice_hours)) into v_overdue, v_noticed
  from decision_items where user_id = p_user and resolved_at is null and due_at <= now();
  select * into r from user_restrictions where user_id = p_user and lifted_at is null;

  if r.id is not null and (v_overdue < pol.restrict_after_overdue or me.accountability_exempt or not pol.enabled) then
    update user_restrictions set lifted_at = now(), lift_reason = 'Overdue decisions are answered' where id = r.id;
    update restriction_appeals set status = 'granted', decided_at = now(), decision_note = 'Closed: the restriction was lifted' where restriction_id = r.id and status = 'open';
    insert into accountability_audit (target_user, action, reason, ref_id) values (p_user, 'restriction_lifted', 'Overdue decisions are answered', r.id);
    perform public.notify_event(p_user, null, 'restriction_lifted', jsonb_build_object('restriction_id', r.id), 'restriction_lifted:' || r.id, true);
  elsif r.id is null and pol.enabled and not me.accountability_exempt and me.status = 'active' and v_noticed >= pol.restrict_after_overdue then
    insert into user_restrictions (user_id, reason) values (p_user, v_noticed || ' decisions on your posts are overdue') returning * into r;
    insert into accountability_audit (target_user, action, reason, ref_id) values (p_user, 'restriction_applied', r.reason, r.id);
    perform public.notify_event(p_user, null, 'restriction_applied', jsonb_build_object('restriction_id', r.id, 'overdue', v_noticed), 'restriction_applied:' || r.id, true);
  end if;
end $$;

create function public.close_decision(p_item uuid, p_resolution text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  update decision_items set resolved_at = now(), resolution = p_resolution, resolved_note = p_note
  where item_id = p_item and resolved_at is null returning user_id into v_user;
  if v_user is not null then perform public.reconcile_restriction(v_user); end if;
end $$;

-- Reminders, overdue notices, escalation, restrictions. Safe to run at any time and as often as you like:
-- each step is guarded by its own timestamp and its own dedupe key.
create function public.accountability_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare pol public.accountability_policy; i record; v_data jsonb; n int := 0; v_user uuid; v_mod uuid;
begin
  select * into pol from accountability_policy;
  update accountability_policy set last_sweep_at = now();
  if not pol.enabled then return 0; end if;
  for i in
    select d.*, p.phrase, p.current_phrase, u.accountability_exempt as exempt, u.status as owner_status, x.author_id as item_author
    from decision_items d join contribution_posts p on p.id = d.post_id join profiles u on u.id = d.user_id join post_discussion x on x.id = d.item_id
    where d.resolved_at is null
  loop
    v_data := jsonb_build_object('post_id', i.post_id, 'item_id', i.item_id, 'phrase', left(coalesce(i.current_phrase, i.phrase), 80), 'due_at', i.due_at);
    -- Before the deadline: remind, then keep reminding.
    if i.due_at > now() and not i.exempt and (
         (i.reminder_count = 0 and i.created_at <= now() - make_interval(hours => pol.first_reminder_hours))
      or (i.reminder_count > 0 and i.last_reminded_at <= now() - make_interval(hours => pol.repeat_reminder_hours))) then
      update decision_items set reminder_count = reminder_count + 1, last_reminded_at = now() where id = i.id;
      perform public.notify_event(i.user_id, null, 'action_reminder', v_data, 'reminder:' || i.id || ':' || (i.reminder_count + 1), true);
      n := n + 1;
    end if;
    -- Past the deadline: say so, to the owner and to the person waiting.
    if i.due_at <= now() and i.overdue_notified_at is null and not i.exempt then
      update decision_items set overdue_notified_at = now() where id = i.id;
      perform public.notify_event(i.user_id, null, 'action_overdue', v_data, 'overdue:' || i.id || ':' || extract(epoch from i.due_at)::bigint, true);
      perform public.notify_event(i.item_author, null, 'action_overdue', v_data || '{"waiting":true}', 'overdue_waiting:' || i.id || ':' || extract(epoch from i.due_at)::bigint);
      insert into post_discussion_events (post_id, item_id, action, note) values (i.post_id, i.item_id, 'overdue', 'The decision passed its deadline');
      n := n + 1;
    end if;
    -- Still nothing: moderators can step in. A deactivated owner goes straight here.
    if i.escalated_at is null and (i.due_at <= now() - make_interval(hours => pol.escalate_after_hours) or i.owner_status <> 'active') then
      update decision_items set escalated_at = now() where id = i.id;
      for v_mod in select id from profiles where role in ('admin','moderator') and status = 'active' and id <> i.user_id loop
        perform public.notify_event(v_mod, null, 'action_escalated', v_data, 'escalated:' || i.id);
      end loop;
      insert into post_discussion_events (post_id, item_id, action, note) values (i.post_id, i.item_id, 'escalated', 'Passed to moderators');
      n := n + 1;
    end if;
  end loop;
  for v_user in
    select distinct user_id from decision_items where resolved_at is null and due_at <= now()
    union select user_id from user_restrictions where lifted_at is null
  loop
    perform public.reconcile_restriction(v_user);
  end loop;
  return n;
end $$;

-- Runs the sweep as people use the app, so reminders work even where pg_cron is not enabled.
create function public.sweep_if_due() returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select last_sweep_at from accountability_policy), 'epoch') < now() - interval '10 minutes' then
    perform public.accountability_sweep();
  end if;
end $$;

-- Where pg_cron exists, also run on a clock. Not fatal where it does not.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-accountability-sweep', '*/15 * * * *', 'select public.accountability_sweep()');
exception when others then
  raise notice 'pg_cron unavailable (%), the sweep runs from app activity instead', sqlerrm;
end $$;

-- ---------- 5. Writing to a thread ----------
create function public.submit_discussion(p_post uuid, p_parent uuid, p_kind text, p_body text, p_phrase text default null, p_translation text default null, p_client_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  post public.contribution_posts; par public.post_discussion; v_id uuid; v_depth int := 0;
  v_body text := btrim(coalesce(p_body, '')); v_phrase text := nullif(btrim(coalesce(p_phrase, '')), ''); v_trans text := nullif(btrim(coalesce(p_translation, '')), '');
  v_base_phrase text; v_base_trans text; pol public.accountability_policy; v_data jsonb;
begin
  perform assert_active();
  if p_client_key is null then raise exception 'missing_client_key'; end if;
  select id into v_id from post_discussion where author_id = auth.uid() and client_key = p_client_key;
  if v_id is not null then return v_id; end if;   -- a repeated tap: same row, no second notification

  select * into post from contribution_posts where id = p_post for share;
  if post.id is null or public.is_blocked_between(auth.uid(), post.user_id) then raise exception 'post_not_found'; end if;
  if p_kind not in ('correction','clarification','comment') then raise exception 'invalid_kind'; end if;
  if char_length(v_body) = 0 then raise exception 'explanation_required'; end if;
  if char_length(v_body) > 1000 or char_length(v_phrase) > 500 or char_length(v_trans) > 500 then raise exception 'text_too_long'; end if;
  if (select count(*) from post_discussion where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;

  if p_parent is not null then
    select * into par from post_discussion where id = p_parent and post_id = p_post;
    if par.id is null then raise exception 'invalid_parent'; end if;
    if public.is_blocked_between(auth.uid(), par.author_id) then raise exception 'invalid_parent'; end if;
    v_depth := par.depth + 1;
    if v_depth > 12 then raise exception 'thread_too_deep'; end if;
  end if;

  if p_kind in ('correction','clarification') then
    if not public.can_correct_language(auth.uid(), post.language_id) then raise exception 'not_qualified_to_correct'; end if;
    if post.user_id = auth.uid() then raise exception 'owner_cannot_correct'; end if;
    -- A correction targets the post or another correction, never a chat comment or a closed proposal.
    if par.id is not null then
      if par.kind <> 'correction' then raise exception 'invalid_parent'; end if;
      if par.status not in ('pending','accepted') then raise exception 'parent_closed'; end if;
      if par.author_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
    end if;
  end if;

  if p_kind = 'correction' then
    v_base_phrase := coalesce(par.proposed_phrase, post.current_phrase, post.phrase);
    v_base_trans := coalesce(par.proposed_translation, post.current_translation, post.translation);
    if v_phrase is null and v_trans is null then raise exception 'proposal_required'; end if;
    if (v_phrase is null or lower(v_phrase) = lower(v_base_phrase)) and (v_trans is null or lower(v_trans) = lower(coalesce(v_base_trans, ''))) then raise exception 'no_change'; end if;
    if exists (select 1 from post_discussion d where d.post_id = p_post and d.author_id = auth.uid() and d.status = 'pending' and d.parent_id is not distinct from p_parent
               and lower(coalesce(d.proposed_phrase, '')) = lower(coalesce(v_phrase, '')) and lower(coalesce(d.proposed_translation, '')) = lower(coalesce(v_trans, ''))) then
      raise exception 'duplicate_correction';
    end if;
  else
    v_phrase := null; v_trans := null;
  end if;

  insert into post_discussion (post_id, parent_id, depth, author_id, kind, body, proposed_phrase, proposed_translation, status, client_key)
  values (p_post, p_parent, v_depth, auth.uid(), p_kind, v_body, v_phrase, v_trans, case when p_kind = 'comment' then null else 'pending' end, p_client_key)
  returning id into v_id;
  perform public.log_discussion(p_post, v_id, 'submitted', null, case when p_kind = 'comment' then null else 'pending' end);

  v_data := jsonb_build_object('post_id', p_post, 'item_id', v_id, 'phrase', public.post_snippet(post), 'parent_id', p_parent);
  if p_kind = 'comment' then
    -- The person replied to; the owner when it is about the post itself or a correction to it.
    perform public.notify_event(par.author_id, auth.uid(), 'post_reply', v_data, 'reply:' || v_id || ':' || coalesce(par.author_id::text, ''));
    if par.id is null or par.kind <> 'comment' then
      perform public.notify_event(post.user_id, auth.uid(), 'post_reply', v_data, 'reply:' || v_id || ':' || post.user_id);
    end if;
  else
    select * into pol from accountability_policy;
    insert into decision_items (user_id, post_id, item_id, due_at)
    values (post.user_id, p_post, v_id, now() + make_interval(hours => pol.deadline_hours));
    perform public.notify_event(post.user_id, auth.uid(), case when p_kind = 'correction' then 'post_correction' else 'post_clarification' end, v_data, 'submitted:' || v_id, true);
    -- Their correction is being challenged: they hear about it, nobody else in the thread does.
    if par.id is not null and par.author_id is distinct from post.user_id then
      perform public.notify_event(par.author_id, auth.uid(), 'post_challenged', v_data, 'challenged:' || v_id);
    end if;
  end if;
  perform public.refresh_post_review(p_post);
  return v_id;
end $$;

-- ---------- 6. Decisions ----------
create function public.apply_accept(post public.contribution_posts, it public.post_discussion, p_note text, p_from text) returns void
language plpgsql security definer set search_path = public as $$
declare prev public.post_discussion; v_reward boolean := true; v_count int; v_data jsonb;
begin
  v_data := jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post));
  -- Only the correction that held the accepted place steps aside. Other open proposals stay open.
  if post.accepted_item_id is not null and post.accepted_item_id <> it.id then
    select * into prev from post_discussion where id = post.accepted_item_id;
    update post_discussion set status = 'superseded', decided_at = now(), decided_by = auth.uid() where id = prev.id;
    perform public.log_discussion(post.id, prev.id, 'superseded', 'accepted', 'superseded', 'Replaced by a newer accepted correction');
    perform public.notify_event(prev.author_id, auth.uid(), 'post_superseded', v_data || jsonb_build_object('item_id', prev.id, 'by_item', it.id), 'superseded:' || prev.id || ':' || it.id);
  end if;
  update post_discussion set status = 'accepted', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = it.id;
  update contribution_posts set accepted_item_id = it.id,
    current_phrase = coalesce(it.proposed_phrase, post.current_phrase),
    current_translation = coalesce(it.proposed_translation, post.current_translation)
  where id = post.id;
  perform public.log_discussion(post.id, it.id, 'accepted', p_from, 'accepted', p_note);
  perform public.close_decision(it.id, 'decided', p_note);

  -- +5, with the same limits as chat corrections, across both kinds.
  if not public.corrector_in_good_standing(it.author_id) then v_reward := false; end if;
  select count(*) into v_count from points_ledger where user_id = it.author_id and reason in ('correction_accepted','post_correction_accepted') and created_at > now() - interval '24 hours';
  if v_count >= 10 then v_reward := false; end if;
  select count(*) into v_count from points_ledger l join post_discussion d2 on d2.id = l.ref_id join contribution_posts p2 on p2.id = d2.post_id
  where l.user_id = it.author_id and l.reason = 'post_correction_accepted' and l.created_at > now() - interval '24 hours' and p2.user_id = post.user_id;
  if v_count >= 3 then v_reward := false; end if;
  if v_reward and it.author_id is not null and not exists (select 1 from points_ledger where reason = 'post_correction_accepted' and ref_id = it.id) then
    perform public.award_points(it.author_id, 5, 'post_correction_accepted', 'post_discussion', it.id);
  else
    v_reward := false;
  end if;
  perform public.notify_event(it.author_id, auth.uid(), 'post_accepted', v_data || jsonb_build_object('points', case when v_reward then 5 else 0 end), 'accepted:' || it.id || ':' || coalesce(p_from, ''));
end $$;

create function public.decide_correction(p_id uuid, p_accept boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_mod boolean := false;
begin
  perform assert_active();
  select post_id into post.id from post_discussion where id = p_id;
  if post.id is null then raise exception 'correction_unavailable'; end if;
  -- The post row is the lock: two decisions on one post happen one after the other.
  select * into post from contribution_posts where id = post.id for update;
  select * into it from post_discussion where id = p_id for update;
  if post.user_id <> auth.uid() then
    v_mod := public.is_admin();
    if not v_mod then raise exception 'forbidden'; end if;
    if v_note is null then raise exception 'reason_required'; end if;
  end if;
  if it.author_id = auth.uid() then raise exception 'forbidden'; end if;
  if it.kind <> 'correction' then raise exception 'correction_unavailable'; end if;
  if it.status <> 'pending' then raise exception 'already_decided'; end if;

  if p_accept then
    perform public.apply_accept(post, it, v_note, 'pending');
  else
    update post_discussion set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_note = v_note where id = it.id;
    perform public.log_discussion(post.id, it.id, 'declined', 'pending', 'declined', v_note);
    perform public.close_decision(it.id, 'decided', v_note);
    perform public.notify_event(it.author_id, auth.uid(), 'post_declined', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'note', v_note), 'declined:' || it.id);
  end if;
  perform public.refresh_post_review(post.id);
  return case when p_accept then 'accepted' else 'declined' end;
end $$;

create function public.resolve_clarification(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id for update;
  if it.id is null or it.kind <> 'clarification' then raise exception 'correction_unavailable'; end if;
  select * into post from contribution_posts where id = it.post_id;
  if post.user_id <> auth.uid() and it.author_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  if v_note is null then raise exception 'reason_required'; end if;
  if it.status <> 'pending' then raise exception 'already_decided'; end if;
  update post_discussion set status = 'resolved', decided_by = auth.uid(), decided_at = now(), decision_note = left(v_note, 500) where id = it.id;
  perform public.log_discussion(post.id, it.id, 'resolved', 'pending', 'resolved', v_note);
  perform public.close_decision(it.id, 'decided', v_note);
  perform public.notify_event(it.author_id, auth.uid(), 'post_resolved', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'note', v_note), 'resolved:' || it.id);
  perform public.notify_event(post.user_id, auth.uid(), 'post_resolved', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'note', v_note), 'resolved:' || it.id);
  perform public.refresh_post_review(post.id);
end $$;

-- An author may take back a proposal nobody has decided yet. It stays in the thread, marked withdrawn.
create function public.withdraw_discussion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts;
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id for update;
  if it.id is null or it.author_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if it.status is distinct from 'pending' then raise exception 'already_decided'; end if;
  select * into post from contribution_posts where id = it.post_id;
  update post_discussion set status = 'withdrawn', decided_by = auth.uid(), decided_at = now() where id = it.id;
  perform public.log_discussion(post.id, it.id, 'withdrawn', 'pending', 'withdrawn');
  perform public.close_decision(it.id, 'withdrawn');
  perform public.notify_event(post.user_id, auth.uid(), 'post_withdrawn', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post)), 'withdrawn:' || it.id);
  perform public.refresh_post_review(post.id);
end $$;

-- The owner changes their mind: the accepted value goes back to the original.
create function public.revert_accepted(p_post uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare post public.contribution_posts; v_id uuid; v_author uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform assert_active();
  select * into post from contribution_posts where id = p_post for update;
  if post.id is null then raise exception 'post_not_found'; end if;
  if post.user_id <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  if v_note is null then raise exception 'reason_required'; end if;
  v_id := post.accepted_item_id;
  if v_id is null then raise exception 'correction_unavailable'; end if;
  update post_discussion set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_note = v_note where id = v_id returning author_id into v_author;
  update contribution_posts set accepted_item_id = null, current_phrase = null, current_translation = null where id = p_post;
  perform public.log_discussion(p_post, v_id, 'reverted', 'accepted', 'declined', v_note);
  perform public.notify_event(v_author, auth.uid(), 'post_reverted', jsonb_build_object('post_id', p_post, 'item_id', v_id, 'phrase', left(post.phrase, 80), 'note', v_note), 'reverted:' || v_id || ':' || extract(epoch from now())::bigint);
  perform public.refresh_post_review(p_post);
end $$;

-- A moderator reverses or reopens any decision. The reason is mandatory and on the record.
create function public.admin_override_correction(p_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_from text; v_pol public.accountability_policy;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  if p_status not in ('pending','accepted','declined') then raise exception 'invalid_kind'; end if;
  select post_id into post.id from post_discussion where id = p_id;
  if post.id is null then raise exception 'correction_unavailable'; end if;
  select * into post from contribution_posts where id = post.id for update;
  select * into it from post_discussion where id = p_id for update;
  if it.kind <> 'correction' then raise exception 'correction_unavailable'; end if;
  if it.status = p_status then raise exception 'already_decided'; end if;
  v_from := it.status;

  if post.accepted_item_id = it.id then
    update contribution_posts set accepted_item_id = null, current_phrase = null, current_translation = null where id = post.id returning * into post;
  end if;
  if p_status = 'accepted' then
    perform public.apply_accept(post, it, v_reason, v_from);
  else
    update post_discussion set status = p_status, decided_by = auth.uid(), decided_at = now(), decision_note = v_reason where id = it.id;
    perform public.log_discussion(post.id, it.id, 'override', v_from, p_status, v_reason);
    perform public.close_decision(it.id, 'decided', v_reason);
    if p_status = 'pending' then
      select * into v_pol from accountability_policy;
      insert into decision_items (user_id, post_id, item_id, due_at) values (post.user_id, post.id, it.id, now() + make_interval(hours => v_pol.deadline_hours))
      on conflict (item_id) do update set resolved_at = null, resolution = null, resolved_note = null, due_at = excluded.due_at, reminder_count = 0, last_reminded_at = null, overdue_notified_at = null, escalated_at = null;
    end if;
  end if;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), it.author_id, 'decision_override:' || v_from || '>' || p_status, v_reason, it.id);
  perform public.notify_event(it.author_id, auth.uid(), 'post_override', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'status', p_status, 'note', v_reason), 'override:' || it.id || ':' || extract(epoch from now())::bigint);
  perform public.notify_event(post.user_id, auth.uid(), 'post_override', jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'status', p_status, 'note', v_reason), 'override:' || it.id || ':' || extract(epoch from now())::bigint);
  perform public.refresh_post_review(post.id);
end $$;

-- ---------- 7. Quick reactions ----------
-- "This is correct." Returns the new state.
create function public.toggle_post_endorsement(p_post uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare post public.contribution_posts; v_on boolean;
begin
  perform assert_active();
  select * into post from contribution_posts where id = p_post;
  if post.id is null or public.is_blocked_between(auth.uid(), post.user_id) then raise exception 'post_not_found'; end if;
  if post.user_id = auth.uid() then raise exception 'cannot_review_own'; end if;
  if not public.can_correct_language(auth.uid(), post.language_id) then raise exception 'not_qualified_to_correct'; end if;
  delete from post_endorsements where post_id = p_post and user_id = auth.uid();
  v_on := not found;
  if v_on then
    insert into post_endorsements (post_id, user_id) values (p_post, auth.uid());
    perform public.log_discussion(p_post, null, 'endorsed', null, null);
    perform public.notify_event(post.user_id, auth.uid(), 'post_endorsed', jsonb_build_object('post_id', p_post, 'phrase', public.post_snippet(post)), 'endorsed:' || p_post || ':' || auth.uid());
  end if;
  perform public.refresh_post_review(p_post);
  return v_on;
end $$;

create function public.toggle_correction_agreement(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; v_on boolean;
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id;
  if it.id is null or it.kind <> 'correction' or public.is_blocked_between(auth.uid(), it.author_id) then raise exception 'correction_unavailable'; end if;
  if it.author_id = auth.uid() then raise exception 'cannot_review_own'; end if;
  delete from correction_agreements where item_id = p_id and user_id = auth.uid();
  v_on := not found;
  if v_on then insert into correction_agreements (item_id, user_id) values (p_id, auth.uid()); end if;
  return v_on;
end $$;

-- ---------- 8. Reading a thread ----------
create function public.get_post_thread(p_post uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare post public.contribution_posts; v_mod boolean := public.is_admin(); v_me uuid := auth.uid();
begin
  select * into post from contribution_posts where id = p_post;
  if post.id is null or public.is_blocked_between(v_me, post.user_id) then return null; end if;
  return jsonb_build_object(
    'post', to_jsonb(post) || jsonb_build_object(
      'author', (select jsonb_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url) from profiles a where a.id = post.user_id),
      'saved', exists (select 1 from saved_posts s where s.user_id = v_me and s.post_id = p_post)),
    'me', jsonb_build_object(
      'is_owner', post.user_id = v_me,
      'is_moderator', v_mod,
      'can_review', post.user_id <> v_me and public.can_correct_language(v_me, post.language_id),
      'endorsed', exists (select 1 from post_endorsements e where e.post_id = p_post and e.user_id = v_me),
      'muted', exists (select 1 from post_thread_mutes m where m.post_id = p_post and m.user_id = v_me)),
    -- A blocked person's words are hidden, but the place stays, so the replies under it still make sense.
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'parent_id', d.parent_id, 'depth', d.depth, 'kind', d.kind, 'status', d.status, 'created_at', d.created_at,
        'decided_at', d.decided_at, 'decision_note', d.decision_note,
        'hidden', public.is_blocked_between(v_me, d.author_id),
        'body', case when public.is_blocked_between(v_me, d.author_id) then null else d.body end,
        'proposed_phrase', case when public.is_blocked_between(v_me, d.author_id) then null else d.proposed_phrase end,
        'proposed_translation', case when public.is_blocked_between(v_me, d.author_id) then null else d.proposed_translation end,
        'author', case when public.is_blocked_between(v_me, d.author_id) or u.id is null then null else jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) end,
        'decided_by_name', dec.display_name,
        'agree_count', (select count(*) from correction_agreements ca where ca.item_id = d.id),
        'i_agreed', exists (select 1 from correction_agreements ca where ca.item_id = d.id and ca.user_id = v_me),
        'due_at', di.due_at, 'waiting_since', case when di.resolved_at is null then di.created_at end, 'responsible_open', di.id is not null and di.resolved_at is null)
        order by d.created_at)
      from post_discussion d
      left join profiles u on u.id = d.author_id
      left join profiles dec on dec.id = d.decided_by
      left join decision_items di on di.item_id = d.id
      where d.post_id = p_post), '[]'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'item_id', e.item_id, 'action', e.action, 'from_status', e.from_status, 'to_status', e.to_status, 'note', e.note, 'created_at', e.created_at, 'actor_name', a.display_name) order by e.id)
      from post_discussion_events e left join profiles a on a.id = e.actor_id
      where e.post_id = p_post and (e.actor_id is null or not public.is_blocked_between(v_me, e.actor_id))), '[]'),
    'owner_record', public.response_record(post.user_id));
end $$;

-- What the owner's track record shows: facts only, and exempted items do not count.
create function public.response_record(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'decided', count(*) filter (where resolution = 'decided'),
    'on_time', count(*) filter (where resolution = 'decided' and resolved_at <= due_at),
    'open', count(*) filter (where resolved_at is null),
    'overdue', count(*) filter (where resolved_at is null and due_at <= now()))
  from decision_items where user_id = p_user;
$$;

-- Opening a thread is recorded, and changes nothing about what is owed.
create function public.mark_decisions_viewed(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update decision_items set viewed_at = now() where post_id = p_post and user_id = auth.uid() and viewed_at is null and resolved_at is null;
$$;

-- ---------- 9. My queue, extensions, appeals ----------
create function public.my_accountability() returns jsonb
language plpgsql security definer set search_path = public as $$
declare pol public.accountability_policy;
begin
  perform assert_active();
  perform public.sweep_if_due();
  select * into pol from accountability_policy;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'post_id', i.post_id, 'item_id', i.item_id, 'kind', d.kind, 'created_at', i.created_at, 'due_at', i.due_at, 'viewed_at', i.viewed_at,
        'overdue', i.due_at <= now(), 'extensions', i.extensions, 'phrase', left(coalesce(p.current_phrase, p.phrase), 120),
        'proposed_phrase', d.proposed_phrase, 'author_name', u.display_name) order by i.due_at)
      from decision_items i join post_discussion d on d.id = i.item_id join contribution_posts p on p.id = i.post_id left join profiles u on u.id = d.author_id
      where i.user_id = auth.uid() and i.resolved_at is null), '[]'),
    'record', public.response_record(auth.uid()),
    'restriction', (select jsonb_build_object('id', r.id, 'reason', r.reason, 'created_at', r.created_at,
        'appeal', (select jsonb_build_object('status', a.status, 'message', a.message, 'decision_note', a.decision_note) from restriction_appeals a where a.restriction_id = r.id order by a.created_at desc limit 1))
      from user_restrictions r where r.user_id = auth.uid() and r.lifted_at is null),
    'policy', jsonb_build_object('deadline_hours', pol.deadline_hours, 'first_reminder_hours', pol.first_reminder_hours, 'restrict_after_overdue', pol.restrict_after_overdue, 'extension_hours', pol.extension_hours, 'max_extensions', pol.max_extensions, 'enabled', pol.enabled));
end $$;

create function public.request_decision_extension(p_item uuid, p_reason text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare it public.decision_items; pol public.accountability_policy; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_due timestamptz;
begin
  perform assert_active();
  select * into it from decision_items where id = p_item and user_id = auth.uid() and resolved_at is null for update;
  if it.id is null then raise exception 'correction_unavailable'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  select * into pol from accountability_policy;
  if it.extensions >= pol.max_extensions then raise exception 'extension_limit'; end if;
  v_due := greatest(it.due_at, now()) + make_interval(hours => pol.extension_hours);
  update decision_items set due_at = v_due, extensions = extensions + 1, extension_reason = left(v_reason, 500), overdue_notified_at = null, escalated_at = null where id = it.id;
  -- The thread shows that more time was given. Why (often personal) stays with staff, in the audit log.
  perform public.log_discussion(it.post_id, it.item_id, 'extended', null, null);
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), auth.uid(), 'extension', left(v_reason, 500), it.id);
  perform public.reconcile_restriction(auth.uid());
  return v_due;
end $$;

create function public.appeal_restriction(p_restriction uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare v_msg text := nullif(btrim(coalesce(p_message, '')), ''); v_mod uuid;
begin
  perform assert_active();
  if not exists (select 1 from user_restrictions where id = p_restriction and user_id = auth.uid() and lifted_at is null) then raise exception 'correction_unavailable'; end if;
  if v_msg is null then raise exception 'reason_required'; end if;
  if exists (select 1 from restriction_appeals where restriction_id = p_restriction and status = 'open') then raise exception 'already_appealed'; end if;
  insert into restriction_appeals (restriction_id, user_id, message) values (p_restriction, auth.uid(), left(v_msg, 1000));
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), auth.uid(), 'appeal', left(v_msg, 1000), p_restriction);
end $$;

-- ---------- 10. Moderation ----------
create function public.admin_accountability() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'policy', (select to_jsonb(p) from accountability_policy p),
    'escalated', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'item_id', i.item_id, 'post_id', i.post_id, 'due_at', i.due_at, 'owner_name', u.display_name, 'phrase', left(coalesce(c.current_phrase, c.phrase), 120), 'kind', d.kind) order by i.due_at)
      from decision_items i join profiles u on u.id = i.user_id join contribution_posts c on c.id = i.post_id join post_discussion d on d.id = i.item_id
      where i.resolved_at is null and i.escalated_at is not null), '[]'),
    'restrictions', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'name', u.display_name, 'reason', r.reason, 'created_at', r.created_at) order by r.created_at desc)
      from user_restrictions r join profiles u on u.id = r.user_id where r.lifted_at is null), '[]'),
    'appeals', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', u.display_name, 'message', a.message, 'created_at', a.created_at) order by a.created_at)
      from restriction_appeals a join profiles u on u.id = a.user_id where a.status = 'open'), '[]'),
    'audit', coalesce((select jsonb_agg(x order by x.created_at desc) from (select e.id, e.action, e.reason, e.created_at, a.display_name as actor_name, t.display_name as target_name
      from accountability_audit e left join profiles a on a.id = e.actor_id left join profiles t on t.id = e.target_user order by e.created_at desc limit 50) x), '[]'));
end $$;

create function public.admin_set_accountability_policy(p_policy jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update accountability_policy set
    enabled = coalesce((p_policy->>'enabled')::boolean, enabled),
    first_reminder_hours = coalesce((p_policy->>'first_reminder_hours')::int, first_reminder_hours),
    repeat_reminder_hours = coalesce((p_policy->>'repeat_reminder_hours')::int, repeat_reminder_hours),
    deadline_hours = coalesce((p_policy->>'deadline_hours')::int, deadline_hours),
    escalate_after_hours = coalesce((p_policy->>'escalate_after_hours')::int, escalate_after_hours),
    restrict_after_overdue = coalesce((p_policy->>'restrict_after_overdue')::int, restrict_after_overdue),
    restrict_notice_hours = coalesce((p_policy->>'restrict_notice_hours')::int, restrict_notice_hours),
    extension_hours = coalesce((p_policy->>'extension_hours')::int, extension_hours),
    max_extensions = coalesce((p_policy->>'max_extensions')::int, max_extensions),
    updated_at = now(), updated_by = auth.uid();
  insert into accountability_audit (actor_id, action, reason) values (auth.uid(), 'policy_changed', v_reason || ' ' || p_policy::text);
end $$;

create function public.admin_decide_appeal(p_appeal uuid, p_grant boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.restriction_appeals; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_note is null then raise exception 'reason_required'; end if;
  select * into a from restriction_appeals where id = p_appeal and status = 'open' for update;
  if a.id is null then raise exception 'already_decided'; end if;
  update restriction_appeals set status = case when p_grant then 'granted' else 'denied' end, decided_by = auth.uid(), decided_at = now(), decision_note = v_note where id = a.id;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), a.user_id, case when p_grant then 'appeal_granted' else 'appeal_denied' end, v_note, a.id);
  if p_grant then
    -- Granting also clears what caused it, otherwise the next sweep would restrict them again.
    update decision_items set resolved_at = now(), resolution = 'exempted', resolved_note = v_note where user_id = a.user_id and resolved_at is null and due_at <= now();
    update user_restrictions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_note where id = a.restriction_id and lifted_at is null;
  end if;
  perform public.notify_event(a.user_id, auth.uid(), 'appeal_decided', jsonb_build_object('granted', p_grant, 'note', v_note), 'appeal:' || a.id, true);
end $$;

create function public.admin_lift_restriction(p_restriction uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.user_restrictions; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update user_restrictions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_reason where id = p_restriction and lifted_at is null returning * into r;
  if r.id is null then raise exception 'already_decided'; end if;
  update decision_items set resolved_at = now(), resolution = 'exempted', resolved_note = v_reason where user_id = r.user_id and resolved_at is null and due_at <= now();
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), r.user_id, 'restriction_lifted_by_staff', v_reason, r.id);
  perform public.notify_event(r.user_id, auth.uid(), 'restriction_lifted', jsonb_build_object('restriction_id', r.id, 'note', v_reason), 'restriction_lifted:' || r.id, true);
end $$;

create function public.admin_exempt_decision(p_decision uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update decision_items set resolved_at = now(), resolution = 'exempted', resolved_note = v_reason where id = p_decision and resolved_at is null returning user_id into v_user;
  if v_user is null then raise exception 'already_decided'; end if;
  insert into accountability_audit (actor_id, target_user, action, reason, ref_id) values (auth.uid(), v_user, 'decision_exempted', v_reason, p_decision);
  perform public.reconcile_restriction(v_user);
end $$;

create function public.admin_set_user_exempt(p_user uuid, p_exempt boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  update profiles set accountability_exempt = coalesce(p_exempt, false) where id = p_user;
  insert into accountability_audit (actor_id, target_user, action, reason) values (auth.uid(), p_user, case when p_exempt then 'user_exempted' else 'user_exemption_removed' end, v_reason);
  perform public.reconcile_restriction(p_user);
end $$;

-- ---------- 11. Existing post functions ----------
create or replace function public.post_contribution(p_phrase text, p_translation text default null, p_language text default null,
                                                    p_category text default 'phrase', p_source_context text default null,
                                                    p_unsplash_image_url text default null, p_text_align text default 'left')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left')));
begin
  perform assert_active();
  perform public.sweep_if_due();
  if exists (select 1 from user_restrictions where user_id = auth.uid() and lifted_at is null and kind = 'new_posts') then raise exception 'posting_restricted'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if (select count(*) from public.contribution_posts where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;

  insert into public.contribution_posts (user_id, certified_at, language_id, phrase, translation, category, source_context, unsplash_image_url, text_align, updated_at)
  values (auth.uid(), now(), v_lang, left(btrim(p_phrase), 500), left(nullif(btrim(coalesce(p_translation, '')), ''), 500), v_cat,
          left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), v_img, v_align, now())
  returning id into v_id;
  return v_id;
end $$;

-- Once a post is being discussed, what people are discussing cannot change under them. Context, image and
-- category stay editable.
create or replace function public.update_contribution(p_id uuid, p_phrase text, p_translation text default null, p_language text default null,
                                                      p_category text default 'phrase', p_source_context text default null,
                                                      p_unsplash_image_url text default null, p_text_align text default 'left')
returns void language plpgsql security definer set search_path = public as $$
declare v_lang text; old public.contribution_posts; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left')));
begin
  perform assert_active();
  select * into old from public.contribution_posts where id = p_id and user_id = auth.uid();
  if not found then raise exception 'post_not_found'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if v_lang is distinct from old.language_id and not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if (old.thread_count > 0 or old.endorse_count > 0) and (
       left(btrim(p_phrase), 500) <> old.phrase
    or left(nullif(btrim(coalesce(p_translation, '')), ''), 500) is distinct from old.translation
    or v_lang is distinct from old.language_id) then
    raise exception 'post_under_review';
  end if;

  update public.contribution_posts
     set language_id = v_lang, phrase = left(btrim(p_phrase), 500), translation = left(nullif(btrim(coalesce(p_translation, '')), ''), 500),
         category = v_cat, source_context = left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), unsplash_image_url = v_img,
         text_align = v_align, updated_at = now()
   where id = p_id and user_id = auth.uid();
end $$;

-- Deleting a post cannot be the way out of a decision someone else is waiting on.
create or replace function public.delete_contribution(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if exists (select 1 from public.decision_items where post_id = p_id and user_id = auth.uid() and resolved_at is null) then raise exception 'post_has_open_decisions'; end if;
  delete from public.contribution_posts where id = p_id and user_id = auth.uid();
end $$;

-- ---------- Grants ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
-- Internal only. The blanket grant above re-opens everything, so these lines must stay LAST.
revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.refund_expired_bounties() from public, anon, authenticated;
revoke execute on function public.tz_hours_apart(text, text) from public, anon, authenticated;
revoke execute on function public.level_evidence(uuid, text) from public, anon, authenticated;
revoke execute on function public.level_rule_met(jsonb, public.level_rules) from public, anon, authenticated;
revoke execute on function public.evaluate_level(uuid) from public, anon, authenticated;
revoke execute on function public.corrector_in_good_standing(uuid) from public, anon, authenticated;
revoke execute on function public.trg_check_level() from public, anon, authenticated;
revoke execute on function public.vouch_blocker(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.valid_vouches(uuid, text) from public, anon, authenticated;
-- notify was callable by anyone until now: any signed-in user could send anyone a notification.
revoke execute on function public.notify(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_event(uuid, uuid, text, jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.log_discussion(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.refresh_post_review(uuid) from public, anon, authenticated;
revoke execute on function public.reconcile_restriction(uuid) from public, anon, authenticated;
revoke execute on function public.close_decision(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.accountability_sweep() from public, anon, authenticated;
revoke execute on function public.sweep_if_due() from public, anon, authenticated;
revoke execute on function public.apply_accept(public.contribution_posts, public.post_discussion, text, text) from public, anon, authenticated;
revoke execute on function public.response_record(uuid) from public, anon, authenticated;
