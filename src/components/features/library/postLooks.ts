import { BookOpen, GraduationCap, Image, Languages, type LucideIcon, MessageCircle, MessageCircleQuestion, PencilLine, Quote, ScrollText, Sparkles, type LucideProps } from 'lucide-react';
import type { PracticeType } from '@/lib/postTypes';

export type { LucideIcon, LucideProps };

/** Each category has its own colour and mark, so a post can be recognised before a word is read. Colours are tints: ink stays readable on all of them in both themes. */
export const CATEGORY_LOOK: Record<string, { label: string; icon: LucideIcon; panel: string }> = {
  phrase: { label: 'Phrase', icon: Quote, panel: 'bg-brand-soft' },
  idiom: { label: 'Idiom', icon: Sparkles, panel: 'bg-sun/25' },
  usage: { label: 'Usage', icon: MessageCircle, panel: 'bg-aqua/15' },
  grammar: { label: 'Grammar', icon: BookOpen, panel: 'bg-accent/15' },
};

export const LESSON_LOOK = { label: 'Lesson', icon: GraduationCap, panel: 'bg-brand-soft' };

export const PRACTICE_LOOK: Record<PracticeType, { icon: LucideIcon; stamp: string; panel: string }> = {
  correct_me: { icon: PencilLine, stamp: 'border-accent', panel: 'bg-surface-2' },
  how_do_i_say: { icon: Languages, stamp: 'border-aqua', panel: 'bg-aqua/10' },
  story: { icon: ScrollText, stamp: 'border-brand', panel: 'bg-surface' },
  question: { icon: MessageCircleQuestion, stamp: 'border-sun', panel: 'bg-sun/15' },
  photo: { icon: Image, stamp: 'border-accent', panel: 'bg-surface-2' },
};
