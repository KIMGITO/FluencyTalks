import { rpc } from '@/lib/api';

export interface LevelEvidence { messages: number; active_days: number; partners: number; reviewed: number; partners_any: number; reviewed_any: number; error_pct: number | null; accepted_given: number; rated: number; helpful_pct: number | null; post_saves: number }
export interface LevelNeeds { min_messages: number; min_active_days: number; min_partners: number; min_reviewed: number; max_error_pct: number; min_accepted_given: number; min_helpful_pct: number; min_post_saves: number }
export interface LevelProgress {
  verified_level: string | null;
  next_level: string | null;
  evidence: LevelEvidence | null;
  needs: LevelNeeds | null;
  vouches: number;
  vouches_needed: number;
  /** Ratings of my corrections over the last 60 days. */
  rated: number;
  not_helpful: number;
  rewards_paused: boolean;
}

/** Also applies any promotion the evidence now allows. */
export const getLevelProgress = () => rpc<LevelProgress>('my_level_progress');

export interface VouchStatus { language: string; vouched: boolean; blocker: string | null }
/** Null: nothing to offer (not my language, or they're already past B1). */
export const getVouchStatus = (learner: string) => rpc<VouchStatus | null>('vouch_status', { p_learner: learner });
export const vouchFor = (learner: string) => rpc('vouch_for', { p_learner: learner });
export const withdrawVouch = (learner: string) => rpc('withdraw_vouch', { p_learner: learner });
