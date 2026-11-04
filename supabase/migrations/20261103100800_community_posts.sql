-- Contribution and help posts, their discussions, endorsements and saves.

create table public.contribution_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  certified_at timestamptz not null default now(),
  language_id text references public.languages(id) on delete set null,
  phrase text not null check ((char_length(phrase) >= 1) and (char_length(phrase) <= 500)),
  translation text check (char_length(translation) <= 500),
  category text not null default 'phrase' check (category in ('phrase', 'idiom', 'usage', 'grammar')),
  source_context text check (char_length(source_context) <= 500),
  unsplash_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  text_align text not null default 'left' check (text_align in ('left', 'center', 'right')),
  pinned_at timestamptz,
  current_phrase text,
  current_translation text,
  accepted_item_id uuid,
  review_status text not null default 'awaiting_feedback' check (review_status in ('awaiting_feedback', 'corrections_received', 'under_review', 'reviewed')),
  open_corrections int not null default 0,
  thread_count int not null default 0,
  endorse_count int not null default 0,
  -- library and lesson teach, so they need a qualified author. The rest are practice: open to every learner.
  post_type text not null default 'library' check (post_type in ('library', 'lesson', 'correct_me', 'how_do_i_say', 'story', 'question', 'photo')),
  body text check (char_length(body) <= 5000),
  current_body text,
  image_layout text not null default 'above' check (image_layout in ('above', 'overlay')),
  constraint contribution_posts_shape check (
    (post_type in ('library', 'lesson') or ((char_length(phrase) <= 280) and (accepted_item_id is null)))
    and (post_type in ('library', 'lesson', 'photo') or (unsplash_image_url is null))
    and (post_type <> 'photo' or (unsplash_image_url is not null))
    and (post_type not in ('story', 'lesson') or (body is not null))
    and (post_type in ('story', 'lesson', 'question') or (body is null))
    and (image_layout = 'above' or ((unsplash_image_url is not null) and (char_length(phrase) <= 120))))
);
alter table public.contribution_posts enable row level security;
create index contribution_posts_created_idx on public.contribution_posts (created_at desc);
create index contribution_posts_pinned_idx on public.contribution_posts (user_id, pinned_at desc nulls last);
create index contribution_posts_lang_idx on public.contribution_posts (language_id);
create index contribution_posts_type_idx on public.contribution_posts (post_type, review_status, created_at desc);
create index contribution_posts_user_idx on public.contribution_posts (user_id);
grant select on public.contribution_posts to authenticated;

create table public.post_discussion (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  parent_id uuid,
  depth int not null default 0 check ((depth >= 0) and (depth <= 12)),
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('correction', 'clarification', 'comment')),
  body text not null check ((char_length(body) >= 1) and (char_length(body) <= 1000)),
  proposed_phrase text check ((char_length(proposed_phrase) >= 1) and (char_length(proposed_phrase) <= 1000)),
  proposed_translation text check ((char_length(proposed_translation) >= 1) and (char_length(proposed_translation) <= 500)),
  status text check (status in ('pending', 'accepted', 'declined', 'superseded', 'withdrawn', 'resolved')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 500),
  client_key uuid not null,
  created_at timestamptz not null default now(),
  feedback text check ((feedback is null) or (feedback in ('helpful', 'not_helpful'))),
  feedback_at timestamptz,
  -- A correction on a long post covers one stretch of the body: characters target_start up to target_end, counted from 0.
  target_start int,
  target_end int,
  target_text text check (char_length(target_text) <= 1000),
  constraint post_discussion_target check (((target_start is null) = (target_end is null)) and ((target_start is null) = (target_text is null)) and ((target_start is null) or ((kind = 'correction') and (target_start >= 0) and (target_end > target_start)))),
  unique (author_id, client_key),
  constraint post_discussion_check check (parent_id is distinct from id),
  constraint post_discussion_check1 check ((parent_id is null) = (depth = 0)),
  constraint post_discussion_check2 check ((kind <> 'comment') or ((status is null) and (proposed_phrase is null) and (proposed_translation is null))),
  constraint post_discussion_check3 check ((kind <> 'correction') or ((status in ('pending', 'accepted', 'declined', 'superseded', 'withdrawn')) and ((proposed_phrase is not null) or (proposed_translation is not null)))),
  constraint post_discussion_check4 check ((kind <> 'clarification') or ((status in ('pending', 'resolved', 'withdrawn')) and (proposed_phrase is null) and (proposed_translation is null))),
  unique (id, post_id),
  constraint post_discussion_parent_id_post_id_fkey foreign key (parent_id, post_id) references public.post_discussion(id, post_id) on delete cascade
);
alter table public.post_discussion enable row level security;
create index post_discussion_parent_idx on public.post_discussion (parent_id);
create index post_discussion_author_idx on public.post_discussion (author_id, created_at desc);
create index post_discussion_post_idx on public.post_discussion (post_id, created_at);
grant select on public.post_discussion to authenticated;

