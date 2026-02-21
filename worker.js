import "dotenv/config"
import admin from "firebase-admin"
import fetch from "node-fetch"
import { buildPrompt } from "./prompt.js"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b"
const ANALYSIS_BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 12)
const NOTE_TEXT_LIMIT = Number(process.env.NOTE_TEXT_LIMIT || 900)
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120000)
const MAX_NOTES_PER_TASK = 200
const MAX_BATCH_OPERATIONS = 400

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("[Worker] Missing FIREBASE_SERVICE_ACCOUNT environment variable")
    process.exit(1)
}

let serviceAccount
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
} catch {
    console.error("[Worker] FIREBASE_SERVICE_ACCOUNT must contain valid JSON")
    process.exit(1)
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

const database = admin.firestore()
const activeTaskIds = new Set()
const activeUserAnalysisLocks = new Set()

function stripHtml(html) {
    if (!html) return ""
    return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function clampInteger(value, minimumValue, maximumValue) {
    const numericValue = Number(value)
    const integerValue = Number.isFinite(numericValue) ? Math.trunc(numericValue) : minimumValue
    return Math.max(minimumValue, Math.min(maximumValue, integerValue))
}

function parseModelResponse(rawText) {
    if (!rawText) return null
    const trimmedText = String(rawText).trim()
    try {
        return JSON.parse(trimmedText)
    } catch {
        const arrayMatch = trimmedText.match(/\[[\s\S]*\]/)
        if (!arrayMatch) return null
        return JSON.parse(arrayMatch[0])
    }
}

async function fetchWithTimeout(url, options, timeoutMs) {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: abortController.signal })
    } finally {
        clearTimeout(timeoutId)
    }
}

async function analyzeChunkWithOllama(folders, notesChunk) {
    console.log(`[Worker] AI request started for ${notesChunk.length} notes`)
    const prompt = buildPrompt(folders, notesChunk)
    const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            format: "json",
            options: { temperature: 0 },
            prompt
        })
    }, REQUEST_TIMEOUT_MS)

    if (!response.ok) {
        throw new Error(`ollama_http_${response.status}`)
    }

    const responseBody = await response.json()
    const parsedPayload = parseModelResponse(responseBody.response)
    if (!Array.isArray(parsedPayload)) {
        throw new Error("ollama_invalid_payload")
    }
    console.log(`[Worker] AI request finished for ${notesChunk.length} notes`)
    return parsedPayload
}

async function fetchPendingNotes(uid) {
    const notesCollection = database.collection("users").doc(uid).collection("notes")
    const snapshotByAnalyzedFlag = await notesCollection.where("analyzed", "==", false).get()
    return snapshotByAnalyzedFlag.docs.filter(documentEntry => {
        const noteData = documentEntry.data() || {}
        return noteData.analyzed !== true
    })
}

function mapNotesForAnalysis(noteDocuments) {
    return noteDocuments
        .map(documentEntry => {
            const noteData = documentEntry.data() || {}
            const noteText = stripHtml(noteData.content || "").slice(0, NOTE_TEXT_LIMIT)
            return {
                id: documentEntry.id,
                title: String(noteData.title || ""),
                text: noteText,
                hasFolder: !!noteData.folderId
            }
        })
        .filter(note => note.text)
}

async function markChunkAnalysisError(uid, notesChunk, errorCode) {
    if (!notesChunk.length) return
    await commitBatchOperations(uid, notesChunk.map(note => ({
        id: note.id,
        payload: {
            analyzed: false,
            aiProcessed: false,
            aiError: true,
            aiErrorCode: errorCode,
            aiErrorAt: admin.firestore.FieldValue.serverTimestamp()
        }
    })))
}

async function commitBatchOperations(uid, operations) {
    const normalizedOperations = Array.isArray(operations) ? operations : []
    for (let index = 0; index < normalizedOperations.length; index += MAX_BATCH_OPERATIONS) {
        const operationsChunk = normalizedOperations.slice(index, index + MAX_BATCH_OPERATIONS)
        if (!operationsChunk.length) continue
        const batch = database.batch()
        operationsChunk.forEach(operation => {
            const noteReference = database.collection("users").doc(uid).collection("notes").doc(operation.id)
            batch.update(noteReference, operation.payload)
        })
        await batch.commit()
    }
}

