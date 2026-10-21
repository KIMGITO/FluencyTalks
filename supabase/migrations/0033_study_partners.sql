-- 0033: study partners replaces follow/unfollow
-- --------------------------------------------------------------
-- 1. Create study_partners table: private bookmark list
--    user_id saves partner_id. No counts, no notifications, no public lists.
-- --------------------------------------------------------------
create table if not exists public.study_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, partner_id)
);

-- --------------------------------------------------------------
-- 2. Index for fast lookup of a user's study partners
-- --------------------------------------------------------------
create index if not exists study_partners_user_id_idx on public.study_partners (user_id);

-- --------------------------------------------------------------
-- 3. RLS: authenticated users can read their own study partners
-- --------------------------------------------------------------
alter table public.study_partners enable row level security;
create policy "users can read own study partners" on public.study_partners
for select using (auth.uid() = user_id);

-- --------------------------------------------------------------
-- 4. Comment: this replaces the facebook-style follows/followers system.
--    - No follower/following counts
--    - No follow requests or notifications
--    - Partners are not notified when saved
--    - Private bookmark list per user
-- --------------------------------------------------------------