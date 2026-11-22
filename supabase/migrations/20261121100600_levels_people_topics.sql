-- Levels instead of a topic-by-topic path, a large topic library, connections between people, a good/bad vote
-- after every call, and what's happening now on the home page. Spec: docs/LEARNING_PATH.md.
--
-- Progress is per level (A1 to C2). Every level has many topics that share one goal. Any topic call at the
-- learner's current level counts toward it: `partners_needed` different assessors with a cumulative `pass_pct`
-- passes the level and opens the next. The verified level is the highest level passed.
--
-- Connections: one person asks, the other accepts. Connected people can call each other and see whether the other
-- is online or already on a call. Chats still allow calls, as before.

-- ---------------------------------------------------------------- levels

create table public.path_levels (
  band text primary key check (band in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  rank int not null unique,
  goal text not null
);
alter table public.path_levels enable row level security;
grant select on public.path_levels to authenticated;
create policy "levels readable" on public.path_levels for select to authenticated using (true);

insert into public.path_levels (band, rank, goal) values
 ('A1', 1, 'Exchange simple personal information and talk about familiar, everyday things.'),
 ('A2', 2, 'Describe experiences, places and plans in short connected sentences, and handle everyday situations.'),
 ('B1', 3, 'Tell stories, explain opinions and give reasons on familiar topics, and keep the conversation going.'),
 ('B2', 4, 'Discuss topics in detail, compare points of view and defend an opinion with examples.'),
 ('C1', 5, 'Explore abstract and complex ideas fluently, build arguments and respond to subtle points.'),
 ('C2', 6, 'Debate nuanced ideas with precision and style, and adapt your language to any situation.');

-- ---------------------------------------------------------------- the topic library

alter table public.path_topics drop constraint if exists path_topics_no_check;
alter table public.path_topics add constraint path_topics_no_check check (no >= 1);
alter table public.path_topics add column category text not null default 'everyday'
  check (category in ('people', 'everyday', 'food', 'places', 'free-time', 'travel', 'school-work', 'health', 'nature', 'tech', 'culture', 'society', 'ideas', 'stories'));
-- Extra angles shown during the call, so a conversation doesn't run dry.
alter table public.path_topics add column ideas text[] not null default '{}';

update public.path_topics set category = case no
  when 1 then 'people' when 2 then 'people' when 3 then 'everyday' when 4 then 'food' when 5 then 'places' when 6 then 'everyday'
  when 7 then 'free-time' when 8 then 'travel' when 9 then 'stories' when 10 then 'school-work' when 11 then 'health' when 12 then 'ideas'
  when 13 then 'tech' when 14 then 'society' when 15 then 'nature' when 16 then 'culture' when 17 then 'school-work' when 18 then 'school-work'
  when 19 then 'ideas' when 20 then 'society' when 21 then 'culture' when 22 then 'ideas' when 23 then 'society' when 24 then 'society'
  when 25 then 'ideas' else category end;

-- Every topic suits members from 12: no politics, crime or adult themes, and no prompt asks for an address, a school or a timetable.
insert into public.path_topics (no, band, slug, title, summary, category, prompts, ideas) values
 -- A1
 (26, 'A1', 'my-room', 'My room', 'Describe your room and the things in it.', 'everyday',
  array['What colour are the walls in your room?', 'Name five things in your room.', 'What is your favourite thing in your room?', 'Ask your partner about their room.'],
  array['Is your room tidy or messy?', 'What would you like to add to your room?', 'Where do you like to sit and relax?']),
 (27, 'A1', 'pets-animals', 'Pets and animals', 'Talk about pets and your favourite animals.', 'nature',
  array['Do you have a pet? What is its name?', 'What is your favourite animal? Why?', 'Is there an animal you are afraid of?', 'Ask your partner about animals they like.'],
  array['Cats or dogs?', 'What animal would you like to be for one day?', 'Which animals live in your country?']),
 (28, 'A1', 'clothes-colours', 'Clothes and colours', 'Say what you wear and which colours you like.', 'everyday',
  array['What are you wearing today?', 'What is your favourite colour?', 'What do you wear when it is cold? And when it is hot?', 'Describe your favourite piece of clothing.'],
  array['Do you like shopping for clothes?', 'What colour is your bag?', 'What do people wear at a party in your country?']),
 (29, 'A1', 'weather-seasons', 'Weather and seasons', 'Talk about the weather today and your favourite season.', 'nature',
  array['What is the weather like today where you are?', 'What is your favourite season? Why?', 'What do you do on a rainy day?', 'Ask your partner about the weather in their country.'],
  array['Do you like snow?', 'What is the hottest month where you live?', 'What do you do on a sunny day?']),
 (30, 'A1', 'birthdays-dates', 'Birthdays and dates', 'Say dates, ages and how you celebrate birthdays.', 'people',
  array['When is your birthday?', 'How do you celebrate your birthday?', 'What is a good birthday present?', 'Ask your partner about their last birthday.'],
  array['What is your favourite birthday food?', 'Do you like surprises?', 'What day is it today? And tomorrow?']),
 (31, 'A1', 'favourite-things', 'My favourite things', 'Talk about the things you like most.', 'free-time',
  array['What is your favourite film or show?', 'What is your favourite food?', 'What is your favourite day of the week? Why?', 'Find three favourites you and your partner share.'],
  array['Favourite song right now?', 'Favourite place in your town?', 'Favourite word in the language you are learning?']),
 (32, 'A1', 'at-the-cafe', 'At the café', 'Order food and drinks and ask about prices.', 'food',
  array['Role-play: you are the customer, your partner is the waiter. Order a drink.', 'Ask how much something costs.', 'Say what you like and don''t like on the menu.', 'Swap roles and do it again.'],
  array['Hot or cold drinks?', 'Sweet or salty snacks?', 'What is a popular café drink in your country?']),
 (33, 'A1', 'my-week', 'My week', 'Talk about the days of the week and what you do.', 'everyday',
  array['What do you do on Mondays?', 'What is your busiest day?', 'What do you do on Saturday?', 'Ask your partner about their week.'],
  array['What time do you get up?', 'What is your favourite part of the week?', 'What will you do tomorrow?']),
 (34, 'A1', 'sports-games', 'Sports and games', 'Talk about sports and games you play or watch.', 'free-time',
  array['Do you play a sport?', 'What sport do you like to watch?', 'What games do you play with friends?', 'Ask your partner if they like sport.'],
  array['Football or basketball?', 'Board games or video games?', 'Can you swim?']),
 (35, 'A1', 'music-i-like', 'Music I like', 'Talk about music, singers and songs you like.', 'culture',
  array['What music do you like?', 'Who is your favourite singer or band?', 'Do you play an instrument?', 'Tell your partner the name of a song you love.'],
  array['Do you sing?', 'When do you listen to music?', 'What music is popular in your country?']),
 -- A2
 (36, 'A2', 'cooking-home', 'Cooking at home', 'Describe a dish and explain how to make it.', 'food',
  array['What can you cook?', 'Explain the steps to make a simple dish you like.', 'Who cooks in your home?', 'Describe a meal you ate recently.'],
  array['Have you ever cooked for friends?', 'What dish from your country should your partner try?', 'What was a cooking disaster you had?']),
 (37, 'A2', 'holidays-festivals', 'Holidays and festivals', 'Talk about a festival or holiday and what people do.', 'culture',
  array['What is the biggest festival in your country?', 'What do people eat and wear at it?', 'What did you do last holiday?', 'Compare it with a festival in your partner''s country.'],
  array['Do you give presents at festivals?', 'Which festival would you like to visit abroad?', 'What music do you hear at festivals?']),
 (38, 'A2', 'my-neighbourhood', 'My neighbourhood', 'Describe the area you live in, without saying exactly where.', 'places',
  array['Is your neighbourhood quiet or busy?', 'What shops and places are near your home?', 'What do you like about your area?', 'What is missing in your neighbourhood?'],
  array['Are there parks near you?', 'How has your area changed?', 'Where do young people meet?']),
 (39, 'A2', 'films-series', 'Films and series', 'Talk about films and series you have watched.', 'culture',
  array['What film did you watch recently? Was it good?', 'What kind of films do you like?', 'Describe your favourite character.', 'Recommend a series to your partner and say why.'],
  array['Cinema or home?', 'Do you watch with subtitles?', 'What film have you watched more than once?']),
 (40, 'A2', 'favourite-subjects', 'Favourite subjects', 'Talk about what you like learning and why.', 'school-work',
  array['What is your favourite subject or thing to learn?', 'What is difficult for you to learn?', 'Who is a good teacher you remember, and why?', 'What would you like to learn next?'],
  array['Do you prefer learning alone or in a group?', 'How do you remember new words?', 'What did you learn this week?']),
 (41, 'A2', 'last-weekend', 'Last weekend', 'Tell your partner what you did, in the past tense.', 'stories',
  array['What did you do last weekend?', 'Who were you with?', 'What was the best moment?', 'Ask your partner three questions about their weekend.'],
  array['Did you eat anything special?', 'Did you go anywhere new?', 'What will you do differently next weekend?']),
 (42, 'A2', 'help-in-town', 'Asking for help in town', 'Ask for directions and help, and understand the answers.', 'places',
  array['Role-play: you are lost. Ask your partner for directions to a museum.', 'Ask where to buy a ticket.', 'Explain the way from a station to a café you invent.', 'Swap roles.'],
  array['What do you do when you get lost?', 'Do you use maps on your phone?', 'How do you politely ask a stranger for help?']),
 (43, 'A2', 'games-apps', 'Games and apps', 'Talk about apps and games you use every day.', 'tech',
  array['What apps do you use most?', 'Describe a game you enjoy and how to play it.', 'How much time do you spend on your phone?', 'Recommend an app to your partner.'],
  array['Do you play games with friends online?', 'What app could you not live without?', 'Is there an app you deleted? Why?']),
 (44, 'A2', 'staying-healthy', 'Staying healthy', 'Talk about food, sleep and exercise.', 'health',
  array['What do you do to stay healthy?', 'How many hours do you sleep?', 'What healthy food do you like?', 'Give your partner one health tip.'],
  array['Do you walk a lot?', 'What do you do when you feel tired?', 'What is a healthy habit you want to start?']),
 (45, 'A2', 'parks-outdoors', 'Parks and the outdoors', 'Describe places in nature and what you do there.', 'nature',
  array['Do you like being outside?', 'Describe a beautiful place in nature you have visited.', 'What do you do in a park?', 'Plan a day outdoors with your partner.'],
  array['Mountains or beach?', 'Have you ever camped?', 'What animals do you see outside?']),
 -- B1
 (46, 'B1', 'trip-to-remember', 'A trip to remember', 'Tell the story of a trip with details and feelings.', 'travel',
  array['Tell the story of a trip you remember well.', 'What surprised you there?', 'Did anything go wrong? What did you do?', 'Would you go back? Why or why not?'],
  array['Who did you travel with?', 'What did you bring home?', 'What would you tell someone going there for the first time?']),
 (47, 'B1', 'books-stories', 'Books and stories', 'Talk about a book or story and give your opinion of it.', 'culture',
  array['Describe a book or story you liked without spoiling the end.', 'Who was the most interesting character? Why?', 'Do you prefer books or films of the same story?', 'Recommend something for your partner to read.'],
  array['Do you read on paper or a screen?', 'What story did you love as a child?', 'Would you like to write a story? About what?']),
 (48, 'B1', 'role-models', 'Role models', 'Describe someone you admire and explain why.', 'people',
  array['Who is someone you admire? It can be someone you know.', 'What qualities do they have?', 'How have they influenced you?', 'Is it good to have famous role models?'],
  array['What advice would they give you?', 'What quality would you like to have more of?', 'Who admires you, do you think?']),
 (49, 'B1', 'learning-languages', 'Learning languages', 'Share how you learn and what works for you.', 'ideas',
  array['Why are you learning this language?', 'What is the hardest part for you?', 'Share a tip that helps you learn.', 'Tell a funny mistake you made in another language.'],
  array['What word do you love in this language?', 'Which language would you like to learn next?', 'How do you practise speaking?']),
 (50, 'B1', 'food-world', 'Food around the world', 'Compare food cultures and explain what you think.', 'food',
  array['What dish best represents your country? Why?', 'What foreign food do you love?', 'Is there a food you tried and didn''t like?', 'How are meal times different between your countries?'],
  array['Street food or restaurants?', 'Would you try insects?', 'What dish would you cook for a visitor?']),
 (51, 'B1', 'smart-fixes', 'Small problems, smart fixes', 'Describe everyday problems and suggest solutions.', 'everyday',
  array['Describe a small problem you had this week.', 'How did you solve it?', 'Ask your partner for advice on a problem you invent.', 'Give your partner advice on one of theirs.'],
  array['What do you do when you lose something?', 'What is the best life hack you know?', 'Who do you ask for help?']),
 (52, 'B1', 'social-media', 'Social media habits', 'Talk about how you use social media and how it makes you feel.', 'tech',
  array['Which social apps do you use, and what for?', 'What do you like and dislike about them?', 'Has social media ever changed your mood?', 'What rules would you make for yourself?'],
  array['Do you post or mostly watch?', 'What makes a post worth sharing?', 'Could you stop for a week?']),
 (53, 'B1', 'teamwork', 'Teams and teamwork', 'Talk about working with others and what makes a good team.', 'free-time',
  array['Tell your partner about a time you worked in a team.', 'What makes a good team member?', 'What do you do when a team disagrees?', 'Are you better alone or in a team? Why?'],
  array['What is the best team you have seen?', 'Who should be the leader?', 'What happens when someone does nothing?']),
 (54, 'B1', 'wildlife', 'Wildlife and protecting animals', 'Discuss wild animals and how people can protect them.', 'nature',
  array['What wild animals live in your country?', 'Why are some animals in danger?', 'What can ordinary people do to help?', 'Are zoos good or bad? Give reasons.'],
  array['Have you seen a wild animal up close?', 'Which animal should we save first?', 'What do you think of nature documentaries?']),
 (55, 'B1', 'dream-jobs', 'Dream jobs', 'Talk about jobs, skills and what you would like to do.', 'school-work',
  array['What job would you love to do? Why?', 'What skills does it need?', 'What job would you never do?', 'Ask your partner what they wanted to be as a child.'],
  array['Would you work from home?', 'Is money or enjoyment more important?', 'What job will exist in 20 years that doesn''t now?']),
 -- B2
 (56, 'B2', 'city-or-country', 'City life or country life', 'Compare living in the city and the countryside.', 'places',
  array['Where would you rather grow up, a city or the countryside? Why?', 'What are the hidden costs of city life?', 'Can the countryside keep young people? How?', 'Agree on the perfect place to live, with reasons.'],
  array['What do city people misunderstand about the countryside?', 'Would you move far for a better life?', 'What makes a place feel like home?']),
 (57, 'B2', 'advertising', 'Advertising and what we buy', 'Discuss how adverts influence us.', 'society',
  array['Describe an advert you remember. Why did it work?', 'Do adverts make you buy things you don''t need?', 'Should adverts aimed at young people have stricter rules?', 'Create a short advert together for a strange product.'],
  array['Are influencer posts adverts?', 'What brands do you trust and why?', 'Would a world without adverts be better?']),
 (58, 'B2', 'fame-influencers', 'Fame and influencers', 'Discuss fame, influencers and their effect.', 'culture',
  array['Would you like to be famous? Why or why not?', 'What makes someone a good influencer?', 'Do famous people have a duty to be good examples?', 'How has fame changed with the internet?'],
  array['Who deserves to be famous but isn''t?', 'Can fame be bad for you?', 'What would you do with a million followers?']),
 (59, 'B2', 'online-safety', 'Staying safe online', 'Discuss risks online and how to stay safe.', 'tech',
  array['What are the main risks for young people online?', 'How do you know if information online is true?', 'What would you do if someone was unkind to you online?', 'Agree on three rules for staying safe online.'],
  array['Should apps check users'' ages?', 'How private is your profile?', 'What is a strong password?']),
 (60, 'B2', 'tourism', 'Tourism: good or bad?', 'Weigh up what tourism brings to a place.', 'travel',
  array['What does tourism bring to your country?', 'Can too many tourists harm a place? How?', 'How can people travel more responsibly?', 'Would you prefer a famous place or an unknown one? Why?'],
  array['Is it better to travel far or explore near home?', 'What do tourists often get wrong?', 'How should a city welcome visitors?']),
 (61, 'B2', 'sport-fairness', 'Sport, money and fairness', 'Discuss money, fairness and rules in sport.', 'society',
  array['Are top athletes paid too much? Explain.', 'Is it fair when rich teams always win?', 'Should technology help referees? Give examples.', 'What makes a sport fair?'],
  array['Should girls and boys play together?', 'Is e-sport a real sport?', 'What sport would you change, and how?']),
 (62, 'B2', 'screens-sleep', 'Screen time and sleep', 'Discuss how screens affect rest and focus.', 'health',
  array['How do screens affect your sleep?', 'Is screen time always bad? Give examples.', 'What helps you focus when you study?', 'Agree on a healthy evening routine.'],
  array['Do you use your phone in bed?', 'What is a good digital break?', 'Should phones be allowed at meals?']),
 (63, 'B2', 'good-friend', 'What makes a good friend', 'Discuss friendship and how it changes.', 'people',
  array['What makes a good friend?', 'Can you be real friends with someone online?', 'How do friendships change as we grow up?', 'How do you fix an argument with a friend?'],
  array['Is it better to have many friends or a few close ones?', 'Can friends be too honest?', 'What did you learn from an old friendship?']),
 (64, 'B2', 'music-identity', 'Music and identity', 'Discuss how music shapes who we are.', 'culture',
  array['How does music show who you are?', 'Does the music of your country matter to you?', 'Do people judge others by the music they like?', 'Introduce a song from your culture and explain it.'],
  array['Old music or new music?', 'Can music change your mood on purpose?', 'Should music be free?']),
 (65, 'B2', 'climate-choices', 'Everyday climate choices', 'Discuss small choices and the bigger picture.', 'nature',
  array['What do you do to waste less?', 'Do individual choices really matter?', 'What should companies do differently?', 'Agree on the most useful change a family can make.'],
  array['Is second-hand clothing cool?', 'How do you get around town?', 'What would you give up for the planet?']),
 -- C1
 (66, 'C1', 'artificial-intelligence', 'Artificial intelligence', 'Explore what AI can and should do.', 'tech',
  array['Where do you already meet AI in daily life?', 'What should AI never be allowed to decide?', 'Will AI make learning easier or lazier?', 'Imagine school or work in 2045 with AI everywhere.'],
  array['Can a machine be creative?', 'Who is responsible when AI makes a mistake?', 'What human skill will matter most?']),
 (67, 'C1', 'space-exploration', 'Space exploration', 'Discuss why and how we explore space.', 'ideas',
  array['Is space exploration worth the cost? Argue both sides.', 'Would you live on another planet? What would you miss?', 'Who should own resources in space?', 'What discovery would change everything?'],
  array['Do you think there is life elsewhere?', 'Should space travel be for tourists?', 'What would you take on a one-way trip?']),
 (68, 'C1', 'remembering-the-past', 'How we remember the past', 'Explore museums, monuments and family memories.', 'society',
  array['How does your family keep its memories?', 'What should a museum about our time show?', 'Should old buildings always be protected?', 'What will people in 100 years find strange about us?'],
  array['Do photos change how we remember?', 'What object would you keep for 50 years?', 'Is it important to know your family history?']),
 (69, 'C1', 'originality', 'Originality and copying', 'Discuss creativity, copying and inspiration.', 'culture',
  array['Where is the line between inspiration and copying?', 'Is anything truly original?', 'Should remixes and fan art be allowed?', 'How do you get creative ideas?'],
  array['Who owns an idea?', 'Can rules make people more creative?', 'What is the most original thing you have seen?']),
 (70, 'C1', 'future-cities', 'Cities of the future', 'Design and debate the city of tomorrow.', 'places',
  array['What will cities look like in 50 years?', 'Should cars be banned from city centres?', 'How can a city feel friendly, not just efficient?', 'Design one street of the future together.'],
  array['Green roofs or more parks?', 'Who should decide how a city changes?', 'What would you keep from today''s cities?']),
 (71, 'C1', 'decisions', 'How we make decisions', 'Explore choices, instinct and advice.', 'ideas',
  array['Describe a hard decision and how you made it.', 'Do you trust your instinct or lists of pros and cons?', 'Why do too many options make choosing harder?', 'Whose advice do you trust, and why?'],
  array['Do you regret any choice?', 'Should we let apps choose for us?', 'How do you decide what to eat?']),
 (72, 'C1', 'future-of-food', 'The future of food', 'Discuss how we will eat and grow food.', 'food',
  array['Would you eat food grown in a lab?', 'How might cooking change in 30 years?', 'Should cities grow their own food?', 'How can we waste less food?'],
  array['Will restaurants survive?', 'What traditional dish must never disappear?', 'Is eating less meat a good idea?']),
 (73, 'C1', 'kindness', 'Kindness to strangers', 'Explore why people help each other.', 'people',
  array['Tell about a time a stranger helped you.', 'Why do people help strangers?', 'Is kindness different across cultures?', 'How could your community be kinder?'],
  array['Do you return lost things?', 'Is it ever wrong to help?', 'Can kindness spread?']),
 (74, 'C1', 'learning-from-failure', 'Learning from failure', 'Discuss mistakes, resilience and growth.', 'school-work',
  array['Describe a failure that taught you something.', 'Why are people afraid of failing?', 'Should schools reward effort or results?', 'How do you bounce back from a bad day?'],
  array['Is perfectionism a strength?', 'Who failed before succeeding?', 'What would you try if you couldn''t fail?']),
 (75, 'C1', 'oceans', 'The oceans', 'Explore the sea, its life and its future.', 'nature',
  array['What does the sea mean in your culture?', 'What are the biggest threats to the oceans?', 'Should deep-sea exploration have limits?', 'What would you discover on an ocean expedition?'],
  array['Do you like swimming in the sea?', 'What sea creature fascinates you?', 'Could people live underwater?']),
 -- C2
 (76, 'C2', 'truth-storytelling', 'Truth and storytelling', 'Debate how stories shape what we believe.', 'ideas',
  array['Can a story be untrue but still honest?', 'Why do rumours spread faster than facts?', 'Is it ever right to exaggerate a story?', 'Tell a short story; your partner guesses which parts are invented.'],
  array['What makes a storyteller trustworthy?', 'Do photos still prove anything?', 'Which stories from your culture teach a lesson?']),
 (77, 'C2', 'humour', 'What makes something funny', 'Analyse humour across languages and cultures.', 'culture',
  array['What makes a joke funny?', 'Why are jokes so hard to translate?', 'Is there humour that should never be used?', 'Try to explain a joke from your culture to your partner.'],
  array['Puns or physical comedy?', 'Who is the funniest person you know?', 'Can irony be misunderstood in writing?']),
 (78, 'C2', 'time', 'Time and how we spend it', 'Reflect on time, speed and attention.', 'ideas',
  array['Why does time seem to go faster as we get older?', 'Is being busy a good thing?', 'What is time well wasted?', 'If you had an extra hour every day, how would you spend it?'],
  array['Are you always early or late?', 'Does boredom have value?', 'How do different cultures see punctuality?']),
 (79, 'C2', 'beauty', 'What is beautiful?', 'Debate whether beauty is personal or shared.', 'culture',
  array['Is beauty in the eye of the beholder?', 'Describe something ugly that you find beautiful.', 'Do filters and editing change what we find beautiful?', 'Can a mathematical idea be beautiful?'],
  array['What is the most beautiful word you know?', 'Does beauty change between generations?', 'Is nature always beautiful?']),
 (80, 'C2', 'privacy', 'Privacy in a connected world', 'Debate what privacy means today.', 'tech',
  array['What does privacy mean to you?', 'Is privacy worth giving up for convenience?', 'Should parents see everything their children do online?', 'Write three privacy rules for the internet together.'],
  array['What would you never share online?', 'Can privacy and safety go together?', 'Will privacy exist in 2060?']),
 (81, 'C2', 'lost-in-translation', 'Lost in translation', 'Explore what languages can and cannot say.', 'ideas',
  array['Share a word in your language that has no translation.', 'Does a language change how you think?', 'Are you a different person in another language?', 'Translate a proverb literally and explain its real meaning.'],
  array['What gets lost in subtitles?', 'Will translation apps replace learning languages?', 'Which language sounds most musical to you?']),
 (82, 'C2', 'luck-or-effort', 'Luck or effort?', 'Debate how much success depends on luck.', 'society',
  array['How much of success is luck?', 'Tell about a lucky break in your life.', 'Should we admire effort more than results?', 'Can people make their own luck?'],
  array['Do you believe in lucky objects?', 'Is talent a kind of luck?', 'What role do other people play in success?']),
 (83, 'C2', 'talent-born-made', 'Talent: born or made?', 'Debate whether talent is natural or learned.', 'people',
  array['Are people born talented or do they become talented?', 'Is 10,000 hours of practice the answer?', 'What talent do you wish you had?', 'How should talent be encouraged in young people?'],
  array['Can anyone learn to draw?', 'Is there a talent that can''t be taught?', 'Do labels like "gifted" help or hurt?']),
 (84, 'C2', 'progress', 'Is progress always good?', 'Weigh progress against what it costs.', 'society',
  array['What is real progress?', 'Name an invention that made life worse in some way.', 'Should we ever slow down progress?', 'What will be seen as progress in 100 years?'],
  array['Was life better without phones?', 'Who benefits from progress?', 'Is going back ever progress?']),
 (85, 'C2', 'better-world', 'Imagining a better world', 'Design and challenge an ideal society.', 'ideas',
  array['Describe your ideal society in three rules.', 'Your partner finds a problem with each rule. Defend or change them.', 'Why do so many stories about perfect worlds go wrong?', 'What small step today moves towards a better world?'],
  array['Would you want to live there forever?', 'Who would be unhappy in your world?', 'What should never change?']);

-- ---------------------------------------------------------------- progress per level

create table public.level_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  language_id text not null references public.languages(id) on delete cascade,
  band text not null references public.path_levels(band),
  unlocked_at timestamptz not null default now(),
  passed_at timestamptz,
  score_pct int check (score_pct between 0 and 100),
  primary key (user_id, language_id, band)
);
alter table public.level_progress enable row level security;
grant select on public.level_progress to authenticated;
create policy "read own level progress" on public.level_progress for select to authenticated using (auth.uid() = user_id);

