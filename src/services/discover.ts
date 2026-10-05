import { supabase } from '@/lib/supabase';
import { rpc } from '@/lib/api';
import type { Country, FeedPerson } from '@/types/db';

/** The ISO 3166-1 list behind the country picker. Public data, so it is cached after the first read. */
export const listCountries = async (): Promise<Country[]> =>
  ((await supabase.from('countries').select('code,name').order('name')).data ?? []) as Country[];

/**
 * The Home feed in one round trip: people who share one of my languages first, then
 * everyone else, already ordered. Blocked, suspended and unfinished accounts are
 * filtered out server-side, so nothing to hide on this side.
 */
export const homeFeed = (partnerLimit = 12, otherLimit = 8) => rpc<FeedPerson[]>('home_feed', {
  p_partner_limit: partnerLimit, p_other_limit: otherLimit,
});