import { stripHtml } from "../providers/utils.js"

const GENERIC_FOLDER_NAMES = new Set(["ideas", "misc", "other", "прочее", "разное", "заметки"])

function trimText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function normalizeFolderCandidate(document) {
  const folderData = document.data()
  const name = trimText(folderData.name, 120)

  return {
    id: document.id,
    name,
    description: trimText(folderData.description, 300),
    isGeneric: GENERIC_FOLDER_NAMES.has(name.toLowerCase())
  }
}

function normalizeExistingTags(tags, maxItems) {
  return (Array.isArray(tags) ? tags : [])
    .map(tag => trimText(tag, 40))
    .filter(Boolean)
    .slice(0, maxItems)
}

function resolveSourceType(noteData) {
  if (typeof noteData.sourceType === "string" && noteData.sourceType.trim()) {
    return noteData.sourceType.trim().slice(0, 40)
  }

  return "note"
}

function resolveLanguage(noteData) {
  if (typeof noteData.language === "string" && noteData.language.trim()) {
    return noteData.language.trim().slice(0, 16)
  }

  return "unknown"
}

export function buildAnalysisUserContext({ userDocument }) {
  const userData = typeof userDocument?.data === "function" ? userDocument.data() : {}

  return {
    language: typeof userData?.lang === "string" && userData.lang.trim() ? userData.lang.trim().slice(0, 16) : "unknown"
  }
}

export function buildFolderCandidates(foldersSnapshot) {
  return foldersSnapshot.docs.map(normalizeFolderCandidate)
}

export function buildNoteInput(document, noteTextLimit) {
  const noteData = document.data()
  const cleanText = trimText(stripHtml(noteData.content || ""), noteTextLimit)
  const currentFolderId = typeof noteData.folderId === "string" && noteData.folderId
    ? noteData.folderId
    : typeof noteData.aiFolder === "string" && noteData.aiFolder
      ? noteData.aiFolder
      : null
  const currentUserTags = Array.isArray(noteData.tags) && noteData.tags.length
    ? noteData.tags
    : Array.isArray(noteData.aiTags)
      ? noteData.aiTags
      : []
  const analyzed = noteData.analyzed === true || noteData.aiProcessed === true

  return {
    id: document.id,
    title: trimText(noteData.title, 200),
    cleanText,
    createdAt: noteData.createdAt || null,
    updatedAt: noteData.updatedAt || null,
    currentFolderId,
    currentUserTags: normalizeExistingTags(currentUserTags, 5),
    currentHiddenTags: normalizeExistingTags(noteData.hiddenTags, 15),
    analyzed,
    sourceType: resolveSourceType(noteData),
    language: resolveLanguage(noteData),
    charCount: cleanText.length
  }
}

export function isNoteReadyForAnalysis(noteInput) {
  return Boolean(noteInput.title || noteInput.cleanText)
}