create table public.post_discussion_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  item_id uuid references public.post_discussion(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.post_discussion_events enable row level security;
create index post_discussion_events_post_idx on public.post_discussion_events (post_id, id);

create table public.post_endorsements (
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_endorsements enable row level security;

create table public.post_thread_mutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  primary key (user_id, post_id)
);
alter table public.post_thread_mutes enable row level security;

create table public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.saved_posts enable row level security;
create index saved_posts_user_idx on public.saved_posts (user_id, created_at desc);
grant select on public.saved_posts to authenticated;

alter table public.reports add constraint reports_post_id_fkey foreign key (post_id) references public.contribution_posts(id) on delete set null;

alter table public.decision_items add constraint decision_items_item_id_fkey foreign key (item_id) references public.post_discussion(id) on delete cascade;

alter table public.decision_items add constraint decision_items_post_id_fkey foreign key (post_id) references public.contribution_posts(id) on delete cascade;

alter table public.contribution_posts add constraint contribution_posts_accepted_item_fkey foreign key (accepted_item_id) references public.post_discussion(id) on delete set null;

create function public.pin_contribution(p_id uuid, p_pinned boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if not exists (select 1 from public.contribution_posts where id = p_id and user_id = auth.uid()) then raise exception 'post_not_found'; end if;
  if p_pinned then
    update public.contribution_posts set pinned_at = null where user_id = auth.uid() and pinned_at is not null and id <> p_id;
    update public.contribution_posts set pinned_at = now() where id = p_id;
  else
    update public.contribution_posts set pinned_at = null where id = p_id;
  end if;
end $$;

create function public.toggle_saved_post(p_post uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  perform assert_active();
  select user_id into v_owner from public.contribution_posts where id = p_post;
  if v_owner is null or public.is_blocked_between(auth.uid(), v_owner) then raise exception 'post_not_found'; end if;
  if exists (select 1 from public.saved_posts where user_id = auth.uid() and post_id = p_post) then
    delete from public.saved_posts where user_id = auth.uid() and post_id = p_post;
    return false;
  end if;
  if (select count(*) from public.saved_posts where user_id = auth.uid()) >= 500 then raise exception 'saved_limit'; end if;
  insert into public.saved_posts (user_id, post_id) values (auth.uid(), p_post);
  return true;
end $$;

create function public.report_post(p_post uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; p public.contribution_posts; v_recent int;
begin
  perform assert_active();
  select * into p from public.contribution_posts where id = p_post;
  if p.id is null or public.is_blocked_between(auth.uid(), p.user_id) then raise exception 'post_not_found'; end if;
  if p.user_id = auth.uid() then raise exception 'cannot_report_self'; end if;
  if exists (select 1 from public.reports where reporter_id = auth.uid() and post_id = p_post and status = 'open') then raise exception 'already_reported'; end if;

  insert into public.reports (reporter_id, target_user_id, post_id, reason, details, evidence)
  values (auth.uid(), p.user_id, p.id, p_reason, left(p_details, 1000),
          jsonb_build_array(jsonb_build_object('id', p.id, 'sender_id', p.user_id, 'created_at', p.created_at,
            'body', concat_ws(E'\n', p.phrase, p.body, '→ ' || p.translation, '“' || p.source_context || '”', p.unsplash_image_url))))
  returning id into v_id;

  select count(distinct reporter_id) into v_recent from public.reports where target_user_id = p.user_id and created_at > now() - interval '7 days';
  if v_recent >= 5 then
    perform set_config('app.bypass_protect', 'on', true);
    update public.profiles set status = 'suspended' where id = p.user_id and status = 'active' and role = 'user';
    insert into public.moderation_actions (target_user_id, action, reason) values (p.user_id, 'auto_suspend', v_recent || ' reports in 7 days');
  end if;
  return v_id;
end $$;

create function public.admin_remove_post(p_post uuid, p_report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.contribution_posts where id = p_post;
  if p_report is not null then update public.reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now() where id = p_report; end if;
end $$;

create function public.matches_my_languages(p public.contribution_posts) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.language_id in (me.native_language_id, me.learning_language_id)
                   from public.profiles me where me.id = auth.uid()), false);
$$;

create function public.is_contribution_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.native_language_id is not null or p.verified_level in ('B1', 'B2', 'C1', 'C2')
                   from public.profiles p where p.id = p_user), false);
$$;

create function public.protect_discussion() returns trigger language plpgsql as $$
begin
  if new.post_id <> old.post_id or new.parent_id is distinct from old.parent_id or new.kind <> old.kind or new.body <> old.body
     or new.proposed_phrase is distinct from old.proposed_phrase or new.proposed_translation is distinct from old.proposed_translation
     or new.target_start is distinct from old.target_start or new.target_end is distinct from old.target_end or new.target_text is distinct from old.target_text
     or new.created_at <> old.created_at or new.depth <> old.depth
     or (new.author_id is distinct from old.author_id and new.author_id is not null) then
    raise exception 'discussion_is_immutable';
  end if;
  return new;
end $$;

create function public.set_thread_mute(p_post uuid, p_muted boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_muted then insert into post_thread_mutes (user_id, post_id) values (auth.uid(), p_post) on conflict do nothing;
  else delete from post_thread_mutes where user_id = auth.uid() and post_id = p_post; end if;
end $$;

create function public.post_snippet(p public.contribution_posts) returns text language sql immutable as $$
  select left(coalesce(p.current_phrase, p.phrase), 80);
$$;

create function public.log_discussion(p_post uuid, p_item uuid, p_action text, p_from text, p_to text, p_note text default null) returns void
language sql security definer set search_path = public as $$
  insert into post_discussion_events (post_id, item_id, actor_id, action, from_status, to_status, note)
  values (p_post, p_item, auth.uid(), p_action, p_from, p_to, p_note);
$$;

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
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'parent_id', d.parent_id, 'depth', d.depth, 'kind', d.kind, 'status', d.status, 'created_at', d.created_at,
        'decided_at', d.decided_at, 'decision_note', d.decision_note,
        'hidden', public.is_blocked_between(v_me, d.author_id),
        'body', case when public.is_blocked_between(v_me, d.author_id) then null else d.body end,
        'proposed_phrase', case when public.is_blocked_between(v_me, d.author_id) then null else d.proposed_phrase end,
        'proposed_translation', case when public.is_blocked_between(v_me, d.author_id) then null else d.proposed_translation end,
        'author', case when public.is_blocked_between(v_me, d.author_id) or u.id is null then null else jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) end,
        'decided_by_name', dec.display_name,
        'target_start', d.target_start, 'target_end', d.target_end, 'target_text', d.target_text,
        'agree_count', (select count(*) from correction_agreements ca where ca.item_id = d.id and ca.stance = 'agree'),
        'i_agreed', exists (select 1 from correction_agreements ca where ca.item_id = d.id and ca.user_id = v_me and ca.stance = 'agree'),
        'flag_count', (select count(*) from correction_agreements ca where ca.item_id = d.id and ca.stance = 'flag'),
        'i_flagged', exists (select 1 from correction_agreements ca where ca.item_id = d.id and ca.user_id = v_me and ca.stance = 'flag'),
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

create function public.post_contribution(p_phrase text, p_translation text default null, p_language text default null,
                                                    p_category text default 'phrase', p_source_context text default null,
                                                    p_unsplash_image_url text default null, p_text_align text default 'left',
                                                    p_post_type text default 'library', p_body text default null, p_image_layout text default 'above')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left'))); v_body text := nullif(btrim(coalesce(p_body, '')), ''); v_layout text := coalesce(p_image_layout, 'above');
begin
  perform assert_active();
  perform public.sweep_if_due();
  if exists (select 1 from user_restrictions where user_id = auth.uid() and lifted_at is null and kind = 'new_posts') then raise exception 'posting_restricted'; end if;
  if p_post_type not in ('library', 'lesson') then raise exception 'invalid_post_type'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if p_post_type = 'lesson' and v_body is null then raise exception 'empty_body'; end if;
  if p_post_type = 'library' then v_body := null; end if;
  if char_length(v_body) > 5000 then raise exception 'text_too_long'; end if;
  if v_layout not in ('above', 'overlay') or (v_layout = 'overlay' and v_img is null) then raise exception 'invalid_image'; end if;
  if v_layout = 'overlay' and char_length(btrim(p_phrase)) > 120 then raise exception 'overlay_too_long'; end if;
  if (select count(*) from public.contribution_posts where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;

  insert into public.contribution_posts (user_id, certified_at, language_id, phrase, translation, category, source_context, unsplash_image_url, text_align, updated_at, post_type, body, image_layout)
  values (auth.uid(), now(), v_lang, left(btrim(p_phrase), 500), left(nullif(btrim(coalesce(p_translation, '')), ''), 500), v_cat,
          left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), v_img, v_align, now(), p_post_type, v_body, v_layout)
  returning id into v_id;
  return v_id;
end $$;

create function public.update_contribution(p_id uuid, p_phrase text, p_translation text default null, p_language text default null,
                                                      p_category text default 'phrase', p_source_context text default null,
                                                      p_unsplash_image_url text default null, p_text_align text default 'left',
                                                      p_body text default null, p_image_layout text default 'above')
returns void language plpgsql security definer set search_path = public as $$
declare v_lang text; old public.contribution_posts; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left'))); v_body text := nullif(btrim(coalesce(p_body, '')), ''); v_layout text := coalesce(p_image_layout, 'above');
begin
  perform assert_active();
  select * into old from public.contribution_posts where id = p_id and user_id = auth.uid();
  if not found then raise exception 'post_not_found'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  if old.post_type not in ('library', 'lesson') and char_length(btrim(p_phrase)) > 280 then raise exception 'text_too_long'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if v_lang is distinct from old.language_id and not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if old.post_type = 'photo' and v_img is null then raise exception 'invalid_image'; end if;
  if old.post_type in ('story', 'lesson') and v_body is null then raise exception 'empty_body'; end if;
  if old.post_type not in ('story', 'lesson', 'question') then v_body := null; end if;
  if char_length(v_body) > (case when old.post_type = 'question' then 2000 else 5000 end) then raise exception 'text_too_long'; end if;
  if v_layout not in ('above', 'overlay') or (v_layout = 'overlay' and v_img is null) then raise exception 'invalid_image'; end if;
  if v_layout = 'overlay' and char_length(btrim(p_phrase)) > 120 then raise exception 'overlay_too_long'; end if;
  if (old.thread_count > 0 or old.endorse_count > 0) and (
       left(btrim(p_phrase), 500) <> old.phrase
    or left(nullif(btrim(coalesce(p_translation, '')), ''), 500) is distinct from old.translation
    or v_body is distinct from old.body
    or v_lang is distinct from old.language_id) then
    raise exception 'post_under_review';
  end if;

  update public.contribution_posts
     set language_id = v_lang, phrase = left(btrim(p_phrase), 500), translation = left(nullif(btrim(coalesce(p_translation, '')), ''), 500),
         category = v_cat, source_context = left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), unsplash_image_url = v_img,
         text_align = v_align, body = v_body, image_layout = v_layout, updated_at = now()
   where id = p_id and user_id = auth.uid();