-- A level is passed if any of its topics was passed under the old path, so verified levels stay as they were.
insert into public.level_progress (user_id, language_id, band, unlocked_at, passed_at, score_pct)
select tp.user_id, tp.language_id, t.band, min(tp.unlocked_at), min(tp.passed_at), round(avg(tp.score_pct) filter (where tp.passed_at is not null))
from public.topic_progress tp join public.path_topics t on t.no = tp.topic_no
group by tp.user_id, tp.language_id, t.band;
insert into public.level_progress (user_id, language_id, band)
select lp.user_id, lp.language_id, nb.band from public.level_progress lp
join public.path_levels b on b.band = lp.band join public.path_levels nb on nb.rank = b.rank + 1
where lp.passed_at is not null on conflict do nothing;

-- Assessments now count toward a level: one per assessor per level ("five different people").
alter table public.topic_assessments add column band text references public.path_levels(band);
update public.topic_assessments a set band = t.band from public.path_topics t where t.no = a.topic_no;
delete from public.topic_assessments a using public.topic_assessments b
where a.learner_id = b.learner_id and a.language_id = b.language_id and a.band = b.band and a.assessor_id = b.assessor_id
  and (a.created_at, a.id) < (b.created_at, b.id);
alter table public.topic_assessments alter column band set not null;
alter table public.topic_assessments drop constraint topic_assessments_once;
alter table public.topic_assessments add constraint topic_assessments_once unique (learner_id, language_id, band, assessor_id);

