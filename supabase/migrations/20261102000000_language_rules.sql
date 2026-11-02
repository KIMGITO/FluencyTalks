-- Language rules: matching, post language and points. NEW migration. Never edit past migrations.
--
-- 1. home_feed follows the match tiers (docs/PRODUCT_ANALYSIS F2, B4-B6): perfect swap, then they
--    teach me, then I teach them. Sharing a native or target language is not a match. Follower
--    count no longer ranks anyone: recent activity, then timezone overlap, then newest.
-- 2. Posts can be ranked for the reader: matches_my_languages() is a PostgREST computed column.
-- 3. update_contribution: a post can keep the language it already has, so an author whose
--    languages or level changed can still fix a typo. Moving a post to another language still
--    needs the qualification.
-- 4. suggest_correction: no empty or unchanged text, at most 20 per hour (R2, R6).
-- 5. accept_correction: an untagged message earns no +5 (B8), and the saved phrase keeps the
--    message's language so the phrasebook filter finds it.

-- ---------- 1. Matching ----------
-- Whole-hour distance between two time zones, around the clock. NULL when either is missing or not
-- a real zone: profiles.timezone is free text, and pg_timezone_names is far too slow to join here.
create or replace function public.tz_hours_apart(p_a text, p_b text) returns numeric
language plpgsql stable set search_path = public as $$
declare v_diff numeric;
begin
  v_diff := abs(extract(epoch from (now() at time zone p_a) - (now() at time zone p_b))) / 3600;
  return least(v_diff, 24 - v_diff);
exception when others then
  return null;
end $$;

create or replace function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    select me.native_language_id as native, me.learning_language_id as learning, me.timezone as tz
    from profiles me where me.id = auth.uid()
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
      -- What the badge names: the language they teach me, else the one I teach them.
      case
        when p.native_language_id = mine.learning then p.native_language_id
        when p.learning_language_id = mine.native then p.learning_language_id
      end as match_language,
      -- Whole days, otherwise the timestamp alone decides and timezone overlap never counts.
      date_trunc('day', greatest(p.created_at,
        (select max(m.created_at) from messages m where m.sender_id = p.id),
        (select max(c.created_at) from contribution_posts c where c.user_id = p.id))) as active_day,
      public.tz_hours_apart(p.timezone, mine.tz) as tz_apart
    from profiles p cross join mine
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  -- Every column is table-qualified: plpgsql would treat a bare "id" or "languages" as the
  -- function's OUT parameter and refuse the query as ambiguous.
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language
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

-- ---------- 2. Posts in my languages ----------
create or replace function public.matches_my_languages(p public.contribution_posts) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.language_id in (me.native_language_id, me.learning_language_id)
                   from public.profiles me where me.id = auth.uid()), false);
$$;

-- ---------- 3. Editing keeps the post's own language ----------
create or replace function public.update_contribution(p_id uuid, p_phrase text, p_translation text default null, p_language text default null,
                                                      p_category text default 'phrase', p_source_context text default null,
                                                      p_unsplash_image_url text default null, p_text_align text default 'left')
returns void language plpgsql security definer set search_path = public as $$
declare v_lang text; v_old text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left')));
begin
  perform assert_active();
  select language_id into v_old from public.contribution_posts where id = p_id and user_id = auth.uid();
  if not found then raise exception 'post_not_found'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if v_lang is distinct from v_old and not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;

  update public.contribution_posts
     set language_id = v_lang, phrase = left(btrim(p_phrase), 500), translation = left(nullif(btrim(coalesce(p_translation, '')), ''), 500),
         category = v_cat, source_context = left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), unsplash_image_url = v_img,
         text_align = v_align, updated_at = now()
   where id = p_id and user_id = auth.uid();
end $$;

-- ---------- 4. suggest_correction: same text checks as answer_bounty, plus a rate limit ----------
create or replace function public.suggest_correction(p_message uuid, p_text text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.messages; v_id uuid; v_text text := btrim(p_text);
begin
  perform assert_active();
  select * into m from public.messages where id = p_message;
  if not found or not public.can_access_conversation(m.conversation_id) then raise exception 'conversation_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  if not public.can_correct_language(auth.uid(), m.language_id) then raise exception 'not_qualified_to_correct'; end if;
  if v_text is null or char_length(v_text) = 0 then raise exception 'empty_message'; end if;
  if lower(v_text) = lower(btrim(m.body)) then raise exception 'no_change'; end if;
  if (select count(*) from public.message_corrections where corrector_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate_limited'; end if;
  insert into public.message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), v_text, p_note) returning id into v_id;
  return v_id;
end $$;

-- ---------- 5. accept_correction ----------
create or replace function public.accept_correction(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.message_corrections; v_msg public.messages; v_reward boolean := true; v_count int;
begin
  perform assert_active();
  perform public.refund_expired_bounties();
  select mc.* into c from public.message_corrections mc join public.messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  select * into v_msg from public.messages where id = c.message_id;

  update public.message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, v_msg.language_id, c.message_id);

  if v_msg.bounty_status = 'open' then
    update public.messages set bounty_status = 'paid', bounty_paid_to = c.corrector_id where id = v_msg.id;
    perform public.award_points(c.corrector_id, v_msg.bounty_cost, 'bounty_answered_accepted', 'message', v_msg.id);
    -- The helper may not be in this chat, so the notification carries the points but no conversation id.
    perform public.notify(c.corrector_id, auth.uid(), 'bounty_paid', jsonb_build_object('points', v_msg.bounty_cost, 'message_id', v_msg.id));
    return;
  end if;

  -- Ordinary +5, with limits so two accounts cannot farm each other.
  -- An untagged message has no language to check the corrector against, so it earns nothing.
  if v_msg.language_id is null then v_reward := false; end if;
  if lower(btrim(c.suggested_text)) = lower(btrim(v_msg.body)) then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger
   where user_id = c.corrector_id and reason = 'correction_accepted' and created_at > now() - interval '24 hours';
  if v_count >= 10 then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger l
   join public.message_corrections mc2 on mc2.id = l.ref_id
   join public.messages m2 on m2.id = mc2.message_id
   where l.user_id = c.corrector_id and l.reason = 'correction_accepted'
     and l.created_at > now() - interval '24 hours' and m2.sender_id = v_msg.sender_id;
  if v_count >= 3 then v_reward := false; end if;
  if v_reward then perform public.award_points(c.corrector_id, 5, 'correction_accepted', 'correction', c.id); end if;
  perform public.notify(c.corrector_id, auth.uid(), 'correction_accepted',
    jsonb_build_object('conversation_id', v_msg.conversation_id, 'message_id', v_msg.id, 'points', case when v_reward then 5 else 0 end));
end $$;

-- ---------- Grants ----------
revoke execute on function public.matches_my_languages(public.contribution_posts) from public, anon;
grant  execute on function public.matches_my_languages(public.contribution_posts) to authenticated, service_role;
-- Internal: only home_feed needs it.
revoke execute on function public.tz_hours_apart(text, text) from public, anon, authenticated;
