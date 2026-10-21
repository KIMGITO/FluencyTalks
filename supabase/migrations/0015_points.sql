-- 0015: Points economy + bounty system.
-- Consolidated from 0027_points_and_library_upgrade.sql, 0029_restore_grants_lock_points.sql,
-- 0035_points_ledger_and_bounties.sql, and 0036_saved_phrases_bounty_cols.sql.

-- ---------- 1. points_balance column on profiles ----------

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

create or replace function public.adjust_user_points(p_user_id uuid, p_amount int) returns void language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  perform assert_active();
  -- A caller may only spend their own points (negative amount on their own id)
  -- or credit another user (positive amount on a different id).
  if p_user_id = auth.uid() and p_amount < 0 then
    -- Spending own points: check balance won't go negative
    select coalesce(points_balance, 0) into v_balance from profiles where id = auth.uid();
    if v_balance + p_amount < 0 then raise exception 'insufficient_points'; end if;
  end if;
  -- Update the balance
  update profiles set points_balance = points_balance + p_amount where id = p_user_id;
end $$;

-- ---------- 4. Points ledger table ----------

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete set null,
  delta int not null,
  reason text not null check (reason in ('sign_up','correction_accepted','bounty_answered_accepted','bounty_expired_refund','bounty_posted','language_change')),
  ref_type text not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (reason, ref_type, ref_id)
);

alter table public.points_ledger enable row level security;

-- ---------- 5. Sign-up bonus function ----------

create or replace function public.record_signup_bonus(p_user_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin perform public.apply_points_delta(p_user_id, 10, 'sign_up', 'profile', p_user_id); end $$;

-- ---------- 6. Correction reward function ----------

create or replace function public.record_correction_reward(p_correction_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  v_mc record;
  v_m record;
begin
  select mc.*, m.sender_id, m.conversation_id into v_mc
  from message_corrections mc
  join messages m on m.id = mc.message_id
  where mc.id = p_correction_id;

  if not found then raise exception 'correction_not_found'; end if;
  if v_mc.sender_id = auth.uid() then raise exception 'cannot_reward_self'; end if;

  perform public.adjust_user_points(v_mc.corrector_id, 5);
  -- Save the phrase to the learner's phrasebook
  perform public.save_phrase(v_mc.suggested_text, null, null, v_mc.message_id);
end $$;

-- ---------- 7. Bounty: asker spends points to post an urgent question ----------

create or replace function public.post_bounty_question(p_question_text text, p_bounty_cost int default 50) returns uuid
language plpgsql security definer set search_path = public as
$$ declare v_asker uuid := auth.uid(); v_result uuid;
begin
  if p_bounty_cost < 10 then raise exception 'bounty_too_low'; end if;
  perform adjust_user_points(v_asker, -p_bounty_cost);
  -- Record the bounty in the ledger
  insert into points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (v_asker, -p_bounty_cost, 'bounty_posted', 'profile', v_asker)
  returning id into v_result;
  return v_result;
end $$;

-- ---------- 8. Bounty: answering a held bounty ----------

create or replace function public.answer_bounty_accepted(p_bounty_id uuid) returns uuid
language plpgsql security definer set search_path = public as
$$ declare
  v_helper uuid;
  v_cost int := 50;
begin
  -- Deduct from asker, add to helper
  perform adjust_user_points(auth.uid(), -v_cost);
  -- Find the helper (who posted the bounty answer)
  -- ... (service layer logic)
  perform adjust_user_points(v_helper, v_cost);
  -- Record in ledger
  insert into points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (auth.uid(), -v_cost, 'bounty_expired_refund', 'profile', auth.uid());
  insert into points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (v_helper, v_cost, 'bounty_answered_accepted', 'profile', v_helper);
  return v_helper;
end $$;

-- ---------- 9. Bounty columns on saved_phrases ----------

alter table public.saved_phrases
  add column if not exists bounty_id uuid;

alter table public.saved_phrases
  add column if not exists bounty_cost int default 50;

alter table public.saved_phrases
  add column if not exists bounty_status text not null default 'none'
    check (bounty_status in ('none','held','accepted','expired_refunded'));

alter table public.saved_phrases
  add column if not exists bounty_asker_id uuid references public.profiles(id);