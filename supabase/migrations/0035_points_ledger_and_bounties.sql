-- 0035: points ledger + priority bounty system
-- 1. Create points_ledger table
create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete set null,
  delta int not null,
  reason text not null check (reason in (
    'sign_up',
    'correction_accepted',
    'bounty_answered_accepted',
    'bounty_expired_refund',
    'bounty_posted',
    'language_change'
  )),
  ref_type text not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (reason, ref_type, ref_id)
);alter table public.points_ledger enable row level security;

-- 4. Sign-up bonus function (records the 10-point bonus portion of the 100 start)
create or replace function public.record_signup_bonus(p_user_id uuid) returns void language plpgsql security definer set search_path = public as
begin
  perform public.apply_points_delta(p_user_id, 10, 'sign_up', 'profile', p_user_id);
end
\$\$;

-- 5. Correction reward function: +5 to corrector when learner accepts
create or replace function public.record_correction_reward(p_correction_id uuid) returns void language plpgsql security definer set search_path = public as
declare
  c message_corrections;
  m messages;
  corrector_id uuid;
begin
  select mc, m.* into c, m
  from message_corrections mc
  join messages m on m.id = mc.message_id
  where mc.id = p_correction_id;

  if not found then raise exception 'correction_not_found'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_reward_self'; end if;

  corrector_id := c.corrector_id;
  perform public.apply_points_delta(corrector_id, 5, 'correction_accepted', 'correction', p_correction_id);
  -- Save the phrase to the learner's phrasebook
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);
end
\$\$;

-- 6. Bounty: asker spends points to post an urgent question
create or replace function public.post_bounty(
  p_language_id uuid,
  p_text text,
  p_cost int default 50
) returns uuid language plpgsql security definer set search_path = public as
declare
  asker_balance int;
begin
  select points_balance into asker_balance from public.profiles where id = auth.uid();
  if asker_balance < p_cost then raise exception 'insufficient_points'; end if;

  perform public.apply_points_delta(auth.uid(), -p_cost, 'bounty_posted', 'bounty', null);

  -- Create bounty entry in saved_phrases with bounty markers
  insert into public.saved_phrases (user_id, phrase, language_code, is_public, unsplash_image_url, bounty_id, bounty_cost, bounty_status, bounty_asker_id)
  values (auth.uid(), p_text, p_language_id, false, null, gen_random_uuid(), p_cost, 'held', auth.uid());

  return (select id from public.saved_phrases where bounty_id = (select max(bounty_id) from public.saved_phrases where user_id = auth.uid() limit 1));
end
\$\$;

-- 7. Indexes for ledger query performance
create index if not exists idx_points_ledger_user_id on public.points_ledger (user_id);
create index if not exists idx_points_ledger_reason on public.points_ledger (reason, ref_type, ref_id);

-- 9. Bounty answer function: helper accepts bounty, receives 50 points, phrase saved to learner
create or replace function public.accept_bounty(p_saved_phrase_id uuid) returns uuid language plpgsql security definer set search_path = public as
declare
  sp public.saved_phrases;
  conv public.conversations;
  helper_id uuid;
begin
  select * into sp from public.saved_phrases where id = p_saved_phrase_id;
  if not found then raise exception 'bounty_not_found'; end if;
  if sp.bounty_status != 'held' then raise exception 'bounty_already_resolved'; end if;
  -- Find the conversation between asker and helper
  select conversation_id into conv from public.conversation_members
  where user_id in (auth.uid(), sp.bounty_asker_id) and conversation_id in (
    select conversation_id from public.conversation_members
    where user_id in (auth.uid(), sp.bounty_asker_id)
    group by conversation_id
    having count(distinct user_id) = 2
  ) limit 1;
  -- Award 50 points to the helper
  perform public.apply_points_delta(sp.bounty_asker_id, 50, 'bounty_answered_accepted', 'bounty', p_saved_phrase_id);
  -- Refund the asker (points already deducted when posted, so just update status)
  update public.saved_phrases set bounty_status = 'accepted', updated_at = now() where id = p_saved_phrase_id;
  -- Save the corrected phrase to the asker's phrasebook (the bounty text)
  perform public.save_phrase(sp.phrase, null, sp.language_code, sp.source_message_id);
  return sp.id;
end
$$;

-- 10. Bounty expiry function: 48h after posting, refund to asker if unaccepted
create or replace function public.expire_bounty(p_saved_phrase_id uuid) returns uuid language plpgsql security definer set search_path = public as
declare
  sp public.saved_phrases;
begin
  select * into sp from public.saved_phrases where id = p_saved_phrase_id;
  if not found then raise exception 'bounty_not_found'; end if;
  if sp.bounty_status != 'held' then raise exception 'bounty_already_resolved'; end if;
  -- Check if 48 hours have passed since creation
  if now() > sp.created_at + interval '48 hours' then
    -- Refund 50 points to the asker
    perform public.apply_points_delta(sp.bounty_asker_id, 50, 'bounty_expired_refund', 'bounty', p_saved_phrase_id);
    update public.saved_phrases set bounty_status = 'expired_refunded' where id = p_saved_phrase_id;
  else
    raise exception 'bounty_not_expired_yet';
  end if;
  return sp.id;
end
$$;

-- 11. Grants: only authenticated users may call the payout functions
revoke execute on function public.adjust_user_points(int) from public, anon;
grant execute on function public.apply_points_delta(uuid, int, text, text, uuid) to authenticated;
grant execute on function public.record_signup_bonus(uuid) to authenticated;
grant execute on function public.record_correction_reward(uuid) to authenticated;
grant execute on function public.accept_bounty(uuid) to authenticated;
grant execute on function public.expire_bounty(uuid) to authenticated;
