import { Link } from 'react-router-dom';
import type { Post } from '.';

const post: Post = {
  slug: 'find-a-language-exchange-partner',
  title: 'How to Find a Language Exchange Partner Online (Free)',
  description: 'Where to find a language exchange partner online for free, what to look for in a good match, and what to write in your first message so they say yes.',
  kicker: 'Getting started',
  published: '2026-11-01',
  updated: '2026-11-01',
  readMinutes: 7,
  summary: 'The quickest way to find a language exchange partner is to look for someone who speaks the language you are learning and is learning the language you speak. Use a platform that matches by language pair, write a short, specific first message, and agree early on how often you will talk.',
  body: (
    <>
      <h2>Start with the right match</h2>
      <p>The best partner is someone whose needs mirror yours. If you speak English and are learning Vietnamese, look for a native Vietnamese speaker who is learning English. Both of you then have a reason to keep showing up.</p>
      <p>Three things matter more than anything else:</p>
      <ul>
        <li><strong>The language pair.</strong> They speak what you are learning; you speak what they are learning.</li>
        <li><strong>A similar level.</strong> Not identical, but if one person is at A1 and the other at C1, conversations tend to drift into one language.</li>
        <li><strong>Similar availability.</strong> Time zones matter less for text chat, but you still need to reply within a day or two.</li>
      </ul>

      <h2>Where to look</h2>
      <p>You have a few kinds of options, all free:</p>
      <ul>
        <li><strong>Language exchange apps and sites.</strong> These are built for exactly this, and the good ones match you by language rather than by photos or follower counts.</li>
        <li><strong>Local meetups and university groups.</strong> Many universities run tandem programmes, and cities often have language cafés.</li>
        <li><strong>Online communities.</strong> Language-learning forums and subreddits often have partner-finding threads. Be specific about your languages and level.</li>
        <li><strong>People you already know.</strong> A colleague or classmate who grew up speaking another language may be glad to swap.</li>
      </ul>

      <h2>What to look for in a profile</h2>
      <p>Before you message someone, check that they have filled in their languages and level, and that they say what they want from an exchange. Someone who writes "I want to practise everyday English for work" is easier to help, and more likely to reply, than an empty profile.</p>
      <p>Fill in your own profile the same way. It is the first thing a potential partner sees.</p>

      <h2>What to write in your first message</h2>
      <p>Keep it short and give them something to answer. A good first message has four parts: hello, who you are, what you want, and a question.</p>
      <blockquote>
        <p>Hi Linh! I'm Tom, a native English speaker learning Vietnamese (about A2). <span lang="vi">Rất vui được làm quen!</span> I'd love to practise a few times a week by chat, and I'm happy to help with your English. What made you start learning English?</p>
      </blockquote>
      <p>Avoid long life stories, copy-pasted messages to dozens of people, and anything that is not about learning. And write part of the message in the language you are learning, even if it is just one sentence, like Tom's <em lang="vi">"Rất vui được làm quen!"</em> ("Nice to meet you!"). It shows effort.</p>

      <h2>Agree on how you will work</h2>
      <p>After the first few messages, settle two questions:</p>
      <ol>
        <li><strong>How will you split the languages?</strong> Alternate days, half and half, or each person writes in the language they are learning.</li>
        <li><strong>How do you want to be corrected?</strong> Every mistake, or only the important ones? Read <Link to="/blog/corrections-from-native-speakers">how to ask for corrections</Link> for wording that works.</li>
      </ol>

      <h2>Staying safe</h2>
      <ul>
        <li>Keep the conversation on the platform until you trust the person.</li>
        <li>Do not share your address, financial details or passwords.</li>
        <li>If someone makes you uncomfortable, stop replying, block them and report them. A good platform makes this easy.</li>
      </ul>

      <h2>If a partner goes quiet</h2>
      <p>It happens, and it is rarely personal: people get busy. Send one friendly follow-up, then move on. It is normal to message several people before one exchange really clicks, and many learners keep two or three partners going at once.</p>

      <h2>Finding a partner on The Fluency Talks</h2>
      <p>On <Link to="/">The Fluency Talks</Link>, you pick your native language and the language and level you are learning, and the people you see are chosen by that language pair, not by popularity. New contacts arrive as requests that the other person can accept or decline, and you can block or report anyone. It is free: <Link to="/signup">create an account</Link> and send your first message today.</p>
      <p>New to the idea? Start with <Link to="/blog/what-is-a-language-exchange">what a language exchange is and how it works</Link>.</p>
    </>
  ),
};

export default post;