-- The old per-topic functions go; their replacements follow.
drop function public.my_path();
drop function public.list_topic_partners();
drop function public.start_topic_call(uuid);
drop function public.evaluate_topic(uuid, text, integer);
drop function public.topic_tally(uuid, text, integer);
drop function public.current_topic(uuid, text);
drop function public.sweep_settling_topics();
drop function public.ensure_path(uuid, text);
drop function public.path_start_topic(text);
drop table public.topic_progress;
do $$ begin perform cron.unschedule('ft-path-settle'); exception when others then null; end $$;

-- ---------------------------------------------------------------- helpers (internal)

create function public.band_rank(p_band text) returns int language sql stable set search_path = public as $$
  select rank from path_levels where band = p_band $$;

create function public.ensure_path(p_user uuid, p_lang text) returns void language plpgsql security definer set search_path = public as $$
declare v_band text;
begin
  if p_user is null or p_lang is null then return; end if;
  if not exists (select 1 from level_progress where user_id = p_user and language_id = p_lang) then
    select coalesce((select band from path_levels where band = p.learning_level), 'A1') into v_band
    from profiles p where p.id = p_user;
    insert into level_progress (user_id, language_id, band) values (p_user, p_lang, coalesce(v_band, 'A1')) on conflict do nothing;
  end if;
