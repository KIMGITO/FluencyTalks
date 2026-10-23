-- FluencyTalks initial schema. Keep all schema changes as migrations in this folder.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique, display_name text, avatar_url text, bio text default '',
  timezone text, is_private boolean default false, created_at timestamptz default now()
);
create table public.user_languages (
  user_id uuid references public.profiles(id) on delete cascade,
  language_code text not null, role text check (role in ('native','learning')) not null,
  level text check (level in ('A1','A2','B1','B2','C1','C2','Native')),
  primary key (user_id, language_code, role)
);
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('pending','accepted')) default 'accepted',
  created_at timestamptz default now(), primary key (follower_id, followee_id)
);
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(), primary key (blocker_id, blocked_id)
);
create index on public.follows (followee_id); create index on public.blocks (blocked_id);

alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;

-- Profiles are hidden from anyone who is blocked by the owner, or blocked the viewer.
create policy "profiles readable unless blocked" on public.profiles for select using (
  not exists (select 1 from public.blocks b where (b.blocker_id = id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = id)));
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own languages" on public.user_languages for all using (auth.uid() = user_id);
create policy "languages readable" on public.user_languages for select using (true);
create policy "follow as self" on public.follows for all using (auth.uid() = follower_id);
create policy "see own follow rows" on public.follows for select using (auth.uid() in (follower_id, followee_id));
create policy "manage own blocks" on public.blocks for all using (auth.uid() = blocker_id);

-- Auto-create a profile row on signup.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, split_part(new.email,'@',1)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
