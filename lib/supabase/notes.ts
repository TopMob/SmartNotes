import { getSupabaseAdminClient } from "./admin"

type JsonObject = Record<string, unknown>

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  app_language?: string | null
  metadata?: JsonObject | null
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
  aiProcessed?: boolean | null
  aiTags?: unknown[] | null
  pageTitles?: unknown[] | null
  pageDrawings?: unknown[] | null
  pageDrawingsRevision?: string | null
  lock?: JsonObject | null
  lockHidden?: boolean | null
  aiStatus?: string | null
  analyzed?: boolean | null
  aiError?: string | null
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

type NotePermissionRow = {
  note_id: string
  user_id: string
  role: "viewer" | "editor"
  status: "pending" | "accepted" | "rejected"
  invited_by_user_id: string
}

type FolderPermissionRow = {
  folder_id: string
  user_id: string
  role: "viewer" | "editor"
  status: "pending" | "accepted" | "rejected"
  invited_by_user_id: string
}

type SharePermissionInput = {
  noteId: string
  userId: string
  userEmail: string
  collaboratorTarget: string
  role: "viewer" | "editor"
}

type ResolvedCollaborator = {
  id: string
  email: string
  displayName: string
  photoURL: string
}

function mapPermissionRole(value: unknown) {
  return String(value || "").trim().toLowerCase() === "editor" ? "editor" : "viewer"
}

function mapPermissionStatus(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase()
  return normalized === "accepted" || normalized === "rejected" ? normalized : "pending"
}

function buildDisplayName(profile: Partial<ProfileRow> | null, fallbackId: string) {
  const displayName = String(profile?.display_name || "").trim()
  if (displayName) return displayName
  const email = String(profile?.email || "").trim()
  if (email) return email.split("@")[0]
  return fallbackId.slice(0, 8) || "User"
}

function extractCollaboratorTargetValue(value: unknown) {
  const normalizedValue = String(value || "").trim()
  if (!normalizedValue) return ""
  const normalizedEmail = normalizeEmail(normalizedValue)
  if (normalizedEmail.includes("@")) return normalizedEmail

  try {
    const url = new URL(normalizedValue)
    const emailTarget = normalizeEmail(
      url.searchParams.get("email")
      || url.searchParams.get("user_email")
      || ""
    )
    if (emailTarget) return emailTarget

    const idTarget = String(
      url.searchParams.get("userId")
      || url.searchParams.get("user_id")
      || url.searchParams.get("uid")
      || url.searchParams.get("id")
      || ""
    ).trim()
    if (idTarget) return idTarget

    const pathSegments = url.pathname.split("/").map(segment => segment.trim()).filter(Boolean)
    return String(pathSegments[pathSegments.length - 1] || "").trim()
  } catch {
    return normalizedValue
  }
}

async function resolveCollaboratorEmail(collaboratorTarget: unknown) {
  const normalizedTarget = extractCollaboratorTargetValue(collaboratorTarget)
  if (!normalizedTarget) {
    throw new Error("BAD_REQUEST")
  }
  if (normalizedTarget.includes("@")) {
    const profile = await resolveProfileByEmail(normalizedTarget)
    if (!profile?.email) throw new Error("COLLABORATOR_NOT_FOUND")
    return normalizeEmail(profile.email)
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", normalizedTarget)
    .maybeSingle()

  if (error) throw error
  const normalizedEmail = normalizeEmail(data?.email)
  if (!normalizedEmail) {
    throw new Error("COLLABORATOR_NOT_FOUND")
  }

  return normalizedEmail
}

async function getProfileByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (error) throw new Error("COLLABORATOR_NOT_FOUND")
  return data ? mapProfileRow(data as ProfileRow) : null
}

async function getAuthUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const supabase = getSupabaseAdminClient()
  let page = 1
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error("COLLABORATOR_NOT_FOUND")
    const users = Array.isArray(data?.users) ? data.users : []
    const matchedUser = users.find(user => normalizeEmail(user?.email || "") === normalizedEmail) || null
    if (matchedUser?.id) {
      return {
        id: String(matchedUser.id || ""),
        email: normalizeEmail(matchedUser.email || ""),
        displayName: String(matchedUser.user_metadata?.display_name || matchedUser.user_metadata?.full_name || "").trim(),
        photoURL: String(matchedUser.user_metadata?.avatar_url || "").trim(),
        uid: String(matchedUser.id || "")
      }
    }
    if (users.length < 200) break
    page += 1
  }

  return null
}

async function resolveProfileByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const profile = await getProfileByEmail(normalizedEmail)
  if (profile?.id) return profile

  const authUser = await getAuthUserByEmail(normalizedEmail)
  if (!authUser?.id) return null
  return authUser
}

async function listProfilesByIds(userIds: string[]) {
  const normalizedIds = [...new Set((Array.isArray(userIds) ? userIds : []).map(value => String(value || "").trim()).filter(Boolean))]
  if (!normalizedIds.length) return []

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .in("id", normalizedIds)

  if (error) throw error
  return (data || []) as ProfileRow[]
}

