-- Push for chat messages. NEW migration. Never edit past migrations.
-- Until now only notifications rows were pushed, and an ordinary chat message never makes one (the bell would
-- fill up), so a new message never reached a closed app. This queues the same send-push function with a
-- message id. A claim row makes a retried call harmless. Request conversations are left out: the
-- 'message_request' notification already covers them. Like 20261102000004, nothing is sent until
-- push_settings is filled in.

create table public.message_push_claims (
  message_id uuid primary key references public.messages(id) on delete cascade,
  claimed_at timestamptz not null default now());
alter table public.message_push_claims enable row level security;   -- no policies: the edge function uses the service role

create function public.trg_push_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.push_settings;
begin
  select * into cfg from push_settings;
  if cfg.function_url is null then return new; end if;
  if not exists (select 1 from conversation_members cm join push_subscriptions s on s.user_id = cm.user_id
                 where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id and cm.status = 'active') then
    return new;
  end if;
  perform net.http_post(
    url := cfg.function_url,
    body := jsonb_build_object('message_id', new.id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', cfg.webhook_secret));
  return new;
exception when others then
  raise warning 'message push not queued: %', sqlerrm;   -- push failing must never stop the message
  return new;
end $$;
create trigger messages_push after insert on public.messages for each row execute function public.trg_push_message();

revoke execute on function public.trg_push_message() from public, anon, authenticated;
