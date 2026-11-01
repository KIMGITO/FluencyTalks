import { Link } from 'react-router-dom';
import type { Post } from '.';

const post: Post = {
  slug: 'corrections-from-native-speakers',
  title: 'How to Get Corrections from Native Speakers Without Feeling Embarrassed',
  seoTitle: 'How to Get Corrected by Native Speakers',
  description: 'Corrections are how you go from understandable to natural. How to ask native speakers to correct you, what kind of feedback to ask for, and how to remember it.',
  kicker: 'Speaking confidence',
  published: '2026-11-01',
  updated: '2026-11-01',
  readMinutes: 6,
  summary: 'Native speakers often will not correct you unless you ask, because they do not want to be rude. Tell them clearly that you want corrections, say which kind (meaning, grammar, or sounding natural), and save each correction so you review it later. Mistakes are the material you learn from, not something to hide.',
  body: (
    <>
      <h2>Why nobody corrects you</h2>
      <p>If you have chatted with native speakers and nobody ever pointed out a mistake, it is not because you made none. Most people are polite. They understood you, so correcting you feels like interrupting, or like showing off.</p>
      <p>That means the first step is on you: <strong>give people permission</strong>.</p>

      <h2>How to ask</h2>
      <p>Be direct and specific. Something like:</p>
      <blockquote>
        <p>Please correct me when something sounds unnatural, even if you understood it. I'd rather learn the natural way to say it.</p>
      </blockquote>
      <p>Write it in the language you are learning if you can. Then repeat it now and then, because people forget, and thank them every time they do it. A thank-you is the best way to get more corrections.</p>

      <h2>Ask for the right kind of correction</h2>
      <p>Not all corrections are equal. It helps to say which matter most to you right now:</p>
      <ul>
        <li><strong>Meaning:</strong> did I say what I meant? This matters most for beginners.</li>
        <li><strong>Grammar:</strong> verb forms, word order, gender, articles.</li>
        <li><strong>Sounding natural:</strong> the sentence is correct, but no native speaker would put it that way. This is where intermediate and advanced learners grow fastest.</li>
      </ul>
      <p>Here is a classic example for English speakers learning Vietnamese. A learner wants to say "I am hungry" and writes <em lang="vi">"Tôi là đói"</em>, translating "am" as <em lang="vi">là</em>. It is understandable, but a native speaker would say <em lang="vi">"Tôi đói"</em>. In Vietnamese, words like "hungry" work like verbs, so they need no "to be"; <em lang="vi">là</em> joins two nouns, as in <em lang="vi">"Tôi là sinh viên"</em> ("I am a student"). One small correction teaches a pattern you will use for tired (<em lang="vi">Tôi mệt</em>), busy (<em lang="vi">Tôi bận</em>) and happy (<em lang="vi">Tôi vui</em>) as well.</p>

      <h2>Make corrections easy to give</h2>
      <p>Your partner is busy too. Make it easy for them:</p>
      <ul>
        <li>Write in short messages, so a correction fits one idea.</li>
        <li>Mark the sentence you are unsure about: "Is this right?"</li>
        <li>Do not ask them to fix a long essay. Ask about three sentences you care about.</li>
      </ul>

      <h2>Dealing with the embarrassment</h2>
      <p>Every correction proves you are doing the hard part: using the language for real. A few things help:</p>
      <ul>
        <li><strong>Remember they are learning too.</strong> In a language exchange your partner is making mistakes in your language. You are on the same side.</li>
        <li><strong>Correct them back, kindly.</strong> When both people correct each other, it stops feeling like a judgement.</li>
        <li><strong>Separate the mistake from yourself.</strong> "That sentence was wrong" is not "I am bad at this".</li>
      </ul>

      <h2>Keep what you learn</h2>
      <p>A correction you read once and never see again is mostly lost. Write each one down with the wrong and the right version side by side, add an example or a picture if it helps you remember, and look back over the list once a week. Patterns appear quickly: you will notice you always get the same preposition wrong, and then you will stop.</p>

      <h2>How corrections work on The Fluency Talks</h2>
      <p>On <Link to="/">The Fluency Talks</Link>, correcting is built into the chat. A native speaker, or a learner at B1 or above, edits your sentence right where you wrote it. You see what you wrote in red and the correction in green, and you choose whether to accept it. Accepted corrections are saved to your personal phrasebook, so reviewing them is one tap away.</p>
      <p>People who correct you earn 5 points for each correction you accept, so helping is rewarded. And if you are stuck on a question, you can spend 50 points on a bounty to show it to people who know the language. The helper gets the 50 points when you accept their answer; if you accept none within 48 hours, you get them back.</p>
      <p>Still looking for someone to practise with? Here is <Link to="/blog/find-a-language-exchange-partner">how to find a language exchange partner online</Link>, or <Link to="/signup">sign up free</Link> and get matched today.</p>
    </>
  ),
};

export default post;
