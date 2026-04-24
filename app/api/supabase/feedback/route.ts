import { handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { createSupabaseFeedback } from "@/lib/supabase/feedback"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const feedback = await createSupabaseFeedback({
      ...payload,
      uid: String(payload?.uid || user.id || ""),
      email: String(payload?.email || user.email || ""),
      displayName: String(payload?.displayName || user.displayName || "")
    })

    return ok({ feedback }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "FEEDBACK_SAVE_FAILED")
  }
}
