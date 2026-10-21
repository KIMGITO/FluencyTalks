-- 0001: Base schema — profiles, user_languages, study_partners (replaces follows), RLS, auth trigger.
-- This replaces 0001_init.sql and parts of 0002_core_functions.sql and 0033_study_partners.sql.

-- ---------- Core tables ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text default '',
  timezone text,
  is_private boolean default false,
  created_at timestamptz default now()
);

create table public.user_languages (
  user_id uuid references public.profiles(id) on delete cascade,
  language_code text not null,
  role text check (role in ('native','learning')) not null,
  level text check (level in ('A1','A2','B1','B2','C1','C2','Native')),
  primary key (user_id, language_code, role)
);

-- Replace the follows table with a private study_partners bookmark list.
-- Each user has a list of partner profiles they've bookmarked for study.
create table public.study_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, partner_id)
);

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.study_partners enable row level security;

-- Profiles are hidden from anyone who is blocked by the owner, or blocked the viewer.
create policy "profiles readable unless blocked" on public.profiles for select using (
  not exists (select 1 from public.study_partners b where (b.user_id = id and b.partner_id = auth.uid()) or (b.user_id = auth.uid() and b.partner_id = id))
);

-- Users can read their own profile
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own languages" on public.user_languages for all using (auth.uid() = user_id);
create policy "languages readable" on public.user_languages for select using (true);
create policy "own study partners" on public.study_partners for select using (auth.uid() = user_id);
create policy "add study partner" on public.study_partners for insert with check (auth.uid() = user_id);
create policy "remove study partner" on public.study_partners for delete using (auth.uid() = user_id);

-- Auto-create a profile row on signup.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email,'@',1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Helper: check if user is blocked ----------

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_partners where (user_id = a and partner_id = b) or (user_id = b and partner_id = a));
$$;

-- ---------- Admin function: is_admin ----------

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator') and status = 'active');
$$;