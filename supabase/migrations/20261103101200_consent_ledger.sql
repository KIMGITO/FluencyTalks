-- Consents, the versioned legal documents and the hash-chained consent ledger.

create table public.consents (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'age_18')),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, kind, version)
);
alter table public.consents enable row level security;
grant select on public.consents to authenticated;

create table public.consent_documents (
  kind text not null,
  version text not null,
  wording text not null,
  document_text text,
  sha256 text not null,
  created_at timestamptz not null default now(),
  primary key (kind, version)
);
alter table public.consent_documents enable row level security;

create table public.consent_ledger (
  seq bigint generated always as identity primary key,
  event text not null check (event in ('given', 'ended')),
  user_id uuid not null,
  email_hash text,
  kind text not null,
  version text not null,
  document_sha256 text,
  occurred_at timestamptz not null,
  prev_hash text not null,
  entry_hash text not null
);
alter table public.consent_ledger enable row level security;
create index consent_ledger_user_idx on public.consent_ledger (user_id, seq);
create index consent_ledger_email_idx on public.consent_ledger (email_hash, seq);

create function public.record_consent(p_kind text, p_version text) returns void language sql security definer set search_path = public as $$
  insert into consents (user_id, kind, version) values (auth.uid(), p_kind, p_version) on conflict do nothing $$;

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
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'),
    'activity', (select to_jsonb(u) - 'user_id' from user_presence u where u.user_id = auth.uid()),
    'vouches_given', coalesce((select jsonb_agg(jsonb_build_object('learner_id', v.learner_id, 'language_id', v.language_id, 'created_at', v.created_at)) from level_vouches v where v.voucher_id = auth.uid()), '[]'),
    'vouches_received', coalesce((select jsonb_agg(jsonb_build_object('language_id', v.language_id, 'created_at', v.created_at)) from level_vouches v where v.learner_id = auth.uid()), '[]'),
    'contributions', coalesce((select jsonb_agg(to_jsonb(c)) from contribution_posts c where c.user_id = auth.uid()), '[]'),
    'post_discussion', coalesce((select jsonb_agg(to_jsonb(d) - 'client_key') from post_discussion d where d.author_id = auth.uid()), '[]'),
    'decisions_owed', coalesce((select jsonb_agg(to_jsonb(i)) from decision_items i where i.user_id = auth.uid()), '[]'),
    'restrictions', coalesce((select jsonb_agg(to_jsonb(r)) from user_restrictions r where r.user_id = auth.uid()), '[]'));
end $$;

create function public.consent_document_hash() returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.sha256 := encode(sha256(convert_to(new.wording || E'\n' || coalesce(new.document_text, ''), 'UTF8')), 'hex');
  return new;
end $$;

create function public.chain_hash(p_prev text, variadic p_fields text[]) returns text
language sql immutable set search_path = pg_catalog as $$
  select encode(sha256(convert_to(p_prev || '|' || array_to_string(p_fields, '|', '-'), 'UTF8')), 'hex') $$;

create function public.chain_time(p_at timestamptz) returns text
language sql immutable set search_path = pg_catalog as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $$;

create function public.consent_entry_hash(l public.consent_ledger) returns text
language sql immutable set search_path = public as $$
  select public.chain_hash(l.prev_hash, l.event, l.user_id::text, l.email_hash, l.kind, l.version, l.document_sha256, public.chain_time(l.occurred_at)) $$;

create function public.consent_ledger_append(p_event text, p_user uuid, p_email_hash text, p_kind text, p_version text, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare l consent_ledger;
begin
  perform pg_advisory_xact_lock(hashtext('consent_ledger'));
  l.prev_hash := coalesce((select entry_hash from consent_ledger order by seq desc limit 1), repeat('0', 64));
  l.event := p_event; l.user_id := p_user; l.email_hash := p_email_hash; l.kind := p_kind; l.version := p_version; l.occurred_at := p_at;
  l.document_sha256 := (select sha256 from consent_documents d where d.kind = p_kind and d.version = p_version);
  insert into consent_ledger (event, user_id, email_hash, kind, version, document_sha256, occurred_at, prev_hash, entry_hash)
  values (l.event, l.user_id, l.email_hash, l.kind, l.version, l.document_sha256, l.occurred_at, l.prev_hash, public.consent_entry_hash(l));
end $$;

create function public.trg_consent_given() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.consent_ledger_append('given', new.user_id, (select public.email_hash(email) from auth.users where id = new.user_id), new.kind, new.version, new.accepted_at);
  return null;
end $$;

create function public.trg_consent_ended() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.consent_ledger_append('ended', old.user_id,
    (select email_hash from consent_ledger where user_id = old.user_id and event = 'given' and email_hash is not null order by seq desc limit 1),
    old.kind, old.version, now());
  return null;
end $$;

create function public.append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;

create function public.svc_consent_export_page(p_after bigint, p_through bigint, p_limit int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(l) order by l.seq), '[]') from (
    select * from consent_ledger where seq > p_after and seq <= p_through order by seq limit least(p_limit, 1000)) l $$;

create trigger admin_audit_log_no_truncate before truncate on public.admin_audit_log for each statement execute function public.append_only();
create trigger consent_documents_hash before insert on public.consent_documents for each row execute function public.consent_document_hash();
create trigger consent_documents_no_change before update or delete on public.consent_documents for each row execute function public.append_only();
create trigger consent_documents_no_truncate before truncate on public.consent_documents for each statement execute function public.append_only();
create trigger consent_ledger_no_change before update or delete on public.consent_ledger for each row execute function public.append_only();
create trigger consent_ledger_no_truncate before truncate on public.consent_ledger for each statement execute function public.append_only();
create trigger consents_end_in_ledger after delete on public.consents for each row execute function public.trg_consent_ended();
create trigger consents_to_ledger after insert on public.consents for each row execute function public.trg_consent_given();

create policy "read own consents" on public.consents for select using (auth.uid() = user_id);

revoke all on function
  public.record_consent(text, text),
  public.export_my_data(),
  public.consent_document_hash(),
  public.chain_hash(text, text[]),
  public.chain_time(timestamp with time zone),
  public.consent_entry_hash(public.consent_ledger),
  public.consent_ledger_append(text, uuid, text, text, text, timestamp with time zone),
  public.trg_consent_given(),
  public.trg_consent_ended(),
  public.append_only(),
  public.svc_consent_export_page(bigint, bigint, integer)
from public, anon, authenticated, service_role;

grant execute on function
  public.record_consent(text, text),
  public.export_my_data()
to authenticated, service_role;

grant execute on function
  public.svc_consent_export_page(bigint, bigint, integer)
to service_role;
