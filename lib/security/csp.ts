const cspParts = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "script-src 'self'",
  "script-src-elem 'self'",
  "script-src-attr 'none'",
  "upgrade-insecure-requests"
]

function normalizeCsp(value: string) {
  return value.replace(/\s{2,}/g, " ").trim()
}

function toBase64(bytes: Uint8Array) {
  let binary = ""

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

export function createCspNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64(bytes)
}

export function buildCspHeader(nonce: string) {
  const withNonce = cspParts
    .map((part) => {
      if (part === "script-src 'self'") {
        return `script-src 'self' 'nonce-${nonce}'`
      }

      if (part === "script-src-elem 'self'") {
        return `script-src-elem 'self' 'nonce-${nonce}'`
      }

      return part
    })
    .join("; ")

  return normalizeCsp(withNonce)
}
