import { getSupabaseAdminClient } from "./admin"

function mapProfileRow(profile) {
  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email || "",
    displayName: profile.display_name || "",
    photoURL: profile.avatar_url || "",
    uid: profile.id
  }
}

function mapFolderRow(folder) {
  return {
    id: folder.id,
    name: folder.name || "",
    description: folder.description || "",
    folderOrder: Number.isFinite(folder.sort_order) ? folder.sort_order : 0,
    isHidden: folder.is_hidden === true,
    isArchived: folder.is_archived === true,
    createdAt: folder.created_at || null,
    updatedAt: folder.updated_at || null,
    ownerUid: folder.user_id
  }
}

function mapNoteRow(note) {
  return {
    id: note.id,
    title: note.title || "",
    content: note.content_raw || "",
    tags: Array.isArray(note.user_tags) ? note.user_tags : [],
    hiddenTags: Array.isArray(note.hidden_tags) ? note.hidden_tags : [],
    folderId: note.folder_id || null,
    isArchived: note.is_archived === true,
    isFavorite: Boolean(note.metadata?.isFavorite),
    isPinned: Boolean(note.metadata?.isPinned),
    reminderAt: note.reminder_at || null,
    trashedAt: note.is_deleted ? (note.updated_at || note.created_at || null) : null,
    contentType: "text",
    aiFolder: note.ai_folder_id || "",
    aiTags: Array.isArray(note.metadata?.aiTags) ? note.metadata.aiTags : [],
    relevance: Number.isFinite(Number(note.ai_relevance)) ? Number(note.ai_relevance) : 0,
    aiRelevance: Number.isFinite(Number(note.ai_relevance)) ? Number(note.ai_relevance) : 0,
    aiProcessed: note.ai_processed === true,
    aiVersion: 1,
    aiLastAnalyzed: note.ai_last_analyzed || null,
    createdAt: note.created_at || null,
    updatedAt: note.updated_at || null,
    ownerUid: note.user_id,
    access: {
      ownerUid: note.user_id,
      roles: { [note.user_id]: "owner" }
    }
  }
}

export async function getSupabaseProfile(userId) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  return mapProfileRow(data)
}

export async function ensureSupabaseProfile({ userId, email = "", displayName = "", avatarUrl = "" }) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    email: email || null,
    display_name: displayName || "",
    avatar_url: avatarUrl || ""
  })

  if (error) throw error
  return getSupabaseProfile(userId)
}

export async function listSupabaseFolders(userId) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, description, sort_order, is_hidden, is_archived, created_at, updated_at, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data || []).map(mapFolderRow)
}

export async function upsertSupabaseFolder({ userId, folderId = null, name, description = "", isHidden = false, isArchived = false }) {
  const supabase = getSupabaseAdminClient()
  const payload = {
    id: folderId || undefined,
    user_id: userId,
    name: String(name || "").trim(),
    description: String(description || "").trim(),
    is_hidden: !!isHidden,
    is_archived: !!isArchived
  }

  const { data, error } = await supabase
    .from("folders")
    .upsert(payload)
    .select("id, name, description, sort_order, is_hidden, is_archived, created_at, updated_at, user_id")
    .single()

  if (error) throw error
  return mapFolderRow(data)
}

export async function listSupabaseNotes(userId, { limit = 500, offset = 0 } = {}) {
  const supabase = getSupabaseAdminClient()
  const from = Math.max(0, Number(offset) || 0)
  const to = from + Math.max(1, Number(limit) || 500) - 1
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(from, to)

  if (error) throw error
  return (data || []).map(mapNoteRow)
}

export async function upsertSupabaseNote({ userId, note }) {
  const supabase = getSupabaseAdminClient()
  const payload = {
    id: note?.id || undefined,
    user_id: userId,
    folder_id: note?.folderId || null,
    title: String(note?.title || "").slice(0, 200),
    content_raw: String(note?.content || ""),
    content_plain: String(note?.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000),
    content_format: "html",
    source_type: "note",
    language: "unknown",
    char_count: String(note?.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length,
    is_archived: !!note?.isArchived,
    is_deleted: !!note?.trashedAt,
    user_tags: Array.isArray(note?.tags) ? note.tags : [],
    hidden_tags: Array.isArray(note?.hiddenTags) ? note.hiddenTags : [],
    reminder_at: note?.reminderAt || null,
    metadata: {
      isFavorite: !!note?.isFavorite,
      isPinned: !!note?.isPinned,
      aiTags: Array.isArray(note?.aiTags) ? note.aiTags : []
    }
  }

  const { data, error } = await supabase
    .from("notes")
    .upsert(payload)
    .select("*")
    .single()

  if (error) throw error
  return mapNoteRow(data)
}
