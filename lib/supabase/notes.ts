import { getSupabaseAdminClient } from "./admin"

type JsonObject = Record<string, unknown>

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
}

type FolderRow = {
  id: string
  name: string | null
  description: string | null
  sort_order: number | null
  is_hidden: boolean | null
  is_archived: boolean | null
  metadata: JsonObject | null
  created_at: string | null
  updated_at: string | null
  user_id: string
}

type NoteInput = {
  id?: string | null
  title?: string | null
  content?: string | null
  tags?: unknown[] | null
  hiddenTags?: unknown[] | null
  folderId?: string | null
  folderOrder?: number | string | null
  order?: number | string | null
  isArchived?: boolean | null
  isFavorite?: boolean | null
  isPinned?: boolean | null
  reminderAt?: string | null
  trashedAt?: string | null
  aiTags?: unknown[] | null
  pageTitles?: unknown[] | null
  pageDrawings?: unknown[] | null
  pageDrawingsRevision?: string | null
  lock?: JsonObject | null
  workspaceId?: string | null
}

type NoteRow = {
  id: string
  title: string | null
  content_raw: string | null
  user_tags: unknown[] | null
  hidden_tags: unknown[] | null
  folder_id: string | null
  reminder_at: string | null
  is_archived: boolean | null
  is_deleted: boolean | null
  ai_folder_id: string | null
  ai_relevance: number | null
  ai_processed: boolean | null
  ai_last_analyzed: string | null
  metadata: JsonObject | null
  created_at: string | null
  updated_at: string | null
  user_id: string
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item || "")).filter(Boolean)
    : []
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized || null
}

function normalizeOptionalObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null
}

function normalizeFolderName(name: unknown) {
  return String(name || "").trim()
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim())
}

function assertFolderName(name: unknown) {
  if (!normalizeFolderName(name)) {
    throw new Error("FOLDER_NAME_REQUIRED")
  }
}

function buildNotePayload(userId: string, note: NoteInput = {}, currentMetadata: JsonObject = {}) {
  const content = String(note?.content || "")
  const metadata = currentMetadata && typeof currentMetadata === "object" ? currentMetadata : {}

  return {
    id: isUuid(note?.id) ? String(note?.id) : undefined,
    user_id: userId,
    folder_id: note?.folderId || null,
    title: String(note?.title || "").slice(0, 200),
    content_raw: content,
    content_plain: content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000),
    content_format: "html",
    source_type: "note",
    language: "unknown",
    char_count: content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length,
    is_archived: !!note?.isArchived,
    is_deleted: !!note?.trashedAt,
    user_tags: Array.isArray(note?.tags) ? note.tags : [],
    hidden_tags: Array.isArray(note?.hiddenTags) ? note.hiddenTags : [],
    reminder_at: note?.reminderAt || null,
    metadata: {
      ...metadata,
      isFavorite: !!note?.isFavorite,
      isPinned: !!note?.isPinned,
      aiTags: Array.isArray(note?.aiTags) ? note.aiTags : [],
      folderOrder: Number.isFinite(Number(note?.folderOrder)) ? Number(note.folderOrder) : 0,
      order: Number.isFinite(Number(note?.order)) ? Number(note.order) : Date.now(),
      pageTitles: Array.isArray(note?.pageTitles) ? note.pageTitles : [],
      pageDrawings: Array.isArray(note?.pageDrawings) ? note.pageDrawings : [],
      pageDrawingsRevision: typeof note?.pageDrawingsRevision === "string" ? note.pageDrawingsRevision : "",
      lock: note?.lock && typeof note.lock === "object" ? note.lock : null,
      workspaceId: note?.workspaceId || null,
      trashedAt: note?.trashedAt || null
    }
  }
}

function mergeFolderMetadata(folder: Record<string, unknown> = {}, currentMetadata: JsonObject = {}) {
  const metadata = currentMetadata && typeof currentMetadata === "object" ? currentMetadata : {}
  return {
    ...metadata,
    trashedAt: folder?.trashedAt || null,
    folderOrder: Number.isFinite(Number(folder?.folderOrder))
      ? Number(folder.folderOrder)
      : (Number.isFinite(Number(metadata.folderOrder)) ? Number(metadata.folderOrder) : 0),
    ownerUid: folder?.ownerUid || metadata.ownerUid || null
  }
}

function mapProfileRow(profile: ProfileRow | null) {
  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email || "",
    displayName: profile.display_name || "",
    photoURL: profile.avatar_url || "",
    uid: profile.id
  }
}

function mapFolderRow(folder: FolderRow) {
  const metadata = folder.metadata && typeof folder.metadata === "object" ? folder.metadata : {}

  return {
    id: folder.id,
    name: folder.name || "",
    description: folder.description || "",
    folderOrder: Number.isFinite(Number(folder.sort_order)) ? Number(folder.sort_order) : 0,
    isHidden: folder.is_hidden === true,
    isArchived: folder.is_archived === true,
    trashedAt: Boolean(metadata.trashedAt) ? metadata.trashedAt : null,
    createdAt: folder.created_at || null,
    updatedAt: folder.updated_at || null,
    ownerUid: folder.user_id
  }
}

