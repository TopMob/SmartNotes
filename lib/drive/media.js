const MIME_EXTENSION_MAP = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt"
}

export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error("INVALID_DATA_URL")
  }

  const [meta, content] = dataUrl.split(",", 2)
  const match = meta?.match(/^data:([^;]+);base64$/i)
  if (!match || !content) {
    throw new Error("INVALID_DATA_URL")
  }

  const mimeType = match[1].toLowerCase()
  const buffer = Buffer.from(content, "base64")
  if (!buffer.length) {
    throw new Error("INVALID_DATA_URL")
  }

  return { mimeType, buffer }
}

export function inferExtensionFromMime(mimeType) {
  return MIME_EXTENSION_MAP[String(mimeType || "").toLowerCase()] || "bin"
}

export function buildFileName(fileNameBase, mimeType) {
  const base = String(fileNameBase || "file")
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)

  const safeBase = base || "file"
  const ext = inferExtensionFromMime(mimeType)
  return `${Date.now()}-${safeBase}.${ext}`
}
