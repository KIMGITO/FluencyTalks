-- 0033: study_partners replaces follows
-- --------------------------------------------------------------
-- 1. Create study_partners table (private bookmark list)
-- --------------------------------------------------------------
create table if not exists public.study_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, partner_id)
);

-- --------------------------------------------------------------
-- 2. Enable RLS and policies for study_partners
-- --------------------------------------------------------------
alter table public.study_partners enable row level security;

-- Users can read their own study partners
create policy "users can read own study partners" on public.study_partners
  for select using (auth.uid() = user_id);

-- Users can add partners (insert as user_id)
create policy "users can add study partners" on public.study_partners
  for insert with check (auth.uid() = user_id);

-- Users can remove partners (delete by user_id)
create policy "users can remove study partners" on public.study_partners
  for delete using (auth.uid() = user_id);

-- --------------------------------------------------------------
-- 3. Drop the old follows table and related columns/objects
-- --------------------------------------------------------------
drop policy if exists "follow as self" on public.follows;
drop policy if exists "see own follow rows" on public.follows;
drop table if exists public.follows;

-- --------------------------------------------------------------
-- 4. Comment: service layer updates (people.ts, discover.ts)
--    will replace follows queries with study_partners queries.
-- --------------------------------------------------------------