end $$;

-- The level being worked on: the lowest unlocked one not yet passed.
create function public.current_band(p_user uuid, p_lang text) returns text language sql stable security definer set search_path = public as $$
  select lp.band from level_progress lp join path_levels l on l.band = lp.band
  where lp.user_id = p_user and lp.language_id = p_lang and lp.passed_at is null order by l.rank limit 1 $$;

-- Who may assess a level: a native speaker, or someone who passed a higher level.
create function public.assessor_basis_band(p_assessor uuid, p_lang text, p_band text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from profiles where id = p_assessor and status = 'active' and native_language_id = p_lang) then 'native'
    when exists (select 1 from level_progress lp join path_levels l on l.band = lp.band join profiles p on p.id = lp.user_id and p.status = 'active'
                 where lp.user_id = p_assessor and lp.language_id = p_lang and lp.passed_at is not null and l.rank > public.band_rank(p_band)) then 'passed'
  end $$;

create or replace function public.assessor_basis(p_assessor uuid, p_lang text, p_topic int) returns text
language sql stable security definer set search_path = public as $$
  select public.assessor_basis_band(p_assessor, p_lang, public.topic_band(p_topic)) $$;

create or replace function public.assessment_blocker(p_call uuid, p_assessor uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare tc topic_calls; c calls; s path_settings;
begin
  select * into s from path_settings;
  select * into tc from topic_calls where call_id = p_call;
  select * into c from calls where id = p_call;
  if tc.call_id is null or tc.partner_id is distinct from p_assessor then return 'not_partner'; end if;
  if c.status in ('ringing', 'active') then return 'call_not_ended'; end if;
  if coalesce(public.topic_call_minutes(p_call), 0) < s.min_call_minutes then return 'too_short'; end if;
  if c.ended_at < now() - make_interval(days => s.assess_window_days) then return 'window_closed'; end if;
  if exists (select 1 from topic_assessments a where a.learner_id = tc.learner_id and a.language_id = tc.language_id
             and a.band = public.topic_band(tc.topic_no) and a.assessor_id = p_assessor) then return 'already_assessed'; end if;
  if public.assessor_basis(p_assessor, tc.language_id, tc.topic_no) is null then return 'not_eligible'; end if;
  return null;
end $$;

create function public.level_tally(p_user uuid, p_lang text, p_band text)
returns table (counting int, waiting int, score_pct numeric) language sql stable security definer set search_path = public as $$
  with s as (select * from path_settings),
  a as (
    select x.assessor_id, x.score_pct,
      public.band_rank(p_band) < public.band_rank('B1') or p.created_at <= now() - make_interval(days => (select settle_days from s)) as counts
    from topic_assessments x join profiles p on p.id = x.assessor_id and p.status = 'active'
    where x.learner_id = p_user and x.language_id = p_lang and x.band = p_band)
  select (count(distinct assessor_id) filter (where counts))::int,
         (count(distinct assessor_id) filter (where not counts))::int,
         round(avg(score_pct) filter (where counts), 1)
  from a $$;

-- Passing is cumulative across every topic of the level. Running it twice changes nothing.
create function public.evaluate_band(p_user uuid, p_lang text, p_band text) returns boolean
language plpgsql security definer set search_path = public as $$
declare s path_settings; t record; v_passed timestamptz; v_next text;
begin
  select * into s from path_settings;
  select passed_at into v_passed from level_progress where user_id = p_user and language_id = p_lang and band = p_band for update;
  if not found or v_passed is not null then return false; end if;
  select * into t from public.level_tally(p_user, p_lang, p_band);
  if t.counting < s.partners_needed or coalesce(t.score_pct, 0) < s.pass_pct then return false; end if;
  update level_progress set passed_at = now(), score_pct = round(t.score_pct) where user_id = p_user and language_id = p_lang and band = p_band;
  select band into v_next from path_levels where rank = public.band_rank(p_band) + 1;
  if v_next is not null then insert into level_progress (user_id, language_id, band) values (p_user, p_lang, v_next) on conflict do nothing; end if;
  perform public.notify_event(p_user, null, 'topic_passed', jsonb_build_object('band', p_band, 'next', v_next, 'language', p_lang, 'score', round(t.score_pct)),
    'level:' || p_lang || ':' || p_band || ':passed', true);
  perform public.check_level_safely(p_user);
  return true;
end $$;

-- The verified level is the highest level passed in the language being learned.
create or replace function public.evaluate_level(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_new text;
begin
  select * into me from profiles where id = p_user;
  if not found or me.learning_language_id is null then return null; end if;
  select lp.band into v_new from level_progress lp join path_levels l on l.band = lp.band
  where lp.user_id = p_user and lp.language_id = me.learning_language_id and lp.passed_at is not null
  order by l.rank desc limit 1;
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set level_checked_at = now() where id = p_user;
  if v_new is distinct from me.verified_level then
    update profiles set verified_level = v_new,
      learning_level = case when public.level_rank(v_new) > public.level_rank(learning_level) then v_new else learning_level end
    where id = p_user;
    update user_languages ul set level = p.learning_level from profiles p
    where p.id = p_user and ul.user_id = p_user and ul.role = 'learning';
    if public.level_rank(v_new) > public.level_rank(me.verified_level) then
      perform public.notify(p_user, null, 'level_up', jsonb_build_object('level', v_new, 'language', me.learning_language_id));
    end if;
  end if;
  return v_new;
end $$;

create function public.sweep_settling_levels() returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct lp.user_id, lp.language_id, lp.band from level_progress lp
           join topic_assessments a on a.learner_id = lp.user_id and a.language_id = lp.language_id and a.band = lp.band
           where lp.passed_at is null limit 500 loop
    perform public.evaluate_band(r.user_id, r.language_id, r.band);
  end loop;
end $$;

-- ---------------------------------------------------------------- connections

create table public.connections (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint connections_not_self check (requester_id <> addressee_id)
);
create unique index connections_pair_idx on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);
alter table public.connections enable row level security;
grant select on public.connections to authenticated;
create policy "see own connections" on public.connections for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create trigger staff_refused before insert on public.connections for each row execute function public.refuse_staff_learner_action();

create function public.is_connected(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from connections where status = 'accepted'
                 and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))) $$;

