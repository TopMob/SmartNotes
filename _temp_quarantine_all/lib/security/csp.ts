const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  "https://www.gstatic.com",
  "https://cdn.jsdelivr.net",
  "https://unpkg.com",
  "https://cdnjs.cloudflare.com",
  "https://accounts.google.com",
  "https://apis.google.com"
]

const imageSources = [
  "'self'",
  "data:",
  "blob:",
  "https://*.googleusercontent.com",
  "http://googleusercontent.com",
  "https://ui-avatars.com",
  "https://www.gstatic.com"
]

const cspParts = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src ${imageSources.join(" ")}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://accounts.google.com",
  "script-src",
  "script-src-elem",
  "script-src-attr 'none'",
  "upgrade-insecure-requests"
]

function normalizeCsp(value: string) {
  return value.replace(/\s{2,}/g, " ").trim()
}

function toBase64(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export function createCspNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64(bytes)
}

export function buildCspHeader(nonce: string) {
  const nonceSource = `'nonce-${nonce}'`
  const scriptDirective = `script-src ${scriptSources.join(" ")} ${nonceSource}`
  const scriptElemDirective = `script-src-elem ${scriptSources.join(" ")} ${nonceSource}`

  const withNonce = cspParts
    .map((part) => {
      if (part === "script-src") return scriptDirective
      if (part === "script-src-elem") return scriptElemDirective
      return part
    })
    .join("; ")

  return normalizeCsp(withNonce)
}
