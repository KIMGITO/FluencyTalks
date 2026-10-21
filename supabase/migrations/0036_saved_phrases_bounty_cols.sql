-- 0036: saved_phrases bounty columns
-- --------------------------------------------------------------
-- Add bounty tracking columns to saved_phrases table
-- These are used by the priority bounty system (F8)
-- --------------------------------------------------------------
alter table public.saved_phrases
  add column if not exists bounty_id uuid;
alter table public.saved_phrases
  add column if not exists bounty_cost int;
alter table public.saved_phrases
  add column if not exists bounty_status text not null default 'none' check (bounty_status in ('none','held','accepted','expired_refunded'));
alter table public.saved_phrases
  add column if not exists bounty_asker_id uuid references public.profiles(id);