import { deleteSupabaseFolder, listSupabaseFolders, upsertSupabaseFolder } from "@/lib/supabase/notes"
import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

function mapFolderError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "FOLDER_ID_REQUIRED" || message === "FOLDER_NAME_REQUIRED") {
    return new ApiRouteError(400, message)
  }

  return error
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const folders = await listSupabaseFolders(user.id)
    return ok({ folders })
  } catch (error) {
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
    return handleRouteError(mapFolderError(error), "FOLDER_CREATE_FAILED")
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const folder = await upsertSupabaseFolder({
      userId: user.id,
      folderId: payload?.id,
      name: payload?.name,
      description: payload?.description || "",
      isHidden: payload?.isHidden,
      isArchived: payload?.isArchived || Boolean(payload?.trashedAt)
    })

    return ok({ folder })
  } catch (error) {
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
    return handleRouteError(mapFolderError(error), "FOLDER_DELETE_FAILED")
  }
}