end $$;

create function public.delete_contribution(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if exists (select 1 from public.decision_items where post_id = p_id and user_id = auth.uid() and resolved_at is null) then raise exception 'post_has_open_decisions'; end if;
  delete from public.contribution_posts where id = p_id and user_id = auth.uid();
end $$;

-- The body as it reads with accepted corrections applied, or null when none apply. The original is never changed.
-- Where accepted corrections overlap, the newest decision wins.
create function public.applied_body(p_post uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_body text; v_changed boolean := false; it record;
begin
  select body into v_body from contribution_posts where id = p_post;
  if v_body is null then return null; end if;
  for it in
    select d.target_start, d.target_end, d.proposed_phrase from post_discussion d
    where d.post_id = p_post and d.kind = 'correction' and d.status = 'accepted' and d.target_start is not null and d.proposed_phrase is not null
      and not exists (select 1 from post_discussion n
                      where n.post_id = d.post_id and n.kind = 'correction' and n.status = 'accepted' and n.target_start is not null
                        and n.target_start < d.target_end and n.target_end > d.target_start
                        and (n.decided_at, n.id) > (d.decided_at, d.id))
    order by d.target_start desc
  loop
    v_body := overlay(v_body placing it.proposed_phrase from it.target_start + 1 for it.target_end - it.target_start);
    v_changed := true;
  end loop;
  return case when v_changed then v_body end;
end $$;

create function public.refresh_post_review(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update contribution_posts c set
    open_corrections = o.open, thread_count = o.total, endorse_count = o.endorsed,
    current_body = public.applied_body(p_post),
    review_status = case
      when o.escalated > 0 then 'under_review'
      when o.open > 0 or (c.post_type = 'question' and o.total > 0) then 'corrections_received'
      when o.accepted > 0 or o.endorsed > 0 then 'reviewed'
      else 'awaiting_feedback' end
  from (select
          (select count(*)::int from post_discussion d where d.post_id = p_post and d.status = 'pending') as open,
          (select count(*)::int from post_discussion d where d.post_id = p_post) as total,
          (select count(*)::int from post_discussion d where d.post_id = p_post and d.kind = 'correction' and d.status = 'accepted') as accepted,
          (select count(*)::int from decision_items i where i.post_id = p_post and i.resolved_at is null and i.escalated_at is not null) as escalated,
          (select count(*)::int from post_endorsements e where e.post_id = p_post) as endorsed) o
  where c.id = p_post;
$$;

-- Every practice type: nobody needs a level, and the language is always the one you are learning.
create function public.post_help_request(p_type text, p_text text, p_context text default null, p_body text default null,
                                         p_image_url text default null, p_image_layout text default 'above') returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.profiles; post public.contribution_posts; v_text text := btrim(coalesce(p_text, '')); v_helper uuid;
        v_body text := nullif(btrim(coalesce(p_body, '')), ''); v_img text := nullif(btrim(coalesce(p_image_url, '')), ''); v_layout text := coalesce(p_image_layout, 'above');
begin
  perform assert_active();
  perform public.sweep_if_due();
  if p_type not in ('correct_me', 'how_do_i_say', 'story', 'question', 'photo') then raise exception 'invalid_post_type'; end if;
  select * into me from profiles where id = auth.uid();
  if me.learning_language_id is null then raise exception 'learning_language_required'; end if;
  if char_length(v_text) = 0 then raise exception 'empty_phrase'; end if;
  if char_length(v_text) > 280 then raise exception 'text_too_long'; end if;
  if p_type = 'story' and v_body is null then raise exception 'empty_body'; end if;
  if p_type not in ('story', 'question') then v_body := null; end if;
  if char_length(v_body) > (case when p_type = 'question' then 2000 else 5000 end) then raise exception 'text_too_long'; end if;
  if p_type <> 'photo' then v_img := null; v_layout := 'above'; end if;
  if p_type = 'photo' and (v_img is null or char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if v_layout not in ('above', 'overlay') then raise exception 'invalid_image'; end if;
  if v_layout = 'overlay' and char_length(v_text) > 120 then raise exception 'overlay_too_long'; end if;
  if (select count(*) from contribution_posts where user_id = me.id and post_type not in ('library', 'lesson') and created_at > now() - interval '24 hours') >= 5 then raise exception 'practice_limit'; end if;

  insert into contribution_posts (user_id, certified_at, language_id, phrase, source_context, post_type, review_status, updated_at, body, unsplash_image_url, image_layout)
  values (me.id, now(), me.learning_language_id, v_text, left(nullif(btrim(coalesce(p_context, '')), ''), 200), p_type, 'awaiting_feedback', now(), v_body, v_img, v_layout)
  returning * into post;

  for v_helper in
    select p.id from profiles p left join user_presence up on up.user_id = p.id
    where p.id <> me.id and p.status = 'active' and p.role = 'user' and p.onboarding_done
      and public.can_correct_language(p.id, post.language_id) and not public.is_blocked_between(me.id, p.id)
      and not exists (select 1 from notifications n where n.user_id = p.id and n.type = 'help_request' and n.created_at > now() - interval '6 hours')
    order by (p.native_language_id = post.language_id) desc, up.last_seen_at desc nulls last
    limit 5
  loop
    perform public.notify_event(v_helper, me.id, 'help_request', jsonb_build_object('post_id', post.id, 'phrase', public.post_snippet(post)), 'help_request:' || post.id || ':' || v_helper);
  end loop;

  return post.id;
end $$;

create function public.help_supply(p_language text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from (
    select 1 from profiles p
    where p.id <> auth.uid() and p.status = 'active' and p.role = 'user' and p.onboarding_done
      and public.can_correct_language(p.id, public.normalize_language_code(p_language))
    limit 5) x;
$$;

create function public.submit_discussion(p_post uuid, p_parent uuid, p_kind text, p_body text, p_phrase text default null, p_translation text default null, p_client_key uuid default null,
                                          p_target_start int default null, p_target_end int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  post public.contribution_posts; par public.post_discussion; v_id uuid; v_depth int := 0;
  v_body text := btrim(coalesce(p_body, '')); v_phrase text := nullif(btrim(coalesce(p_phrase, '')), ''); v_trans text := nullif(btrim(coalesce(p_translation, '')), '');
  v_base_phrase text; v_base_trans text; pol public.accountability_policy; v_data jsonb;
  v_start int; v_end int; v_target text;
begin
  perform assert_active();
  if p_client_key is null then raise exception 'missing_client_key'; end if;
  select id into v_id from post_discussion where author_id = auth.uid() and client_key = p_client_key;
  if v_id is not null then return v_id; end if;

  select * into post from contribution_posts where id = p_post for share;
  if post.id is null or public.is_blocked_between(auth.uid(), post.user_id) then raise exception 'post_not_found'; end if;
  if p_kind not in ('correction','clarification','comment') then raise exception 'invalid_kind'; end if;
  if char_length(v_body) = 0 then raise exception 'explanation_required'; end if;
  if char_length(v_body) > 1000 or char_length(v_phrase) > 1000 or char_length(v_trans) > 500 then raise exception 'text_too_long'; end if;
  if (select count(*) from post_discussion where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;

  if p_parent is not null then
    select * into par from post_discussion where id = p_parent and post_id = p_post;
    if par.id is null then raise exception 'invalid_parent'; end if;
    if public.is_blocked_between(auth.uid(), par.author_id) then raise exception 'invalid_parent'; end if;
    v_depth := par.depth + 1;
    if v_depth > 12 then raise exception 'thread_too_deep'; end if;
  end if;

  -- Practice posts take fixes and replies, a question only replies. Nothing here can create a duty for the author.
  if post.post_type not in ('library', 'lesson') and p_kind = 'clarification' then raise exception 'help_post_fix_only'; end if;
  if post.post_type = 'question' and p_kind = 'correction' then raise exception 'help_post_fix_only'; end if;

  if p_kind in ('correction','clarification') then
    if not public.can_correct_language(auth.uid(), post.language_id) then raise exception 'not_qualified_to_correct'; end if;
    if post.user_id = auth.uid() then raise exception 'owner_cannot_correct'; end if;
    if par.id is not null then
      if par.kind <> 'correction' then raise exception 'invalid_parent'; end if;
      if par.status not in ('pending','accepted') then raise exception 'parent_closed'; end if;
      if par.author_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
    end if;
  end if;

  if p_kind = 'correction' then
    v_base_phrase := coalesce(par.proposed_phrase, post.current_phrase, post.phrase);
    v_base_trans := coalesce(par.proposed_translation, post.current_translation, post.translation);
    if post.body is not null then
      -- A long post is corrected one stretch at a time, so one fix never replaces the whole text.
      v_start := coalesce(par.target_start, p_target_start);
      v_end := coalesce(par.target_end, p_target_end);
      if v_start is null or v_end is null or v_start < 0 or v_end <= v_start or v_end > char_length(post.body) then raise exception 'sentence_required'; end if;
      v_target := substr(post.body, v_start + 1, v_end - v_start);
      if char_length(v_target) > 1000 then raise exception 'text_too_long'; end if;
      v_base_phrase := coalesce(par.proposed_phrase, v_target);
      v_trans := null;
    end if;
    if v_phrase is null and v_trans is null then raise exception 'proposal_required'; end if;
    if (v_phrase is null or lower(v_phrase) = lower(v_base_phrase)) and (v_trans is null or lower(v_trans) = lower(coalesce(v_base_trans, ''))) then raise exception 'no_change'; end if;
    if exists (select 1 from post_discussion d where d.post_id = p_post and d.kind = 'correction' and d.status = 'pending' and d.parent_id is not distinct from p_parent
               and d.target_start is not distinct from v_start
               and lower(coalesce(d.proposed_phrase, '')) = lower(coalesce(v_phrase, '')) and lower(coalesce(d.proposed_translation, '')) = lower(coalesce(v_trans, ''))) then
      raise exception 'duplicate_correction';
    end if;
  else
    v_phrase := null; v_trans := null;
  end if;

  insert into post_discussion (post_id, parent_id, depth, author_id, kind, body, proposed_phrase, proposed_translation, status, client_key, target_start, target_end, target_text)
  values (p_post, p_parent, v_depth, auth.uid(), p_kind, v_body, v_phrase, v_trans, case when p_kind = 'comment' then null else 'pending' end, p_client_key, v_start, v_end, v_target)
  returning id into v_id;
  perform public.log_discussion(p_post, v_id, 'submitted', null, case when p_kind = 'comment' then null else 'pending' end);

  v_data := jsonb_build_object('post_id', p_post, 'item_id', v_id, 'phrase', public.post_snippet(post), 'parent_id', p_parent);
  if p_kind = 'comment' then
    perform public.notify_event(par.author_id, auth.uid(), 'post_reply', v_data, 'reply:' || v_id || ':' || coalesce(par.author_id::text, ''));
    if par.id is null or par.kind <> 'comment' then
      perform public.notify_event(post.user_id, auth.uid(), 'post_reply', v_data, 'reply:' || v_id || ':' || post.user_id);
    end if;
  else
    if post.post_type in ('library', 'lesson') then
      select * into pol from accountability_policy;
      insert into decision_items (user_id, post_id, item_id, due_at)
      values (post.user_id, p_post, v_id, now() + make_interval(hours => pol.deadline_hours));
      perform public.notify_event(post.user_id, auth.uid(), case when p_kind = 'correction' then 'post_correction' else 'post_clarification' end, v_data, 'submitted:' || v_id, true);
    else
      perform public.notify_event(post.user_id, auth.uid(), 'help_fix', v_data, 'help_fix:' || v_id);
    end if;
    if par.id is not null and par.author_id is distinct from post.user_id then
      perform public.notify_event(par.author_id, auth.uid(), 'post_challenged', v_data, 'challenged:' || v_id);
    end if;
  end if;
  perform public.refresh_post_review(p_post);
  return v_id;
end $$;

create function public.rate_help_fix(p_id uuid, p_helpful boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; post public.contribution_posts; v_status text := case when p_helpful then 'accepted' else 'declined' end; v_reward boolean := p_helpful; v_count int;
        v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 500);
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id for update;
  if it.id is null or it.kind <> 'correction' then raise exception 'correction_unavailable'; end if;
  select * into post from contribution_posts where id = it.post_id;
  if post.user_id <> auth.uid() or post.post_type in ('library', 'lesson') then raise exception 'forbidden'; end if;
  if it.status <> 'pending' then raise exception 'already_decided'; end if;

  update post_discussion set status = v_status, decided_by = auth.uid(), decided_at = now(), decision_note = v_note,
    feedback = case when p_helpful then 'helpful' else 'not_helpful' end, feedback_at = now()
  where id = it.id;
  perform public.log_discussion(post.id, it.id, v_status, 'pending', v_status, v_note);

  if v_reward then
    perform public.keep_correction(post.user_id, it.proposed_phrase, post.language_id, post.id);
    if not public.corrector_in_good_standing(it.author_id) then v_reward := false; end if;
    select count(*) into v_count from points_ledger where user_id = it.author_id and reason in ('correction_accepted','post_correction_accepted') and created_at > now() - interval '24 hours';
    if v_count >= 10 then v_reward := false; end if;
    select count(*) into v_count from points_ledger l join post_discussion d2 on d2.id = l.ref_id join contribution_posts p2 on p2.id = d2.post_id
    where l.user_id = it.author_id and l.reason = 'post_correction_accepted' and l.created_at > now() - interval '24 hours' and p2.user_id = post.user_id;
    if v_count >= 3 then v_reward := false; end if;
    if v_reward and it.author_id is not null then perform public.award_points(it.author_id, 5, 'post_correction_accepted', 'post_discussion', it.id); else v_reward := false; end if;
    perform public.notify_event(it.author_id, auth.uid(), 'help_thanked',
      jsonb_build_object('post_id', post.id, 'item_id', it.id, 'phrase', public.post_snippet(post), 'points', case when v_reward then 5 else 0 end), 'help_thanked:' || it.id);
  end if;
  perform public.refresh_post_review(post.id);
end $$;

create function public.search_posts(p_query text default null, p_language text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, user_id uuid, language_id text, phrase text, translation text, category text, source_context text,
  unsplash_image_url text, text_align text, pinned_at timestamptz, created_at timestamptz, updated_at timestamptz, certified_at timestamptz,
  author_username text, author_name text, author_avatar text, saved boolean,
  current_phrase text, current_translation text, review_status text, open_corrections int, thread_count int, endorse_count int,
  post_type text, body text, current_body text, image_layout text)
language plpgsql security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text;
begin
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_like is null and v_lang is null then return; end if;

  return query
  select c.id, c.user_id, c.language_id, c.phrase, c.translation, c.category, c.source_context,
    c.unsplash_image_url, c.text_align, c.pinned_at, c.created_at, c.updated_at, c.certified_at,
    a.username, a.display_name, a.avatar_url,
    exists (select 1 from saved_posts s where s.user_id = auth.uid() and s.post_id = c.id),
    c.current_phrase, c.current_translation, c.review_status, c.open_corrections, c.thread_count, c.endorse_count,
    c.post_type, c.body, c.current_body, c.image_layout
  from contribution_posts c
  join profiles a on a.id = c.user_id
  where c.post_type in ('library', 'lesson')
    and (a.status = 'active' or a.id = auth.uid())
    and not public.is_blocked_between(auth.uid(), c.user_id)
    and (v_lang is null or c.language_id = v_lang)
    and (v_like is null or c.phrase ilike v_like or c.body ilike v_like or c.translation ilike v_like or c.source_context ilike v_like
         or a.display_name ilike v_like or a.username ilike v_like)
  order by case
      when v_q is null then 2
      when lower(c.phrase) like v_q || '%' then 0
      when c.phrase ilike v_like then 1
      else 2 end,
    c.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

create trigger staff_refused before insert on public.contribution_posts for each row execute function public.refuse_staff_learner_action();
create trigger post_discussion_protect before update on public.post_discussion for each row execute function public.protect_discussion();
create trigger staff_refused before insert on public.post_discussion for each row execute function public.refuse_staff_learner_action();
create trigger staff_refused before insert on public.post_endorsements for each row execute function public.refuse_staff_learner_action();
create trigger staff_refused before insert on public.saved_posts for each row execute function public.refuse_staff_learner_action();

create policy "View contribution posts unless blocked" on public.contribution_posts for select to authenticated
  using (not public.is_blocked_between(auth.uid(), user_id));
create policy "closed during a pause" on public.post_discussion as restrictive for select to authenticated using ((select public.app_open()));
create policy "read discussion unless blocked" on public.post_discussion for select to authenticated
  using (not public.is_blocked_between(auth.uid(), author_id));
create policy "Read own saved posts" on public.saved_posts for select to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.post_discussion;

revoke all on function
  public.pin_contribution(uuid, boolean),
  public.toggle_saved_post(uuid),
  public.report_post(uuid, text, text),
  public.admin_remove_post(uuid, uuid),
  public.matches_my_languages(public.contribution_posts),
  public.is_contribution_eligible(uuid),
  public.protect_discussion(),
  public.set_thread_mute(uuid, boolean),
  public.post_snippet(public.contribution_posts),
  public.log_discussion(uuid, uuid, text, text, text, text),
  public.withdraw_discussion(uuid),
  public.toggle_post_endorsement(uuid),
  public.get_post_thread(uuid),
  public.post_contribution(text, text, text, text, text, text, text, text, text, text),
  public.update_contribution(uuid, text, text, text, text, text, text, text, text, text),
  public.delete_contribution(uuid),
  public.applied_body(uuid),
  public.refresh_post_review(uuid),
  public.post_help_request(text, text, text, text, text, text),
  public.help_supply(text),
  public.submit_discussion(uuid, uuid, text, text, text, text, uuid, integer, integer),
  public.rate_help_fix(uuid, boolean, text),
  public.search_posts(text, text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.pin_contribution(uuid, boolean),
  public.toggle_saved_post(uuid),
  public.report_post(uuid, text, text),
  public.admin_remove_post(uuid, uuid),
  public.matches_my_languages(public.contribution_posts),
  public.is_contribution_eligible(uuid),
  public.protect_discussion(),
  public.set_thread_mute(uuid, boolean),
  public.post_snippet(public.contribution_posts),
  public.withdraw_discussion(uuid),
  public.toggle_post_endorsement(uuid),
  public.get_post_thread(uuid),
  public.post_contribution(text, text, text, text, text, text, text, text, text, text),
  public.update_contribution(uuid, text, text, text, text, text, text, text, text, text),
  public.delete_contribution(uuid),
  public.post_help_request(text, text, text, text, text, text),
  public.help_supply(text),
  public.submit_discussion(uuid, uuid, text, text, text, text, uuid, integer, integer),
  public.rate_help_fix(uuid, boolean, text),
  public.search_posts(text, text, integer, integer)
to authenticated, service_role;

grant execute on function
  public.log_discussion(uuid, uuid, text, text, text, text),
  public.applied_body(uuid),
  public.refresh_post_review(uuid)
to service_role;
