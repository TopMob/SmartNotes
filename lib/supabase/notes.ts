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

type NoteShareRow = {
  id: string
  note_id: string
  owner_user_id: string
  shared_with_user_id: string
  role: string | null
  status: string | null
  invited_by_user_id: string | null
  created_at: string | null
  updated_at: string | null
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

async function getAuthUserById(userId: string) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return null

  const supabase = getSupabaseAdminClient()
  const getUserById = supabase.auth.admin.getUserById?.bind(supabase.auth.admin)
  if (typeof getUserById === "function") {
    const { data, error } = await getUserById(normalizedUserId)
    if (!error && data?.user?.id) {
      return {
        id: String(data.user.id || ""),
        email: normalizeEmail(data.user.email || ""),
        displayName: String(data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || "").trim(),
        photoURL: String(data.user.user_metadata?.avatar_url || "").trim(),
        uid: String(data.user.id || "")
      }
    }
  }

  let page = 1
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error("COLLABORATOR_NOT_FOUND")
    const users = Array.isArray(data?.users) ? data.users : []
    const matchedUser = users.find(user => String(user?.id || "") === normalizedUserId) || null
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

async function resolveProfileById(userId: string) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return null

  const profile = await getSupabaseProfile(normalizedUserId).catch(() => null)
  if (profile?.id) return profile

  const authUser = await getAuthUserById(normalizedUserId)
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
    payload.folder_id = updates.folderId ? normalizeUuid(updates.folderId) : null
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

function normalizeShareRole(value: unknown) {
  return String(value || "").trim().toLowerCase() === "editor" ? "editor" : "viewer"
}

function normalizeShareStatus(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase()
  return ["pending", "accepted", "rejected"].includes(normalized) ? normalized : "accepted"
}

function mapSharedNoteRow(note: NoteRow, shareRow: NoteShareRow, invitedByDisplayName = "") {
  const mapped = mapNoteRow(note)
  return {
    ...mapped,
    accessRole: normalizeShareRole(shareRow.role),
    accessStatus: normalizeShareStatus(shareRow.status),
    invitedByDisplayName
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

async function getFolderAccessRow(folderId: string, userId: string) {
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
      ownerId: String(folderRow.user_id || "")
    }
  }

  throw new Error("FOLDER_NOT_FOUND")
}

async function getNoteAccessRow(noteId: string, userId: string) {
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
    return { noteRow: noteRow as NoteRow }
  }

  const { data: shareRow, error: shareError } = await supabase
    .from("note_shares")
    .select("*")
    .eq("note_id", normalizedNoteId)
    .eq("shared_with_user_id", userId)
    .eq("status", "accepted")
    .maybeSingle()

  if (shareError) throw shareError
  if (shareRow?.id) {
    return {
      noteRow: noteRow as NoteRow,
      shareRow: shareRow as NoteShareRow
    }
  }

  throw new Error("NOTE_NOT_FOUND")
}

