import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./config"

let adminClient: SupabaseClient | null = null

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient
  }

  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  return adminClient
}
