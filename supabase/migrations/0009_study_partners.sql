-- 0009: Study partners — replaces the follows table with a private bookmark list.
-- This consolidation merges the concept from 0033_study_partners.sql,
-- replacing the public follows table with a private study_partners table.

-- ---------- Study partners table ----------

create table if not exists public.study_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, partner_id)
);

-- ---------- RLS policies ----------

alter table public.study_partners enable row level security;

-- Users can read their own study partners
create policy "users can read own study partners" on public.study_partners
  for select using (auth.uid() = user_id);

-- Users can add partners
create policy "users can add study partners" on public.study_partners
  for insert with check (auth.uid() = user_id);

-- Users can remove partners
create policy "users can remove study partners" on public.study_partners
  for delete using (auth.uid() = user_id);

-- ---------- Drop old follows table and policies (if applying fresh) ----------

-- Drop old follows policies
drop table if exists public.follows;

-- ---------- Comments for service layer ----------

-- Service layer updates (people.ts, discover.ts) will replace follows queries with study_partners queries.