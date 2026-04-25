import { getSupabaseAdminClient } from "./admin"

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function createDocument(id, data) {
  const normalizedData = asObject(data)

  return {
    id: String(id || "").trim(),
    data() {
      return normalizedData
    }
  }
}

function mapProfileRow(row) {
  return {
    lang: typeof row?.app_language === "string" && row.app_language.trim()
      ? row.app_language.trim().slice(0, 16)
      : "unknown",
    metadata: asObject(row?.metadata)
  }
}

function mapFolderRow(row) {
  return {
    name: typeof row?.name === "string" ? row.name : "",
    description: typeof row?.description === "string" ? row.description : ""
  }
}

function mapNoteRow(row) {
  const metadata = asObject(row?.metadata)

  return {
    title: typeof row?.title === "string" ? row.title : "",
    content: typeof row?.content_raw === "string" ? row.content_raw : "",
    folderId: typeof row?.folder_id === "string" && row.folder_id ? row.folder_id : null,
    aiFolder: typeof row?.ai_folder_id === "string" && row.ai_folder_id ? row.ai_folder_id : null,
    tags: Array.isArray(row?.user_tags) ? row.user_tags : [],
    aiTags: Array.isArray(metadata.aiTags) ? metadata.aiTags : [],
    hiddenTags: Array.isArray(row?.hidden_tags) ? row.hidden_tags : [],
    analyzed: metadata.analyzed === true || row?.ai_processed === true,
    aiProcessed: row?.ai_processed === true,
    sourceType: typeof row?.source_type === "string" ? row.source_type : "note",
    language: typeof row?.language === "string" ? row.language : "unknown",
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    metadata
  }
}

function buildAnalyzeUpdatePayload(update, metadata) {
  const nextMetadata = {
    ...asObject(metadata),
    analyzed: update.analyzed === true,
    analyzedBy: update.analyzedBy,
    aiContractVersion: update.aiContractVersion,
    aiModelFamily: update.aiModelFamily,
    aiModelVersion: update.aiModelVersion,
    promptVersion: update.promptVersion,
    aiTags: Array.isArray(update.aiTags) ? update.aiTags : [],
    aiResurfacingClass: update.aiResurfacingClass
  }

  return {
    user_tags: Array.isArray(update.tags) ? update.tags : [],
    hidden_tags: Array.isArray(update.hiddenTags) ? update.hiddenTags : [],
    ai_relevance: Number.isFinite(Number(update.aiRelevance ?? update.relevance))
      ? Number(update.aiRelevance ?? update.relevance)
      : 0,
    folder_id: typeof update.folderId === "string" && update.folderId ? update.folderId : null,
    ai_folder_id: typeof update.aiFolder === "string" && update.aiFolder ? update.aiFolder : null,
    ai_processed: update.aiProcessed === true,
    ai_last_analyzed: update.aiLastAnalyzed || new Date().toISOString(),
    metadata: nextMetadata
  }
}

export function getAnalyzeDatabase() {
  const supabase = getSupabaseAdminClient()

  return {
    async listUserIds() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .order("id", { ascending: true })

      if (error) throw error
      return (data || []).map(row => String(row.id || "").trim()).filter(Boolean)
    },

    async getUserAnalyzeData(uid) {
      const [userResult, foldersResult, notesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, app_language, metadata")
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("folders")
          .select("id, name, description")
          .eq("user_id", uid)
          .order("created_at", { ascending: true }),
        supabase
          .from("notes")
          .select("id, title, content_raw, source_type, language, user_tags, hidden_tags, folder_id, ai_folder_id, ai_processed, metadata, created_at, updated_at")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
      ])

      if (userResult.error) throw userResult.error
      if (foldersResult.error) throw foldersResult.error
      if (notesResult.error) throw notesResult.error

      return {
        userDocument: createDocument(uid, mapProfileRow(userResult.data || {})),
        foldersSnapshot: {
          docs: (foldersResult.data || []).map(row => createDocument(row.id, mapFolderRow(row)))
        },
        notesSnapshot: {
          docs: (notesResult.data || []).map(row => createDocument(row.id, mapNoteRow(row)))
        }
      }
    },

    async updateNotes(uid, updates) {
      if (!Array.isArray(updates) || !updates.length) {
        return
      }

      await Promise.all(updates.map(async update => {
        const noteId = String(update?.id || "").trim()
        if (!noteId) {
          return
        }

        const { data: existingNote, error: existingError } = await supabase
          .from("notes")
          .select("id, metadata")
          .eq("id", noteId)
          .eq("user_id", uid)
          .maybeSingle()

        if (existingError) throw existingError
        if (!existingNote?.id) {
          throw new Error(`NOTE_NOT_FOUND:${noteId}`)
        }

        const payload = buildAnalyzeUpdatePayload(update, existingNote.metadata)
        const { error } = await supabase
          .from("notes")
          .update(payload)
          .eq("id", noteId)
          .eq("user_id", uid)

        if (error) throw error
      }))
    }
  }
}
