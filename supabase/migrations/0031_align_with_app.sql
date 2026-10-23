-- 0031: align the database with what the app now sends.
--
-- The report dialog offers 'fake_correction' and 'points_abuse' (src/lib/constants.ts), but
-- reports.reason only allowed the original seven values, so those reports failed with a check
-- violation. Keep this list identical to REPORT_REASONS in the app.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in (
  'harassment', 'spam', 'inappropriate', 'impersonation', 'underage', 'scam',
  'fake_correction', 'points_abuse', 'other'));

-- ---------- Points ledger: an audit trail behind points_balance ----------
-- The Points History page reads this table (src/services/history.ts). Clients can only READ
-- their own rows; every write goes through award_points(), which is not callable from the API.
create table if not exists public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null check (reason in ('correction_accepted', 'bounty_posted', 'bounty_answered_accepted', 'bounty_expired_refund')),
  ref_type   text not null,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),
  -- One payout per user per event: replaying an event can never pay twice.
  unique (user_id, reason, ref_type, ref_id)
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
alter table public.points_ledger enable row level security;
drop policy if exists "read own ledger" on public.points_ledger;
create policy "read own ledger" on public.points_ledger for select using (auth.uid() = user_id);

-- The only way points move. Returns false (and changes nothing) if this event was already paid.
create or replace function public.award_points(p_user uuid, p_delta int, p_reason text, p_ref_type text, p_ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  insert into public.points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref)
  on conflict (user_id, reason, ref_type, ref_id) do nothing;
  if not found then return false; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set points_balance = points_balance + p_delta where id = p_user returning points_balance into v_balance;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;
  return true;
end $$;

-- adjust_user_points let any signed-in client credit anyone any amount (closed in 0029) and
-- nothing needs it any more: award_points replaces it.
drop function if exists public.adjust_user_points(uuid, int);

-- Accepting a correction still saves the phrase; the +5 reward now goes through the ledger,
-- with limits so two accounts cannot farm points by "correcting" each other:
--   * no reward when the "correction" is the same text as the original
--   * at most 10 rewarded corrections per corrector per 24 hours
--   * at most 3 rewarded corrections per corrector for the same author per 24 hours
-- The correction is accepted and the phrase saved either way; only the reward is withheld.
create or replace function public.accept_correction(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.message_corrections; v_msg public.messages; v_reward boolean := true; v_count int;
begin
  perform assert_active();
  select mc.* into c from public.message_corrections mc join public.messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  select * into v_msg from public.messages where id = c.message_id;

  update public.message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);

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
end $$;

-- ---------- Columns the app's types and pages already expect ----------
-- messages.language_id: the Message type has it. Nothing fills it yet (the sender will pick the
-- language they are writing in); it is nullable and harmless until then.
alter table public.messages add column if not exists language_id text references public.languages(id);

-- Bounty Queue page (src/services/phrasebook.ts) filters on these. PROVISIONAL: the page is a
-- stub, there is no function that posts or pays a bounty yet, and a proper design (its own table
-- with escrow) will replace these columns. Defaults keep every existing phrase unaffected.
alter table public.saved_phrases
  add column if not exists bounty_status   text not null default 'none' check (bounty_status in ('none', 'held', 'accepted', 'expired_refunded')),
  add column if not exists bounty_cost     int,
  add column if not exists bounty_asker_id uuid references public.profiles(id) on delete set null;

-- ---------- Grants (project convention) ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
-- The blanket grant above re-opens this one; it moves points and must stay internal-only.
revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
