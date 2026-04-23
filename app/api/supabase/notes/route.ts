import { listSupabaseNotes, upsertSupabaseNote } from "@/lib/supabase/notes"

export const runtime = "nodejs"

function readUserId(request: Request) {
  const userId = request.headers.get("x-user-id") || ""
  return String(userId).trim()
}

export async function GET(request: Request) {
  try {
    const userId = readUserId(request)
    if (!userId) return Response.json({ error: "USER_ID_REQUIRED" }, { status: 400 })
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") || 500)
    const offset = Number(url.searchParams.get("offset") || 0)
    const notes = await listSupabaseNotes(userId, { limit, offset })
    return Response.json({ notes })
  } catch (error) {
    return Response.json({ error: "NOTES_FAILED", details: String(error?.message || error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = readUserId(request)
    if (!userId) return Response.json({ error: "USER_ID_REQUIRED" }, { status: 400 })
    const payload = await request.json()
    const note = await upsertSupabaseNote({ userId, note: payload?.note || payload })
    return Response.json({ note })
  } catch (error) {
    return Response.json({ error: "NOTE_UPSERT_FAILED", details: String(error?.message || error) }, { status: 500 })
  }
}
