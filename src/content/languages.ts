/**
 * The 40 launch languages, for the public /languages pages. Keep in step with the launch list in
 * supabase/migrations/20261103101500_reference_data.sql (is_supported_learning). `id` is the ISO 639-3 id the app uses; `lang` is the BCP 47
 * tag for the greeting text (so screen readers pronounce it). Greetings are only given where we are sure of them.
 */
export type Region = 'African languages' | 'European languages' | 'Middle Eastern languages' | 'Asian languages';

export interface PublicLanguage {
  id: string;
  slug: string;
  name: string;
  native: string;
  lang: string;
  rtl?: boolean;
  region: Region;
  /** Where it is spoken, finishing the sentence "{name} is spoken in …". */
  where: string;
  script: string;
  hello?: string;
  thanks?: string;
}

const L = (id: string, name: string, native: string, lang: string, region: Region, where: string, script: string, hello?: string, thanks?: string, rtl?: boolean): PublicLanguage =>
  ({ id, slug: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, native, lang, region, where, script, hello, thanks, rtl });

export const LANGUAGES: PublicLanguage[] = [
  L('swh', 'Swahili', 'Kiswahili', 'sw', 'African languages', 'Kenya, Tanzania, Uganda and across East and Central Africa', 'Latin', 'Habari', 'Asante'),
  L('amh', 'Amharic', 'አማርኛ', 'am', 'African languages', 'Ethiopia', "Ge'ez (Ethiopic)", 'ሰላም', 'አመሰግናለሁ'),
  L('som', 'Somali', 'Af-Soomaali', 'so', 'African languages', 'Somalia, Djibouti, eastern Ethiopia and north-eastern Kenya', 'Latin', 'Nabad', 'Mahadsanid'),
  L('yor', 'Yoruba', 'Yorùbá', 'yo', 'African languages', 'south-western Nigeria and Benin', 'Latin', 'Báwo ni', 'Ẹ ṣé'),
  L('ibo', 'Igbo', 'Asụsụ Igbo', 'ig', 'African languages', 'south-eastern Nigeria', 'Latin', 'Ndewo', 'Daalụ'),
  L('hau', 'Hausa', 'Harshen Hausa', 'ha', 'African languages', 'northern Nigeria, Niger and across West Africa', 'Latin', 'Sannu', 'Na gode'),
  L('zul', 'Zulu', 'isiZulu', 'zu', 'African languages', 'South Africa', 'Latin', 'Sawubona', 'Ngiyabonga'),
  L('kin', 'Kinyarwanda', 'Ikinyarwanda', 'rw', 'African languages', 'Rwanda', 'Latin', 'Muraho', 'Murakoze'),
  L('eng', 'English', 'English', 'en', 'European languages', 'the UK, Ireland, the US, Canada, Australia, Kenya, Nigeria, India and as a shared language worldwide', 'Latin', 'Hello', 'Thank you'),
  L('fra', 'French', 'Français', 'fr', 'European languages', 'France, Belgium, Switzerland, Canada and much of West and Central Africa', 'Latin', 'Bonjour', 'Merci'),
  L('spa', 'Spanish', 'Español', 'es', 'European languages', 'Spain and most of Latin America', 'Latin', 'Hola', 'Gracias'),
  L('por', 'Portuguese', 'Português', 'pt', 'European languages', 'Portugal, Brazil, Angola and Mozambique', 'Latin', 'Olá', 'Obrigado'),
  L('deu', 'German', 'Deutsch', 'de', 'European languages', 'Germany, Austria and Switzerland', 'Latin', 'Hallo', 'Danke'),
  L('ita', 'Italian', 'Italiano', 'it', 'European languages', 'Italy and Switzerland', 'Latin', 'Ciao', 'Grazie'),
  L('nld', 'Dutch', 'Nederlands', 'nl', 'European languages', 'the Netherlands, Flanders in Belgium, and Suriname', 'Latin', 'Hallo', 'Dank je'),
  L('pol', 'Polish', 'Polski', 'pl', 'European languages', 'Poland', 'Latin', 'Cześć', 'Dziękuję'),
  L('ukr', 'Ukrainian', 'Українська', 'uk', 'European languages', 'Ukraine', 'Cyrillic', 'Привіт', 'Дякую'),
  L('rus', 'Russian', 'Русский', 'ru', 'European languages', 'Russia and across Eastern Europe and Central Asia', 'Cyrillic', 'Привет', 'Спасибо'),
  L('ell', 'Greek', 'Ελληνικά', 'el', 'European languages', 'Greece and Cyprus', 'Greek', 'Γεια σας', 'Ευχαριστώ'),
  L('swe', 'Swedish', 'Svenska', 'sv', 'European languages', 'Sweden and parts of Finland', 'Latin', 'Hej', 'Tack'),
  L('ces', 'Czech', 'Čeština', 'cs', 'European languages', 'the Czech Republic', 'Latin', 'Ahoj', 'Děkuji'),
  L('ron', 'Romanian', 'Română', 'ro', 'European languages', 'Romania and Moldova', 'Latin', 'Bună', 'Mulțumesc'),
  L('ara', 'Arabic', 'العربية', 'ar', 'Middle Eastern languages', 'the Middle East and North Africa', 'Arabic', 'مرحبا', 'شكرا', true),
  L('heb', 'Hebrew', 'עברית', 'he', 'Middle Eastern languages', 'Israel', 'Hebrew', 'שלום', 'תודה', true),
  L('pes', 'Persian', 'فارسی', 'fa', 'Middle Eastern languages', 'Iran, Afghanistan and Tajikistan', 'Arabic (Persian alphabet)', 'سلام', 'ممنون', true),
  L('tur', 'Turkish', 'Türkçe', 'tr', 'Middle Eastern languages', 'Türkiye and Cyprus', 'Latin', 'Merhaba', 'Teşekkürler'),
  L('zho', 'Chinese', '中文', 'zh', 'Asian languages', 'China, Taiwan and Singapore', 'Chinese characters', '你好', '谢谢'),
  L('yue', 'Cantonese', '粵語', 'yue', 'Asian languages', 'Hong Kong, Macau and Guangdong in southern China', 'Traditional Chinese characters', '你好', '多謝'),
  L('jpn', 'Japanese', '日本語', 'ja', 'Asian languages', 'Japan', 'Kana and kanji', 'こんにちは', 'ありがとう'),
  L('kor', 'Korean', '한국어', 'ko', 'Asian languages', 'South Korea and North Korea', 'Hangul', '안녕하세요', '감사합니다'),
  L('vie', 'Vietnamese', 'Tiếng Việt', 'vi', 'Asian languages', 'Vietnam', 'Latin', 'Xin chào', 'Cảm ơn'),
  L('tha', 'Thai', 'ไทย', 'th', 'Asian languages', 'Thailand', 'Thai', 'สวัสดี', 'ขอบคุณ'),
  L('ind', 'Indonesian', 'Bahasa Indonesia', 'id', 'Asian languages', 'Indonesia', 'Latin', 'Halo', 'Terima kasih'),
  L('msa', 'Malay', 'Bahasa Melayu', 'ms', 'Asian languages', 'Malaysia, Brunei and Singapore', 'Latin', 'Apa khabar', 'Terima kasih'),
  L('tgl', 'Tagalog', 'Tagalog', 'tl', 'Asian languages', 'the Philippines', 'Latin', 'Kumusta', 'Salamat'),
  L('hin', 'Hindi', 'हिन्दी', 'hi', 'Asian languages', 'northern and central India', 'Devanagari', 'नमस्ते', 'धन्यवाद'),
  L('urd', 'Urdu', 'اردو', 'ur', 'Asian languages', 'Pakistan and India', 'Arabic (Urdu alphabet)', 'السلام علیکم', 'شکریہ', true),
  L('ben', 'Bengali', 'বাংলা', 'bn', 'Asian languages', 'Bangladesh and West Bengal in India', 'Bengali', 'নমস্কার', 'ধন্যবাদ'),
  L('tam', 'Tamil', 'தமிழ்', 'ta', 'Asian languages', 'Tamil Nadu in India, Sri Lanka and Singapore', 'Tamil', 'வணக்கம்', 'நன்றி'),
  L('pan', 'Punjabi', 'ਪੰਜਾਬੀ', 'pa', 'Asian languages', 'Punjab in India and Pakistan', 'Gurmukhi (Shahmukhi in Pakistan)', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'ਧੰਨਵਾਦ'),
];

export const REGIONS: Region[] = ['African languages', 'European languages', 'Middle Eastern languages', 'Asian languages'];

export const languageBySlug = (slug?: string) => LANGUAGES.find((l) => l.slug === slug);
