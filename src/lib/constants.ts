export const LEARNER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const DISCOVER_PAGE_SIZE = 20;            // must match search_people default limit
export const FOLLOW_PAGE_SIZE = 30;              // must match list_follows default limit
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // must match the avatars bucket limit
export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' }, { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' }, { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'underage', label: 'Seems under 18' }, { value: 'scam', label: 'Scam or fraud' }, { value: 'other', label: 'Something else' },
] as const;
