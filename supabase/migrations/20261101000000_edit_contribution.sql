-- Let authors edit their own library posts. Same rules as post_contribution (eligible language,
-- known category, Unsplash-only image); only the owner can change a post.
create or replace function public.update_contribution(p_id uuid, p_phrase text, p_translation text default null, p_language text default null,
                                                      p_category text default 'phrase', p_source_context text default null,
                                                      p_unsplash_image_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_lang text; v_cat text := lower(btrim(coalesce(p_category, 'phrase'))); v_img text := nullif(btrim(coalesce(p_unsplash_image_url, '')), '');
begin
  perform assert_active();
  if not exists (select 1 from public.contribution_posts where id = p_id and user_id = auth.uid()) then raise exception 'post_not_found'; end if;
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_phrase'; end if;
  v_lang := public.normalize_language_code(nullif(btrim(coalesce(p_language, '')), ''));
  if v_lang is null then raise exception 'language_required'; end if;
  if not public.can_correct_language(auth.uid(), v_lang) then raise exception 'not_contribution_eligible'; end if;
  if v_cat not in ('phrase', 'idiom', 'usage', 'grammar') then raise exception 'invalid_category'; end if;
  if v_img is not null and (char_length(v_img) > 500 or v_img !~ '^https://images\.unsplash\.com/[^[:space:]]+$') then raise exception 'invalid_image'; end if;

  update public.contribution_posts
     set language_id = v_lang, phrase = left(btrim(p_phrase), 500), translation = left(nullif(btrim(coalesce(p_translation, '')), ''), 500),
         category = v_cat, source_context = left(nullif(btrim(coalesce(p_source_context, '')), ''), 500), unsplash_image_url = v_img, updated_at = now()
   where id = p_id and user_id = auth.uid();
end $$;

revoke execute on function public.update_contribution(uuid, text, text, text, text, text, text) from public, anon;
grant  execute on function public.update_contribution(uuid, text, text, text, text, text, text) to authenticated, service_role;
