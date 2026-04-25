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

function serializeFolderShareError(error: unknown) {
  if (error instanceof Error) {
    const structuredError = error as Error & { code?: string, details?: string, hint?: string, status?: number }
    return {
      name: structuredError.name,
      message: structuredError.message,
      code: structuredError.code || null,
      details: structuredError.details || null,
      hint: structuredError.hint || null,
      status: structuredError.status || null,
      stack: structuredError.stack || null
    }
  }

  if (error && typeof error === "object") {
    return { ...(error as Record<string, unknown>) }
  }

  return { value: error }
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const folderId = String(url.searchParams.get("folderId") || url.searchParams.get("folder_id") || "")
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
      folderId: String(payload?.folderId || payload?.folder_id || ""),
      userId: user.id,
      userEmail: user.email,
      collaboratorTarget: String(payload?.target || payload?.email || payload?.user_email || payload?.userId || payload?.user_id || ""),
      role: payload?.role === "editor" ? "editor" : "viewer"
    })

    return ok({ permission }, { status: 201 })
  } catch (error) {
    console.error("[FOLDER_SHARE_FAILED]", serializeFolderShareError(error))
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
