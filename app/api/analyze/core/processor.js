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
import { buildAnalysisUserContext, buildFolderCandidates, buildNoteInput, selectFolderCandidatesForNote } from "./contract.js"
import { ANALYSIS_CONTRACT_VERSION, ANALYSIS_MODEL_FAMILY, RESURFACING_CLASSES } from "../providers/schema.js"

async function analyzeSingleNote({ database, uid, userContext, allFolders, folderSet, note }) {
  let modelResult = null
  let attempt = 0
  let lastError = null
  let resolvedModelName = ""
  const candidateFolders = selectFolderCandidatesForNote(allFolders, note)

  while (!Array.isArray(modelResult) && attempt <= RETRY_COUNT) {
    try {
      const providerResult = await analyzeWithProvider({
        providerName: ANALYZE_PROVIDER,
        userContext,
        folders: candidateFolders,
        notes: [{
          ...note,
          folderCandidates: candidateFolders
        }]
      })
      modelResult = providerResult?.parsed || null
      resolvedModelName = String(providerResult?.model || "")
      lastError = null
    } catch (error) {
      lastError = error
      modelResult = null
      console.error("Analyze chunk provider request failed", {
        provider: ANALYZE_PROVIDER,
        uid,
        attempt: attempt + 1,
        notes: 1,
        noteId: note.id,
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
      notes: 1,
      noteId: note.id,
      lastError: lastError ? String(lastError?.message || lastError) : null
    })
    return 0
  }

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

    if (analyzedItem.id !== note.id) {
      continue
    }

    const noteReference = database.collection("users").doc(uid).collection("notes").doc(analyzedItem.id)

    const mergedUserTags = mergeAndNormalizeTags(note.currentUserTags, analyzedItem.userTags, 5)
    const mergedHiddenTags = mergeAndNormalizeTags(note.currentHiddenTags, analyzedItem.hiddenTags, 15)
    const normalizedRelevance = clampRelevance(analyzedItem.relevance)
    const resolvedFolderId = resolveFolderId(note, analyzedItem, folderSet)
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
      aiContractVersion: ANALYSIS_CONTRACT_VERSION,
      aiModelFamily: ANALYSIS_MODEL_FAMILY,
      aiModelVersion: resolvedModelName || ANALYZE_PROVIDER,
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
      notes: 1,
      noteId: note.id,
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
  const allFolders = buildFolderCandidates(foldersSnapshot)

  const folderSet = new Set(allFolders.map(folder => folder.id))
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
    for (const note of notesChunk) {
      totalUpdated += await analyzeSingleNote({ database, uid, userContext, allFolders, folderSet, note })
    }
  }

  return totalUpdated
}
