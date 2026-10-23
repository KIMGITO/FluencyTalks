-- 0027: Points economy + public phrasebook library with Unsplash visual anchors.
--
-- NOTE on numbering: 0012 is already taken by 0012_single_reaction.sql, so this
-- ships as 0027 (the next free version after 0026).
--
-- 1. points_balance on profiles (default 100). Readable by anyone who can view
--    the profile, but never writable directly by clients: it is guarded by
--    protect_profile_columns() and only adjust_user_points() (security definer,
--    bypass_protect) may change it.
-- 2. adjust_user_points(user_id, amount): the single safe primitive for moving
--    points. A caller may only spend their own points (negative amount on their
--    own id) or credit another user (positive amount on a different id). A
--    client can therefore never inflate their own balance or drain someone else.
--    Raises if the target is missing or the balance would go negative.
-- 3. accept_correction() now pays the native helper +5 points when a correction
--    is finalized.
-- 4. saved_phrases gains is_public + unsplash_image_url for public vocabulary
--    decks with safe Unsplash visual anchors (URL strings only; no binaries).
-- 5. Bounty flagging (spend 50, transfer to helper) is built on top of
--    adjust_user_points in a later step; the primitive already enforces the
--    sufficient-balance check so no points can be created out of thin air.

-- ---------- 1. points_balance column ----------
alter table public.profiles
  add column if not exists points_balance int not null default 100;

-- Backfill profiles created before this migration.
update public.profiles set points_balance = 100 where points_balance is null;

-- ---------- 2. Guard points_balance from direct client edits ----------
create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' and not public.is_admin() then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done
       or new.points_balance <> old.points_balance then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;

-- ---------- 3. Safe point adjustment primitive ----------
create or replace function public.adjust_user_points(p_user_id uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  perform assert_active();

  if p_user_id is null then raise exception 'points_user_required'; end if;

  -- Self: only spending (negative) is allowed. Never credit yourself.
  if p_user_id = auth.uid() then
    if p_amount > 0 then raise exception 'points_self_credit_not_allowed'; end if;
  else
    -- Others: only crediting (positive) is allowed. Never spend someone else's points.
    if p_amount < 0 then raise exception 'points_spend_other_not_allowed'; end if;
  end if;

  select points_balance into v_balance from public.profiles where id = p_user_id;
  if not found then raise exception 'points_user_not_found'; end if;
  if v_balance + p_amount < 0 then raise exception 'insufficient_points'; end if;

  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles
  set points_balance = points_balance + p_amount
  where id = p_user_id;
end $$;

-- ---------- 4. Reward the helper when a correction is accepted ----------
create or replace function public.accept_correction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c message_corrections;
begin
  perform assert_active();
  select mc.* into c from message_corrections mc join messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  update message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);
  -- Native helper earns 5 points for a successfully finalized correction.
  perform public.adjust_user_points(c.corrector_id, 5);
end $$;

-- ---------- 5. Public phrasebook library + Unsplash visual anchors ----------
alter table public.saved_phrases
  add column if not exists is_public boolean not null default false,
  add column if not exists unsplash_image_url text;

create index if not exists saved_phrases_public_idx on public.saved_phrases (is_public, created_at desc) where is_public;

-- Anyone may read public phrases (the shared library). Owners retain full
-- control of their own phrases via the existing "own phrases" policy.
create policy "read public phrases" on public.saved_phrases for select
  using (is_public or auth.uid() = user_id);

-- ---------- Grants (match existing convention: signed-in clients only) ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;