-- Post actions: text alignment, pin to profile, save for later, report a post.

-- ---------- 1. Columns on posts ----------
alter table public.contribution_posts
  add column if not exists text_align text not null default 'left' check (text_align in ('left', 'center', 'right')),
  add column if not exists pinned_at timestamptz;
create index if not exists contribution_posts_pinned_idx on public.contribution_posts (user_id, pinned_at desc nulls last);

-- ---------- 2. Post / edit take the alignment (old signatures dropped so the RPC is not ambiguous) ----------
drop function if exists public.post_contribution(text, text, text, text, text, text);
create or replace function public.post_contribution(p_phrase text, p_translation text default null, p_language text default null,
                                                    p_category text default 'phrase', p_source_context text default null,
                                                    p_unsplash_image_url text default null, p_text_align text default 'left')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left')));
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;
  if (select count(*) from public.contribution_posts where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;

  insert into public.contribution_posts (user_id, certified_at, language_id, phrase, translation, category, source_context, unsplash_image_url, text_align, updated_at)
  values (auth.uid(), now(), v_lang, left(btrim(p_phrase), 500), left(nullif(btrim(coalesce(p_translation, '')), ''), 500), v_cat,
          left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), v_img, v_align, now())
  returning id into v_id;
  return v_id;
end $$;

drop function if exists public.update_contribution(uuid, text, text, text, text, text, text);
create or replace function public.update_contribution(p_id uuid, p_phrase text, p_translation text default null, p_language text default null,
                                                      p_category text default 'phrase', p_source_context text default null,
                                                      p_unsplash_image_url text default null, p_text_align text default 'left')
returns void language plpgsql security definer set search_path = public as $$
declare v_lang text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
        v_align text := lower(btrim(coalesce(p_text_align, 'left')));
begin
  perform assert_active();
  if not exists (select 1 from public.contribution_posts where id = p_id and user_id = auth.uid()) then raise exception 'post_not_found'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_align not in ('left', 'center', 'right') then raise exception 'invalid_alignment'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;

  update public.contribution_posts
     set language_id = v_lang, phrase = left(btrim(p_phrase), 500), translation = left(nullif(btrim(coalesce(p_translation, '')), ''), 500),
         category = v_cat, source_context = left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), unsplash_image_url = v_img,
         text_align = v_align, updated_at = now()
   where id = p_id and user_id = auth.uid();
end $$;

-- ---------- 3. Pin to profile: one pinned post per person; pinning another replaces it ----------
create or replace function public.pin_contribution(p_id uuid, p_pinned boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if not exists (select 1 from public.contribution_posts where id = p_id and user_id = auth.uid()) then raise exception 'post_not_found'; end if;
  if p_pinned then
    update public.contribution_posts set pinned_at = null where user_id = auth.uid() and pinned_at is not null and id <> p_id;
    update public.contribution_posts set pinned_at = now() where id = p_id;
  else
    update public.contribution_posts set pinned_at = null where id = p_id;
  end if;
end $$;

-- ---------- 4. Saved posts (private to each person) ----------
create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id));
create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);
alter table public.saved_posts enable row level security;
drop policy if exists "Read own saved posts" on public.saved_posts;
create policy "Read own saved posts" on public.saved_posts for select to authenticated using (user_id = auth.uid());

