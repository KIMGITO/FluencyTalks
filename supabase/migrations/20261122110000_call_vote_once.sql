-- Call feedback: a third answer, "didn't connect" (the call ended but sound or picture never got through), and one
-- answer per person per call: once given it is kept, not changed. Only 'good' counts towards a profile.
alter table public.call_votes drop constraint call_votes_vote_check;
alter table public.call_votes add constraint call_votes_vote_check check (vote in ('good', 'bad', 'no_connect'));

create or replace function public.vote_call(p_call uuid, p_vote text) returns void language plpgsql security definer set search_path = public as $$
declare c calls; v_other uuid;
begin
  perform assert_active();
  if p_vote is null or p_vote not in ('good', 'bad', 'no_connect') then raise exception 'invalid_input'; end if;
  select * into c from calls where id = p_call;
  if c.id is null or not public.is_call_member(p_call) then raise exception 'call_unavailable'; end if;
  if c.status in ('ringing', 'active') then raise exception 'call_not_ended'; end if;
  if not exists (select 1 from call_participants where call_id = p_call and user_id = auth.uid() and joined_at is not null) then raise exception 'call_not_connected'; end if;
  select user_id into v_other from call_participants where call_id = p_call and user_id <> auth.uid() and joined_at is not null limit 1;
  if v_other is null then raise exception 'call_not_connected'; end if;
  insert into call_votes (call_id, voter_id, about_id, vote) values (p_call, auth.uid(), v_other, p_vote)
  on conflict (call_id, voter_id) do nothing;
  if not found then raise exception 'call_already_rated'; end if;
end $$;
