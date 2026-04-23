import admin from "firebase-admin"
import { analyzeWithProvider } from "../providers"
import { clampRelevance, mergeAndNormalizeTags, normalizeAnalyzedItem } from "../providers/utils"
import {
  ANALYZE_PROVIDER,
  CHUNK_SIZE,
  NOTE_TEXT_LIMIT,
  PROMPT_VERSION,
  RETRY_COUNT
} from "./config"
import {
  createNoteForPrompt,
  isNoteReadyForAnalysis,
  isValidAnalyzedItem,
  resolveFolderId,
  shouldAnalyzeNote,
  toAiFolderId
} from "./notes"

async function analyzeChunk({ database, uid, folders, folderSet, notesChunk }) {
  let modelResult = null
  let attempt = 0
  let lastError = null

  while (!Array.isArray(modelResult) && attempt <= RETRY_COUNT) {
    try {
      modelResult = await analyzeWithProvider({
        providerName: ANALYZE_PROVIDER,
        folders,
        notes: notesChunk
      })
      lastError = null
    } catch (error) {
      lastError = error
      modelResult = null
      console.error("Analyze chunk provider request failed", {
        provider: ANALYZE_PROVIDER,
        uid,
        attempt: attempt + 1,
        notes: notesChunk.length,
        error: String(error?.message || error)
      })
    }
    attempt += 1
  }

  if (!Array.isArray(modelResult)) {
    console.error("Analyze chunk result is not a JSON array", {
      provider: ANALYZE_PROVIDER,
      uid,
      attempts: attempt,
      notes: notesChunk.length,
      lastError: lastError ? String(lastError?.message || lastError) : null
    })
    return 0
  }

  const notesById = new Map(notesChunk.map(note => [note.id, note]))
  const writeBatch = database.batch()
  let updatedCount = 0

  for (const rawAnalyzedItem of modelResult) {
    const analyzedItem = normalizeAnalyzedItem(rawAnalyzedItem)

    if (!isValidAnalyzedItem(analyzedItem)) {
      console.error("Analyze item has invalid shape", {
        provider: ANALYZE_PROVIDER,
        uid,
        item: rawAnalyzedItem
      })
      continue
    }

    const sourceNote = notesById.get(analyzedItem.id)
    if (!sourceNote) {
      continue
    }

    const noteReference = database.collection("users").doc(uid).collection("notes").doc(analyzedItem.id)

    const mergedUserTags = mergeAndNormalizeTags(sourceNote.currentUserTags, analyzedItem.userTags, 5)
    const mergedHiddenTags = mergeAndNormalizeTags(sourceNote.currentHiddenTags, analyzedItem.hiddenTags, 15)
    const normalizedRelevance = clampRelevance(analyzedItem.relevance)
    const resolvedFolderId = resolveFolderId(sourceNote, analyzedItem, folderSet)

    writeBatch.update(noteReference, {
      tags: mergedUserTags,
      hiddenTags: mergedHiddenTags,
      relevance: normalizedRelevance,
      folderId: resolvedFolderId,
      analyzed: true,
      analyzedBy: ANALYZE_PROVIDER,
      promptVersion: PROMPT_VERSION,
      aiTags: mergedUserTags,
      aiRelevance: normalizedRelevance,
      aiFolder: toAiFolderId(resolvedFolderId),
      aiProcessed: true,
      aiLastAnalyzed: admin.firestore.FieldValue.serverTimestamp()
    })

    updatedCount += 1
  }

  if (updatedCount > 0) {
    await writeBatch.commit()
  } else {
    console.error("Analyze chunk produced no writable updates", {
      provider: ANALYZE_PROVIDER,
      uid,
      notes: notesChunk.length,
      resultCount: modelResult.length
    })
  }

  return updatedCount
}

export async function processUserNotes({ database, uid, reindexAll }) {
  const foldersSnapshot = await database.collection("users").doc(uid).collection("folders").get()
  const folders = foldersSnapshot.docs.map(document => {
    const folderData = document.data()
    return {
      id: document.id,
      name: folderData.name || "",
      description: String(folderData.description || "").slice(0, 300)
    }
  })

  const folderSet = new Set(folders.map(folder => folder.id))
  const notesSnapshot = await database.collection("users").doc(uid).collection("notes").get()
  const notes = notesSnapshot.docs
    .map(document => createNoteForPrompt(document, NOTE_TEXT_LIMIT))
    .filter(note => shouldAnalyzeNote(note, reindexAll))
    .filter(isNoteReadyForAnalysis)

  if (!notes.length) {
    return 0
  }

  let totalUpdated = 0
  for (let startIndex = 0; startIndex < notes.length; startIndex += CHUNK_SIZE) {
    const notesChunk = notes.slice(startIndex, startIndex + CHUNK_SIZE)
    totalUpdated += await analyzeChunk({ database, uid, folders, folderSet, notesChunk })
  }

  return totalUpdated
}