async function resolveCollaborator(collaboratorTarget: unknown): Promise<ResolvedCollaborator> {
  const normalizedTarget = extractCollaboratorTargetValue(collaboratorTarget)
  if (!normalizedTarget) throw new Error("BAD_REQUEST")

  if (normalizedTarget.includes("@")) {
    const profile = await resolveProfileByEmail(normalizedTarget)
    if (!profile?.id) throw new Error("COLLABORATOR_NOT_FOUND")
    return {
      id: String(profile.id || ""),
      email: String(profile.email || ""),
      displayName: String(profile.displayName || ""),
      photoURL: String(profile.photoURL || "")
    }
  }

  const profile = await getSupabaseProfile(normalizedTarget)
  if (!profile?.id) throw new Error("COLLABORATOR_NOT_FOUND")
  return {
    id: String(profile.id || ""),
    email: String(profile.email || ""),
    displayName: String(profile.displayName || ""),
    photoURL: String(profile.photoURL || "")
  }
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

function normalizeThemeSettingsMetadata(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {}
  return {
    preset: typeof source.preset === "string" && source.preset ? source.preset : "oled",
    p: typeof source.p === "string" ? source.p : "",
    bg: typeof source.bg === "string" ? source.bg : "",
    t: typeof source.t === "string" ? source.t : "",
    mainBackgroundUrl: typeof source.mainBackgroundUrl === "string" ? source.mainBackgroundUrl : "",
    sidebarBackgroundUrl: typeof source.sidebarBackgroundUrl === "string" ? source.sidebarBackgroundUrl : "",
    mainBackgroundImage: typeof source.mainBackgroundImage === "string" ? source.mainBackgroundImage : "",
    sidebarBackgroundImage: typeof source.sidebarBackgroundImage === "string" ? source.sidebarBackgroundImage : "",
    uiOpacity: Number.isFinite(Number(source.uiOpacity)) ? Number(source.uiOpacity) : 0.78,
    cardsOpacity: Number.isFinite(Number(source.cardsOpacity)) ? Number(source.cardsOpacity) : 0.9
  }
}

function normalizeInterfaceMetadata(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {}
  return {
    showSavedFilters: source.showSavedFilters !== false,
    showTagFilter: source.showTagFilter !== false,
    showUpdatedPeriodFilter: source.showUpdatedPeriodFilter !== false
  }
}

function normalizeCustomPresets(value: unknown) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === "object" && !Array.isArray(item)) as JsonObject[]
    : []
}

function hasOwn(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function sanitizeLockValue(value: unknown, fallback: JsonObject | null = null) {
  if (value === null) return null
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback
  const source = value as JsonObject
  const nextLock: JsonObject = {
    ...(fallback && typeof fallback === "object" ? fallback : {})
  }

  if (typeof source.v === "number") nextLock.v = source.v
  if (typeof source.hash === "string") nextLock.hash = source.hash
  if (typeof source.hidden === "boolean") nextLock.hidden = source.hidden

  return Object.keys(nextLock).length ? nextLock : null
}

function buildNotePatchPayload(existingRow: NoteRow, updates: Record<string, unknown>) {
  const metadata = existingRow.metadata && typeof existingRow.metadata === "object" ? { ...existingRow.metadata as JsonObject } : {}
  const payload: Record<string, unknown> = {}

  if (hasOwn(updates, "title")) {
    const title = String(updates.title || "")
    payload.title = title.slice(0, 200)
  }

  if (hasOwn(updates, "content")) {
    const content = String(updates.content || "")
    payload.content_raw = content
    payload.content_plain = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000)
    payload.char_count = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length
  }

  if (hasOwn(updates, "folderId")) {
    payload.folder_id = updates.folderId ? String(updates.folderId) : null
  }

  if (hasOwn(updates, "isArchived")) {
    payload.is_archived = updates.isArchived === true
  }

  if (hasOwn(updates, "reminderAt")) {
    payload.reminder_at = normalizeOptionalString(updates.reminderAt)
  }

  if (hasOwn(updates, "trashedAt")) {
    const trashedAt = normalizeOptionalString(updates.trashedAt)
    payload.is_deleted = Boolean(trashedAt)
    metadata.trashedAt = trashedAt
  }

  if (hasOwn(updates, "tags")) {
    payload.user_tags = Array.isArray(updates.tags) ? updates.tags : []
  }

  if (hasOwn(updates, "hiddenTags")) {
    payload.hidden_tags = Array.isArray(updates.hiddenTags) ? updates.hiddenTags : []
  }

  if (hasOwn(updates, "isFavorite")) {
    metadata.isFavorite = updates.isFavorite === true
  }

  if (hasOwn(updates, "isPinned")) {
    metadata.isPinned = updates.isPinned === true
  }

  if (hasOwn(updates, "folderOrder")) {
    metadata.folderOrder = Number.isFinite(Number(updates.folderOrder)) ? Number(updates.folderOrder) : 0
  }

  if (hasOwn(updates, "order")) {
    metadata.order = Number.isFinite(Number(updates.order)) ? Number(updates.order) : metadata.order || Date.now()
  }

  if (hasOwn(updates, "aiTags")) {
    metadata.aiTags = Array.isArray(updates.aiTags) ? updates.aiTags : []
  }

   if (hasOwn(updates, "aiStatus")) {
    metadata.aiStatus = normalizeOptionalString(updates.aiStatus) || "pending"
  }

  if (hasOwn(updates, "analyzed")) {
    metadata.analyzed = updates.analyzed === true
  }

  if (hasOwn(updates, "aiError")) {
    metadata.aiError = normalizeOptionalString(updates.aiError)
  }

  if (hasOwn(updates, "pageTitles")) {
    metadata.pageTitles = Array.isArray(updates.pageTitles) ? updates.pageTitles : []
  }

  if (hasOwn(updates, "pageDrawings")) {
    metadata.pageDrawings = Array.isArray(updates.pageDrawings) ? updates.pageDrawings : []
  }

  if (hasOwn(updates, "pageDrawingsRevision")) {
    metadata.pageDrawingsRevision = typeof updates.pageDrawingsRevision === "string" ? updates.pageDrawingsRevision : ""
  }

  if (hasOwn(updates, "lock")) {
    const currentLock = normalizeOptionalObject(metadata.lock)
    const nextLock = sanitizeLockValue(updates.lock, currentLock)
    metadata.lock = nextLock
    metadata.lockHidden = Boolean(nextLock?.hidden)
  }

  if (hasOwn(updates, "lock.hidden")) {
    const currentLock = sanitizeLockValue(metadata.lock, null) || {}
    const nextLock = {
      ...currentLock,
      hidden: updates["lock.hidden"] === true
    }
    metadata.lock = nextLock
    metadata.lockHidden = nextLock.hidden === true
  }

  payload.metadata = metadata
  return payload
}

