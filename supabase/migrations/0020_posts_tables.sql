-- 0020: blog posts (admin) + stories (users). One table, kind = blog|story.
-- Rich blocks JSON, eye-reads, saves, learning notes. Posts vanish with author.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('blog','story')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  blocks jsonb not null default '[]',
  body_text text not null default '',
  language_id text null,
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_kind_time_idx on public.posts (kind, created_at desc);
create table if not exists public.post_reads (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists post_notes_post_idx on public.post_notes (post_id, created_at);
create index if not exists post_notes_user_idx on public.post_notes (user_id, created_at desc);
alter table public.posts enable row level security;
alter table public.post_reads enable row level security;
alter table public.post_saves enable row level security;
alter table public.post_notes enable row level security;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
