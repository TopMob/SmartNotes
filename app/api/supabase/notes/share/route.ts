import { listSupabaseNoteAccess, revokeSupabaseNoteAccess, shareSupabaseNote } from "@/lib/supabase/notes"
import { mapApiRouteError, ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

function mapShareError(error: unknown) {
  return mapApiRouteError(error, ["NOTE_ID_REQUIRED", "NOTE_NOT_FOUND", "BAD_REQUEST", "COLLABORATOR_NOT_FOUND", "CANNOT_SHARE_WITH_SELF"])
}

function normalizeShareTarget(value: unknown) {
  const normalizedValue = String(value || "").trim()
  if (!normalizedValue) return ""
  try {
    const parsed = new URL(normalizedValue)
    return String(
      parsed.searchParams.get("userId")
      || parsed.searchParams.get("uid")
      || parsed.searchParams.get("id")
      || parsed.searchParams.get("email")
      || normalizedValue
    ).trim()
  } catch {
    return normalizedValue
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const noteId = String(url.searchParams.get("noteId") || url.searchParams.get("id") || "").trim()
    if (!noteId) {
      throw new ApiRouteError(400, "NOTE_ID_REQUIRED")
    }

    const access = await listSupabaseNoteAccess(noteId, user.id)
    return ok({ permissions: access, access })
  } catch (error) {
    console.error("[NOTE_SHARE_LIST_FAILED]", error)
    return handleRouteError(mapShareError(error), "NOTE_SHARE_LIST_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const noteId = String(payload?.noteId || payload?.id || "").trim()
    if (!noteId) {
      throw new ApiRouteError(400, "NOTE_ID_REQUIRED")
    }

    const access = await shareSupabaseNote({
      noteId,
      ownerUserId: user.id,
      ownerEmail: user.email,
      ownerDisplayName: user.displayName,
      ownerAvatarUrl: user.avatarUrl,
      target: normalizeShareTarget(payload?.target),
      role: String(payload?.role || "viewer")
    })

    const normalizedTarget = normalizeShareTarget(payload?.target)
    const normalizedTargetEmail = normalizedTarget.includes("@") ? normalizedTarget.toLowerCase() : ""
    const permission = Array.isArray(access)
      ? access.find(item => String(item?.userId || "") === normalizedTarget || String(item?.email || "").toLowerCase() === normalizedTargetEmail) || null
      : null
    return ok({ permission, access, permissions: access })
  } catch (error) {
    console.error("[NOTE_SHARE_FAILED]", error)
    return handleRouteError(mapShareError(error), "NOTE_SHARE_FAILED")
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const noteId = String(payload?.noteId || payload?.id || "").trim()
    if (!noteId) {
      throw new ApiRouteError(400, "NOTE_ID_REQUIRED")
    }

    const access = await revokeSupabaseNoteAccess({
      noteId,
      ownerUserId: user.id,
      target: normalizeShareTarget(payload?.target)
    })

    return ok({ permission: access, access })
  } catch (error) {
    console.error("[NOTE_SHARE_REVOKE_FAILED]", error)
    return handleRouteError(mapShareError(error), "NOTE_SHARE_REVOKE_FAILED")
  }
}
