import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { deleteSupabaseNotePermission, listSupabaseNotePermissions, upsertSupabaseNotePermission } from "@/lib/supabase/notes"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const noteId = String(url.searchParams.get("noteId") || url.searchParams.get("note_id") || "")
    const permissions = await listSupabaseNotePermissions({
      noteId,
      userId: user.id
    })

    return ok({ permissions })
  } catch (error) {
    return handleRouteError(mapShareError(error), "NOTE_SHARE_LIST_FAILED")
  }
}

function mapShareError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "NOTE_ID_REQUIRED" || message === "NOTE_NOT_FOUND" || message === "BAD_REQUEST") {
    return new ApiRouteError(message === "NOTE_NOT_FOUND" ? 404 : 400, message)
  }

  return error
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const permission = await upsertSupabaseNotePermission({
      noteId: String(payload?.noteId || payload?.note_id || ""),
      userId: user.id,
      userEmail: user.email,
      collaboratorEmail: String(payload?.email || payload?.user_email || ""),
      role: payload?.role === "editor" ? "editor" : "viewer"
    })

    return ok({ permission }, { status: 201 })
  } catch (error) {
    return handleRouteError(mapShareError(error), "NOTE_SHARE_FAILED")
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const permission = await deleteSupabaseNotePermission({
      noteId: String(payload?.noteId || payload?.note_id || ""),
      userId: user.id,
      collaboratorEmail: String(payload?.email || payload?.user_email || "")
    })

    return ok({ permission })
  } catch (error) {
    return handleRouteError(mapShareError(error), "NOTE_SHARE_REVOKE_FAILED")
  }
}
