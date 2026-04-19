export const API_SECRET = process.env.API_SECRET
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "https://topmob.github.io"
export const ANALYZE_PROVIDER = process.env.ANALYZE_PROVIDER || "gemini"
export const PROMPT_VERSION = "v3.1-balanced"

function toPositiveInteger(value, fallbackValue) {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    return fallbackValue
  }

  const normalized = Math.floor(parsedValue)
  return normalized > 0 ? normalized : fallbackValue
}

function toNonNegativeInteger(value, fallbackValue) {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    return fallbackValue
  }

  const normalized = Math.floor(parsedValue)
  return normalized >= 0 ? normalized : fallbackValue
}

export const CHUNK_SIZE = toPositiveInteger(process.env.ANALYZE_CHUNK_SIZE, 8)
export const NOTE_TEXT_LIMIT = toPositiveInteger(process.env.NOTE_TEXT_LIMIT, 1200)
export const RETRY_COUNT = toNonNegativeInteger(process.env.ANALYZE_RETRY_COUNT, 2)

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CLIENT_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-secret"
}
