import admin from "firebase-admin"
import { analyzeWithProvider } from "../providers/index.js"
import { clampRelevance, mergeAndNormalizeTags, normalizeAnalyzedItem, normalizeTagArray } from "../providers/utils.js"
import {
  ANALYZE_PROVIDER,
  CHUNK_SIZE,
  NOTE_TEXT_LIMIT,
  PROMPT_VERSION,
  RETRY_COUNT
} from "./config.js"
import {
  isNoteReadyForAnalysis,
  isValidAnalyzedItem,
  resolveFolderId,
  shouldAnalyzeNote,
  toAiFolderId
} from "./notes.js"
import { buildAnalysisUserContext, buildFolderCandidates, buildNoteInput } from "./contract.js"
import { RESURFACING_CLASSES } from "../providers/schema.js"

async function analyzeChunk({ database, uid, userContext, folders, folderSet, notesChunk }) {
  let modelResult = null
  let attempt = 0
  let lastError = null

  while (!Array.isArray(modelResult) && attempt <= RETRY_COUNT) {
    try {
      modelResult = await analyzeWithProvider({
        providerName: ANALYZE_PROVIDER,
        userContext,
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
    const resurfacingClass = RESURFACING_CLASSES.includes(analyzedItem.resurfacingClass)
      ? analyzedItem.resurfacingClass
      : "reference"

    writeBatch.update(noteReference, {
      tags: normalizeTagArray(mergedUserTags, 5),
      hiddenTags: normalizeTagArray(mergedHiddenTags, 15),
      relevance: normalizedRelevance,
      folderId: resolvedFolderId,
      analyzed: true,
      analyzedBy: ANALYZE_PROVIDER,
      promptVersion: PROMPT_VERSION,
      aiTags: normalizeTagArray(mergedUserTags, 5),
      aiRelevance: normalizedRelevance,
      aiFolder: toAiFolderId(resolvedFolderId),
      aiResurfacingClass: resurfacingClass,
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
  const userReference = database.collection("users").doc(uid)
  const [userDocument, foldersSnapshot, notesSnapshot] = await Promise.all([
    userReference.get(),
    userReference.collection("folders").get(),
    userReference.collection("notes").get()
  ])

  const userContext = buildAnalysisUserContext({ userDocument })
  const folders = buildFolderCandidates(foldersSnapshot)

  const folderSet = new Set(folders.map(folder => folder.id))
  const notes = notesSnapshot.docs
    .map(document => buildNoteInput(document, NOTE_TEXT_LIMIT))
    .filter(note => shouldAnalyzeNote(note, reindexAll))
    .filter(isNoteReadyForAnalysis)

  if (!notes.length) {
    return 0
  }

  let totalUpdated = 0
  for (let startIndex = 0; startIndex < notes.length; startIndex += CHUNK_SIZE) {
    const notesChunk = notes.slice(startIndex, startIndex + CHUNK_SIZE)
    totalUpdated += await analyzeChunk({ database, uid, userContext, folders, folderSet, notesChunk })
  }

  return totalUpdated
}