-- Returns the new state: true = saved.
create or replace function public.toggle_saved_post(p_post uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  perform assert_active();
  select user_id into v_owner from public.contribution_posts where id = p_post;
  if v_owner is null or public.is_blocked_between(auth.uid(), v_owner) then raise exception 'post_not_found'; end if;
  if exists (select 1 from public.saved_posts where user_id = auth.uid() and post_id = p_post) then
    delete from public.saved_posts where user_id = auth.uid() and post_id = p_post;
    return false;
  end if;
  if (select count(*) from public.saved_posts where user_id = auth.uid()) >= 500 then raise exception 'saved_limit'; end if;
  insert into public.saved_posts (user_id, post_id) values (auth.uid(), p_post);
  return true;
end $$;

-- ---------- 5. Report a post: lands in the normal moderation queue with a snapshot of the post ----------
alter table public.reports add column if not exists post_id uuid references public.contribution_posts(id) on delete set null;

create or replace function public.report_post(p_post uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; p public.contribution_posts; v_recent int;
begin
  perform assert_active();
  select * into p from public.contribution_posts where id = p_post;
  if p.id is null or public.is_blocked_between(auth.uid(), p.user_id) then raise exception 'post_not_found'; end if;
  if p.user_id = auth.uid() then raise exception 'cannot_report_self'; end if;
  if exists (select 1 from public.reports where reporter_id = auth.uid() and post_id = p_post and status = 'open') then raise exception 'already_reported'; end if;

  -- Evidence keeps the shape moderators already read (id, sender_id, body, created_at), so it survives the post being deleted.
  insert into public.reports (reporter_id, target_user_id, post_id, reason, details, evidence)
  values (auth.uid(), p.user_id, p.id, p_reason, left(p_details, 1000),
          jsonb_build_array(jsonb_build_object('id', p.id, 'sender_id', p.user_id, 'created_at', p.created_at,
            'body', concat_ws(E'\n', p.phrase, '→ ' || p.translation, '“' || p.source_context || '”', p.unsplash_image_url))))
  returning id into v_id;

  -- Same auto-suspend rule as reporting a person.
  select count(distinct reporter_id) into v_recent from public.reports where target_user_id = p.user_id and created_at > now() - interval '7 days';
  if v_recent >= 5 then
    perform set_config('app.bypass_protect', 'on', true);
    update public.profiles set status = 'suspended' where id = p.user_id and status = 'active' and role = 'user';
    insert into public.moderation_actions (target_user_id, action, reason) values (p.user_id, 'auto_suspend', v_recent || ' reports in 7 days');
  end if;
  return v_id;
end $$;

-- Moderators can take a reported post down; the report is marked actioned.
create or replace function public.admin_remove_post(p_post uuid, p_report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.contribution_posts where id = p_post;
  if p_report is not null then update public.reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now() where id = p_report; end if;
end $$;

-- The queue now says which post a report is about.
drop function if exists public.admin_report_queue(text);
create function public.admin_report_queue(p_status text default 'open')
returns table (id uuid, reason text, details text, evidence jsonb, status text, created_at timestamptz, conversation_id uuid,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_id uuid, target_username text, target_name text, target_status text, target_open_reports int, post_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.reason, r.details, r.evidence, r.status, r.created_at, r.conversation_id,
           r.reporter_id, rp.username, rp.display_name,
           r.target_user_id, tp.username, tp.display_name, tp.status,
           (select count(*)::int from reports x where x.target_user_id = r.target_user_id and x.status = 'open'),
           r.post_id
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    left join profiles tp on tp.id = r.target_user_id
    where r.status = p_status
    order by case when p_status = 'open' then r.created_at end asc nulls last, r.created_at desc
    limit 100;
end $$;

-- ---------- Grants ----------
revoke execute on function public.post_contribution(text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.post_contribution(text, text, text, text, text, text, text) to authenticated, service_role;
revoke execute on function public.update_contribution(uuid, text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.update_contribution(uuid, text, text, text, text, text, text, text) to authenticated, service_role;
revoke execute on function public.pin_contribution(uuid, boolean) from public, anon;
grant  execute on function public.pin_contribution(uuid, boolean) to authenticated, service_role;
revoke execute on function public.toggle_saved_post(uuid) from public, anon;
grant  execute on function public.toggle_saved_post(uuid) to authenticated, service_role;
revoke execute on function public.report_post(uuid, text, text) from public, anon;
grant  execute on function public.report_post(uuid, text, text) to authenticated, service_role;
revoke execute on function public.admin_remove_post(uuid, uuid) from public, anon;
grant  execute on function public.admin_remove_post(uuid, uuid) to authenticated, service_role;
revoke execute on function public.admin_report_queue(text) from public, anon;
grant  execute on function public.admin_report_queue(text) to authenticated, service_role;
