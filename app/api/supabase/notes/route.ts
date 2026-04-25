import { deleteSupabaseNote, listSupabaseNotes, patchSupabaseNote, updateSupabaseNote, upsertSupabaseNote } from "@/lib/supabase/notes"
import { ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { getAnalyzeDatabase } from "@/lib/supabase/analyze"
import { processUserNotes } from "@/app/api/analyze/core/processor"

export const runtime = "nodejs"

function mapNoteError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error || "")
  if (message === "NOTE_ID_REQUIRED" || message === "NOTE_NOT_FOUND" || message === "BAD_REQUEST") {
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
    const startAfterId = String(url.searchParams.get("startAfterId") || "").trim() || undefined
    const notes = await listSupabaseNotes(user.id, { limit, offset, startAfterId })
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
    const normalizedNoteId = String(payload?.id || bodyNote?.id || "").trim()
    if (!normalizedNoteId) {
      throw new ApiRouteError(400, "NOTE_ID_REQUIRED")
    }

    const shouldPatch = payload?.partial === true || !Object.keys(bodyNote || {}).some(key => ["content", "title", "tags", "hiddenTags", "pageTitles", "pageDrawings", "pageDrawingsRevision", "workspaceId"].includes(key))
    const note = shouldPatch
      ? await patchSupabaseNote({
        userId: user.id,
        noteId: normalizedNoteId,
        updates: bodyNote
      })
      : await updateSupabaseNote({
        userId: user.id,
        noteId: normalizedNoteId,
        note: bodyNote
      })

    return ok({ note })
  } catch (error) {
    return handleRouteError(mapNoteError(error), "NOTE_UPDATE_FAILED")
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const normalizedNoteId = String(payload?.id || "").trim()
    if (!normalizedNoteId) {
      throw new ApiRouteError(400, "NOTE_ID_REQUIRED")
    }

    const action = String(payload?.action || "").trim()
    if (action === "trigger-analysis") {
      await patchSupabaseNote({
        userId: user.id,
        noteId: normalizedNoteId,
        updates: {
          aiStatus: "pending",
          aiError: null,
          analyzed: false,
          aiProcessed: false
        }
      })

      const database = getAnalyzeDatabase()
      const processed = await processUserNotes({
        database,
        uid: user.id,
        reindexAll: false
      })

      const note = await patchSupabaseNote({
        userId: user.id,
        noteId: normalizedNoteId,
        updates: {}
      })

      return ok({ note, processed })
    }

    throw new ApiRouteError(400, "BAD_REQUEST")
  } catch (error) {
    return handleRouteError(mapNoteError(error), "NOTE_ACTION_FAILED")
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
