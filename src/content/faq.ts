import { BRAND } from '@/lib/site';

/**
 * Every public question and answer: the full /faq page, and the ones marked `landing` on the home page.
 * Each answer opens with the direct answer in short sentences, because search and AI tools quote single paragraphs.
 * Plain text only: the same strings go into the FAQPage structured data. Keep the numbers in step with public/llms.txt.
 */
export interface FaqItem { q: string; a: string; landing?: boolean }
export interface FaqGroup { id: string; title: string; items: FaqItem[] }

/** Change this when you change an answer: it becomes <lastmod> in the sitemap. */
export const FAQ_UPDATED = '2026-11-03';

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      { q: `What is ${BRAND}?`, a: `${BRAND} is a free language exchange web app. You chat one to one with people who speak the language you are learning, and they correct your messages inside the conversation. Corrections you accept are saved to your personal phrasebook.` },
      { q: `How do I practise one-to-one language conversations on ${BRAND}?`, a: 'Create a free account, then choose your native language and the language and level you are learning. You will see suggested partners. Send one a message; once they accept, you chat one to one in text and correct each other as you go.' },
      { q: 'What is a language exchange?', landing: true, a: `Two people who speak different languages help each other practise. In the neatest case you speak English and are learning Vietnamese, and your partner is the other way round. It doesn't have to be a perfect pair: a Vietnamese speaker who learns nothing can still help you, and you can help a French speaker who is learning English. On ${BRAND} you chat in writing and correct each other's messages.` },
      { q: `Is ${BRAND} free?`, landing: true, a: 'Yes. There are no paid plans. You start with 100 points, earn 5 for each correction someone accepts, and spend 50 on a bounty when you are stuck.' },
      { q: `How is ${BRAND} different from other language exchange apps?`, landing: true, a: 'Corrections are built into the chat and saved to your phrasebook, you are matched by language rather than popularity, there are no followers or likes, and it is free with no paid tier.' },
      { q: 'Do I need to be fluent to join?', landing: true, a: 'No. Choose the language you are learning and your level, from A1 to C2. People who speak it natively, or have been verified at B1 or above, can correct you.' },
      { q: 'Do I need to download an app?', a: 'No. It is a web app that runs in a modern browser on your phone or computer.' },
      { q: 'How old do I have to be?', a: 'You must be 16 or older to create an account.' },
    ],
  },
  {
    id: 'partners',
    title: 'Partners and languages',
    items: [
      { q: 'How are partners matched?', landing: true, a: 'By language, and a perfect swap is not required. If you speak English and are learning Vietnamese, you see native Vietnamese speakers (whatever they are learning, even nothing) and anyone learning English (whatever their native language is). People who are both come first.' },
      { q: 'Which languages can I practise?', landing: true, a: '40 at launch: English, Vietnamese, Swahili, Spanish, French, German, Portuguese, Italian, Chinese, Cantonese, Japanese, Korean, Hindi, Arabic, Russian, Turkish and 24 more. You pick one you speak and one you are learning.' },
      { q: 'Can I practise Vietnamese with native speakers for free?', landing: true, a: 'Yes. Choose Vietnamese as the language you are learning. Native Vietnamese speakers are suggested to you as matches, whatever they are learning themselves. You can also help anyone who is learning English.' },
      { q: 'Do I have to speak on video?', landing: true, a: 'No. Practice happens in text chat, so you can take your time and see every correction written out.' },
    ],
  },
  {
    id: 'corrections',
    title: 'Corrections and your phrasebook',
    items: [
      { q: 'How do corrections work?', a: 'Your partner edits your sentence where you wrote it. You see exactly what changed, and you accept the change or not. Accepted corrections go into your phrasebook automatically.' },
      { q: 'Who can correct my messages?', a: 'Native speakers of that language, and learners verified at B1 or above. Levels are earned through activity on the site, not claimed, so choosing a level yourself does not qualify you to correct others.' },
      { q: 'Can I help others with my own language?', landing: true, a: 'Yes. Native speakers, and learners verified at B1 or above through their practice, can suggest corrections. Each correction the author accepts earns you 5 points.' },
      { q: 'Can I translate a message I do not understand?', landing: true, a: 'Yes. Open any message’s menu and choose Translate message. Every translation is kept on your Learning page, next to your saved phrases and the corrections you received.' },
    ],
  },
  {
    id: 'points',
    title: 'Points and bounties',
    items: [
      { q: 'How does the correction reward system work?', a: 'You earn points for helping. Every account starts with 100 points. Each correction you give that the other person accepts earns you 5 points. Points have no cash value and nothing on the site requires payment.' },
      { q: 'What is a bounty?', a: 'A bounty is a question you put in front of people qualified in that language. It costs 50 points. Each qualified person can send one answer, and you choose the one you accept. That person receives the 50 points.' },
      { q: 'What happens if nobody answers my bounty?', a: 'You get your 50 points back. If you do not accept an answer within 48 hours, the bounty closes and the points are refunded. You can have up to 3 open bounties at a time.' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety and your data',
    items: [
      { q: 'Is it safe?', landing: true, a: 'New contacts arrive as message requests that you can decline. You can block or report anyone, blocked people cannot see you or write to you, and reports are reviewed by admins.' },
      { q: 'Can I export or delete my data?', a: 'Yes. You can export your data or delete your account at any time. We do not sell your data.' },
    ],
  },
];

export const LANDING_FAQS: FaqItem[] = FAQ_GROUPS.flatMap((g) => g.items.filter((i) => i.landing));