-- A block ends any connection between the two.
create function public.trg_block_ends_connection() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from connections where (requester_id = new.blocker_id and addressee_id = new.blocked_id) or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return null;
end $$;
create trigger block_ends_connection after insert on public.blocks for each row execute function public.trg_block_ends_connection();

-- Ask to connect. If they already asked me, this accepts. Returns the state: 'pending' or 'connected'.
create function public.request_connection(p_user uuid) returns text language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_user = auth.uid() then raise exception 'cannot_connect_self'; end if;
  if not exists (select 1 from profiles where id = p_user and status = 'active' and onboarding_done)
     or public.is_blocked_between(auth.uid(), p_user) or exists (select 1 from admin_accounts where user_id = p_user)
     or public.age_gate(p_user) is not null then raise exception 'user_unavailable'; end if;
  if exists (select 1 from connections where requester_id = p_user and addressee_id = auth.uid()) then
    perform public.respond_connection(p_user, true); return 'connected';
  end if;
  -- Adults don't see under-16s, so they can't ask them; an under-16 may ask anyone.
  if not public.minor_visible(auth.uid(), p_user) then raise exception 'user_unavailable'; end if;
  insert into connections (requester_id, addressee_id) values (auth.uid(), p_user) on conflict do nothing;
  if found then
    perform public.notify_event(p_user, auth.uid(), 'connection_request', jsonb_build_object('user_id', auth.uid()), 'connect:' || auth.uid() || ':' || p_user, false);
  end if;
  return (select case when status = 'accepted' then 'connected' else 'pending' end from connections where requester_id = auth.uid() and addressee_id = p_user);
end $$;

