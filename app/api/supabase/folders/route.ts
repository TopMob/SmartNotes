import { deleteSupabaseFolder, listAccessibleSupabaseFolders, updateSupabaseFolder, upsertSupabaseFolder } from "@/lib/supabase/notes"
import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

function mapFolderError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "FOLDER_ID_REQUIRED" || message === "FOLDER_NAME_REQUIRED" || message === "FOLDER_NOT_FOUND") {
    return new ApiRouteError(400, message)
  }

  return error
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const folders = await listAccessibleSupabaseFolders(user.id)
    return ok({ folders })
  } catch (error) {
    console.error("[FOLDERS_FAILED]", error)
    return handleRouteError(mapFolderError(error), "FOLDERS_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const folder = await upsertSupabaseFolder({
      userId: user.id,
      folderId: payload?.id || null,
      name: payload?.name,
      description: payload?.description || "",
      isHidden: payload?.isHidden,
      isArchived: payload?.isArchived || Boolean(payload?.trashedAt)
    })
    return ok({ folder }, { status: 201 })
  } catch (error) {
    console.error("[FOLDER_CREATE_FAILED]", error)
    return handleRouteError(mapFolderError(error), "FOLDER_CREATE_FAILED")
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const folder = await updateSupabaseFolder({
      userId: user.id,
      folderId: payload?.id,
      updates: payload
    })

    return ok({ folder })
  } catch (error) {
    console.error("[FOLDER_UPDATE_FAILED]", error)
    return handleRouteError(mapFolderError(error), "FOLDER_UPDATE_FAILED")
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const folderId = url.searchParams.get("id") || ""
    const result = await deleteSupabaseFolder(user.id, folderId)

    return ok({ folder: result })
  } catch (error) {
    console.error("[FOLDER_DELETE_FAILED]", error)
    return handleRouteError(mapFolderError(error), "FOLDER_DELETE_FAILED")
  }
}
