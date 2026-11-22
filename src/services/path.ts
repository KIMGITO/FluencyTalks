import { rpc } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type Band = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const BANDS: Band[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export type LevelState = 'passed' | 'open' | 'locked' | 'skipped';
export type TopicCategory = 'people' | 'everyday' | 'food' | 'places' | 'free-time' | 'travel' | 'school-work' | 'health' | 'nature' | 'tech' | 'culture' | 'society' | 'ideas' | 'stories';
export const CATEGORY_LABEL: Record<TopicCategory, string> = {
  people: 'People', everyday: 'Everyday life', food: 'Food', places: 'Places', 'free-time': 'Free time', travel: 'Travel', 'school-work': 'Learning and work',
  health: 'Health', nature: 'Nature', tech: 'Technology', culture: 'Culture', society: 'Society', ideas: 'Big ideas', stories: 'Stories',
};
/** One conversation topic. Every level has many, all sharing that level's goal. */
export interface Topic { no: number; band: Band; slug: string; title: string; summary: string; category: TopicCategory; prompts: string[]; ideas: string[] }
export interface PathLevel { band: Band; goal: string; topics: number; state: LevelState; passed_at: string | null; score_pct: number | null }
export interface Criteria { fluency: number | null; vocabulary: number | null; grammar: number | null; pronunciation: number | null; interaction: number | null }
export interface OwedAssessment {
  call_id: string; topic: number; title: string; band: Band; language: string;
  learner_id: string; learner_name: string | null; learner_username: string | null; learner_avatar: string | null; ended_at: string; due_at: string;
}
export interface PathSettings { partners_needed: number; pass_pct: number; min_call_minutes: number; assess_window_days: number; settle_days: number }
export interface MyPath {
  language: string | null;
  verified_level: Band | null;
  settings: PathSettings;
  /** The level being worked on; null once every level is passed. */
  current_band: Band | null;
  levels: PathLevel[];
  /** The current level. Scores are anonymous: averages per criterion and comments, never who gave what. */
  current: { band: Band; goal: string; counting: number; waiting: number; score_pct: number | null; criteria: Criteria; comments: { comment: string; created_at: string }[] } | null;
  /** Calls I was the partner in and still need to assess. */
  owed: OwedAssessment[];
  rated: number; not_helpful: number; rewards_paused: boolean;
  contribution: { posts: number; corrections_given: number; corrections_accepted: number; points: number; response: { decided: number; on_time: number; open: number; overdue: number } };
}
export interface TopicPartner { id: string; username: string | null; display_name: string | null; avatar_url: string | null; basis: 'native' | 'passed' }
export interface TopicCall {
  call_id: string; topic: number; band: Band; title: string; summary: string; category: TopicCategory; prompts: string[]; ideas: string[]; goal: string; language: string;
  learner_id: string; partner_id: string; i_am: 'learner' | 'partner'; minutes: number; min_minutes: number;
  /** Null when I can assess now. */
  assess_blocker: string | null;
  /** For the learner: this call's score once their partner has rated it. */
  score_pct: number | null;
}
export interface Scores { fluency: number; vocabulary: number; grammar: number; pronunciation: number; interaction: number }

export const CRITERIA: { key: keyof Scores; label: string; hint: string }[] = [
  { key: 'fluency', label: 'Fluency', hint: 'Speaks without long pauses and keeps going.' },
  { key: 'vocabulary', label: 'Vocabulary', hint: 'Has the words the topic needs.' },
  { key: 'grammar', label: 'Grammar', hint: 'Sentences are accurate for this level.' },
  { key: 'pronunciation', label: 'Pronunciation', hint: 'Easy to understand.' },
  { key: 'interaction', label: 'Conversation', hint: 'Answers, asks back and covers the prompts.' },
];

/** Also passes the current topic if its assessments now allow it. */
export const getMyPath = () => rpc<MyPath>('my_path');
export const listTopicPartners = () => rpc<TopicPartner[]>('list_topic_partners');
export const startTopicCall = (partner: string, topic?: number | null) => rpc<string>('start_topic_call', { p_partner: partner, p_topic: topic ?? null });
export const getTopicCall = (call: string) => rpc<TopicCall | null>('get_topic_call', { p_call: call });
export const submitTopicAssessment = (call: string, s: Scores, comment: string) => rpc('submit_topic_assessment', {
  p_call: call, p_fluency: s.fluency, p_vocabulary: s.vocabulary, p_grammar: s.grammar, p_pronunciation: s.pronunciation, p_interaction: s.interaction, p_comment: comment,
});

let topicCache: Promise<Topic[]> | null = null;
/** The whole topic library, fetched once per session. */
export const listTopics = (): Promise<Topic[]> => (topicCache ??= Promise.resolve(
  supabase.from('path_topics').select('no, band, slug, title, summary, category, prompts, ideas').order('no'),
).then(({ data, error }) => { if (error) { topicCache = null; throw error; } return (data ?? []) as Topic[]; }));