function normalizeFolderName(name: unknown) {
  return String(name || "").trim()
}

function normalizeRecordId(value: unknown) {
  const normalized = String(value || "").trim()
  return normalized || undefined
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim())
}

function normalizeUuid(value: unknown) {
  const normalized = String(value || "").trim()
  return isUuid(normalized) ? normalized : null
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
    folder_id: normalizeUuid(note?.folderId),
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
      lockHidden: note?.lock && typeof note.lock === "object"
        ? Boolean((note.lock as JsonObject).hidden)
        : Boolean(metadata.lockHidden),
      trashedAt: note?.trashedAt || null,
      analyzed: note?.analyzed === true,
      aiStatus: normalizeOptionalString(note?.aiStatus) || (note?.aiProcessed === true ? "done" : "pending"),
      aiError: normalizeOptionalString(note?.aiError)
    }
  }
}

function mergeFolderMetadata(folder: Record<string, unknown> = {}, currentMetadata: JsonObject = {}) {
  const metadata = currentMetadata && typeof currentMetadata === "object" ? currentMetadata : {}
  return {
    ...metadata,
    trashedAt: folder?.trashedAt || null,
    isHidden: typeof folder?.isHidden === "boolean" ? folder.isHidden : Boolean(metadata.isHidden),
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
    isHidden: typeof metadata.isHidden === "boolean" ? metadata.isHidden : folder.is_hidden === true,
    isArchived: folder.is_archived === true,
    accessRole: typeof metadata.accessRole === "string" ? metadata.accessRole : "owner",
    accessStatus: typeof metadata.accessStatus === "string" ? metadata.accessStatus : "accepted",
    invitedByDisplayName: typeof metadata.invitedByDisplayName === "string" ? metadata.invitedByDisplayName : "",
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
    accessRole: typeof metadata.accessRole === "string" ? metadata.accessRole : "owner",
    accessStatus: typeof metadata.accessStatus === "string" ? metadata.accessStatus : "accepted",
    invitedByDisplayName: typeof metadata.invitedByDisplayName === "string" ? metadata.invitedByDisplayName : "",
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
    aiStatus: normalizeOptionalString(metadata.aiStatus) || (note.ai_processed === true ? "done" : "idle"),
    analyzed: metadata.analyzed === true || note.ai_processed === true,
    aiError: normalizeOptionalString(metadata.aiError),
    pageTitles: normalizeStringArray(metadata.pageTitles),
    pageDrawings: normalizeStringArray(metadata.pageDrawings),
    pageDrawingsRevision: typeof metadata.pageDrawingsRevision === "string" ? metadata.pageDrawingsRevision : "",
    lock: normalizeOptionalObject(metadata.lock),
    lockHidden: Boolean(metadata.lockHidden),
    createdAt: note.created_at || null,
    updatedAt: note.updated_at || null,
    ownerUid: note.user_id
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

async function listPermittedNoteIds(userId: string) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return []

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("note_permissions")
    .select("note_id")
    .eq("user_id", normalizedUserId)
    .eq("status", "accepted")

  if (error) throw error
  return (data || []).map(row => String(row.note_id || "")).filter(Boolean)
}

async function listPermittedFolderRows(userId: string) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return []

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folder_permissions")
    .select("folder_id, user_id, role, status, invited_by_user_id")
    .eq("user_id", normalizedUserId)
    .eq("status", "accepted")

  if (error) throw error
  return (data || []) as FolderPermissionRow[]
}