create function public.respond_connection(p_user uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_accept then
    if public.is_blocked_between(auth.uid(), p_user) then raise exception 'user_unavailable'; end if;
    update connections set status = 'accepted', accepted_at = now() where requester_id = p_user and addressee_id = auth.uid() and status = 'pending';
    if found then
      perform public.notify_event(p_user, auth.uid(), 'connection_accepted', jsonb_build_object('user_id', auth.uid()), 'connected:' || p_user || ':' || auth.uid(), false);
    end if;
  else
    delete from connections where requester_id = p_user and addressee_id = auth.uid() and status = 'pending';
  end if;
  delete from notifications where user_id = auth.uid() and dedupe_key = 'connect:' || p_user || ':' || auth.uid();
end $$;

-- Cancel my request, or end a connection.
create function public.remove_connection(p_user uuid) returns void language sql security definer set search_path = public as $$
  delete from connections where (requester_id = auth.uid() and addressee_id = p_user) or (requester_id = p_user and addressee_id = auth.uid() and status = 'accepted') $$;

create function public.list_connection_requests()
returns table (id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, c.created_at
  from connections c join profiles p on p.id = c.requester_id and p.status = 'active'
  where c.addressee_id = auth.uid() and c.status = 'pending' and not public.is_blocked_between(auth.uid(), p.id)
  order by c.created_at desc limit 100 $$;

create function public.list_connections(p_limit int default 100)
returns table (id uuid, username text, display_name text, avatar_url text, accepted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, c.accepted_at
  from connections c join profiles p on p.id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end and p.status = 'active'
  where auth.uid() in (c.requester_id, c.addressee_id) and c.status = 'accepted' and not public.is_blocked_between(auth.uid(), p.id)
  order by c.accepted_at desc limit least(greatest(coalesce(p_limit, 100), 1), 200) $$;

-- Connected people, or people in an accepted chat, may call each other.
create or replace function public.can_call(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and a <> b
    and exists (select 1 from profiles where id = a and status = 'active')
    and exists (select 1 from profiles where id = b and status = 'active')
    and not exists (select 1 from admin_accounts where user_id in (a, b))
    and not public.is_blocked_between(a, b)
    -- Under-16s may call anyone, adults included, so they can be assessed; only once a guardian has agreed (the
    -- request gate covers the caller). Such a call is voice only (claim_call_join).
    and public.age_gate(a) is null and public.age_gate(b) is null
    and (public.is_connected(a, b)
      or exists (select 1 from conversation_members x join conversation_members y on y.conversation_id = x.conversation_id
                 where x.user_id = a and y.user_id = b and x.status = 'active' and y.status = 'active')) $$;

-- ---------------------------------------------------------------- call votes

-- After a call, each person says whether it was a good call. Votes are never shown one by one: only a count of
-- good calls appears on a profile.
create table public.call_votes (
  call_id uuid not null references public.calls(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  about_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('good', 'bad')),
  created_at timestamptz not null default now(),
  primary key (call_id, voter_id)
);
create index call_votes_about_idx on public.call_votes (about_id, vote);
alter table public.call_votes enable row level security;
create trigger staff_refused before insert on public.call_votes for each row execute function public.refuse_staff_learner_action();

create function public.vote_call(p_call uuid, p_vote text) returns void language plpgsql security definer set search_path = public as $$
declare c calls; v_other uuid;
begin
  perform assert_active();
  if p_vote is null or p_vote not in ('good', 'bad') then raise exception 'invalid_input'; end if;
  select * into c from calls where id = p_call;
  if c.id is null or not public.is_call_member(p_call) then raise exception 'call_unavailable'; end if;
  if c.status in ('ringing', 'active') then raise exception 'call_not_ended'; end if;
  if not exists (select 1 from call_participants where call_id = p_call and user_id = auth.uid() and joined_at is not null) then raise exception 'call_not_connected'; end if;
  select user_id into v_other from call_participants where call_id = p_call and user_id <> auth.uid() and joined_at is not null limit 1;
  if v_other is null then raise exception 'call_not_connected'; end if;
  insert into call_votes (call_id, voter_id, about_id, vote) values (p_call, auth.uid(), v_other, p_vote)
  on conflict (call_id, voter_id) do update set vote = excluded.vote, created_at = now();
end $$;

create function public.my_call_vote(p_call uuid) returns text language sql stable security definer set search_path = public as $$
  select vote from call_votes where call_id = p_call and voter_id = auth.uid() $$;

-- ---------------------------------------------------------------- people: status in one call

-- For each person: connection state, online now, on a call now (only for people I may call), may I call them,
-- and how many good calls they've had. Adults still don't see under-16s, unless they're connected or asked.
create function public.person_status(p_users uuid[])
returns table (user_id uuid, connection text, online boolean, in_call boolean, can_call boolean, good_calls int)
language sql stable security definer set search_path = public as $$
  select p.id,
    case when c.status = 'accepted' then 'connected' when c.requester_id = auth.uid() then 'outgoing' when c.requester_id = p.id then 'incoming' else 'none' end,
    coalesce(pr.last_seen_at > now() - interval '70 seconds' and p.show_activity and (select m.show_activity from profiles m where m.id = auth.uid()), false),
    public.can_call(auth.uid(), p.id) and public.in_live_call(p.id),
    public.can_call(auth.uid(), p.id),
    (select count(*)::int from call_votes v where v.about_id = p.id and v.vote = 'good')
  from profiles p
  left join connections c on (c.requester_id = auth.uid() and c.addressee_id = p.id) or (c.requester_id = p.id and c.addressee_id = auth.uid())
  left join user_presence pr on pr.user_id = p.id
  where p.id = any((p_users)[1:100]) and p.id <> auth.uid() and p.status = 'active'
    and not public.is_blocked_between(auth.uid(), p.id)
    and (public.minor_visible(auth.uid(), p.id) or c.status = 'accepted' or c.requester_id = p.id) $$;

-- ---------------------------------------------------------------- what's happening now (home)

-- Counts and topics only: never who is calling whom.
create function public.home_pulse() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  perform public.expire_stale_calls();
  return jsonb_build_object(
    'online', (select count(*) from user_presence u join profiles p on p.id = u.user_id and p.status = 'active' and p.show_activity
               where u.last_seen_at > now() - interval '70 seconds' and u.user_id <> auth.uid()),
    'live_calls', (select count(*) from calls where status = 'active'),
    'calls_today', (select count(*) from calls where started_at > now() - interval '24 hours'),
    'talking_about', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select pt.no, pt.title, pt.band, pt.category, tc.language_id as language, c.started_at
        from calls c join topic_calls tc on tc.call_id = c.id join path_topics pt on pt.no = tc.topic_no
        where c.status = 'active' order by c.started_at desc nulls last limit 8) x),
    'popular_topics', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select pt.no, pt.title, pt.band, pt.category, count(*)::int as calls
        from topic_calls tc join path_topics pt on pt.no = tc.topic_no
        where tc.created_at > now() - interval '30 days' group by pt.no order by count(*) desc, pt.no limit 6) x),
    'languages', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select ul.language_id as id, count(*) filter (where ul.role = 'native')::int as natives,
               count(*) filter (where ul.role = 'learning')::int as learners
        from user_languages ul join profiles p on p.id = ul.user_id and p.status = 'active' and p.onboarding_done
        group by ul.language_id order by count(*) desc limit 12) x));
end $$;

-- ---------------------------------------------------------------- post likes

-- A like on any post. The count lives on the post, so lists don't count rows; my own likes come back through RLS.
alter table public.contribution_posts add column like_count int not null default 0 check (like_count >= 0);
create table public.post_likes (
  post_id uuid not null references public.contribution_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id, created_at desc);
alter table public.post_likes enable row level security;
grant select on public.post_likes to authenticated;
create policy "see own likes" on public.post_likes for select to authenticated using (auth.uid() = user_id);
create trigger staff_refused before insert on public.post_likes for each row execute function public.refuse_staff_learner_action();

create function public.trg_post_like_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update contribution_posts set like_count = like_count + 1 where id = new.post_id;
  else update contribution_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id; end if;
  return null;
end $$;
create trigger post_like_count after insert or delete on public.post_likes for each row execute function public.trg_post_like_count();

