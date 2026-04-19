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

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
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
