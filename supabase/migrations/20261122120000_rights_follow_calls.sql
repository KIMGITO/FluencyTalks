-- Rights now follow the same rule as rating a call (assessor_basis_band), not "verified at B1".
--   * Correcting someone (a message, a bounty, a practice post or its fixes): a native speaker of the language, or a
--     learner who has passed a level above the one the author is working on. An author who is a native speaker can
--     only be corrected by native speakers.
--   * Teaching (Library posts and lessons): native speakers only. A call with no author means this.
--   * Messaging: like calls, only partners (an accepted connection) start a chat or send in one.

drop function public.can_correct_language(uuid, text);

create function public.can_correct_language(p_user uuid, p_language text, p_author uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select p_language is null
    or exists (select 1 from profiles where id = p_user and native_language_id = p_language)
    or (p_author is not null and p_author <> p_user
        and not exists (select 1 from profiles where id = p_author and native_language_id = p_language)
        and exists (select 1 from level_progress lp join path_levels l on l.band = lp.band
                    where lp.user_id = p_user and lp.language_id = p_language and lp.passed_at is not null
                      and l.rank > coalesce(
                        -- the level the author is working on; past C2 nobody but a native ranks above them
                        public.band_rank(public.current_band(p_author, p_language)),
                        (select max(l2.rank) + 1 from level_progress lp2 join path_levels l2 on l2.band = lp2.band
                         where lp2.user_id = p_author and lp2.language_id = p_language and lp2.passed_at is not null),
                        1)));
$$;

revoke all on function public.can_correct_language(uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_correct_language(uuid, text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- the checks, now told whose words they are

create or replace function public.nav_badges() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; v_home timestamptz; v_library timestamptz; v_bounties timestamptz;
        v_default timestamptz := now() - interval '3 days';
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.status <> 'active' then return '{}'::jsonb; end if;
  select coalesce(max(seen_at) filter (where tab = 'home'), v_default),
         coalesce(max(seen_at) filter (where tab = 'library'), v_default),
         coalesce(max(seen_at) filter (where tab = 'bounties'), v_default)
    into v_home, v_library, v_bounties
  from tab_seen where user_id = auth.uid();
  return jsonb_build_object(
    'home', (select count(*) from (select 1 from profiles p
              where p.created_at > v_home and p.id <> me.id and p.status = 'active' and p.onboarding_done
                and ((me.learning_language_id is not null and p.native_language_id = me.learning_language_id)
                  or (me.native_language_id is not null and p.learning_language_id = me.native_language_id))
                and not public.is_blocked_between(me.id, p.id) limit 100) x),
    'library', (select count(*) from (select 1 from contribution_posts c
              where c.created_at > v_library and c.user_id <> me.id
                and c.language_id in (me.native_language_id, me.learning_language_id)
                and not public.is_blocked_between(me.id, c.user_id) limit 100) x),
    'bounties',
      (select count(*) from message_corrections mc join messages m on m.id = mc.message_id
        where m.sender_id = me.id and m.bounty_status = 'open' and mc.status = 'pending')
      + (select count(*) from (select 1 from messages m
          where m.bounty_status = 'open' and m.deleted_at is null and m.created_at > v_bounties and m.sender_id <> me.id
            and m.bounty_expires_at > now() and public.can_correct_language(me.id, m.language_id, m.sender_id) and m.language_id is not null
            and not public.is_blocked_between(me.id, m.sender_id)
            and not exists (select 1 from message_corrections mc where mc.message_id = m.id and mc.corrector_id = me.id) limit 100) x)
      + (select count(*) from (select 1 from contribution_posts c
          where c.post_type not in ('library', 'lesson') and c.review_status = 'awaiting_feedback' and c.created_at > v_bounties and c.user_id <> me.id
            and public.can_correct_language(me.id, c.language_id, c.user_id) and not public.is_blocked_between(me.id, c.user_id) limit 100) x));
end $$;

create or replace function public.answer_bounty(p_message uuid, p_text text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.messages; v_id uuid; v_text text := btrim(p_text);
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  select * into m from public.messages where id = p_message;
  if not found or m.bounty_status <> 'open' then raise exception 'bounty_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  if public.is_blocked_between(auth.uid(), m.sender_id) then raise exception 'bounty_unavailable'; end if;
  if not public.can_correct_language(auth.uid(), m.language_id, m.sender_id) then raise exception 'not_qualified_to_correct'; end if;
  if v_text is null or char_length(v_text) = 0 then raise exception 'empty_message'; end if;
  if lower(v_text) = lower(btrim(m.body)) then raise exception 'no_change'; end if;
  if exists (select 1 from public.message_corrections where message_id = p_message and corrector_id = auth.uid()) then raise exception 'already_answered'; end if;
  if (select count(*) from public.message_corrections where corrector_id = auth.uid() and created_at > now() - interval '24 hours') >= 30 then raise exception 'rate_limited'; end if;
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), v_text, p_note) returning id into v_id;
  return v_id;
end $$;

create or replace function public.suggest_correction(p_message uuid, p_text text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.messages; v_id uuid; v_text text := btrim(p_text);
begin
  perform assert_active();
  select * into m from public.messages where id = p_message;
  if not found or not public.can_access_conversation(m.conversation_id) then raise exception 'conversation_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  if not public.can_correct_language(auth.uid(), m.language_id, m.sender_id) then raise exception 'not_qualified_to_correct'; end if;
  if v_text is null or char_length(v_text) = 0 then raise exception 'empty_message'; end if;
  if lower(v_text) = lower(btrim(m.body)) then raise exception 'no_change'; end if;
  if (select count(*) from public.message_corrections where corrector_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate_limited'; end if;
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), v_text, p_note) returning id into v_id;
  return v_id;
end $$;

create or replace function public.list_open_bounties(p_limit int default 20, p_offset int default 0)
returns table (message_id uuid, body text, language_id text, cost int, expires_at timestamptz, created_at timestamptz,
               asker_id uuid, asker_username text, asker_display_name text, asker_avatar_url text,
               answers int, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  return query
  select m.id, m.body, m.language_id, m.bounty_cost, m.bounty_expires_at, m.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         (select count(*)::int from public.message_corrections mc where mc.message_id = m.id and mc.status = 'pending'),
         case when exists (select 1 from public.conversation_members cm where cm.conversation_id = m.conversation_id and cm.user_id = auth.uid())
              then m.conversation_id end
  from public.messages m join public.profiles p on p.id = m.sender_id
  where m.bounty_status = 'open' and m.deleted_at is null and m.language_id is not null and m.sender_id <> auth.uid()
    and p.status = 'active' and not public.is_blocked_between(auth.uid(), m.sender_id)
    and public.can_correct_language(auth.uid(), m.language_id, m.sender_id)
    and not exists (select 1 from public.message_corrections mc where mc.message_id = m.id and mc.corrector_id = auth.uid())
  order by m.bounty_expires_at asc, m.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.toggle_correction_flag(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare it public.post_discussion; v_on boolean; v_lang text; v_author uuid;
begin
  perform assert_active();
  select * into it from post_discussion where id = p_id;
  if it.id is null or it.kind <> 'correction' or public.is_blocked_between(auth.uid(), it.author_id) then raise exception 'correction_unavailable'; end if;
  if it.author_id = auth.uid() then raise exception 'cannot_review_own'; end if;
  select language_id, user_id into v_lang, v_author from contribution_posts where id = it.post_id;
  if not public.can_correct_language(auth.uid(), v_lang, v_author) then raise exception 'not_qualified_to_correct'; end if;
  delete from correction_agreements where item_id = p_id and user_id = auth.uid() and stance = 'flag';
  v_on := not found;
  if v_on then
    insert into correction_agreements (item_id, user_id, stance) values (p_id, auth.uid(), 'flag')
    on conflict (item_id, user_id) do update set stance = 'flag', created_at = now();
    perform public.log_discussion(it.post_id, p_id, 'flagged', null, null);
  end if;
  return v_on;
end $$;

create or replace function public.toggle_post_endorsement(p_post uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare post public.contribution_posts; v_on boolean;
begin
  perform assert_active();
  select * into post from contribution_posts where id = p_post;
  if post.id is null or public.is_blocked_between(auth.uid(), post.user_id) then raise exception 'post_not_found'; end if;
  if post.user_id = auth.uid() then raise exception 'cannot_review_own'; end if;
  if not public.can_correct_language(auth.uid(), post.language_id, post.user_id) then raise exception 'not_qualified_to_correct'; end if;
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

create or replace function public.get_post_thread(p_post uuid) returns jsonb
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
      'can_review', post.user_id <> v_me and public.can_correct_language(v_me, post.language_id, post.user_id),
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

create or replace function public.post_help_request(p_type text, p_text text, p_context text default null, p_body text default null,
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
      and public.can_correct_language(p.id, post.language_id, me.id) and not public.is_blocked_between(me.id, p.id)
      and not exists (select 1 from notifications n where n.user_id = p.id and n.type = 'help_request' and n.created_at > now() - interval '6 hours')
    order by (p.native_language_id = post.language_id) desc, up.last_seen_at desc nulls last
    limit 5
  loop
    perform public.notify_event(v_helper, me.id, 'help_request', jsonb_build_object('post_id', post.id, 'phrase', public.post_snippet(post)), 'help_request:' || post.id || ':' || v_helper);
  end loop;

  return post.id;
end $$;

create or replace function public.help_supply(p_language text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from (
    select 1 from profiles p
    where p.id <> auth.uid() and p.status = 'active' and p.role = 'user' and p.onboarding_done
      and public.can_correct_language(p.id, public.normalize_language_code(p_language), auth.uid())
    limit 5) x;
$$;

create or replace function public.submit_discussion(p_post uuid, p_parent uuid, p_kind text, p_body text, p_phrase text default null, p_translation text default null, p_client_key uuid default null,
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
    if not public.can_correct_language(auth.uid(), post.language_id, post.user_id) then raise exception 'not_qualified_to_correct'; end if;
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

create or replace function public.is_contribution_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.native_language_id is not null
                   from public.profiles p where p.id = p_user), false);
$$;

-- ---------------------------------------------------------------- messaging follows calls

create or replace function public.start_conversation(p_target uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_key text; v_id uuid;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_message_self'; end if;
  if not exists (select 1 from profiles where id = p_target and status = 'active') or public.is_blocked_between(auth.uid(), p_target) then raise exception 'user_unavailable'; end if;
  -- Like calls: only partners (an accepted connection) message each other. Accepting the connection was the consent,
  -- under-16s included, so the chat opens straight away.
  -- Staff run the app, they don't use it: say so before anything about partners.
  if exists (select 1 from admin_accounts where user_id in (auth.uid(), p_target)) then raise exception 'staff_account'; end if;
  if not public.is_connected(auth.uid(), p_target) then raise exception 'not_connected'; end if;
  v_key := least(auth.uid()::text, p_target::text) || ':' || greatest(auth.uid()::text, p_target::text);
  select id into v_id from conversations where direct_key = v_key;
  if v_id is null then
    if (select count(*) from conversations where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;
    insert into conversations (direct_key, created_by) values (v_key, auth.uid()) returning id into v_id;
    insert into conversation_members (conversation_id, user_id, status) values (v_id, auth.uid(), 'active'), (v_id, p_target, 'active');
  else
    -- A message request from before connections counted is opened by the connection.
    update conversation_members set status = 'active' where conversation_id = v_id and status = 'request';
  end if;
  return v_id;
end $$;

create or replace function public.send_message(p_conv uuid, p_body text, p_reply_to uuid default null,
                                    p_language text default null, p_bounty boolean default false)
returns public.messages language plpgsql security definer set search_path = public as $$
declare
  m public.messages; v_other_status text; v_body text := btrim(p_body);
  me public.profiles; v_lang text := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
begin
  perform assert_active();
  if not public.can_access_conversation(p_conv) then raise exception 'conversation_unavailable'; end if;
  if v_body is null or char_length(v_body) = 0 then raise exception 'empty_message'; end if;
  select * into me from public.profiles where id = auth.uid();

  if v_lang is null then
    v_lang := coalesce(me.learning_language_id, me.native_language_id);
  elsif v_lang is distinct from me.native_language_id and v_lang is distinct from me.learning_language_id then
    raise exception 'language_not_yours';
  end if;

  select status into v_other_status from public.conversation_members where conversation_id = p_conv and user_id <> auth.uid();
  if not public.is_connected(auth.uid(), (select user_id from public.conversation_members where conversation_id = p_conv and user_id <> auth.uid() limit 1)) then raise exception 'not_connected'; end if;
  if v_other_status = 'request' and exists (select 1 from public.messages where conversation_id = p_conv and sender_id = auth.uid()) then raise exception 'awaiting_acceptance'; end if;
  if (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then raise exception 'rate_limited'; end if;
  if p_reply_to is not null and not exists (select 1 from public.messages where id = p_reply_to and conversation_id = p_conv) then raise exception 'invalid_reply'; end if;

  if coalesce(p_bounty, false) then
    perform public.refund_expired_bounties();
    if v_lang is null then raise exception 'bounty_needs_language'; end if;
    if (select count(*) from public.messages where sender_id = auth.uid() and bounty_status = 'open') >= 3 then raise exception 'too_many_bounties'; end if;
    if me.points_balance < 50 then raise exception 'insufficient_points'; end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body, reply_to, language_id, is_bounty, bounty_cost, bounty_status, bounty_expires_at)
  values (p_conv, auth.uid(), v_body, p_reply_to, v_lang, coalesce(p_bounty, false),
          case when coalesce(p_bounty, false) then 50 end,
          case when coalesce(p_bounty, false) then 'open' else 'none' end,
          case when coalesce(p_bounty, false) then now() + interval '48 hours' end)
  returning * into m;
  if coalesce(p_bounty, false) then
    perform public.award_points(auth.uid(), -50, 'bounty_posted', 'message', m.id);
  end if;
  update public.conversations set last_message_at = m.created_at where id = p_conv;
  update public.conversation_members set last_read_at = m.created_at where conversation_id = p_conv and user_id = auth.uid();
  return m;
end $$;
