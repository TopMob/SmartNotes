import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { deleteSupabaseFolderPermission, listSupabaseFolderPermissions, upsertSupabaseFolderPermission } from "@/lib/supabase/notes"

export const runtime = "nodejs"

function mapFolderShareError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "FOLDER_ID_REQUIRED" || message === "BAD_REQUEST") {
    return new ApiRouteError(400, message)
  }
  if (message === "FOLDER_NOT_FOUND") {
    return new ApiRouteError(404, message)
  }
  if (message === "COLLABORATOR_NOT_FOUND") {
    return new ApiRouteError(404, message)
  }

  return error
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const folderId = String(url.searchParams.get("folderId") || "")
    const permissions = await listSupabaseFolderPermissions({
      folderId,
      userId: user.id
    })

    return ok({ permissions })
  } catch (error) {
    return handleRouteError(mapFolderShareError(error), "FOLDER_SHARE_LIST_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const permission = await upsertSupabaseFolderPermission({
      folderId: String(payload?.folderId || ""),
      userId: user.id,
      userEmail: user.email,
      collaboratorTarget: String(payload?.target || payload?.email || payload?.userId || ""),
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
      folderId: String(payload?.folderId || ""),
      userId: user.id,
      collaboratorTarget: String(payload?.target || payload?.email || payload?.userId || "")
    })

    return ok({ permission })
  } catch (error) {
    return handleRouteError(mapFolderShareError(error), "FOLDER_SHARE_REVOKE_FAILED")
  }
}
