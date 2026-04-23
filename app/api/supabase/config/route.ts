import { isSupabaseConfigured } from "@/lib/supabase"

export const runtime = "nodejs"

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: "SUPABASE_ENV_MISSING" }, { status: 500 })
  }

  return Response.json({
    ok: true,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  })
}
