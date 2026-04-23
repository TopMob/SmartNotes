import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabasePublishableKey, getSupabaseUrl } from "./config"

let browserClient: SupabaseClient | null = null

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  return browserClient
}
