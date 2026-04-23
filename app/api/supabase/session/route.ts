import { getSupabaseAdminClient } from "@/lib/supabase"
import { ensureSupabaseProfile, getSupabaseProfile } from "@/lib/supabase/notes"

export const runtime = "nodejs"

async function getUserFromAccessToken(accessToken: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error) throw error
  return data.user
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || ""
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
    if (!token) {
      return Response.json({ user: null }, { status: 200 })
    }

    const user = await getUserFromAccessToken(token)
    if (!user?.id) {
      return Response.json({ user: null }, { status: 200 })
    }

    const profile = await ensureSupabaseProfile({
      userId: user.id,
      email: user.email || "",
      displayName: String(user.user_metadata?.display_name || ""),
      avatarUrl: String(user.user_metadata?.avatar_url || "")
    })

    return Response.json({ user: profile })
  } catch (error) {
    return Response.json({ error: "SESSION_FAILED", details: String(error?.message || error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const userId = String(payload?.userId || "").trim()
    if (!userId) {
      return Response.json({ error: "USER_ID_REQUIRED" }, { status: 400 })
    }

    const profile = await ensureSupabaseProfile({
      userId,
      email: String(payload?.email || ""),
      displayName: String(payload?.displayName || ""),
      avatarUrl: String(payload?.avatarUrl || "")
    })

    return Response.json({ user: profile })
  } catch (error) {
    return Response.json({ error: "PROFILE_SYNC_FAILED", details: String(error?.message || error) }, { status: 500 })
  }
}
