import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { deleteSupabaseFolderPermission, upsertSupabaseFolderPermission } from "@/lib/supabase/notes"

export const runtime = "nodejs"

function mapFolderShareError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "FOLDER_ID_REQUIRED" || message === "FOLDER_NOT_FOUND" || message === "BAD_REQUEST" || message === "COLLABORATOR_NOT_FOUND") {
    return new ApiRouteError(message === "FOLDER_NOT_FOUND" ? 404 : 400, message)
  }

  return error
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const permission = await upsertSupabaseFolderPermission({
      folderId: String(payload?.folderId || payload?.folder_id || ""),
      userId: user.id,
      userEmail: user.email,
      collaboratorTarget: String(payload?.target || payload?.email || payload?.user_email || payload?.userId || payload?.user_id || ""),
      role: payload?.role === "editor" ? "editor" : "viewer"
    })

    return ok({ permission }, { status: 201 })
  } catch (error) {
    return handleRouteError(mapFolderShareError(error), "FOLDER_SHARE_FAILED")
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const permission = await deleteSupabaseFolderPermission({
      folderId: String(payload?.folderId || payload?.folder_id || ""),
      userId: user.id,
      collaboratorTarget: String(payload?.target || payload?.email || payload?.user_email || payload?.userId || payload?.user_id || "")
    })

    return ok({ permission })
  } catch (error) {
    return handleRouteError(mapFolderShareError(error), "FOLDER_SHARE_REVOKE_FAILED")
  }
}
