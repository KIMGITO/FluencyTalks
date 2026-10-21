-- Create the normalization function
create or replace function public.normalize_language_code(p_code text)
returns text language plpgsql immutable as $$
declare
  v_code text := lower(btrim(coalesce(p_code, '')));
begin
  if v_code = '' then return null; end if;
  
  -- If it's already a valid 3-letter code, return it.
  if exists (select 1 from public.languages where id = v_code) then
    return v_code;
  end if;
  
  -- Try looking up by ISO 639-1 (2-letter code)
  return (select id from public.languages where iso_639_1 = v_code limit 1);
end $$;