async function listOwnedFolderIds(userId: string) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return []

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", normalizedUserId)

  if (error) throw error
  return (data || []).map(row => normalizeUuid(row.id)).filter(Boolean) as string[]
}

async function getFolderAccessRow(folderId: string, userId: string, userEmail: string) {
  const normalizedFolderId = normalizeUuid(folderId)
  if (!normalizedFolderId) {
    throw new Error("FOLDER_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const { data: folderRow, error: folderError } = await supabase
    .from("folders")
    .select("id, user_id")
    .eq("id", normalizedFolderId)
    .maybeSingle()

  if (folderError) throw folderError
  if (!folderRow?.id) {
    throw new Error("FOLDER_NOT_FOUND")
  }

  if (folderRow.user_id === userId) {
    return {
      folderId: normalizedFolderId,
      ownerId: String(folderRow.user_id || ""),
      permission: null
    }
  }

  const permission = await getFolderPermissionRow(normalizedFolderId, userId)
  if (!permission?.folder_id) {
    throw new Error("FOLDER_NOT_FOUND")
  }

  return {
    folderId: normalizedFolderId,
    ownerId: String(folderRow.user_id || ""),
    permission
  }
}

async function getFolderPermissionRow(folderId: string, userId: string) {
  const normalizedFolderId = normalizeUuid(folderId)
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedFolderId || !normalizedUserId) return null

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folder_permissions")
    .select("folder_id, user_id, role, status, invited_by_user_id")
    .eq("folder_id", normalizedFolderId)
    .eq("user_id", normalizedUserId)
    .eq("status", "accepted")
    .maybeSingle()

  if (error) throw error
  return data as FolderPermissionRow | null
}

async function getNoteAccessRow(noteId: string, userId: string, userEmail: string) {
  const normalizedNoteId = normalizeUuid(noteId)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const { data: noteRow, error: noteError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", normalizedNoteId)
    .maybeSingle()

  if (noteError) throw noteError
  if (!noteRow?.id) throw new Error("NOTE_NOT_FOUND")
  if (noteRow.user_id === userId) {
    return { noteRow: noteRow as NoteRow, permission: null }
  }

  const folderAccess = noteRow.folder_id
    ? await getFolderAccessRow(String(noteRow.folder_id || ""), userId, userEmail).catch(error => {
      if (String(error instanceof Error ? error.message : error || "") === "FOLDER_NOT_FOUND") {
        return null
      }
      throw error
    })
    : null
  if (folderAccess?.folderId) {
    return {
      noteRow: noteRow as NoteRow,
      permission: folderAccess.permission || { folder_id: folderAccess.folderId, user_id: String(userId || ""), role: "editor", status: "accepted", invited_by_user_id: String(folderAccess.ownerId || "") }
    }
  }

  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const { data: permissionRow, error: permissionError } = await supabase
    .from("note_permissions")
    .select("note_id, user_id, role, status, invited_by_user_id")
    .eq("note_id", normalizedNoteId)
    .eq("user_id", normalizedUserId)
    .eq("status", "accepted")
    .maybeSingle()

  if (permissionError) throw permissionError
  if (!permissionRow?.note_id) {
    throw new Error("NOTE_NOT_FOUND")
  }

  return {
    noteRow: noteRow as NoteRow,
    permission: permissionRow as NotePermissionRow
  }
}

async function requireEditorNoteAccess(noteId: string, userId: string, userEmail: string) {
  const access = await getNoteAccessRow(noteId, userId, userEmail)
  if (access.noteRow.user_id === userId) {
    return access.noteRow
  }

  if (access.permission?.role !== "editor") {
    throw new Error("NOTE_NOT_FOUND")
  }

  return access.noteRow
}

async function requireOwnedNote(noteId: string, userId: string) {
  const normalizedNoteId = normalizeUuid(noteId)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("notes")
    .select("id, user_id")
    .eq("id", normalizedNoteId)
    .maybeSingle()

  if (error) throw error
  if (!data?.id || data.user_id !== userId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  return data
}

export async function getSupabaseProfile(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw new Error("COLLABORATOR_NOT_FOUND")
  return mapProfileRow(data)
}

async function presentNotePermissions(rows: NotePermissionRow[]) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  if (!normalizedRows.length) return []
  const profileRows = await listProfilesByIds(normalizedRows.flatMap(row => [row.user_id, row.invited_by_user_id]))
  const profileMap = new Map(profileRows.map(profile => [String(profile.id || ""), profile]))

  return normalizedRows.map(row => {
    const collaboratorProfile = profileMap.get(String(row.user_id || "")) || null
    const inviterProfile = profileMap.get(String(row.invited_by_user_id || "")) || null
    return {
      userId: String(row.user_id || ""),
      displayName: buildDisplayName(collaboratorProfile, String(row.user_id || "")),
      email: String(collaboratorProfile?.email || ""),
      photoURL: String(collaboratorProfile?.avatar_url || ""),
      role: mapPermissionRole(row.role),
      status: mapPermissionStatus(row.status),
      invitedByUserId: String(row.invited_by_user_id || ""),
      invitedByDisplayName: buildDisplayName(inviterProfile, String(row.invited_by_user_id || ""))
    }
  })
}

async function presentFolderPermissions(rows: FolderPermissionRow[]) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  if (!normalizedRows.length) return []
  const profileRows = await listProfilesByIds(normalizedRows.flatMap(row => [row.user_id, row.invited_by_user_id]))
  const profileMap = new Map(profileRows.map(profile => [String(profile.id || ""), profile]))

  return normalizedRows.map(row => {
    const collaboratorProfile = profileMap.get(String(row.user_id || "")) || null
    const inviterProfile = profileMap.get(String(row.invited_by_user_id || "")) || null
    return {
      userId: String(row.user_id || ""),
      displayName: buildDisplayName(collaboratorProfile, String(row.user_id || "")),
      email: String(collaboratorProfile?.email || ""),
      photoURL: String(collaboratorProfile?.avatar_url || ""),
      role: mapPermissionRole(row.role),
      status: mapPermissionStatus(row.status),
      invitedByUserId: String(row.invited_by_user_id || ""),
      invitedByDisplayName: buildDisplayName(inviterProfile, String(row.invited_by_user_id || ""))
    }
  })
}

export async function ensureSupabaseProfile({ userId, email = "", displayName = "", avatarUrl = "" }: { userId: string, email?: string, displayName?: string, avatarUrl?: string }) {
  const supabase = getSupabaseAdminClient()
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("metadata, app_language")
    .eq("id", userId)
    .maybeSingle()

  if (existingProfileError) throw existingProfileError

  const currentMetadata = existingProfile?.metadata && typeof existingProfile.metadata === "object"
    ? existingProfile.metadata as JsonObject
    : {}

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    email: email || null,
    display_name: displayName || "",
    avatar_url: avatarUrl || "",
    app_language: typeof existingProfile?.app_language === "string" && existingProfile.app_language === "en" ? "en" : "ru",
    metadata: currentMetadata
  })

  if (error) throw error
  return getSupabaseProfile(userId)
}

