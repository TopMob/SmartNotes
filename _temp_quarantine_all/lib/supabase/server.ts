import { createClient } from "@supabase/supabase-js"
import { getSupabasePublishableKey, getSupabaseUrl } from "./config"

export function getSupabaseServerClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}
