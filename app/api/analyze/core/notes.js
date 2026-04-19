import { stripHtml } from "../providers/utils"

export function createNoteForPrompt(document, noteTextLimit) {
  const noteData = document.data()
  const isAnalyzed = noteData.analyzed === true || noteData.aiProcessed === true
  const activeFolderId =
    typeof noteData.folderId === "string" && noteData.folderId
      ? noteData.folderId
      : typeof noteData.aiFolder === "string" && noteData.aiFolder
        ? noteData.aiFolder
        : null
  const currentUserTags =
    Array.isArray(noteData.tags) && noteData.tags.length
      ? noteData.tags
      : Array.isArray(noteData.aiTags)
        ? noteData.aiTags
        : []

  return {
    id: document.id,
    title: noteData.title || "",
    text: stripHtml(noteData.content || "").slice(0, noteTextLimit),
    analyzed: isAnalyzed,
    currentFolderId: activeFolderId,
    currentUserTags,
    currentHiddenTags: Array.isArray(noteData.hiddenTags) ? noteData.hiddenTags : []
  }
}

export function isNoteReadyForAnalysis(note) {
  return Boolean(note.title || note.text)
}

export function shouldAnalyzeNote(note, reindexAll) {
  if (reindexAll) {
    return true
  }

  return note.analyzed !== true
}

export function resolveFolderId(sourceNote, analyzedItem, folderSet) {
  if (sourceNote.analyzed && sourceNote.currentFolderId) {
    return sourceNote.currentFolderId
  }

  if (folderSet.has(analyzedItem.folderId)) {
    return analyzedItem.folderId
  }

  return null
}

export function toAiFolderId(folderId) {
  return typeof folderId === "string" ? folderId : ""
}

export function isValidAnalyzedItem(analyzedItem) {
  if (!analyzedItem?.id) {
    return false
  }

  if (!Array.isArray(analyzedItem.userTags)) {
    return false
  }

  if (!Array.isArray(analyzedItem.hiddenTags)) {
    return false
  }

  return true
}