export async function getSupabaseUserSettings(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("app_language, metadata")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error

  const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata as JsonObject : {}
  const normalizedCustomTheme = normalizeThemeSettingsMetadata(metadata.customTheme)
  return {
    lang: typeof data?.app_language === "string" && data.app_language === "en" ? "en" : "ru",
    notesPerPage: [5, 10, 20, 50].includes(Number(metadata.notesPerPage)) ? Number(metadata.notesPerPage) : 20,
    folderViewMode: metadata.folderViewMode === "full" ? "full" : "compact",
    reduceMotion: metadata.reduceMotion === true,
    interface: normalizeInterfaceMetadata(metadata.interface),
    themeId: typeof metadata.themeId === "string" ? metadata.themeId : "oled",
    customTheme: normalizedCustomTheme,
    customPresets: normalizeCustomPresets(metadata.customPresets),
    schemaVersion: 1
  }
}

export async function saveSupabaseUserSettings(userId: string, settings: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient()
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle()

  if (existingProfileError) throw existingProfileError

  const currentMetadata = existingProfile?.metadata && typeof existingProfile.metadata === "object"
    ? existingProfile.metadata as JsonObject
    : {}

  const normalizedThemeId = typeof settings?.themeId === "string" && settings.themeId ? settings.themeId : (typeof currentMetadata.themeId === "string" ? String(currentMetadata.themeId) : "oled")
  const normalizedCustomTheme = normalizeThemeSettingsMetadata(settings?.customTheme)
  const normalizedInterface = normalizeInterfaceMetadata(settings?.interface)
  const normalizedNotesPerPage = [5, 10, 20, 50].includes(Number(settings?.notesPerPage)) ? Number(settings?.notesPerPage) : 20

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      app_language: settings?.lang === "en" ? "en" : "ru",
      metadata: {
        ...currentMetadata,
        notesPerPage: normalizedNotesPerPage,
        folderViewMode: settings?.folderViewMode === "full" ? "full" : "compact",
        reduceMotion: settings?.reduceMotion === true,
        interface: normalizedInterface,
        themeId: normalizedThemeId,
        customTheme: normalizedCustomTheme,
        customPresets: Array.isArray(settings?.customPresets) ? settings.customPresets : currentMetadata.customPresets || []
      }
    })

  if (error) throw error

  return getSupabaseUserSettings(userId)
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

export async function listAccessibleSupabaseFolders(userId: string, userEmail: string) {
  const supabase = getSupabaseAdminClient()
  const permittedFolders = await listPermittedFolderRows(userId)
  const permittedFolderIds = permittedFolders.map(row => normalizeUuid(row.folder_id)).filter(Boolean) as string[]
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, description, sort_order, is_hidden, is_archived, metadata, created_at, updated_at, user_id")
    .or([
      `user_id.eq.${userId}`,
      ...(permittedFolderIds.length ? [`id.in.(${permittedFolderIds.join(",")})`] : [])
    ].join(","))
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data || []).map(folder => {
    const mappedFolder = mapFolderRow(folder as FolderRow)
    const permissionRow = permittedFolders.find(row => String(row.folder_id || "") === String(mappedFolder.id || "")) || null
    if (!permissionRow) return mappedFolder
    return {
      ...mappedFolder,
      accessRole: mapPermissionRole(permissionRow.role),
      accessStatus: mapPermissionStatus(permissionRow.status)
    }
  })
}

