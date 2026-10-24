-- 20241023000004: Points & Phrasebook
-- Consolidates: 0003, 0006, 0008, 0027, 0029, 0031

-- ---------- 1. Tables ----------
create table public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null check (reason in ('correction_accepted', 'bounty_posted', 'bounty_answered_accepted', 'bounty_expired_refund')),
  ref_type   text not null,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_type, ref_id)
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
alter table public.points_ledger enable row level security;
create policy "read own ledger" on public.points_ledger for select using (auth.uid() = user_id);

create table public.saved_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phrase text not null check (char_length(phrase) <= 500),
  translation text,
  language_id text references public.languages(id),
  source_message_id uuid references public.messages(id) on delete set null,
  is_public boolean not null default false,
  unsplash_image_url text,
  bounty_status text not null default 'none' check (bounty_status in ('none', 'held', 'accepted', 'expired_refunded')),
  bounty_cost int,
  bounty_asker_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, phrase)
);
create index on public.saved_phrases (user_id, created_at desc);
create index saved_phrases_public_idx on public.saved_phrases (is_public, created_at desc) where is_public;
alter table public.saved_phrases enable row level security;
create policy "read phrases" on public.saved_phrases for select using (is_public or auth.uid() = user_id);
create policy "manage own phrases" on public.saved_phrases for all using (auth.uid() = user_id);

create table public.translation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 4000),
  translated_text text not null check (char_length(translated_text) between 1 and 4000),
  language_id text references public.languages(id),
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.translation_history (user_id, created_at desc);
alter table public.translation_history enable row level security;
create policy "own translations" on public.translation_history for all using (auth.uid() = user_id);

-- ---------- 2. Functions ----------
create function public.award_points(p_user uuid, p_delta int, p_reason text, p_ref_type text, p_ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  insert into public.points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref)
  on conflict (user_id, reason, ref_type, ref_id) do nothing;
  if not found then return false; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set points_balance = points_balance + p_delta where id = p_user returning points_balance into v_balance;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;
  return true;
end $$;

create function public.save_phrase(p_phrase text, p_translation text default null, p_language text default null, p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := lower(btrim(p_language));
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  if p_source is not null and not exists (select 1 from messages m where m.id = p_source and public.can_access_conversation(m.conversation_id)) then p_source := null; end if;
  insert into saved_phrases (user_id, phrase, translation, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_phrase), 500), left(p_translation, 500), v_lang, p_source)
  on conflict (user_id, phrase) do update set translation = coalesce(excluded.translation, saved_phrases.translation)
  returning id into v_id;
  return v_id;
end $$;

create function public.accept_correction(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.message_corrections; v_msg public.messages; v_reward boolean := true; v_count int;
begin
  perform assert_active();
  select mc.* into c from public.message_corrections mc join public.messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  select * into v_msg from public.messages where id = c.message_id;

  update public.message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);

  if lower(btrim(c.suggested_text)) = lower(btrim(v_msg.body)) then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger
   where user_id = c.corrector_id and reason = 'correction_accepted' and created_at > now() - interval '24 hours';
  if v_count >= 10 then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger l
   join public.message_corrections mc2 on mc2.id = l.ref_id
   join public.messages m2 on m2.id = mc2.message_id
   where l.user_id = c.corrector_id and l.reason = 'correction_accepted'
     and l.created_at > now() - interval '24 hours' and m2.sender_id = v_msg.sender_id;
  if v_count >= 3 then v_reward := false; end if;

  if v_reward then perform public.award_points(c.corrector_id, 5, 'correction_accepted', 'correction', c.id); end if;
end $$;


create function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'translations', coalesce((select jsonb_agg(to_jsonb(t)) from translation_history t where t.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'));
end $$;

revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
grant execute on all functions in schema public to authenticated, service_role;

