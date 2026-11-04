// What each post type is for. No imports, so it can be tested without a browser or Supabase.

export type PostType = 'library' | 'lesson' | 'correct_me' | 'how_do_i_say' | 'story' | 'question' | 'photo';
/** Open to every learner, in the language they are learning. Nothing on one of these can create a duty or a deadline. */
export type PracticeType = Exclude<PostType, 'library' | 'lesson'>;

export const PRACTICE_TYPES: PracticeType[] = ['correct_me', 'how_do_i_say', 'story', 'question', 'photo'];
export const isPractice = (type: string | null | undefined): type is PracticeType => PRACTICE_TYPES.includes(type as PracticeType);
/** Posts that teach: they need a qualified author, and their corrections need a decision. */
export const REFERENCE_TYPES: PostType[] = ['library', 'lesson'];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  library: 'Phrase', lesson: 'Lesson', correct_me: 'Correct me', how_do_i_say: 'How do I say…?', story: 'Story', question: 'Question', photo: 'Photo',
};

/** A long post is corrected one sentence at a time. */
export const hasLongBody = (type: string | null | undefined) => type === 'story' || type === 'lesson';
/** A question is answered with replies, and anyone may reply. */
export const takesFixes = (type: string | null | undefined) => type !== 'question';

export const MAX_TITLE = 280;
export const MAX_REFERENCE_TITLE = 500;
export const MAX_OVERLAY_TEXT = 120;
export const maxBody = (type: string | null | undefined) => (type === 'question' ? 2000 : 5000);

/** The words on a card's main action: what a helper would actually be doing. */
export const FIX_LABEL: Record<PracticeType, string> = {
  correct_me: 'Fix this', how_do_i_say: 'Answer', story: 'Fix a sentence', photo: 'Fix the caption', question: 'Reply',
};
