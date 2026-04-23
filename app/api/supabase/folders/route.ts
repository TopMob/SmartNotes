import { listSupabaseFolders, upsertSupabaseFolder } from "@/lib/supabase/notes"

export const runtime = "nodejs"

function readUserId(request: Request) {
  const userId = request.headers.get("x-user-id") || ""
  return String(userId).trim()
}

export async function GET(request: Request) {
  try {
    const userId = readUserId(request)
    if (!userId) return Response.json({ error: "USER_ID_REQUIRED" }, { status: 400 })
    const folders = await listSupabaseFolders(userId)
    return Response.json({ folders })
  } catch (error) {
    return Response.json({ error: "FOLDERS_FAILED", details: String(error?.message || error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = readUserId(request)
    if (!userId) return Response.json({ error: "USER_ID_REQUIRED" }, { status: 400 })
    const payload = await request.json()
    const folder = await upsertSupabaseFolder({
      userId,
      folderId: payload?.id || null,
      name: payload?.name,
      description: payload?.description || "",
      isHidden: payload?.isHidden,
      isArchived: payload?.isArchived
    })
    return Response.json({ folder })
  } catch (error) {
    return Response.json({ error: "FOLDER_UPSERT_FAILED", details: String(error?.message || error) }, { status: 500 })
  }
}
