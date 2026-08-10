import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://luodxzttfbnnufxufehb.supabase.co";
export const SUPABASE_KEY = "sb_publishable_rmXVP-5JoFt5xTF6humZPQ_oQAWLm2n";
export const ADMIN_EMAIL = "ribeiroleonardoti@gmail.com";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});
