-- 0004: Safety & moderation — reports, moderation actions, banned emails.
-- Stands alone; no other file merges into this concept.

-- ---------- Reports ----------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in ('harassment','spam','inappropriate','impersonation','underage','scam','fake_correction','points_abuse','other')),
  details text check (char_length(details) <= 1000),
  evidence jsonb not null default '[]',
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.reports (status, created_at);
create index on public.reports (target_user_id, created_at);

-- ---------- Moderation Actions ----------

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('suspend','ban','reinstate','dismiss_report','auto_suspend')),
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Banned Emails ----------

create table public.banned_emails (
  email_hash text primary key,
  created_at timestamptz not null default now()
);

-- ---------- Policies ----------

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.banned_emails enable row level security;

create policy "admins read reports" on public.reports for select using (public.is_admin());
create policy "admins read actions" on public.moderation_actions for select using (public.is_admin());

-- ---------- Helper: email hash ----------

create or replace function public.email_hash(p_email text) returns text language sql immutable as $$
  select encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex');
$$;

-- ---------- Function: block banned signup ----------

create or replace function public.block_banned_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from banned_emails where email_hash = public.email_hash(new.email)) then
    raise exception 'signup_not_allowed';
  end if;
  return new;
end $$;

create trigger auth_block_banned before insert on auth.users for each row execute function public.block_banned_signup();

-- ---------- Function: report_user ----------

create or replace function public.report_user(p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evidence jsonb := '[]'; v_recent int;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_report_self'; end if;
  if p_conversation is not null and public.can_access_conversation(p_conversation) then
    -- gather recent message evidence (skip deleted)
    select coalesce(jsonb_agg(e order by e->>'created_at'), '[]') into v_evidence from (
      select jsonb_build_object('id', id, 'sender_id', sender_id, 'body', body, 'created_at', created_at) as e
      from messages where conversation_id = p_conversation and deleted_at is null and body <> '[deleted]'
      order by created_at desc limit 20) t;
  end if;
  insert into reports (reporter_id, target_user_id, conversation_id, reason, details, evidence)
  values (auth.uid(), p_target, p_conversation, p_reason, details, v_evidence)
  returning id into v_id;
  return v_id;
end $$;