function mapNoteRow(note: NoteRow) {
  const metadata = note.metadata && typeof note.metadata === "object" ? note.metadata : {}

  return {
    id: note.id,
    title: note.title || "",
    content: note.content_raw || "",
    tags: Array.isArray(note.user_tags) ? note.user_tags : [],
    hiddenTags: Array.isArray(note.hidden_tags) ? note.hidden_tags : [],
    folderId: note.folder_id || null,
    folderOrder: Number.isFinite(Number(metadata.folderOrder)) ? Number(metadata.folderOrder) : 0,
    order: Number.isFinite(Number(metadata.order)) ? Number(metadata.order) : Date.parse(String(note.created_at || note.updated_at || "")) || Date.now(),
    isArchived: note.is_archived === true,
    isFavorite: Boolean(metadata.isFavorite),
    isPinned: Boolean(metadata.isPinned),
    reminderAt: note.reminder_at || null,
    trashedAt: note.is_deleted ? (normalizeOptionalString(metadata.trashedAt) || note.updated_at || note.created_at || null) : null,
    contentType: "text",
    aiFolder: note.ai_folder_id || "",
    aiTags: normalizeStringArray(metadata.aiTags),
    relevance: Number.isFinite(Number(note.ai_relevance)) ? Number(note.ai_relevance) : 0,
    aiRelevance: Number.isFinite(Number(note.ai_relevance)) ? Number(note.ai_relevance) : 0,
    aiProcessed: note.ai_processed === true,
    aiVersion: 1,
    aiLastAnalyzed: note.ai_last_analyzed || null,
    pageTitles: normalizeStringArray(metadata.pageTitles),
    pageDrawings: normalizeStringArray(metadata.pageDrawings),
    pageDrawingsRevision: typeof metadata.pageDrawingsRevision === "string" ? metadata.pageDrawingsRevision : "",
    lock: normalizeOptionalObject(metadata.lock),
    workspaceId: normalizeOptionalString(metadata.workspaceId),
    createdAt: note.created_at || null,
    updatedAt: note.updated_at || null,
    ownerUid: note.user_id,
    access: {
      ownerUid: note.user_id,
      roles: { [note.user_id]: "owner" }
    }
  }
}

export async function getSupabaseProfile(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  return mapProfileRow(data)
}

export async function ensureSupabaseProfile({ userId, email = "", displayName = "", avatarUrl = "" }: { userId: string, email?: string, displayName?: string, avatarUrl?: string }) {
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

export async function listSupabaseFolders(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, description, sort_order, is_hidden, is_archived, metadata, created_at, updated_at, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data || []).map(mapFolderRow)
}

export async function upsertSupabaseFolder({ userId, folderId = null, name, description = "", isHidden = false, isArchived = false }: { userId: string, folderId?: string | null, name: unknown, description?: string, isHidden?: boolean, isArchived?: boolean }) {
  assertFolderName(name)
  const supabase = getSupabaseAdminClient()
  let currentMetadata: JsonObject = {}

  if (folderId) {
    const { data: existingFolder, error: existingFolderError } = await supabase
      .from("folders")
      .select("metadata")
      .eq("id", folderId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingFolderError) throw existingFolderError
    currentMetadata = (existingFolder?.metadata && typeof existingFolder.metadata === "object") ? existingFolder.metadata as JsonObject : {}
  }

  const payload = {
    id: folderId || undefined,
    user_id: userId,
    name: normalizeFolderName(name),
    description: String(description || "").trim(),
    is_hidden: !!isHidden,
    is_archived: !!isArchived,
    metadata: mergeFolderMetadata({}, currentMetadata)
  }

  const { data, error } = await supabase
    .from("folders")
    .upsert(payload)
    .select("id, name, description, sort_order, is_hidden, is_archived, metadata, created_at, updated_at, user_id")
    .single()

  if (error) throw error
  return mapFolderRow(data)
}

