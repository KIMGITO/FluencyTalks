-- The FAQ moves from a file in the repo into the database, so admins and moderators can add, change, order and remove
-- questions without a deploy. worker/index.ts puts the live ones into / and /faq as real HTML, so search engines see them.
--
-- Answers are plain text, never HTML: src/lib/blogHtml.ts escapes them, and they also go into the FAQPage structured data.
-- A change is public as soon as it is saved. Hiding a question takes it off the site and keeps its text.

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  -- The list is FAQ_SECTIONS in src/lib/blogHtml.ts, which also holds their titles and order.
  section text not null check (section in ('getting-started', 'partners', 'corrections', 'points', 'safety')),
  question text not null check (char_length(question) between 1 and 200),
  answer text not null check (char_length(answer) between 1 and 2000),
  on_home boolean not null default false,
  is_live boolean not null default true,
  position int not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now());
-- FAQPage structured data shouldn't ask the same thing twice.
create unique index faq_items_question_key on public.faq_items (lower(question));
create index faq_items_section_idx on public.faq_items (section, position);

alter table public.faq_items enable row level security;
create policy "live questions are public" on public.faq_items for select to anon, authenticated using (is_live);
grant select (id, section, question, answer, on_home, position, updated_at) on public.faq_items to anon, authenticated;

-- ---------- What staff call. is_admin() is true for moderators too. ----------
create function public.admin_faq_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(f) order by f.position, f.created_at) from faq_items f), '[]');
end $$;

-- No p_id adds a question. p_expected is the updated_at it loaded: if someone else saved since, it is told rather than overwriting them.
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
    -- A question moved to another section goes to the end of it.
    position = case when p_section = v_old.section then position else (select coalesce(max(f.position), 0) + 1 from faq_items f where f.section = p_section) end
  where id = p_id returning * into v;
  perform public.admin_audit('faq_update', null, jsonb_build_object('question', v.question, 'is_live', v.is_live, 'was_question', v_old.question));
  return to_jsonb(v);
end $$;

-- Swaps a question with the one above (-1) or below (1) it in its section. At either end there is nothing to do.
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

revoke execute on function public.admin_faq_list(), public.admin_faq_save(uuid, text, text, text, boolean, boolean, timestamptz),
  public.admin_faq_move(uuid, int), public.admin_faq_delete(uuid) from public, anon;
grant execute on function public.admin_faq_list(), public.admin_faq_save(uuid, text, text, text, boolean, boolean, timestamptz),
  public.admin_faq_move(uuid, int), public.admin_faq_delete(uuid) to authenticated, service_role;

-- ---------- The questions that used to be in src/content/faq.ts, word for word ----------
insert into public.faq_items (section, question, answer, on_home, position) values
  ('getting-started', $t$What is The Fluency Talks?$t$, $t$The Fluency Talks is a free language exchange web app. You chat one to one with people who speak the language you are learning, and they correct your messages inside the conversation. Corrections you accept are saved to your personal phrasebook.$t$, false, 1),
  ('getting-started', $t$How do I practise one-to-one language conversations on The Fluency Talks?$t$, $t$Create a free account, then choose your native language and the language and level you are learning. You will see suggested partners. Send one a message; once they accept, you chat one to one in text and correct each other as you go.$t$, false, 2),
  ('getting-started', $t$What is a language exchange?$t$, $t$Two people who speak different languages help each other practise. In the neatest case you speak English and are learning Vietnamese, and your partner is the other way round. It doesn't have to be a perfect pair: a Vietnamese speaker who learns nothing can still help you, and you can help a French speaker who is learning English. On The Fluency Talks you chat in writing and correct each other's messages.$t$, true, 3),
  ('getting-started', $t$Is The Fluency Talks free?$t$, $t$Yes. There are no paid plans. You start with 100 points, earn 5 for each correction someone accepts, and spend 50 on a bounty when you are stuck.$t$, true, 4),
  ('getting-started', $t$How is The Fluency Talks different from other language exchange apps?$t$, $t$Corrections are built into the chat and saved to your phrasebook, you are matched by language rather than popularity, there are no followers or likes, and it is free with no paid tier.$t$, true, 5),
  ('getting-started', $t$Do I need to be fluent to join?$t$, $t$No. Choose the language you are learning and your level, from A1 to C2. People who speak it natively, or have been verified at B1 or above, can correct you.$t$, true, 6),
  ('getting-started', $t$Do I need to download an app?$t$, $t$No. It is a web app that runs in a modern browser on your phone or computer.$t$, false, 7),
  ('getting-started', $t$How old do I have to be?$t$, $t$You must be 16 or older to create an account.$t$, false, 8),
  ('partners', $t$How are partners matched?$t$, $t$By language, and a perfect swap is not required. If you speak English and are learning Vietnamese, you see native Vietnamese speakers (whatever they are learning, even nothing) and anyone learning English (whatever their native language is). People who are both come first.$t$, true, 1),
  ('partners', $t$Which languages can I practise?$t$, $t$40 at launch: English, Vietnamese, Swahili, Spanish, French, German, Portuguese, Italian, Chinese, Cantonese, Japanese, Korean, Hindi, Arabic, Russian, Turkish and 24 more. You pick one you speak and one you are learning.$t$, true, 2),
  ('partners', $t$Can I practise Vietnamese with native speakers for free?$t$, $t$Yes. Choose Vietnamese as the language you are learning. Native Vietnamese speakers are suggested to you as matches, whatever they are learning themselves. You can also help anyone who is learning English.$t$, true, 3),
  ('partners', $t$Do I have to speak on video?$t$, $t$No. Practice happens in text chat, so you can take your time and see every correction written out.$t$, true, 4),
  ('corrections', $t$How do corrections work?$t$, $t$Your partner edits your sentence where you wrote it. You see exactly what changed, and you accept the change or not. Accepted corrections go into your phrasebook automatically.$t$, false, 1),
  ('corrections', $t$Who can correct my messages?$t$, $t$Native speakers of that language, and learners verified at B1 or above. Levels are earned through activity on the site, not claimed, so choosing a level yourself does not qualify you to correct others.$t$, false, 2),
  ('corrections', $t$Can I help others with my own language?$t$, $t$Yes. Native speakers, and learners verified at B1 or above through their practice, can suggest corrections. Each correction the author accepts earns you 5 points.$t$, true, 3),
  ('corrections', $t$Can I translate a message I do not understand?$t$, $t$Yes. Open any message’s menu and choose Translate message. Every translation is kept on your Learning page, next to your saved phrases and the corrections you received.$t$, true, 4),
  ('points', $t$How does the correction reward system work?$t$, $t$You earn points for helping. Every account starts with 100 points. Each correction you give that the other person accepts earns you 5 points. Points have no cash value and nothing on the site requires payment.$t$, false, 1),
  ('points', $t$What is a bounty?$t$, $t$A bounty is a question you put in front of people qualified in that language. It costs 50 points. Each qualified person can send one answer, and you choose the one you accept. That person receives the 50 points.$t$, false, 2),
  ('points', $t$What happens if nobody answers my bounty?$t$, $t$You get your 50 points back. If you do not accept an answer within 48 hours, the bounty closes and the points are refunded. You can have up to 3 open bounties at a time.$t$, false, 3),
  ('safety', $t$Is it safe?$t$, $t$New contacts arrive as message requests that you can decline. You can block or report anyone, blocked people cannot see you or write to you, and reports are reviewed by admins.$t$, true, 1),
  ('safety', $t$Can I export or delete my data?$t$, $t$Yes. You can export your data or delete your account at any time. We do not sell your data.$t$, false, 2);
