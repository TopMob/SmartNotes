import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabasePublishableKey, getSupabaseUrl } from "./config"

let browserClient: SupabaseClient | null = null

export const SUPABASE_BROWSER_STORAGE_KEY = "sb-smartnotes-auth-token"

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
      storageKey: SUPABASE_BROWSER_STORAGE_KEY
    }
  })

  return browserClient
}
