export const runtime = "nodejs"

import { timingSafeEqual } from "node:crypto"
import { readJsonObject } from "@/lib/http/jsonBody"
import { getAnalyzeDatabase } from "@/lib/supabase/analyze"
import { ANALYZE_PROVIDER, API_SECRET, CORS_HEADERS, PROMPT_VERSION } from "./core/config"
import { processUserNotes } from "./core/processor"

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()
    return normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes"
  }

  if (typeof value === "number") {
    return value === 1
  }

  return false
}

function isValidSecret(secret) {
  if (!API_SECRET || typeof secret !== "string") {
    return false
  }

  const providedSecret = Buffer.from(secret)
  const expectedSecret = Buffer.from(API_SECRET)

  if (providedSecret.length !== expectedSecret.length) {
    return false
  }

  return timingSafeEqual(providedSecret, expectedSecret)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS
  })
}

export async function POST(request) {
  const secret = request.headers.get("x-secret")

  if (!isValidSecret(secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: CORS_HEADERS
    })
  }

  const requestUrl = new URL(request.url)
  const requestPayload = await readJsonObject(request)
  const targetUid = String(requestPayload.uid ?? requestPayload.userId ?? requestUrl.searchParams.get("uid") ?? "").trim()
  const reindexAll = toBoolean(
    requestPayload.reindexAll ?? requestPayload.forceReindex ?? requestUrl.searchParams.get("reindexAll")
  )

  try {
    const database = getAnalyzeDatabase()
    let processedCount = 0
    let processedUsers = 0

    if (targetUid) {
      processedCount = await processUserNotes({
        database,
        uid: targetUid,
        reindexAll
      })
      processedUsers = 1
    } else {
      const userIds = await database.listUserIds()

      for (const uid of userIds) {
        processedCount += await processUserNotes({
          database,
          uid,
          reindexAll
        })
        processedUsers += 1
      }
    }

    if (processedCount <= 0) {
      return new Response(
        JSON.stringify({
          error: "Analyze produced no updates",
          details: "Provider returned no writable note updates",
          processed: processedCount,
          processedUsers,
          provider: ANALYZE_PROVIDER,
          uid: targetUid || null,
          reindexAll,
          promptVersion: PROMPT_VERSION
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS
          }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        processedUsers,
        provider: ANALYZE_PROVIDER,
        uid: targetUid || null,
        reindexAll,
        promptVersion: PROMPT_VERSION
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Analyze failed",
        details: String(error?.message || error)
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS
        }
      }
    )
  }
}
