import { deleteSupabaseNote, listSupabaseNoteAccess, listSupabaseNotes, patchSupabaseNote, updateSupabaseNote, upsertSupabaseNote } from "@/lib/supabase/notes"
import { mapApiRouteError, ApiRouteError, handleRouteError, ok, readJsonBody, requireSupabaseUser } from "@/lib/supabase/api"
import { getAnalyzeDatabase } from "@/lib/supabase/analyze"
import { processUserNotes } from "@/app/api/analyze/core/processor"

export const runtime = "nodejs"

function mapNoteError(error: unknown) {
  return mapApiRouteError(error, ["NOTE_ID_REQUIRED", "NOTE_NOT_FOUND", "BAD_REQUEST", "COLLABORATOR_NOT_FOUND", "CANNOT_SHARE_WITH_SELF"])
}

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const url = new URL(request.url)
    const action = String(url.searchParams.get("action") || "").trim()
    const noteId = String(url.searchParams.get("id") || "").trim()
    if (action === "list-access") {
      if (!noteId) {
        throw new ApiRouteError(400, "NOTE_ID_REQUIRED")
      }
      const access = await listSupabaseNoteAccess(noteId, user.id)
      return ok({ access })
    }

    const limit = Number(url.searchParams.get("limit") || 500)
    const offset = Number(url.searchParams.get("offset") || 0)
    const startAfterId = String(url.searchParams.get("startAfterId") || "").trim() || undefined
    const notes = await listSupabaseNotes(user.id, user.email, { limit, offset, startAfterId })
    return ok({ notes })
  } catch (error) {
    console.error("[NOTES_FAILED]", error)
    return handleRouteError(mapNoteError(error), "NOTES_FAILED")
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request)
    const payload = await readJsonBody(request)
    const note = await upsertSupabaseNote({ userId: user.id, userEmail: user.email, note: payload?.note || payload })
    return ok({ note }, { status: 201 })
  } catch (error) {
    console.error("[NOTE_CREATE_FAILED]", error)
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

    const shouldPatch = payload?.partial === true || !Object.keys(bodyNote || {}).some(key => ["content", "title", "tags", "hiddenTags", "pageTitles", "pageDrawings", "pageDrawingsRevision"].includes(key))
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
    console.error("[NOTE_UPDATE_FAILED]", error)
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
    console.error("[NOTE_ACTION_FAILED]", error)
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
    console.error("[NOTE_DELETE_FAILED]", error)
    return handleRouteError(mapNoteError(error), "NOTE_DELETE_FAILED")
  }
}