-- Like or unlike. Returns whether I like it now.
create function public.toggle_post_like(p_post uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  perform assert_active();
  select user_id into v_owner from contribution_posts where id = p_post;
  if v_owner is null or public.is_blocked_between(auth.uid(), v_owner) then raise exception 'post_not_found'; end if;
  delete from post_likes where post_id = p_post and user_id = auth.uid();
  if found then return false; end if;
  insert into post_likes (post_id, user_id) values (p_post, auth.uid());
  return true;
end $$;

-- ---------------------------------------------------------------- what the app calls

create function public.my_path() returns jsonb language plpgsql security definer set search_path = public as $$
declare me profiles; s path_settings; v_cur text; t record; v_rated int; v_bad int;
begin
  perform assert_active();
  select * into s from path_settings;
  select * into me from profiles where id = auth.uid();
  if me.learning_language_id is not null then
    perform public.ensure_path(me.id, me.learning_language_id);
    v_cur := public.current_band(me.id, me.learning_language_id);
    if v_cur is not null then perform public.evaluate_band(me.id, me.learning_language_id, v_cur); end if;
    v_cur := public.current_band(me.id, me.learning_language_id);
    if v_cur is not null then select * into t from public.level_tally(me.id, me.learning_language_id, v_cur); end if;
    perform public.check_level_safely(me.id);
    select * into me from profiles where id = auth.uid();
  end if;
  select count(*), count(*) filter (where feedback = 'not_helpful') into v_rated, v_bad from (
    select feedback from message_corrections where corrector_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days'
    union all
    select feedback from post_discussion where author_id = auth.uid() and feedback is not null and feedback_at > now() - interval '60 days') x;
  return jsonb_build_object(
    'language', me.learning_language_id,
    'verified_level', me.verified_level,
    'settings', jsonb_build_object('partners_needed', s.partners_needed, 'pass_pct', s.pass_pct, 'min_call_minutes', s.min_call_minutes,
                                   'assess_window_days', s.assess_window_days, 'settle_days', s.settle_days),
    'current_band', v_cur,
    'levels', (select coalesce(jsonb_agg(jsonb_build_object('band', l.band, 'goal', l.goal,
        'topics', (select count(*) from path_topics pt where pt.band = l.band),
        'state', case when lp.passed_at is not null then 'passed' when lp.band is not null then 'open'
                      when l.rank < (select min(z.rank) from level_progress y join path_levels z on z.band = y.band
                                     where y.user_id = me.id and y.language_id = me.learning_language_id) then 'skipped'
                      else 'locked' end,
        'passed_at', lp.passed_at, 'score_pct', lp.score_pct) order by l.rank), '[]'::jsonb)
      from path_levels l left join level_progress lp on lp.band = l.band and lp.user_id = me.id and lp.language_id = me.learning_language_id),
    'current', case when v_cur is null then null else jsonb_build_object(
        'band', v_cur, 'goal', (select goal from path_levels where band = v_cur),
        'counting', t.counting, 'waiting', t.waiting, 'score_pct', t.score_pct,
        -- Learners see what was said and the criteria averages, never who scored what: assessors stay honest.
        'criteria', (select jsonb_build_object('fluency', round(avg(fluency), 1), 'vocabulary', round(avg(vocabulary), 1), 'grammar', round(avg(grammar), 1),
                                               'pronunciation', round(avg(pronunciation), 1), 'interaction', round(avg(interaction), 1))
                     from topic_assessments where learner_id = me.id and language_id = me.learning_language_id and band = v_cur),
        'comments', (select coalesce(jsonb_agg(jsonb_build_object('comment', comment, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
                     from topic_assessments where learner_id = me.id and language_id = me.learning_language_id and band = v_cur and nullif(btrim(comment), '') is not null)) end,
    'owed', (select coalesce(jsonb_agg(o order by o->>'ended_at'), '[]'::jsonb) from (
        select jsonb_build_object('call_id', tc.call_id, 'topic', tc.topic_no, 'title', pt.title, 'band', pt.band, 'language', tc.language_id,
                                  'learner_id', l.id, 'learner_name', l.display_name, 'learner_username', l.username, 'learner_avatar', l.avatar_url,
                                  'ended_at', c.ended_at, 'due_at', c.ended_at + make_interval(days => s.assess_window_days)) as o
        from topic_calls tc join calls c on c.id = tc.call_id join profiles l on l.id = tc.learner_id join path_topics pt on pt.no = tc.topic_no
        where tc.partner_id = me.id and c.ended_at > now() - make_interval(days => s.assess_window_days)
          and public.assessment_blocker(tc.call_id, me.id) is null) owed),
    'rated', v_rated,
    'not_helpful', v_bad,
    'rewards_paused', not public.corrector_in_good_standing(auth.uid()),
    'contribution', jsonb_build_object(
      'posts', (select count(*) from contribution_posts where user_id = auth.uid()),
      'corrections_given', (select count(*) from post_discussion where author_id = auth.uid() and kind = 'correction') + (select count(*) from message_corrections where corrector_id = auth.uid()),
      'corrections_accepted', (select count(*) from post_discussion where author_id = auth.uid() and kind = 'correction' and status = 'accepted') + (select count(*) from message_corrections where corrector_id = auth.uid() and status = 'accepted'),
      'points', me.points_balance,
      'response', public.response_record(auth.uid())));
end $$;

-- People I can call for my current level: callable, eligible to assess it, and not already counted for it.
create function public.list_topic_partners()
returns table (id uuid, username text, display_name text, avatar_url text, basis text)
language plpgsql security definer set search_path = public as $$
declare me profiles; v_cur text;
begin
  perform assert_active();
  select * into me from profiles where profiles.id = auth.uid();
  if me.learning_language_id is null then return; end if;
  perform public.ensure_path(me.id, me.learning_language_id);
  v_cur := public.current_band(me.id, me.learning_language_id);
  if v_cur is null then return; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, public.assessor_basis_band(p.id, me.learning_language_id, v_cur)
  from profiles p
  where p.id <> me.id and p.status = 'active'
    and public.can_call(me.id, p.id)
    and public.assessor_basis_band(p.id, me.learning_language_id, v_cur) is not null
    and not exists (select 1 from topic_assessments a where a.learner_id = me.id and a.language_id = me.learning_language_id
                    and a.band = v_cur and a.assessor_id = p.id)
  order by p.display_name nulls last limit 50;
end $$;

-- Start a call about a topic at my current level. No topic given: one is picked, preferring ones I haven't talked about.
create function public.start_topic_call(p_partner uuid, p_topic int default null) returns uuid language plpgsql security definer set search_path = public as $$
declare me profiles; v_cur text; v_topic int; v_call uuid;
begin
  perform assert_active();
  select * into me from profiles where id = auth.uid();
  if me.learning_language_id is null then raise exception 'no_learning_language'; end if;
  perform public.ensure_path(me.id, me.learning_language_id);
  v_cur := public.current_band(me.id, me.learning_language_id);
  if v_cur is null then raise exception 'path_complete'; end if;
  if p_topic is not null then
    if public.topic_band(p_topic) is distinct from v_cur then raise exception 'topic_not_at_level'; end if;
    v_topic := p_topic;
  else
    select pt.no into v_topic from path_topics pt where pt.band = v_cur
    order by exists (select 1 from topic_calls tc where tc.learner_id = me.id and tc.topic_no = pt.no), random() limit 1;
  end if;
  if public.assessor_basis_band(p_partner, me.learning_language_id, v_cur) is null then raise exception 'partner_not_eligible'; end if;
  if exists (select 1 from topic_assessments a where a.learner_id = me.id and a.language_id = me.learning_language_id
             and a.band = v_cur and a.assessor_id = p_partner) then raise exception 'partner_already_assessed'; end if;
  v_call := public.start_call(p_partner);
  insert into topic_calls (call_id, learner_id, partner_id, language_id, topic_no) values (v_call, me.id, p_partner, me.learning_language_id, v_topic);
  return v_call;
end $$;

create or replace function public.get_topic_call(p_call uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare tc topic_calls; pt path_topics;
begin
  perform assert_active();
  select * into tc from topic_calls where call_id = p_call;
  if tc.call_id is null or auth.uid() not in (tc.learner_id, tc.partner_id) then return null; end if;
  select * into pt from path_topics where no = tc.topic_no;
  return jsonb_build_object('call_id', tc.call_id, 'topic', pt.no, 'band', pt.band, 'title', pt.title, 'summary', pt.summary,
    'category', pt.category, 'prompts', to_jsonb(pt.prompts), 'ideas', to_jsonb(pt.ideas),
    'goal', (select goal from path_levels where band = pt.band),
    'language', tc.language_id, 'learner_id', tc.learner_id, 'partner_id', tc.partner_id,
    'i_am', case when auth.uid() = tc.learner_id then 'learner' else 'partner' end,
    'minutes', round(coalesce(public.topic_call_minutes(p_call), 0), 1),
    'min_minutes', (select min_call_minutes from path_settings),
    'assess_blocker', case when auth.uid() = tc.partner_id then public.assessment_blocker(p_call, auth.uid()) end,
    -- The learner sees the score of this call once given; never who gave it beyond their own partner.
    'score_pct', case when auth.uid() = tc.learner_id then (select a.score_pct from topic_assessments a where a.call_id = p_call) end);
end $$;

create or replace function public.submit_topic_assessment(p_call uuid, p_fluency int, p_vocabulary int, p_grammar int, p_pronunciation int, p_interaction int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare tc topic_calls; v_block text; v_band text;
begin
  perform assert_active();
  select * into tc from topic_calls where call_id = p_call;
  v_band := public.topic_band(tc.topic_no);
  perform pg_advisory_xact_lock(hashtextextended(coalesce(tc.learner_id::text, '') || ':' || coalesce(v_band, ''), 11));
  v_block := public.assessment_blocker(p_call, auth.uid());
  if v_block is not null then raise exception 'assessment_%', v_block; end if;
  if least(p_fluency, p_vocabulary, p_grammar, p_pronunciation, p_interaction) < 1
     or greatest(p_fluency, p_vocabulary, p_grammar, p_pronunciation, p_interaction) > 5 then raise exception 'invalid_score'; end if;
  insert into topic_assessments (call_id, learner_id, assessor_id, language_id, topic_no, band, basis, fluency, vocabulary, grammar, pronunciation, interaction, comment)
  values (p_call, tc.learner_id, auth.uid(), tc.language_id, tc.topic_no, v_band, public.assessor_basis(auth.uid(), tc.language_id, tc.topic_no),
          p_fluency, p_vocabulary, p_grammar, p_pronunciation, p_interaction, nullif(btrim(left(coalesce(p_comment, ''), 600)), ''));
  delete from notifications where user_id = auth.uid() and dedupe_key = 'topic-call:' || p_call || ':assess';
  perform public.notify_event(tc.learner_id, null, 'topic_assessed', jsonb_build_object('topic', tc.topic_no, 'band', v_band, 'language', tc.language_id),
    'topic-call:' || p_call || ':assessed', false);
  perform public.evaluate_band(tc.learner_id, tc.language_id, v_band);
end $$;

create or replace function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'connections', coalesce((select jsonb_agg(to_jsonb(c)) from connections c where auth.uid() in (c.requester_id, c.addressee_id)), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'translations', coalesce((select jsonb_agg(to_jsonb(t)) from translation_history t where t.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'),
    'activity', (select to_jsonb(u) - 'user_id' from user_presence u where u.user_id = auth.uid()),
    'level_progress', coalesce((select jsonb_agg(to_jsonb(lp) - 'user_id') from level_progress lp where lp.user_id = auth.uid()), '[]'),
    -- Scores I received, without who gave them; and the ones I gave, which are mine.
    'assessments_received', coalesce((select jsonb_agg(to_jsonb(a) - 'assessor_id' - 'learner_id' - 'call_id') from topic_assessments a where a.learner_id = auth.uid()), '[]'),
    'assessments_given', coalesce((select jsonb_agg(to_jsonb(a) - 'assessor_id') from topic_assessments a where a.assessor_id = auth.uid()), '[]'),
    'post_likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'created_at', l.created_at)) from post_likes l where l.user_id = auth.uid()), '[]'),
    'call_votes_given', coalesce((select jsonb_agg(jsonb_build_object('call_id', v.call_id, 'vote', v.vote, 'created_at', v.created_at)) from call_votes v where v.voter_id = auth.uid()), '[]'),
    'contributions', coalesce((select jsonb_agg(to_jsonb(c)) from contribution_posts c where c.user_id = auth.uid()), '[]'),
    'post_discussion', coalesce((select jsonb_agg(to_jsonb(d) - 'client_key') from post_discussion d where d.author_id = auth.uid()), '[]'),
    'decisions_owed', coalesce((select jsonb_agg(to_jsonb(i)) from decision_items i where i.user_id = auth.uid()), '[]'),
    'restrictions', coalesce((select jsonb_agg(to_jsonb(r)) from user_restrictions r where r.user_id = auth.uid()), '[]'),
    'restriction_warning', (select to_jsonb(w) from accountability_warnings w where w.user_id = auth.uid()));
end $$;

-- ---------------------------------------------------------------- notifications, limits, grants

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('follow', 'follow_request', 'follow_accepted', 'message_request', 'correction', 'correction_accepted', 'bounty_paid', 'level_up', 'post_correction', 'post_challenged', 'post_clarification', 'post_reply', 'post_endorsed', 'post_accepted', 'post_declined', 'post_withdrawn', 'post_superseded', 'post_resolved', 'post_reverted', 'post_override', 'action_reminder', 'action_overdue', 'action_escalated', 'restriction_warning', 'restriction_applied', 'restriction_lifted', 'appeal_decided', 'correction_declined', 'correction_superseded', 'bounty_reminder', 'admin_report', 'admin_security', 'admin_appeal', 'admin_site', 'help_request', 'help_fix', 'help_thanked', 'call_incoming', 'call_missed', 'topic_assess_due', 'topic_assessed', 'topic_passed', 'guardian_decided', 'connection_request', 'connection_accepted'));

insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('/rpc/request_connection', 60, 3600),
  ('/rpc/respond_connection', 120, 3600),
  ('/rpc/remove_connection', 120, 3600),
  ('/rpc/vote_call', 60, 3600),
  ('/rpc/person_status', 120, 60),
  ('/rpc/home_pulse', 30, 60),
  ('/rpc/toggle_post_like', 300, 3600)
on conflict (path) do nothing;

revoke all on function
  public.band_rank(text),
  public.ensure_path(uuid, text),
  public.current_band(uuid, text),
  public.assessor_basis_band(uuid, text, text),
  public.assessor_basis(uuid, text, integer),
  public.assessment_blocker(uuid, uuid),
  public.level_tally(uuid, text, text),
  public.evaluate_band(uuid, text, text),
  public.evaluate_level(uuid),
  public.sweep_settling_levels(),
  public.is_connected(uuid, uuid),
  public.trg_block_ends_connection(),
  public.can_call(uuid, uuid),
  public.request_connection(uuid),
  public.respond_connection(uuid, boolean),
  public.remove_connection(uuid),
  public.list_connection_requests(),
  public.list_connections(integer),
  public.vote_call(uuid, text),
  public.my_call_vote(uuid),
  public.person_status(uuid[]),
  public.home_pulse(),
  public.trg_post_like_count(),
  public.toggle_post_like(uuid),
  public.my_path(),
  public.list_topic_partners(),
  public.start_topic_call(uuid, integer),
  public.get_topic_call(uuid),
  public.submit_topic_assessment(uuid, integer, integer, integer, integer, integer, text),
  public.export_my_data()
from public, anon, authenticated, service_role;

grant execute on function
  public.request_connection(uuid),
  public.respond_connection(uuid, boolean),
  public.remove_connection(uuid),
  public.list_connection_requests(),
  public.list_connections(integer),
  public.vote_call(uuid, text),
  public.my_call_vote(uuid),
  public.person_status(uuid[]),
  public.home_pulse(),
  public.toggle_post_like(uuid),
  public.my_path(),
  public.list_topic_partners(),
  public.start_topic_call(uuid, integer),
  public.get_topic_call(uuid),
  public.submit_topic_assessment(uuid, integer, integer, integer, integer, integer, text),
  public.export_my_data()
to authenticated, service_role;

grant execute on function
  public.can_call(uuid, uuid),
  public.evaluate_level(uuid),
  public.evaluate_band(uuid, text, text),
  public.sweep_settling_levels()
to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-level-settle', '17 * * * *', 'select public.sweep_settling_levels()');
exception when others then
  raise notice 'pg_cron unavailable (%), settling assessments count on the learner''s next visit', sqlerrm;
end $$;