async function requireEditorNoteAccess(noteId: string, userId: string) {
  const access = await getNoteAccessRow(noteId, userId)
  if (access.noteRow.user_id === userId) {
    return access.noteRow
  }

  if (normalizeShareRole(access.shareRow?.role) !== "editor") {
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

export async function listAccessibleSupabaseFolders(userId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, description, sort_order, is_hidden, is_archived, metadata, created_at, updated_at, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data || []).map(folder => mapFolderRow(folder as FolderRow))
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
  let query = supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)

  const normalizedStartAfterId = normalizeUuid(startAfterId)
  if (normalizedStartAfterId) {
    const cursorAccess = await getNoteAccessRow(normalizedStartAfterId, userId).catch(error => {
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

  if (error) throw error

  const ownedNotes = (data || []).map(note => mapNoteRow(note as NoteRow))
  const { data: shareRows, error: shareError } = await supabase
    .from("note_shares")
    .select("*")
    .eq("shared_with_user_id", userId)
    .eq("status", "accepted")

  if (shareError) throw shareError

  const acceptedShares = (shareRows || []) as NoteShareRow[]
  if (!acceptedShares.length) {
    const from = Math.max(0, Number(offset) || 0)
    const to = from + Math.max(1, Number(limit) || 500)
    return ownedNotes.slice(from, to)
  }

  const sharedNoteIds = [...new Set(acceptedShares.map(share => normalizeUuid(share.note_id)).filter(Boolean))] as string[]
  const { data: sharedNotesData, error: sharedNotesError } = await supabase
    .from("notes")
    .select("*")
    .in("id", sharedNoteIds)

  if (sharedNotesError) throw sharedNotesError

  const profileIds = [...new Set(acceptedShares.map(share => String(share.invited_by_user_id || "").trim()).filter(Boolean))]
  const profiles = await listProfilesByIds(profileIds)
  const profileMap = new Map(profiles.map(profile => [profile.id, mapProfileRow(profile)?.displayName || profile.email || ""]))
  const shareMap = new Map(acceptedShares.map(share => [share.note_id, share]))
  const sharedNotes = (sharedNotesData || [])
    .map(note => {
      const share = shareMap.get(String((note as NoteRow).id || ""))
      if (!share?.id) return null
      return mapSharedNoteRow(note as NoteRow, share, profileMap.get(String(share.invited_by_user_id || "")) || "")
    })
    .filter(Boolean)

  const mergedNotes = [...ownedNotes, ...sharedNotes]
    .sort((left, right) => {
      const leftTime = Date.parse(String(left?.updatedAt || left?.createdAt || "")) || 0
      const rightTime = Date.parse(String(right?.updatedAt || right?.createdAt || "")) || 0
      if (rightTime !== leftTime) return rightTime - leftTime
      return String(right?.id || "").localeCompare(String(left?.id || ""))
    })

  const from = Math.max(0, Number(offset) || 0)
  const to = from + Math.max(1, Number(limit) || 500)
  return mergedNotes.slice(from, to)
}

export async function listSupabaseNoteAccess(noteId: string, userId: string) {
  const ownedNote = await requireOwnedNote(noteId, userId)
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("note_shares")
    .select("*")
    .eq("note_id", ownedNote.id)
    .order("created_at", { ascending: true })

  if (error) throw error

  const rows = (data || []) as NoteShareRow[]
  const profileIds = [...new Set(rows.flatMap(row => [row.shared_with_user_id, row.invited_by_user_id || ""]).filter(Boolean))]
  const profiles = await listProfilesByIds(profileIds)
  const profileMap = new Map(profiles.map(profile => [profile.id, mapProfileRow(profile)]))

  return rows.map(row => {
    const collaborator = profileMap.get(row.shared_with_user_id)
    const inviter = profileMap.get(String(row.invited_by_user_id || ""))
    return {
      id: row.id,
      userId: row.shared_with_user_id,
      email: collaborator?.email || "",
      displayName: collaborator?.displayName || collaborator?.email || row.shared_with_user_id,
      role: normalizeShareRole(row.role),
      status: normalizeShareStatus(row.status),
      invitedByDisplayName: inviter?.displayName || inviter?.email || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  })
}

export async function shareSupabaseNote({ noteId, ownerUserId, ownerEmail = "", ownerDisplayName = "", ownerAvatarUrl = "", target, role }: { noteId: string, ownerUserId: string, ownerEmail?: string, ownerDisplayName?: string, ownerAvatarUrl?: string, target: string, role: string }) {
  const ownedNote = await requireOwnedNote(noteId, ownerUserId)
  const normalizedTarget = String(target || "").trim()
  if (!normalizedTarget) {
    throw new Error("COLLABORATOR_NOT_FOUND")
  }

  const collaborator = normalizedTarget.includes("@")
    ? await resolveProfileByEmail(normalizedTarget)
    : await resolveProfileById(normalizedTarget)

  if (!collaborator?.id) {
    throw new Error("COLLABORATOR_NOT_FOUND")
  }

  if (String(collaborator.id || "") === String(ownerUserId || "")) {
    throw new Error("CANNOT_SHARE_WITH_SELF")
  }

  await ensureSupabaseProfile({
    userId: ownerUserId,
    email: ownerEmail,
    displayName: ownerDisplayName,
    avatarUrl: ownerAvatarUrl
  })

  await ensureSupabaseProfile({
    userId: collaborator.id,
    email: collaborator.email || "",
    displayName: collaborator.displayName || "",
    avatarUrl: collaborator.photoURL || ""
  })

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("note_shares")
    .upsert({
      note_id: ownedNote.id,
      owner_user_id: ownerUserId,
      shared_with_user_id: collaborator.id,
      role: normalizeShareRole(role),
      status: "accepted",
      invited_by_user_id: ownerUserId
    }, { onConflict: "note_id,shared_with_user_id" })

  if (error) throw error
  return listSupabaseNoteAccess(ownedNote.id, ownerUserId)
}

export async function revokeSupabaseNoteAccess({ noteId, ownerUserId, target }: { noteId: string, ownerUserId: string, target: string }) {
  const ownedNote = await requireOwnedNote(noteId, ownerUserId)
  const normalizedTarget = String(target || "").trim()
  if (!normalizedTarget) {
    throw new Error("COLLABORATOR_NOT_FOUND")
  }

  const collaborator = normalizedTarget.includes("@")
    ? await resolveProfileByEmail(normalizedTarget)
    : await resolveProfileById(normalizedTarget)

  if (!collaborator?.id) {
    throw new Error("COLLABORATOR_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("note_shares")
    .delete()
    .eq("note_id", ownedNote.id)
    .eq("shared_with_user_id", collaborator.id)

  if (error) throw error
  return { noteId: ownedNote.id, userId: collaborator.id }
}

export async function upsertSupabaseNote({ userId, note }: { userId: string, userEmail: string, note: NoteInput }) {
  const supabase = getSupabaseAdminClient()
  const normalizedNoteId = normalizeUuid(note?.id)

  if (normalizedNoteId) {
    const existingAccess = await getNoteAccessRow(normalizedNoteId, userId).catch(error => {
      if (String(error instanceof Error ? error.message : error || "") === "NOTE_NOT_FOUND") {
        return null
      }
      throw error
    })

    if (existingAccess?.noteRow?.id) {
      if (existingAccess.noteRow.user_id !== userId && normalizeShareRole(existingAccess.shareRow?.role) !== "editor") {
        throw new Error("NOTE_NOT_FOUND")
      }

      const currentNote = mapNoteRow(existingAccess.noteRow as NoteRow)
      const payload = buildNotePayload(existingAccess.noteRow.user_id, { ...(currentNote || {}), ...(note || {}), id: normalizedNoteId }, existingAccess.noteRow.metadata || {})
      const { data, error } = await supabase
        .from("notes")
        .update(payload)
        .eq("id", normalizedNoteId)
        .select("*")
        .single()

      if (error) throw error
      return mapNoteRow(data)
    }
  }

  const payload = buildNotePayload(userId, note)

  if (payload.folder_id) {
    const folderAccess = await getFolderAccessRow(String(payload.folder_id || ""), userId)

    if (!folderAccess?.folderId) {
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

export async function updateSupabaseNote({ userId, noteId, note }: { userId: string, noteId?: string | null, note: NoteInput }) {
  const normalizedNoteId = normalizeUuid(noteId || note?.id)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const currentNoteRow = await requireEditorNoteAccess(normalizedNoteId, userId)

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

export async function patchSupabaseNote({ userId, noteId, updates }: { userId: string, noteId: string, updates: Record<string, unknown> }) {
  const normalizedNoteId = normalizeUuid(noteId)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  const supabase = getSupabaseAdminClient()
  const existingRow = await requireEditorNoteAccess(normalizedNoteId, userId)

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

export async function deleteSupabaseNote(userId: string, noteId: string) {
  const normalizedNoteId = normalizeUuid(noteId)
  if (!normalizedNoteId) {
    throw new Error("NOTE_NOT_FOUND")
  }

  await requireOwnedNote(normalizedNoteId, userId)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", normalizedNoteId)

  if (error) throw error
  return { id: normalizedNoteId }
}


