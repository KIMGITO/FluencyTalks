-- Hardening after the community library migration (20261024000002). Never edit past migrations.
--
-- 1. POINTS: 0002 ended with "grant execute on all functions ... to authenticated", which re-opened
--    award_points() and refund_expired_bounties() to every signed-in user. Anyone could call
--    award_points(me, 1000000, ...) and mint points. Closed again at the end of this file.
-- 2. contribution_helper / set_contribution_eligibility / clear_contribution_eligibility let ANY
--    signed-in user grant or remove anyone's "certification" (the person id was a parameter).
--    Nothing used them: eligibility is derived from the profile. Removed.
-- 3. post_contribution: you may post in a language only if you are qualified in THAT language
--    (native speaker, or learner at B1+: the same rule as corrections); valid category; image URL
--    must be an Unsplash image; 20 posts per day.
-- 4. save_partner: not yourself, only active people, not blocked, at most 100; clients can no longer
--    write saved_partners directly.
-- 5. The library read policy now hides blocked people in both directions.

-- ---------- 2. Remove the self-certification surface ----------
drop function if exists public.set_contribution_eligibility(uuid, text);
drop function if exists public.clear_contribution_eligibility(uuid);
drop table if exists public.contribution_helper;

-- Eligibility comes from the profile (the source of truth), not from a user-editable table.
create or replace function public.is_contribution_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.native_language_id is not null or p.learning_level in ('B1', 'B2', 'C1', 'C2')
                   from public.profiles p where p.id = p_user), false);
$$;

-- ---------- 3. Library posts ----------
create or replace function public.post_contribution(p_phrase text, p_translation text default null, p_language text default null,
                                                    p_category text default 'phrase', p_source_context text default null,
                                                    p_unsplash_image_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  -- You can teach a language you speak natively, or know at B1 or above.
  if not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  -- Only an Unsplash image URL is accepted: no arbitrary links or tracking pixels shown to other users.
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if (select count(*) from public.contribution_posts where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;

  insert into public.contribution_posts (user_id, certified_at, language_id, phrase, translation, category, source_context, unsplash_image_url, updated_at)
  values (auth.uid(), now(), v_lang, left(btrim(p_phrase), 500), left(nullif(btrim(coalesce(p_translation, '')), ''), 500), v_cat,
          left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), v_img, now())
  returning id into v_id;
  return v_id;
end $$;

drop policy if exists "Anyone can view contribution posts" on public.contribution_posts;
create policy "View contribution posts unless blocked" on public.contribution_posts for select to authenticated
  using (not public.is_blocked_between(auth.uid(), user_id));

-- ---------- 4. Saved partners ----------
create or replace function public.save_partner(p_partner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_partner is null or p_partner = auth.uid() then raise exception 'cannot_save_self'; end if;
  if not exists (select 1 from public.profiles where id = p_partner and status = 'active' and onboarding_done)
     or public.is_blocked_between(auth.uid(), p_partner) then
    raise exception 'user_unavailable';
  end if;
  if not exists (select 1 from public.saved_partners where user_id = auth.uid() and partner_id = p_partner)
     and (select count(*) from public.saved_partners where user_id = auth.uid()) >= 100 then
    raise exception 'partner_limit';
  end if;
  insert into public.saved_partners (user_id, partner_id) values (auth.uid(), p_partner) on conflict do nothing;
end $$;

-- Reads stay (own rows); writes go through save_partner / delete_partner only.
drop policy if exists "Users can insert their own saved partners" on public.saved_partners;
drop policy if exists "Users can delete their own saved partners" on public.saved_partners;
-- Blocking someone also removes the bookmark both ways.
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_block_self'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  delete from public.follows where (follower_id = auth.uid() and followee_id = p_target) or (follower_id = p_target and followee_id = auth.uid());
  delete from public.saved_partners where (user_id = auth.uid() and partner_id = p_target) or (user_id = p_target and partner_id = auth.uid());
end $$;

-- ---------- 1. Grants: re-apply, then close the internal functions again ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
-- Internal only. The blanket grant above re-opens them, so these lines must stay LAST.
revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.refund_expired_bounties() from public, anon, authenticated;
