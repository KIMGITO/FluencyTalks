import { rpc } from '@/lib/api';

export type Band = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type TopicState = 'passed' | 'open' | 'locked' | 'skipped';
export interface PathTopic { no: number; band: Band; slug: string; title: string; summary: string; prompts: string[]; state: TopicState; passed_at: string | null; score_pct: number | null }
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
  current_topic: number | null;
  topics: PathTopic[];
  /** The topic being worked on. Scores are anonymous: averages per criterion and comments, never who gave what. */
  current: { topic: number; counting: number; waiting: number; score_pct: number | null; criteria: Criteria; comments: { comment: string; created_at: string }[] } | null;
  /** Calls I was the partner in and still need to assess. */
  owed: OwedAssessment[];
  rated: number; not_helpful: number; rewards_paused: boolean;
  contribution: { posts: number; corrections_given: number; corrections_accepted: number; points: number; response: { decided: number; on_time: number; open: number; overdue: number } };
}
export interface TopicPartner { id: string; username: string | null; display_name: string | null; avatar_url: string | null; basis: 'native' | 'passed' }
export interface TopicCall {
  call_id: string; topic: number; band: Band; title: string; summary: string; prompts: string[]; language: string;
  learner_id: string; partner_id: string; i_am: 'learner' | 'partner'; minutes: number; min_minutes: number;
  /** Null when I can assess now. */
  assess_blocker: string | null;
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
export const startTopicCall = (partner: string) => rpc<string>('start_topic_call', { p_partner: partner });
export const getTopicCall = (call: string) => rpc<TopicCall | null>('get_topic_call', { p_call: call });
export const submitTopicAssessment = (call: string, s: Scores, comment: string) => rpc('submit_topic_assessment', {
  p_call: call, p_fluency: s.fluency, p_vocabulary: s.vocabulary, p_grammar: s.grammar, p_pronunciation: s.pronunciation, p_interaction: s.interaction, p_comment: comment,
});
