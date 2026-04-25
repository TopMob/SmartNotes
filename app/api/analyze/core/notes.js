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
  return typeof folderId === "string" && folderId ? folderId : null
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

  if (typeof analyzedItem.resurfacingClass !== "string") {
    return false
  }

  return true
}
