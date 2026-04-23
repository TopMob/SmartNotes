import { deleteSupabaseNote, listSupabaseNotes, updateSupabaseNote, upsertSupabaseNote } from "@/lib/supabase/notes"
import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"

export const runtime = "nodejs"

function mapNoteError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "NOTE_ID_REQUIRED" || message === "NOTE_NOT_FOUND") {
    return new ApiRouteError(400, message)
  }

  return error
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") || 500)
    const offset = Number(url.searchParams.get("offset") || 0)
    const notes = await listSupabaseNotes(user.id, { limit, offset })
    return ok({ notes })
  } catch (error) {
    return handleRouteError(mapNoteError(error), "NOTES_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const note = await upsertSupabaseNote({ userId: user.id, note: payload?.note || payload })
    return ok({ note }, { status: 201 })
  } catch (error) {
    return handleRouteError(mapNoteError(error), "NOTE_CREATE_FAILED")
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const bodyNote = payload?.note || payload
    const note = await updateSupabaseNote({
      userId: user.id,
      noteId: payload?.id || bodyNote?.id,
      note: bodyNote
    })

    return ok({ note })
  } catch (error) {
    return handleRouteError(mapNoteError(error), "NOTE_UPDATE_FAILED")
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const noteId = url.searchParams.get("id") || ""
    const result = await deleteSupabaseNote(user.id, noteId)

    return ok({ note: result })
  } catch (error) {
    return handleRouteError(mapNoteError(error), "NOTE_DELETE_FAILED")
  }
}
