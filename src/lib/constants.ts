export const LEARNER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
/** A learner VERIFIED at one of these may correct, post and earn points in their learning language. */
export const TEACHING_LEVELS: readonly string[] = ['B1', 'B2', 'C1', 'C2'];
export const SEARCH_PAGE_SIZE = 20;              
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; 
export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' }, { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' }, { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'underage', label: 'Seems under 18' }, { value: 'scam', label: 'Scam or fraud' },
  { value: 'fake_correction', label: 'Fake or unhelpful correction' }, { value: 'points_abuse', label: 'Points abuse' },
  { value: 'other', label: 'Something else' },
] as const;
