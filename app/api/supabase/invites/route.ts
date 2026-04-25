import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { listSupabasePendingInvites, respondToSupabaseInvite } from "@/lib/supabase/notes"

export const runtime = "nodejs"

function mapInviteError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "BAD_REQUEST" || message === "INVITE_NOT_FOUND") {
    return new ApiRouteError(message === "INVITE_NOT_FOUND" ? 404 : 400, message)
  }

  return error
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const invites = await listSupabasePendingInvites(user.id)
    return ok({ invites })
  } catch (error) {
    return handleRouteError(mapInviteError(error), "INVITES_LIST_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const invite = await respondToSupabaseInvite({
      userId: user.id,
      itemType: String(payload?.itemType || "") === "folder" ? "folder" : "note",
      itemId: String(payload?.itemId || ""),
      accept: payload?.accept !== false
    })
    return ok({ invite })
  } catch (error) {
    return handleRouteError(mapInviteError(error), "INVITE_RESPOND_FAILED")
  }
}
