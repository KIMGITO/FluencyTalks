-- Launch list v2: 40 major world languages. NEW migration. Never edit past migrations.
--
-- Replaces the baseline launch list. Drops Kikuyu, Luo, Kalenjin, Luhya, Kamba and Gusii from
-- every picker and adds Swedish, Czech, Romanian, Tamil, Punjabi and Cantonese. Swahili and
-- Vietnamese stay. Nobody loses a language: set_language_profile still accepts a value a profile
-- already holds even when it is off the list, and LanguageSelect keeps the current value visible.
-- Keep this list identical to the update at the end of supabase/seed.sql.

-- Several launch languages (Vietnamese among them) used to exist only through seed.sql, so a
-- database built from migrations alone offered 26. Make sure all 40 rows exist before the flag is
-- set. Rows are copied from seed.sql; existing rows are left untouched.
insert into public.languages (id, iso_639_1, english_name, native_name, is_supported_learning) values
  ('eng','en','English','English',true),
  ('swh','sw','Swahili','Kiswahili',true),
  ('vie','vi','Vietnamese','Tiếng Việt',true),
  ('fra','fr','French','Français',true),
  ('spa','es','Spanish','Español',true),
  ('deu','de','German','Deutsch',true),
  ('por','pt','Portuguese','Português',true),
  ('ita','it','Italian','Italiano',true),
  ('zho','zh','Chinese','中文',true),
  ('yue',null,'Cantonese','粵語',true),
  ('jpn','ja','Japanese','日本語',true),
  ('kor','ko','Korean','한국어',true),
  ('hin','hi','Hindi','हिन्दी',true),
  ('ara','ar','Arabic','العربية',true),
  ('rus','ru','Russian','Русский',true),
  ('tur','tr','Turkish','Türkçe',true),
  ('ind','id','Indonesian','Bahasa Indonesia',true),
  ('tha','th','Thai','ไทย',true),
  ('nld','nl','Dutch','Nederlands',true),
  ('pol','pl','Polish','Polski',true),
  ('ukr','uk','Ukrainian','Українська',true),
  ('ell','el','Greek','Ελληνικά',true),
  ('heb','he','Hebrew','עברית',true),
  ('pes','fa','Persian','فارسی',true),
  ('ben','bn','Bengali','বাংলা',true),
  ('urd','ur','Urdu','اردو',true),
  ('tgl','tl','Tagalog','Tagalog',true),
  ('msa','ms','Malay','Bahasa Melayu',true),
  ('tam','ta','Tamil','தமிழ்',true),
  ('pan','pa','Punjabi','ਪੰਜਾਬੀ',true),
  ('swe','sv','Swedish','Svenska',true),
  ('ces','cs','Czech','Čeština',true),
  ('ron','ro','Romanian','Română',true),
  ('amh','am','Amharic','አማርኛ',true),
  ('som','so','Somali','Af-Soomaali',true),
  ('yor','yo','Yoruba','Yorùbá',true),
  ('ibo','ig','Igbo','Asụsụ Igbo',true),
  ('hau','ha','Hausa','Harshen Hausa',true),
  ('zul','zu','Zulu','isiZulu',true),
  ('kin','rw','Kinyarwanda','Ikinyarwanda',true)
on conflict (id) do nothing;

update public.languages set is_supported_learning = (id in (
  'eng','swh','vie','fra','spa','deu','por','ita','zho','yue',
  'jpn','kor','hin','ara','rus','tur','ind','tha','nld','pol',
  'ukr','ell','heb','pes','ben','urd','tgl','msa','tam','pan',
  'swe','ces','ron','amh','som','yor','ibo','hau','zul','kin'));
