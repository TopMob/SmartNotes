import { getSupabaseAdminClient } from "./admin"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type SupabaseFeedbackPayload = {
  type?: string | null
  uid?: string | null
  email?: string | null
  displayName?: string | null
  rating?: number | null
  text?: string | null
  answers?: JsonValue[] | null
  consoleLogs?: JsonValue | null
  userAgent?: string | null
  appVersion?: string | null
  language?: string | null
  createdAt?: string | null
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value)
  return normalized || null
}

function normalizeRating(value: unknown) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function normalizeAnswers(value: unknown) {
  return Array.isArray(value) ? value as JsonValue[] : null
}

function normalizeJson(value: unknown) {
  if (value === null) return null
  if (["string", "number", "boolean"].includes(typeof value)) return value as JsonValue
  if (Array.isArray(value)) return value as JsonValue
  if (value && typeof value === "object") return value as JsonValue
  return null
}

export async function createSupabaseFeedback(payload: SupabaseFeedbackPayload) {
  const supabase = getSupabaseAdminClient()
  const normalizedPayload = {
    type: normalizeString(payload?.type) || "feedback",
    uid: normalizeString(payload?.uid),
    email: normalizeNullableString(payload?.email),
    displayName: normalizeNullableString(payload?.displayName),
    rating: normalizeRating(payload?.rating),
    text: normalizeNullableString(payload?.text),
    answers: normalizeAnswers(payload?.answers),
    consoleLogs: normalizeJson(payload?.consoleLogs),
    userAgent: normalizeNullableString(payload?.userAgent),
    appVersion: normalizeNullableString(payload?.appVersion),
    language: normalizeNullableString(payload?.language),
    createdAt: normalizeNullableString(payload?.createdAt) || new Date().toISOString()
  }

  const { error } = await supabase.from("feedback").insert(normalizedPayload)
  if (error) throw error

  return normalizedPayload
}
