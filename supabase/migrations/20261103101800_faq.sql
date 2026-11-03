-- The FAQ, edited by staff and served by the Worker.

create table public.faq_items (
  id uuid default gen_random_uuid() primary key,
  section text not null check (section in ('getting-started', 'partners', 'corrections', 'points', 'safety')),
  question text not null check ((char_length(question) >= 1) and (char_length(question) <= 200)),
  answer text not null check ((char_length(answer) >= 1) and (char_length(answer) <= 2000)),
  on_home boolean not null default false,
  is_live boolean not null default true,
  position int not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.faq_items enable row level security;
create unique index faq_items_question_key on public.faq_items (lower(question));
create index faq_items_section_idx on public.faq_items (section, position);
grant select (id, section, question, answer, on_home, position, updated_at) on public.faq_items to anon, authenticated;

create function public.admin_faq_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(f) order by f.position, f.created_at) from faq_items f), '[]');
end $$;

create function public.admin_faq_save(p_id uuid, p_section text, p_question text, p_answer text, p_on_home boolean, p_is_live boolean, p_expected timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v faq_items; v_old faq_items; v_q text := trim(coalesce(p_question, '')); v_a text := trim(coalesce(p_answer, ''));
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_section is null or p_section not in ('getting-started', 'partners', 'corrections', 'points', 'safety') then raise exception 'faq_invalid_section'; end if;
  if v_q = '' then raise exception 'faq_question_required'; end if;
  if v_a = '' then raise exception 'faq_answer_required'; end if;
  if char_length(v_q) > 200 then raise exception 'faq_question_too_long'; end if;
  if char_length(v_a) > 2000 then raise exception 'faq_answer_too_long'; end if;
  -- One writer at a time, so two people adding to a section can't get the same position.
  perform pg_advisory_xact_lock(hashtext('faq_items'));
  if exists (select 1 from faq_items where lower(question) = lower(v_q) and id is distinct from p_id) then raise exception 'faq_question_taken'; end if;
  if p_id is null then
    insert into faq_items (section, question, answer, on_home, is_live, position)
    values (p_section, v_q, v_a, coalesce(p_on_home, false), coalesce(p_is_live, true), (select coalesce(max(position), 0) + 1 from faq_items where section = p_section))
    returning * into v;
    perform public.admin_audit('faq_create', null, jsonb_build_object('question', v.question));
    return to_jsonb(v);
  end if;
  select * into v_old from faq_items where id = p_id for update;
  if not found then raise exception 'faq_not_found'; end if;
  if p_expected is not null and v_old.updated_at > p_expected then raise exception 'faq_changed'; end if;
  update faq_items set section = p_section, question = v_q, answer = v_a, on_home = coalesce(p_on_home, false), is_live = coalesce(p_is_live, true), updated_at = now(),
    position = case when p_section = v_old.section then position else (select coalesce(max(f.position), 0) + 1 from faq_items f where f.section = p_section) end
  where id = p_id returning * into v;
  perform public.admin_audit('faq_update', null, jsonb_build_object('question', v.question, 'is_live', v.is_live, 'was_question', v_old.question));
  return to_jsonb(v);
end $$;

create function public.admin_faq_move(p_id uuid, p_direction int) returns void
language plpgsql security definer set search_path = public as $$
declare v faq_items; n faq_items;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtext('faq_items'));
  select * into v from faq_items where id = p_id;
  if not found then raise exception 'faq_not_found'; end if;
  select * into n from faq_items f where f.section = v.section and f.id <> v.id
    and (case when p_direction < 0 then f.position < v.position else f.position > v.position end)
  order by case when p_direction < 0 then -f.position else f.position end limit 1;
  if not found then return; end if;
  update faq_items set position = case when id = v.id then n.position else v.position end, updated_at = now() where id in (v.id, n.id);
  perform public.admin_audit('faq_move', null, jsonb_build_object('question', v.question));
end $$;

create function public.admin_faq_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v faq_items;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from faq_items where id = p_id returning * into v;
  if not found then raise exception 'faq_not_found'; end if;
  perform public.admin_audit('faq_delete', null, jsonb_build_object('question', v.question));
end $$;

create policy "live questions are public" on public.faq_items for select to anon, authenticated using (is_live);

revoke all on function
  public.admin_faq_list(),
  public.admin_faq_save(uuid, text, text, text, boolean, boolean, timestamp with time zone),
  public.admin_faq_move(uuid, integer),
  public.admin_faq_delete(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_faq_list(),
  public.admin_faq_save(uuid, text, text, text, boolean, boolean, timestamp with time zone),
  public.admin_faq_move(uuid, integer),
  public.admin_faq_delete(uuid)
to authenticated, service_role;