export async function updateSupabaseFolder({ userId, folderId, updates }: { userId: string, folderId: string, updates: Record<string, unknown> }) {
  const normalizedFolderId = String(folderId || "").trim()
  if (!normalizedFolderId) {
    throw new Error("FOLDER_ID_REQUIRED")
  }

  const supabase = getSupabaseAdminClient()
  const { data: existingFolder, error: existingFolderError } = await supabase
    .from("folders")
    .select("*")
    .eq("id", normalizedFolderId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingFolderError) throw existingFolderError
  if (!existingFolder?.id) throw new Error("FOLDER_NOT_FOUND")

  const nextMetadata = mergeFolderMetadata(updates, (existingFolder.metadata && typeof existingFolder.metadata === "object") ? existingFolder.metadata as JsonObject : {})
  const { data, error } = await supabase
    .from("folders")
    .update({
      name: typeof updates.name === "string" ? normalizeFolderName(updates.name) : existingFolder.name,
      description: typeof updates.description === "string" ? String(updates.description).trim() : existingFolder.description,
      is_hidden: typeof updates.isHidden === "boolean" ? updates.isHidden : existingFolder.is_hidden,
      is_archived: typeof updates.isArchived === "boolean" ? updates.isArchived : existingFolder.is_archived,
      sort_order: Number.isFinite(Number(updates.folderOrder)) ? Number(updates.folderOrder) : existingFolder.sort_order,
      metadata: nextMetadata
    })
    .eq("id", normalizedFolderId)
    .eq("user_id", userId)
    .select("id, name, description, sort_order, is_hidden, is_archived, metadata, created_at, updated_at, user_id")
    .single()

  if (error) throw error
  return mapFolderRow(data)
}

export async function deleteSupabaseFolder(userId: string, folderId: string) {
  const normalizedFolderId = String(folderId || "").trim()
  if (!normalizedFolderId) {
    throw new Error("FOLDER_ID_REQUIRED")
  }

  const supabase = getSupabaseAdminClient()
  const { data: existingFolder, error: existingFolderError } = await supabase
    .from("folders")
    .select("metadata")
    .eq("id", normalizedFolderId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingFolderError) throw existingFolderError

  const { error } = await supabase
    .from("folders")
    .update({
      is_archived: true,
      metadata: mergeFolderMetadata({ trashedAt: new Date().toISOString() }, (existingFolder?.metadata && typeof existingFolder.metadata === "object") ? existingFolder.metadata as JsonObject : {})
    })
    .eq("id", normalizedFolderId)
    .eq("user_id", userId)

  if (error) throw error
  return { id: normalizedFolderId }
}

export async function listSupabaseNotes(userId: string, { limit = 500, offset = 0 }: { limit?: number, offset?: number } = {}) {
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

export async function upsertSupabaseNote({ userId, note }: { userId: string, note: NoteInput }) {
  const supabase = getSupabaseAdminClient()
  const payload = buildNotePayload(userId, note)

  const { data, error } = await supabase
    .from("notes")
    .upsert(payload)
    .select("*")
    .single()

  if (error) throw error
  return mapNoteRow(data)
}

export async function updateSupabaseNote({ userId, noteId, note }: { userId: string, noteId?: string | null, note: NoteInput }) {
  const normalizedNoteId = String(noteId || note?.id || "").trim()
  if (!normalizedNoteId) {
    throw new Error("NOTE_ID_REQUIRED")
  }

  const supabase = getSupabaseAdminClient()
  const { data: existing, error: existingError } = await supabase
    .from("notes")
    .select("id, metadata")
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existing?.id) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const { data: currentNoteRow, error: currentNoteRowError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)
    .maybeSingle()

  if (currentNoteRowError) throw currentNoteRowError

  const currentNote = currentNoteRow ? mapNoteRow(currentNoteRow as NoteRow) : null
  const payload = buildNotePayload(userId, { ...(currentNote || {}), ...(note || {}), id: normalizedNoteId }, existing.metadata || {})
  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error) throw error
  return mapNoteRow(data)
}

export async function patchSupabaseNote({ userId, noteId, updates }: { userId: string, noteId: string, updates: Record<string, unknown> }) {
  const normalizedNoteId = String(noteId || "").trim()
  if (!normalizedNoteId) {
    throw new Error("NOTE_ID_REQUIRED")
  }

  const supabase = getSupabaseAdminClient()
  const { data: existingRow, error: existingRowError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingRowError) throw existingRowError
  if (!existingRow?.id) throw new Error("NOTE_NOT_FOUND")

  const currentNote = mapNoteRow(existingRow as NoteRow)
  const payload = buildNotePayload(userId, {
    ...currentNote,
    ...updates,
    id: normalizedNoteId
  }, (existingRow.metadata && typeof existingRow.metadata === "object") ? existingRow.metadata as JsonObject : {})

  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error) throw error
  return mapNoteRow(data)
}

export async function deleteSupabaseNote(userId: string, noteId: string) {
  const normalizedNoteId = String(noteId || "").trim()
  if (!normalizedNoteId) {
    throw new Error("NOTE_ID_REQUIRED")
  }

  const supabase = getSupabaseAdminClient()
  const { data: existingNote, error: existingNoteError } = await supabase
    .from("notes")
    .select("metadata")
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingNoteError) throw existingNoteError

  const currentMetadata = (existingNote?.metadata && typeof existingNote.metadata === "object") ? existingNote.metadata as JsonObject : {}
  const { error } = await supabase
    .from("notes")
    .update({
      is_deleted: true,
      metadata: {
        ...currentMetadata,
        trashedAt: new Date().toISOString()
      }
    })
    .eq("id", normalizedNoteId)
    .eq("user_id", userId)

  if (error) throw error
  return { id: normalizedNoteId }
}
