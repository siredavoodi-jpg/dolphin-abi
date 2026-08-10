import { createClient } from "@supabase/supabase-js";

// These values identify the public Supabase project and are safe to expose in
// the browser. Vercel environment variables can override them at any time.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zhowwkyvaakelmznvjef.supabase.co";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_xkXGkvX1WpxyhmuQvp7SQw_ul0CNcdd";

export const supabase = createClient(url, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const functionsUrl =
  process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ?? url + "/functions/v1";
