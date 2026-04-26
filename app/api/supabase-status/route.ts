import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase"

export const runtime = "nodejs"

export async function GET() {
  return Response.json({
    ok: true,
    configured: isSupabaseConfigured(),
    adminConfigured: isSupabaseAdminConfigured()
  })
}
