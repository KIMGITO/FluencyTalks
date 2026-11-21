-- What the media provider reports (signed webhooks), applied once each. This is the authority on who was
-- really connected: the browser's own report only moves its own row and is only a hint.

create table public.call_webhook_events (
  event_id text primary key check (char_length(event_id) between 1 and 200),
  event text not null,
  received_at timestamptz not null default now()
);
alter table public.call_webhook_events enable row level security;
create index call_webhook_events_received_idx on public.call_webhook_events (received_at);

-- Called by the livekit-webhook edge function (service role) after it has verified the signature.
-- Returns what happened, so the function can remove someone the provider let in who has no right to be there.
create function public.apply_call_provider_event(p_event_id text, p_event text, p_room text, p_identity text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c calls; v_user uuid; v_n int;
begin
  insert into call_webhook_events (event_id, event) values (p_event_id, left(p_event, 60)) on conflict (event_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('result', 'duplicate'); end if;
  delete from call_webhook_events where received_at < now() - interval '7 days';

  select * into c from calls where provider_room = p_room for update;
  if c.id is null then return jsonb_build_object('result', 'unknown_room'); end if;
  begin v_user := p_identity::uuid; exception when others then v_user := null; end;

  if p_event = 'room_finished' then
    perform public.finish_call(c.id, 'empty');
    return jsonb_build_object('result', 'ok');
  end if;
  if v_user is null then return jsonb_build_object('result', 'ignored'); end if;

  if p_event = 'participant_joined' then
    update call_participants set presence = 'joined', joined_at = coalesce(joined_at, now()), presence_at = now(), left_at = null
    where call_id = c.id and user_id = v_user and invitation_status = 'accepted' and presence <> 'removed' and c.status in ('ringing', 'active');
    get diagnostics v_n = row_count;
    if v_n = 0 then return jsonb_build_object('result', 'not_allowed', 'call_id', c.id); end if;
    update calls set last_empty_at = null where id = c.id;
  elsif p_event = 'participant_left' then
    update call_participants set presence = 'left', left_at = now(), presence_at = now()
    where call_id = c.id and user_id = v_user and presence in ('joining', 'joined');
    -- Nobody left in the room: the call ends after the grace period unless someone rejoins (expire_stale_calls).
    if not exists (select 1 from call_participants where call_id = c.id and presence in ('joining', 'joined')) then
      update calls set last_empty_at = now() where id = c.id and status = 'active';
    end if;
  else
    return jsonb_build_object('result', 'ignored');
  end if;
  return jsonb_build_object('result', 'ok', 'call_id', c.id);
end $$;

-- For the call-control edge function: the room to close once a call is over. Members only, ended calls only.
create function public.call_room_to_close(p_call uuid) returns text language sql stable security definer set search_path = public as $$
  select c.provider_room from calls c
  where c.id = p_call and c.status in ('ended', 'cancelled', 'expired')
    and exists (select 1 from call_participants p where p.call_id = c.id and p.user_id = auth.uid()) $$;

revoke all on function
  public.apply_call_provider_event(text, text, text, text),
  public.call_room_to_close(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.apply_call_provider_event(text, text, text, text) to service_role;
grant execute on function public.call_room_to_close(uuid) to authenticated, service_role;
