import { ensureSupabaseProfile, getSupabaseProfile } from "@/lib/supabase/notes"
import { handleRouteError, ok, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)

    const profile = await ensureSupabaseProfile({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    })

    return ok({ user: profile })
  } catch (error) {
    return handleRouteError(error, "SESSION_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)

    const profile = await ensureSupabaseProfile({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    })

    return ok({ user: profile })
  } catch (error) {
    return handleRouteError(error, "PROFILE_SYNC_FAILED")
  }
}
