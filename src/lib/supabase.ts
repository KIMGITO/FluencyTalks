import { createClient } from '@supabase/supabase-js';
// Only place that knows about Supabase. Feature code should call stores/services, not the client directly.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
