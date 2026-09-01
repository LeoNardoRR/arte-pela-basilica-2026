import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://luodxzttfbnnufxufehb.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_rmXVP-5JoFt5xTF6humZPQ_oQAWLm2n";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
