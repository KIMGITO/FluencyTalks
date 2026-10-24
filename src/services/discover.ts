import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { Country, FeedPerson } from '@/types/db';


export const listCountries = async (): Promise<Country[]> =>
  ((await supabase.from('countries').select('code,name').order('name')).data ?? []) as Country[];


export const homeFeed = (partnerLimit = 12, otherLimit = 8) => rpc<FeedPerson[]>('home_feed', {
  p_partner_limit: partnerLimit, p_other_limit: otherLimit,
});