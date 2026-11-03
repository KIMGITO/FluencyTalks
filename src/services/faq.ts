import { rpc } from '@/lib/api';
import { FAQ_COLUMNS, type FaqItem } from '@/lib/blogHtml';
import { supabase } from '@/lib/supabase';

export interface AdminFaqItem extends FaqItem { is_live: boolean; created_at: string }
export interface FaqDraft { section: string; question: string; answer: string; on_home: boolean; is_live: boolean }

export async function listLiveFaqs(homeOnly = false) {
  let q = supabase.from('faq_items').select(FAQ_COLUMNS);
  if (homeOnly) q = q.eq('on_home', true);
  const { data, error } = await q.order('position');
  if (error) throw error;
  return (data ?? []) as unknown as FaqItem[];
}

export const adminFaqList = () => rpc<AdminFaqItem[]>('admin_faq_list');
export const adminFaqSave = (id: string | null, d: FaqDraft, expected: string | null) =>
  rpc<AdminFaqItem>('admin_faq_save', { p_id: id, p_section: d.section, p_question: d.question, p_answer: d.answer, p_on_home: d.on_home, p_is_live: d.is_live, p_expected: expected });
export const adminFaqMove = (id: string, direction: -1 | 1) => rpc('admin_faq_move', { p_id: id, p_direction: direction });
export const adminFaqDelete = (id: string) => rpc('admin_faq_delete', { p_id: id });
