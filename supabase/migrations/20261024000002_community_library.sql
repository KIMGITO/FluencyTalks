-- COMMUNITY LIBRARY + PARTNER MATCHING (v20261024000002)
-- NEW migration. Never edit past migrations.
-- Reuses public.saved_phrases for the public phrase library (owner can delete;
-- everyone read-only). Adds contribution helper eligibility + partner matching state.

-- ======================= CONTRIBUTION HELPER (B1+ eligibility) =======================
create table if not exists public.contribution_helper (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  certification text not null default 'none' check (certification in ('native','b1','b2','c1','c2')),
  note         text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists contribution_helper_cert_idx
  on public.contribution_helper (certification);

-- One native speaker, or a learner at B1+, may post to the library.
create or replace function public.is_contribution_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_languages ul join public.profiles p on p.id = ul.user_id
    where ul.user_id = p_user
      and ul.role = 'native'
  ) or exists (
    select 1 from public.user_languages ul where ul.user_id = p_user and ul.role = 'learning' and ul.level in ('B1','B2','C1','C2')
  );
$$;

create or replace function public.set_contribution_eligibility(p_user uuid, p_certification text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_certification = 'native' then
    insert into public.contribution_helper (user_id, certification, updated_at)
    values (p_user, p_certification, now())
    on conflict (user_id) do update set certification = 'native', updated_at = now();
  elsif p_certification ~ '^[bBC]1$' then
    insert into public.contribution_helper (user_id, certification, updated_at)
    values (p_user, p_certification, now())
    on conflict (user_id) do update set certification = p_certification, updated_at = now();
  else
    delete from public.contribution_helper where user_id = p_user;
  end if;
end $$;

create or replace function public.clear_contribution_eligibility(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.contribution_helper where user_id = p_user;
end $$;

revoke execute on function public.is_contribution_eligible(uuid) from public, anon;
grant execute on function public.is_contribution_eligible(uuid) to authenticated, service_role;
revoke execute on function public.set_contribution_eligibility(uuid, text) from public, anon;
grant execute on function public.set_contribution_eligibility(uuid, text) to authenticated, service_role;
revoke execute on function public.clear_contribution_eligibility(uuid) from public, anon;
grant execute on function public.clear_contribution_eligibility(uuid) to authenticated, service_role;

-- ======================= CONTRIBUTION POSTS =======================
create table if not exists public.contribution_posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  certified_at    timestamptz not null default now(),
  language_id     text references public.languages(id) on delete set null,
  phrase          text not null check (char_length(phrase) between 1 and 500),
  translation     text check (char_length(translation) <= 500),
  category        text not null default 'phrase' check (category in ('phrase','idiom','usage','grammar')),
  source_context  text check (char_length(source_context) <= 500),
  unsplash_image_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists contribution_posts_user_idx on public.contribution_posts (user_id);
create index if not exists contribution_posts_lang_idx on public.contribution_posts (language_id);
create index if not exists contribution_posts_created_idx on public.contribution_posts (created_at desc);

-- Library (public) uses saved_phrases already created in baseline + 0001:
--   - public library rows = saved_phrases where is_public = true
--   - contribution_posts is the private-to-library draft store; post() promotes it.

create or replace function public.post_contribution(p_phrase text, p_translation text default null, p_language text default null,
                                                    p_category text default 'phrase', p_source_context text default null,
                                                    p_unsplash_image_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_certified_at timestamptz;
begin
  perform assert_active();
  if not public.is_contribution_eligible(auth.uid()) then raise exception 'not_contribution_eligible'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  insert into public.contribution_posts (user_id, certified_at, language_id, phrase, translation, category,
                                         source_context, unsplash_image_url, updated_at)
  values (auth.uid(), now(), public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), '')),
          left(btrim(p_phrase), 500), left(p_translation, 500), left(btrim(coalesce(p_category, 'phrase')), 20),
          left(btrim(coalesce(p_source_context, '')), 500), p_unsplash_image_url, now())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_contribution(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  delete from public.contribution_posts where id = p_id and user_id = auth.uid();
end $$;

revoke execute on function public.post_contribution(text, text, text, text, text, text) from public, anon;
grant execute on function public.post_contribution(text, text, text, text, text, text) to authenticated, service_role;
revoke execute on function public.delete_contribution(uuid) from public, anon;
grant execute on function public.delete_contribution(uuid) to authenticated, service_role;

-- ======================= MATCHING / SAVED PARTNERS =======================
create table if not exists public.saved_partners (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, partner_id)
);
create index if not exists saved_partners_partner_idx on public.saved_partners (partner_id);

create or replace function public.save_partner(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  insert into public.saved_partners (user_id, partner_id)
  values (auth.uid(), p_partner)
  on conflict (user_id, partner_id) do nothing;
end $$;

create or replace function public.delete_partner(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  delete from public.saved_partners where user_id = auth.uid() and partner_id = p_partner;
end $$;

create or replace function public.list_saved_partner_ids()
returns table (partner_id uuid) language sql stable security definer set search_path = public as $$
  select partner_id from public.saved_partners where user_id = auth.uid();
$$;

revoke execute on function public.save_partner(uuid) from public, anon;
grant execute on function public.save_partner(uuid) to authenticated, service_role;
revoke execute on function public.delete_partner(uuid) from public, anon;
grant execute on function public.delete_partner(uuid) to authenticated, service_role;
revoke execute on function public.list_saved_partner_ids() from public, anon;
grant execute on function public.list_saved_partner_ids() to authenticated, service_role;

-- ======================= GRANTS =======================
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- RLS for contribution_posts
alter table public.contribution_posts enable row level security;

create policy "Anyone can view contribution posts"
  on public.contribution_posts for select
  to authenticated
  using (not exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = contribution_posts.user_id));

create policy "Users can delete their own contribution posts"
  on public.contribution_posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS for contribution_helper
alter table public.contribution_helper enable row level security;

create policy "Anyone can view contribution helpers"
  on public.contribution_helper for select
  to authenticated
  using (true);

-- RLS for saved_partners
alter table public.saved_partners enable row level security;

create policy "Users can view their own saved partners"
  on public.saved_partners for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own saved partners"
  on public.saved_partners for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved partners"
  on public.saved_partners for delete
  to authenticated
  using (auth.uid() = user_id);

