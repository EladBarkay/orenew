import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// The frontend only drives interactive sign-in. Rust owns the session lifecycle,
// so we use PKCE and feed the OAuth callback URL in manually from the deep link
// (detectSessionInUrl is irrelevant in a Tauri window with no URL navigation).
export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: false,
    persistSession: false,
    autoRefreshToken: false,
  },
});
