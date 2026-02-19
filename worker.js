import "dotenv/config"
import admin from "firebase-admin"
import fs from "fs"
import fetch from "node-fetch"
import { buildPrompt } from "./prompt.js"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b"
const ANALYSIS_BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 12)
const NOTE_TEXT_LIMIT = Number(process.env.NOTE_TEXT_LIMIT || 900)
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120000)

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

const database = admin.firestore()

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
    return parsedPayload
}

async function analyzeUserNotes(uid) {
    const foldersSnapshot = await database.collection("users").doc(uid).collection("folders").get()
    const folders = foldersSnapshot.docs
        .map(documentEntry => ({
            id: documentEntry.id,
            name: documentEntry.data()?.name || ""
        }))
        .filter(folder => folder.id && folder.name)

    const availableFolderIds = new Set(folders.map(folder => folder.id))
    const notesSnapshot = await database.collection("users").doc(uid).collection("notes").get()
    if (notesSnapshot.empty) return

    const allNotes = notesSnapshot.docs
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

    for (let index = 0; index < allNotes.length; index += ANALYSIS_BATCH_SIZE) {
        const notesChunk = allNotes.slice(index, index + ANALYSIS_BATCH_SIZE)
        let analysisResults
        try {
            analysisResults = await analyzeChunkWithOllama(folders, notesChunk)
        } catch {
            continue
        }

        const batch = database.batch()

        for (const analysisResult of analysisResults) {
            const noteId = String(analysisResult?.id || "").trim()
            if (!noteId) continue
            const noteReference = database.collection("users").doc(uid).collection("notes").doc(noteId)
            const noteFromChunk = notesChunk.find(note => note.id === noteId)

            batch.update(noteReference, {
                aiProcessed: true,
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
            })

            if (noteFromChunk && !noteFromChunk.hasFolder) {
                const candidateFolderId = String(analysisResult?.folderId || "").trim()
                if (candidateFolderId && availableFolderIds.has(candidateFolderId)) {
                    batch.update(noteReference, { folderId: candidateFolderId })
                }
            }
        }

        await batch.commit()
    }
}

database.collection("tasks")
    .where("status", "==", "pending")
    .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type !== "added") return
            const taskData = change.doc.data() || {}
            const uid = String(taskData.uid || "").trim()
            if (!uid) {
                change.doc.ref.update({ status: "error", errorCode: "missing_uid", finishedAt: admin.firestore.FieldValue.serverTimestamp() })
                return
            }
            change.doc.ref.update({ status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp() })
                .then(() => analyzeUserNotes(uid))
                .then(() => {
                    return change.doc.ref.update({
                        status: "done",
                        model: OLLAMA_MODEL,
                        finishedAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                })
                .catch(() => {
                    change.doc.ref.update({
                        status: "error",
                        model: OLLAMA_MODEL,
                        finishedAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                })
        })
    })

console.log(`Worker listening for tasks with model ${OLLAMA_MODEL}`)