async function analyzeUserNotes(uid, mode = "pending") {
    const foldersSnapshot = await database.collection("users").doc(uid).collection("folders").get()
    const folders = foldersSnapshot.docs
        .map(documentEntry => ({
            id: documentEntry.id,
            name: documentEntry.data()?.name || "",
            description: documentEntry.data()?.description || ""
        }))
        .filter(folder => folder.id && folder.name)

    const availableFolderIds = new Set(folders.map(folder => folder.id))
    const noteDocuments = (await fetchPendingNotes(uid)).slice(0, MAX_NOTES_PER_TASK)
    if (!noteDocuments.length) return

    const allNotes = mapNotesForAnalysis(noteDocuments)
    if (!allNotes.length) {
        console.log(`[Worker] No notes with content to analyze for uid=${uid}`)
        return
    }

    for (let index = 0; index < allNotes.length; index += ANALYSIS_BATCH_SIZE) {
        const notesChunk = allNotes.slice(index, index + ANALYSIS_BATCH_SIZE)
        if (!notesChunk.length) continue
        let analysisResults
        try {
            analysisResults = await analyzeChunkWithOllama(folders, notesChunk)
        } catch (error) {
            const normalizedErrorCode = String(error?.message || "analysis_failed").trim() || "analysis_failed"
            console.error(`[Worker] AI chunk failed for uid=${uid}: ${normalizedErrorCode}`)
            await markChunkAnalysisError(uid, notesChunk, normalizedErrorCode)
            continue
        }

        if (!analysisResults.length) {
            console.error(`[Worker] Empty AI payload for uid=${uid}`)
            await markChunkAnalysisError(uid, notesChunk, "empty_ai_payload")
            continue
        }

        const batchOperations = []
        const notesById = new Map(notesChunk.map(note => [note.id, note]))
        const processedNoteIds = new Set()

        for (const analysisResult of analysisResults) {
            const noteId = String(analysisResult?.id || "").trim()
            if (!noteId) continue
            if (!notesById.has(noteId)) continue
            const noteFromChunk = notesById.get(noteId)
            processedNoteIds.add(noteId)

            batchOperations.push({
                id: noteId,
                payload: {
                analyzed: true,
                aiProcessed: true,
                indexedAt: admin.firestore.FieldValue.serverTimestamp(),
                aiError: admin.firestore.FieldValue.delete(),
                aiErrorCode: admin.firestore.FieldValue.delete(),
                aiErrorAt: admin.firestore.FieldValue.delete(),
                aiRelevance: clampInteger(analysisResult?.relevance, 0, 100),
                aiTagsVisible: Array.isArray(analysisResult?.userTags)
                    ? analysisResult.userTags.map(tag => String(tag || "").trim()).filter(Boolean).slice(0, 5)
                    : [],
                aiTagsHidden: Array.isArray(analysisResult?.hiddenTags)
                    ? analysisResult.hiddenTags.map(tag => String(tag || "").trim()).filter(Boolean).slice(0, 15)
                    : [],
                aiVersion: 1,
                aiModel: OLLAMA_MODEL,
                aiLastAnalyzed: admin.firestore.FieldValue.serverTimestamp()
                }
            })

            if (noteFromChunk && !noteFromChunk.hasFolder) {
                const candidateFolderId = String(analysisResult?.folderId || "").trim()
                if (candidateFolderId && availableFolderIds.has(candidateFolderId)) {
                    batchOperations.push({ id: noteId, payload: { folderId: candidateFolderId } })
                }
            }
        }

        notesChunk.forEach(note => {
            if (processedNoteIds.has(note.id)) return
            batchOperations.push({
                id: note.id,
                payload: {
                    analyzed: false,
                    aiProcessed: false,
                    aiError: true,
                    aiErrorCode: "invalid_ai_entry",
                    aiErrorAt: admin.firestore.FieldValue.serverTimestamp()
                }
            })
        })

        if (batchOperations.length) await commitBatchOperations(uid, batchOperations)
    }
}

async function hasActiveProcessingTaskForUser(uid, currentTaskId) {
    const snapshot = await database.collection("tasks")
        .where("uid", "==", uid)
        .where("status", "==", "processing")
        .get()
    return snapshot.docs.some(documentEntry => documentEntry.id !== currentTaskId)
}

database.collection("tasks")
    .where("status", "==", "pending")
    .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type !== "added") return
            const taskIdentifier = String(change.doc.id || "")
            if (!taskIdentifier || activeTaskIds.has(taskIdentifier)) return
            activeTaskIds.add(taskIdentifier)

            ;(async () => {
                const taskData = change.doc.data() || {}
                const uid = String(taskData.uid || "").trim()
                if (!uid) {
                    await change.doc.ref.update({ status: "failed", errorCode: "missing_uid", processedAt: admin.firestore.FieldValue.serverTimestamp() })
                    return
                }

                const mode = "pending"
                const executionLockKey = uid
                if (activeUserAnalysisLocks.has(executionLockKey)) {
                    await change.doc.ref.update({
                        status: "failed",
                        model: OLLAMA_MODEL,
                        errorCode: "analysis_in_progress",
                        processedAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                    return
                }

                const hasRemoteProcessingTask = await hasActiveProcessingTaskForUser(uid, taskIdentifier)
                if (hasRemoteProcessingTask) {
                    await change.doc.ref.update({
                        status: "failed",
                        model: OLLAMA_MODEL,
                        errorCode: "analysis_in_progress",
                        processedAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                    return
                }

                activeUserAnalysisLocks.add(executionLockKey)
                console.log(`[Worker] Task started id=${taskIdentifier} uid=${uid} mode=${mode}`)
                try {
                    await change.doc.ref.update({ status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp() })
                    await analyzeUserNotes(uid, mode)
                    await change.doc.ref.update({
                        status: "done",
                        model: OLLAMA_MODEL,
                        processedAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                    console.log(`[Worker] Task finished id=${taskIdentifier} uid=${uid} mode=${mode}`)
                } catch (error) {
                    const normalizedErrorCode = String(error?.message || "analysis_task_failed").trim() || "analysis_task_failed"
                    console.error(`[Worker] Task failed id=${taskIdentifier} uid=${uid} mode=${mode}: ${normalizedErrorCode}`)
                    await change.doc.ref.update({
                        status: "failed",
                        model: OLLAMA_MODEL,
                        errorCode: normalizedErrorCode,
                        processedAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                } finally {
                    activeUserAnalysisLocks.delete(executionLockKey)
                    activeTaskIds.delete(taskIdentifier)
                }
            })()
        })
    })

console.log(`Worker listening for tasks with model ${OLLAMA_MODEL}`)
