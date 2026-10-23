-- 0006: phrasebook function + atomic "accept correction" (marks accepted AND saves the corrected phrase).
create unique index saved_phrases_user_phrase on public.saved_phrases (user_id, phrase);

create function public.save_phrase(p_phrase text, p_translation text default null, p_language text default null, p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_message'; end if;
  -- Only keep the source link if I can actually see that message.
  if p_source is not null and not exists (select 1 from messages m where m.id = p_source and public.can_access_conversation(m.conversation_id)) then p_source := null; end if;
  insert into saved_phrases (user_id, phrase, translation, language_code, source_message_id)
  values (auth.uid(), left(btrim(p_phrase), 500), left(p_translation, 500), p_language, p_source)
  on conflict (user_id, phrase) do update set translation = coalesce(excluded.translation, saved_phrases.translation)
  returning id into v_id;
  return v_id;
end $$;

create function public.accept_correction(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare c message_corrections;
begin
  perform assert_active();
  select mc.* into c from message_corrections mc join messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  update message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);
end $$;

-- Re-apply grants for the new functions (signed-in users only).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
