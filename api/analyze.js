import admin from "firebase-admin"
import { buildPrompt } from "../prompt.js"

const MAX_NOTES_PER_REQUEST = Number(process.env.MAX_NOTES_PER_REQUEST || 200)
const CHUNK_SIZE = Number(process.env.AI_CHUNK_SIZE || 12)
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90000)
const YANDEX_GPT_MODEL = process.env.YANDEX_GPT_MODEL || "gpt://yandexgpt-lite/latest"
const YANDEX_GPT_API_URL = process.env.YANDEX_GPT_API_URL || "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

function createCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, x-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  }
}

function resolveServiceAccount() {
  const serviceAccountText = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountText) {
    throw new Error("missing_firebase_service_account")
  }
  return JSON.parse(serviceAccountText)
}

function initializeAdminApp() {
  if (admin.apps.length) return admin.app()
  const serviceAccount = resolveServiceAccount()
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

function stripHtml(htmlValue) {
  return String(htmlValue || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function clampScore(value, minValue = 0, maxValue = 100) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return minValue
  const roundedValue = Math.round(numberValue)
  return Math.max(minValue, Math.min(maxValue, roundedValue))
}

function parseAiPayload(rawText) {
  const responseText = String(rawText || "").trim()
  if (!responseText) return []
  try {
    const parsed = JSON.parse(responseText)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const arrayMatch = responseText.match(/\[[\s\S]*\]/)
    if (!arrayMatch) return []
    try {
      const parsed = JSON.parse(arrayMatch[0])
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

function extractYandexText(responseBody) {
  const alternatives = Array.isArray(responseBody?.result?.alternatives) ? responseBody.result.alternatives : []
  const firstAlternative = alternatives[0] || {}
  const messageText = firstAlternative?.message?.text
  if (typeof messageText === "string") return messageText
  const directText = responseBody?.result?.text
  if (typeof directText === "string") return directText
  return ""
}

async function fetchWithTimeout(url, options, timeoutMilliseconds) {
  const controller = new AbortController()
  const timeoutIdentifier = setTimeout(() => controller.abort(), timeoutMilliseconds)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutIdentifier)
  }
}

async function callYandexGpt({ folders, notes }) {
  const iamToken = String(process.env.YANDEX_IAM_TOKEN || "").trim()
  const apiKey = String(process.env.YANDEX_API_KEY || "").trim()
  if (!iamToken && !apiKey) {
    throw new Error("missing_yandex_credentials")
  }
  const authHeaders = iamToken ? { Authorization: `Bearer ${iamToken}` } : { Authorization: `Api-Key ${apiKey}` }
  const prompt = buildPrompt(folders, notes)
  const requestBody = {
    modelUri: YANDEX_GPT_MODEL,
    completionOptions: {
      stream: false,
      temperature: 0,
      maxTokens: "2000"
    },
    messages: [
      {
        role: "user",
        text: prompt
      }
    ]
  }

  const response = await fetchWithTimeout(YANDEX_GPT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(requestBody)
  }, REQUEST_TIMEOUT_MS)

  if (!response.ok) {
    throw new Error(`yandex_http_${response.status}`)
  }

  const responseBody = await response.json()
  const textPayload = extractYandexText(responseBody)
  const parsedItems = parseAiPayload(textPayload)
  if (!parsedItems.length) {
    throw new Error("yandex_empty_payload")
  }
  return parsedItems
}

async function collectFolders(database, userId) {
  const foldersSnapshot = await database.collection("users").doc(userId).collection("folders").get()
  return foldersSnapshot.docs
    .map(documentEntry => {
      const folderData = documentEntry.data() || {}
      return {
        id: documentEntry.id,
        name: String(folderData.name || ""),
        description: String(folderData.description || "")
      }
    })
    .filter(folder => folder.id && folder.name)
}

async function collectPendingNotes(database, userId) {
  const notesSnapshot = await database.collection("users").doc(userId).collection("notes")
    .where("analyzed", "==", false)
    .limit(MAX_NOTES_PER_REQUEST)
    .get()

  return notesSnapshot.docs.map(documentEntry => {
    const noteData = documentEntry.data() || {}
    return {
      id: documentEntry.id,
      title: String(noteData.title || ""),
      text: stripHtml(noteData.content || ""),
      hasFolder: !!noteData.folderId,
      raw: noteData
    }
  }).filter(note => note.text)
}

function sanitizeTags(tagsValue, maxCount = 15) {
  if (!Array.isArray(tagsValue)) return []
  const uniqueTags = []
  const seenTags = new Set()
  for (const tag of tagsValue) {
    const normalizedTag = String(tag || "").trim()
    if (!normalizedTag) continue
    const lowerTag = normalizedTag.toLowerCase()
    if (seenTags.has(lowerTag)) continue
    seenTags.add(lowerTag)
    uniqueTags.push(normalizedTag)
    if (uniqueTags.length >= maxCount) break
  }
  return uniqueTags
}

async function updateChunk(database, userId, chunkNotes, chunkResults, validFolderIds) {
  const notesById = new Map(chunkNotes.map(note => [note.id, note]))
  const processedIds = new Set()
  const batch = database.batch()

  for (const item of chunkResults) {
    const noteId = String(item?.id || "").trim()
    if (!noteId || !notesById.has(noteId)) continue
    processedIds.add(noteId)
    const noteReference = database.collection("users").doc(userId).collection("notes").doc(noteId)
    const noteData = notesById.get(noteId)
    const nextFolderId = String(item?.folderId || "").trim()
    const updatePayload = {
      tags: sanitizeTags(item?.userTags, 10),
      hiddenTags: sanitizeTags(item?.hiddenTags, 20),
      relevance: clampScore(item?.relevance, 0, 100),
      analyzed: true,
      indexedAt: admin.firestore.FieldValue.serverTimestamp()
    }
    if (!noteData.hasFolder && nextFolderId && validFolderIds.has(nextFolderId)) {
      updatePayload.folderId = nextFolderId
    }
    batch.update(noteReference, updatePayload)
  }

  chunkNotes.forEach(note => {
    if (processedIds.has(note.id)) return
    const noteReference = database.collection("users").doc(userId).collection("notes").doc(note.id)
    batch.update(noteReference, {
      analyzed: false
    })
  })

  await batch.commit()
}

async function analyzeUser(database, userId) {
  const folders = await collectFolders(database, userId)
  const pendingNotes = await collectPendingNotes(database, userId)
  if (!pendingNotes.length) {
    return { processed: 0 }
  }
  const validFolderIds = new Set(folders.map(folder => folder.id))
  let processed = 0
  for (let index = 0; index < pendingNotes.length; index += CHUNK_SIZE) {
    const notesChunk = pendingNotes.slice(index, index + CHUNK_SIZE)
    if (!notesChunk.length) continue
    const aiResults = await callYandexGpt({ folders, notes: notesChunk })
    await updateChunk(database, userId, notesChunk, aiResults, validFolderIds)
    processed += notesChunk.length
  }
  return { processed }
}

async function resolveUserIds(database, requestedUserId) {
  if (requestedUserId) return [requestedUserId]
  const usersSnapshot = await database.collection("users").get()
  return usersSnapshot.docs.map(userDocument => String(userDocument.id || "")).filter(Boolean)
}

export default async function handler(request, response) {
  const corsHeaders = createCorsHeaders()
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value))

  if (request.method === "OPTIONS") {
    response.status(204).end()
    return
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }

  const expectedSecret = String(process.env.ADMIN_SECRET || "").trim()
  const receivedSecret = String(request.headers["x-secret"] || "").trim()
  if (!receivedSecret || !expectedSecret || receivedSecret !== expectedSecret) {
    response.status(401).json({ ok: false, error: "unauthorized" })
    return
  }

  try {
    initializeAdminApp()
    const database = admin.firestore()
    const requestBody = request.body && typeof request.body === "object" ? request.body : {}
    const requestedUserId = String(requestBody.uid || "").trim()
    const userIds = await resolveUserIds(database, requestedUserId)
    let totalProcessed = 0
    const userResults = []

    for (const userId of userIds) {
      const userResult = await analyzeUser(database, userId)
      totalProcessed += userResult.processed
      userResults.push({ uid: userId, processed: userResult.processed })
    }

    response.status(200).json({ ok: true, processed: totalProcessed, users: userResults })
  } catch (error) {
    const errorCode = String(error?.message || "analysis_failed")
    response.status(500).json({ ok: false, error: errorCode })
  }
}
