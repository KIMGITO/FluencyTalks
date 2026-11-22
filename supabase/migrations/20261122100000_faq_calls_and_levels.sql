-- The FAQ still described a text-only app for ages 16+. It now describes one-to-one video calls, topics,
-- levels rated by partners, partner requests and the minimum age of 12. Rows are matched by their question,
-- so a question staff have already reworded in /admin/faq is left alone. New questions go to the end of their section.

update public.faq_items set updated_at = now(), answer = v.answer
from (values
  ($t$What is The Fluency Talks?$t$, $t$The Fluency Talks is a free language exchange web app. You talk one to one on video calls with people who speak the language you are learning, about topics that match your level. Your partners rate your topic calls, and that is how you pass each level from A1 to C2. Between calls you chat in writing, and corrections you accept are saved to your personal phrasebook.$t$),
  ($t$How do I practise one-to-one language conversations on The Fluency Talks?$t$, $t$Create a free account, then choose your native language and the language and level you are learning. You will see suggested people. Add one as a partner; once they accept, you can call them, pick a topic at your level and talk. You can also chat in writing and correct each other's messages.$t$),
  ($t$What is a language exchange?$t$, $t$Two people who speak different languages help each other practise. In the neatest case you speak English and are learning Vietnamese, and your partner is the other way round. It doesn't have to be a perfect pair: a Vietnamese speaker who learns nothing can still help you, and you can help a French speaker who is learning English. On The Fluency Talks you talk on video calls and correct each other's messages in the chat.$t$),
  ($t$How is The Fluency Talks different from other language exchange apps?$t$, $t$You practise by speaking, on one-to-one video calls about topics made for your level. Your level is earned from ratings by real partners, not claimed. Corrections are built into the chat and saved to your phrasebook, you are matched by language rather than popularity, and it is free with no paid tier.$t$),
  ($t$Do I need to be fluent to join?$t$, $t$No. Choose the language you are learning and your level, from A1 to C2. A1 topics start with simple, everyday things. People who speak the language natively, or have passed a higher level, rate your calls.$t$),
  ($t$How old do I have to be?$t$, $t$You must be 12 or older. If you are 12 to 15, a parent or guardian has to agree by email before you can use the app, and every call with you is voice only, with cameras off.$t$),
  ($t$Do I have to speak on video?$t$, $t$No. You can turn your camera off at any time, and calls are never recorded. Calls with a member under 16 are always voice only. If you are not ready to speak yet, you can also chat in writing.$t$),
  ($t$Who can correct my messages?$t$, $t$Native speakers of that language, and learners who have passed a higher level than yours. Levels are earned through calls rated by partners, not claimed, so choosing a level yourself does not qualify you to correct others.$t$),
  ($t$Can I help others with my own language?$t$, $t$Yes. Call learners and rate their topic calls, so their level means something. Native speakers, and learners who have passed a higher level than the writer, can also suggest corrections in the chat. Each correction the author accepts earns you 5 points.$t$),
  ($t$Is it safe?$t$, $t$New contacts arrive as partner requests that you can decline, and only partners can message or call you. Calls are never recorded. You can block or report anyone, blocked people cannot see you or write to you, and reports are reviewed by admins. Members under 16 are hidden from adults in search, and their calls are voice only.$t$)
) as v(question, answer)
where lower(faq_items.question) = lower(v.question);

insert into public.faq_items (section, question, answer, on_home, position)
select v.section, v.question, v.answer, v.on_home,
  (select coalesce(max(position), 0) from public.faq_items f where f.section = v.section) + v.n
from (values
  ('partners', $t$How do calls work?$t$, $t$Add someone as a partner. Once they accept, you can call them from their profile or the People tab, and see whether they are online or already on a call. Calls are one to one, on video, and never recorded. Either of you can pick a topic during the call, up to the level of whichever of you is lower. After every call you each say once whether it was good, bad or didn't connect; profiles show only the number of good calls.$t$, true, 1),
  ('partners', $t$What topics can we talk about?$t$, $t$There are more than 80 topics, 14 to 15 for each level from A1 to C2, about people, food, travel, technology and more. Each one has a short summary, prompts and extra ideas so the conversation keeps going.$t$, false, 2),
  ('partners', $t$How do I pass a level?$t$, $t$Call a partner and talk about a topic at your current level for at least 10 minutes. Afterwards your partner rates you on five points. When 5 different partners have rated you and your average across those calls is 80% or more, you pass the level and the next one opens. Ratings come from native speakers or people who passed a higher level, and you never see who gave which score.$t$, true, 3)
) as v(section, question, answer, on_home, n)
on conflict ((lower(question))) do nothing;