export async function upsertSupabaseFolder({ userId, folderId = null, name, description = "", isHidden = false, isArchived = false }: { userId: string, folderId?: string | null, name: unknown, description?: string, isHidden?: boolean, isArchived?: boolean }) {
  assertFolderName(name)
  const supabase = getSupabaseAdminClient()
  let currentMetadata: JsonObject = {}
  const normalizedFolderId = isUuid(folderId) ? String(folderId) : null

  if (normalizedFolderId) {
    const { data: existingFolder, error: existingFolderError } = await supabase
      .from("folders")
      .select("metadata")
      .eq("id", normalizedFolderId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingFolderError) throw existingFolderError
    currentMetadata = (existingFolder?.metadata && typeof existingFolder.metadata === "object") ? existingFolder.metadata as JsonObject : {}
  }

  const payload = {
    id: normalizedFolderId || undefined,
    user_id: userId,
    name: normalizeFolderName(name),
    description: String(description || "").trim(),
    is_hidden: !!isHidden,
    is_archived: !!isArchived,
    metadata: mergeFolderMetadata({ isHidden }, currentMetadata)
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
  const normalizedFolderId = normalizeUuid(folderId)
  if (!normalizedFolderId) {
    throw new Error("FOLDER_NOT_FOUND")
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
  const normalizedFolderId = normalizeUuid(folderId)
  if (!normalizedFolderId) {
    throw new Error("FOLDER_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", normalizedFolderId)
    .eq("user_id", userId)

  if (error) throw error
  return { id: normalizedFolderId }
}

export async function listSupabaseNotes(userId: string, userEmail: string, { limit = 500, offset = 0, startAfterId }: { limit?: number, offset?: number, startAfterId?: string } = {}) {
  const supabase = getSupabaseAdminClient()
  const from = Math.max(0, Number(offset) || 0)
  const to = from + Math.max(1, Number(limit) || 500) - 1
  const permittedNoteIds = (await listPermittedNoteIds(userId)).map(id => normalizeUuid(id)).filter(Boolean) as string[]
  const ownedFolderIds = await listOwnedFolderIds(userId)
  const permittedFolderRows = await listPermittedFolderRows(userId)
  const permittedFolderIds = [...new Set([
    ...ownedFolderIds,
    ...permittedFolderRows.map(row => normalizeUuid(row.folder_id)).filter(Boolean) as string[]
  ])]
  let query = supabase
    .from("notes")
    .select("*")
    .or([
      `user_id.eq.${userId}`,
      ...(permittedNoteIds.length ? [`id.in.(${permittedNoteIds.join(",")})`] : []),
      ...(permittedFolderIds.length ? [`folder_id.in.(${permittedFolderIds.join(",")})`] : [])
    ].join(","))

  const normalizedStartAfterId = normalizeUuid(startAfterId)
  if (normalizedStartAfterId) {
    const cursorAccess = await getNoteAccessRow(normalizedStartAfterId, userId, userEmail).catch(error => {
      if (String(error instanceof Error ? error.message : error || "") === "NOTE_NOT_FOUND") {
        return null
      }
      throw error
    })

    if (cursorAccess?.noteRow?.id) {
      const cursorUpdatedAt = cursorAccess.noteRow.updated_at || "1970-01-01T00:00:00.000Z"
      query = query.or(`updated_at.lt.${cursorUpdatedAt},and(updated_at.eq.${cursorUpdatedAt},id.lt.${normalizedStartAfterId})`)
    }
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)

  if (error) throw error
  const notePermissionRows = permittedNoteIds.length
    ? await supabase
      .from("note_permissions")
      .select("note_id, user_id, role, status, invited_by_user_id")
      .eq("user_id", userId)
      .eq("status", "accepted")
    : { data: [], error: null }

  if (notePermissionRows.error) throw notePermissionRows.error
  const notePermissionMap = new Map((notePermissionRows.data || []).map(row => [String(row.note_id || ""), row]))

  return (data || []).map(note => {
    const mappedNote = mapNoteRow(note as NoteRow)
    const permissionRow = notePermissionMap.get(String(mappedNote.id || "")) || null
    if (!permissionRow) return mappedNote
    return {
      ...mappedNote,
      accessRole: mapPermissionRole(permissionRow.role),
      accessStatus: mapPermissionStatus(permissionRow.status)
    }
  })
}

export async function upsertSupabaseNote({ userId, userEmail, note }: { userId: string, userEmail: string, note: NoteInput }) {
  const supabase = getSupabaseAdminClient()
  const payload = buildNotePayload(userId, note)

  if (payload.folder_id) {
    const folderAccess = await getFolderAccessRow(String(payload.folder_id || ""), userId, userEmail)

    if (!folderAccess?.folderId || (folderAccess.permission && folderAccess.permission.role !== "editor")) {
      throw new Error("FOLDER_NOT_FOUND")
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

export async function updateSupabaseNote({ userId, userEmail, noteId, note }: { userId: string, userEmail: string, noteId?: string | null, note: NoteInput }) {
  const normalizedNoteId = normalizeUuid(noteId || note?.id)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const currentNoteRow = await requireEditorNoteAccess(normalizedNoteId, userId, userEmail)

  const currentNote = currentNoteRow ? mapNoteRow(currentNoteRow as NoteRow) : null
  const payload = buildNotePayload(currentNoteRow.user_id, { ...(currentNote || {}), ...(note || {}), id: normalizedNoteId }, currentNoteRow.metadata || {})
  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", normalizedNoteId)
    .select("*")
    .single()

  if (error) throw error
  return mapNoteRow(data)
}

export async function patchSupabaseNote({ userId, userEmail, noteId, updates }: { userId: string, userEmail: string, noteId: string, updates: Record<string, unknown> }) {
  const normalizedNoteId = normalizeUuid(noteId)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const existingRow = await requireEditorNoteAccess(normalizedNoteId, userId, userEmail)

  const payload = buildNotePatchPayload(existingRow as NoteRow, {
    ...updates,
    id: normalizedNoteId
  })

  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", normalizedNoteId)
    .select("*")
    .single()

  if (error) throw error
  return mapNoteRow(data)
}

export async function deleteSupabaseNote(userId: string, userEmail: string, noteId: string) {
  const normalizedNoteId = normalizeUuid(noteId)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  await requireEditorNoteAccess(normalizedNoteId, userId, userEmail)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", normalizedNoteId)

  if (error) throw error
  return { id: normalizedNoteId }
}

export async function upsertSupabaseNotePermission({ noteId, userId, userEmail, collaboratorTarget, role }: SharePermissionInput) {
  const normalizedRole = role === "editor" ? "editor" : role === "viewer" ? "viewer" : ""
  const collaborator = await resolveCollaborator(collaboratorTarget)

  if (!normalizedRole || !collaborator.id) {
    throw new Error("BAD_REQUEST")
  }

  if (String(collaborator.id || "") === String(userId || "")) {
    throw new Error("BAD_REQUEST")
  }

  await requireOwnedNote(noteId, userId)

  const supabase = getSupabaseAdminClient()
  const payload = {
    note_id: String(noteId || "").trim(),
    user_id: String(collaborator.id || "").trim(),
    role: normalizedRole,
    status: "pending",
    invited_by_user_id: String(userId || "").trim()
  }

  const { data, error } = await supabase
    .from("note_permissions")
    .upsert(payload)
    .select("note_id, user_id, role, status, invited_by_user_id")
    .single()

  if (error) throw error
  return (await presentNotePermissions([data as NotePermissionRow]))[0] || null
}

export async function deleteSupabaseNotePermission({ noteId, userId, collaboratorTarget }: { noteId: string, userId: string, collaboratorTarget: string }) {
  const collaborator = await resolveCollaborator(collaboratorTarget)
  if (!collaborator.id) {
    throw new Error("BAD_REQUEST")
  }

  await requireOwnedNote(noteId, userId)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("note_permissions")
    .delete()
    .eq("note_id", String(noteId || "").trim())
    .eq("user_id", String(collaborator.id || "").trim())

  if (error) throw error
  return {
    note_id: String(noteId || "").trim(),
    user_id: String(collaborator.id || "")
  }
}

export async function listSupabaseNotePermissions({ noteId, userId }: { noteId: string, userId: string }) {
  await requireOwnedNote(noteId, userId)

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("note_permissions")
    .select("note_id, user_id, role, status, invited_by_user_id")
    .eq("note_id", String(noteId || "").trim())
    .order("created_at", { ascending: true })

  if (error) throw error
  return presentNotePermissions((data || []) as NotePermissionRow[])
}

async function requireOwnedFolder(folderId: string, userId: string) {
  const normalizedFolderId = normalizeUuid(folderId)
  if (!normalizedFolderId) {
    throw new Error("FOLDER_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folders")
    .select("id, user_id")
    .eq("id", normalizedFolderId)
    .maybeSingle()

  if (error) throw error
  if (!data?.id || data.user_id !== userId) {
    throw new Error("FOLDER_NOT_FOUND")
  }

  return data
}

export async function upsertSupabaseFolderPermission({ folderId, userId, userEmail, collaboratorTarget, role }: { folderId: string, userId: string, userEmail: string, collaboratorTarget: string, role: "viewer" | "editor" }) {
  const normalizedRole = role === "editor" ? "editor" : role === "viewer" ? "viewer" : ""
  const collaborator = await resolveCollaborator(collaboratorTarget)

  if (!normalizedRole || !collaborator.id) {
    throw new Error("BAD_REQUEST")
  }

  if (String(collaborator.id || "") === String(userId || "")) {
    throw new Error("BAD_REQUEST")
  }

  await requireOwnedFolder(folderId, userId)

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folder_permissions")
    .upsert({
      folder_id: String(folderId || "").trim(),
      user_id: String(collaborator.id || "").trim(),
      role: normalizedRole,
      status: "pending",
      invited_by_user_id: String(userId || "").trim()
    })
    .select("folder_id, user_id, role, status, invited_by_user_id")
    .single()

  if (error) throw error
  return (await presentFolderPermissions([data as FolderPermissionRow]))[0] || null
}

export async function deleteSupabaseFolderPermission({ folderId, userId, collaboratorTarget }: { folderId: string, userId: string, collaboratorTarget: string }) {
  const collaborator = await resolveCollaborator(collaboratorTarget)
  if (!collaborator.id) {
    throw new Error("BAD_REQUEST")
  }

  await requireOwnedFolder(folderId, userId)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("folder_permissions")
    .delete()
    .eq("folder_id", String(folderId || "").trim())
    .eq("user_id", String(collaborator.id || "").trim())

  if (error) throw error
  return {
    folder_id: String(folderId || "").trim(),
    user_id: String(collaborator.id || "")
  }
}

export async function listSupabaseFolderPermissions({ folderId, userId }: { folderId: string, userId: string }) {
  await requireOwnedFolder(folderId, userId)

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folder_permissions")
    .select("folder_id, user_id, role, status, invited_by_user_id")
    .eq("folder_id", String(folderId || "").trim())
    .order("created_at", { ascending: true })

  if (error) throw error
  return presentFolderPermissions((data || []) as FolderPermissionRow[])
}

export async function listSupabasePendingInvites(userId: string) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return []
  const supabase = getSupabaseAdminClient()

  const [{ data: noteRows, error: noteError }, { data: folderRows, error: folderError }] = await Promise.all([
    supabase
      .from("note_permissions")
      .select("note_id, user_id, role, status, invited_by_user_id")
      .eq("user_id", normalizedUserId)
      .eq("status", "pending"),
    supabase
      .from("folder_permissions")
      .select("folder_id, user_id, role, status, invited_by_user_id")
      .eq("user_id", normalizedUserId)
      .eq("status", "pending")
  ])

  if (noteError) throw noteError
  if (folderError) throw folderError

  const noteIds = (noteRows || []).map(row => normalizeUuid(row.note_id)).filter(Boolean) as string[]
  const folderIds = (folderRows || []).map(row => normalizeUuid(row.folder_id)).filter(Boolean) as string[]
  const inviterIds = [...new Set([
    ...(noteRows || []).map(row => String(row.invited_by_user_id || "")).filter(Boolean),
    ...(folderRows || []).map(row => String(row.invited_by_user_id || "")).filter(Boolean)
  ])]

  const [noteRowsResult, folderRowsResult, inviterProfiles] = await Promise.all([
    noteIds.length ? supabase.from("notes").select("id, title").in("id", noteIds) : Promise.resolve({ data: [], error: null }),
    folderIds.length ? supabase.from("folders").select("id, name").in("id", folderIds) : Promise.resolve({ data: [], error: null }),
    listProfilesByIds(inviterIds)
  ])

  if (noteRowsResult.error) throw noteRowsResult.error
  if (folderRowsResult.error) throw folderRowsResult.error

  const noteTitleMap = new Map((noteRowsResult.data || []).map(row => [String(row.id || ""), String(row.title || "")]))
  const folderTitleMap = new Map((folderRowsResult.data || []).map(row => [String(row.id || ""), String(row.name || "")]))
  const inviterMap = new Map(inviterProfiles.map(profile => [String(profile.id || ""), profile]))

  return [
    ...(noteRows || []).map(row => ({
      itemType: "note",
      itemId: String(row.note_id || ""),
      itemTitle: noteTitleMap.get(String(row.note_id || "")) || "Без названия",
      role: mapPermissionRole(row.role),
      status: "pending",
      invitedByUserId: String(row.invited_by_user_id || ""),
      invitedByDisplayName: buildDisplayName(inviterMap.get(String(row.invited_by_user_id || "")) || null, String(row.invited_by_user_id || ""))
    })),
    ...(folderRows || []).map(row => ({
      itemType: "folder",
      itemId: String(row.folder_id || ""),
      itemTitle: folderTitleMap.get(String(row.folder_id || "")) || "Папка",
      role: mapPermissionRole(row.role),
      status: "pending",
      invitedByUserId: String(row.invited_by_user_id || ""),
      invitedByDisplayName: buildDisplayName(inviterMap.get(String(row.invited_by_user_id || "")) || null, String(row.invited_by_user_id || ""))
    }))
  ]
}

export async function respondToSupabaseInvite({ userId, itemType, itemId, accept }: { userId: string, itemType: "note" | "folder", itemId: string, accept: boolean }) {
  const normalizedUserId = String(userId || "").trim()
  const normalizedItemId = String(itemId || "").trim()
  if (!normalizedUserId || !normalizedItemId) throw new Error("BAD_REQUEST")

  const supabase = getSupabaseAdminClient()
  const tableName = itemType === "folder" ? "folder_permissions" : "note_permissions"
  const idField = itemType === "folder" ? "folder_id" : "note_id"
  const { data, error } = await supabase
    .from(tableName)
    .update({ status: accept ? "accepted" : "rejected", updated_at: new Date().toISOString() })
    .eq(idField, normalizedItemId)
    .eq("user_id", normalizedUserId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("INVITE_NOT_FOUND")
  return data
}
