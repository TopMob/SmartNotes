const SIMILAR_TAG_GROUPS = [
  ["ai", "ии", "нейросети", "искусственный интеллект"],
  ["работа", "карьера", "профессия"],
  ["финансы", "деньги", "бюджет"],
  ["проект", "проектирование", "разработка"]
]

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function canonicalTag(value) {
  const key = normalizeKey(value)
  if (!key) return ""

  for (const group of SIMILAR_TAG_GROUPS) {
    if (group.includes(key)) {
      return group[0]
    }
  }

  return key
}

export function stripHtml(content) {
  return String(content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function cleanModelText(value) {
  return String(value || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim()
}

export function safeParseJsonArray(rawText) {
  const cleaned = cleanModelText(rawText)

  const normalizeParsedArray = (parsed) => {
    if (Array.isArray(parsed)) return parsed
    if (!parsed || typeof parsed !== "object") return null

    const candidates = [parsed.items, parsed.results, parsed.notes, parsed.data, parsed.output]
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate
    }

    return null
  }

  try {
    const parsed = JSON.parse(cleaned)
    const normalizedArray = normalizeParsedArray(parsed)
    if (Array.isArray(normalizedArray)) return normalizedArray
  } catch {}

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (!arrayMatch) return null

  try {
    const parsed = JSON.parse(arrayMatch[0])
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function normalizeAnalyzedItem(value) {
  if (!value || typeof value !== "object") {
    return null
  }

  const item = value
  const toArray = (...values) => {
    for (const candidate of values) {
      if (Array.isArray(candidate)) return candidate
      if (typeof candidate === "string" && candidate.trim()) return [candidate.trim()]
    }
    return []
  }

  return {
    id: typeof item.id === "string"
      ? item.id
      : typeof item.noteId === "string"
        ? item.noteId
        : typeof item.note_id === "string"
          ? item.note_id
          : "",
    folderId: typeof item.folderId === "string"
      ? item.folderId
      : typeof item.folder_id === "string"
        ? item.folder_id
        : null,
    userTags: toArray(item.userTags, item.user_tags, item.tags),
    hiddenTags: toArray(item.hiddenTags, item.hidden_tags, item.keywords, item.semanticTags, item.semantic_tags),
    relevance: item.relevance,
    resurfacingClass: typeof item.resurfacingClass === "string"
      ? item.resurfacingClass
      : typeof item.resurfacing_class === "string"
        ? item.resurfacing_class
        : "reference"
  }
}

export function normalizeTagArray(tags, maxItems) {
  const seen = new Set()
  const normalizedTags = []

  for (const tag of Array.isArray(tags) ? tags : []) {
    const text = String(tag || "").trim().replace(/\s+/g, " ")
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    normalizedTags.push(text.slice(0, 40))
    if (normalizedTags.length >= maxItems) break
  }

  return normalizedTags
}

export function mergeAndNormalizeTags(existingTags, generatedTags, maxItems) {
  const mergedValues = [...(existingTags || []), ...(generatedTags || [])]
  const uniqueByCanonical = new Map()

  for (const candidate of mergedValues) {
    const text = String(candidate || "").trim()
    if (!text) continue

    const canonical = canonicalTag(text)
    if (!canonical) continue

    if (!uniqueByCanonical.has(canonical)) {
      uniqueByCanonical.set(canonical, text)
    }

    if (uniqueByCanonical.size >= maxItems) break
  }

  return Array.from(uniqueByCanonical.values())
}

export function clampRelevance(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 30
  if (numericValue < 0) return 0
  if (numericValue > 100) return 100
  return numericValue
}
