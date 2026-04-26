const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export function getSupabaseUrl() {
  if (!SUPABASE_URL) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL")
  }

  return SUPABASE_URL
}

export function getSupabasePublishableKey() {
  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  }

  return SUPABASE_PUBLISHABLE_KEY
}

export function getSupabaseServiceRoleKey() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY")
  }

  return SUPABASE_SERVICE_ROLE_KEY
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
}

export function isSupabaseAdminConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}
