import crypto from "crypto"

function encodeState(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decodeState(state) {
  const raw = Buffer.from(state, "base64url").toString("utf8")
  return JSON.parse(raw)
}

export function createOAuthState(uid) {
  return encodeState({ uid, nonce: crypto.randomBytes(12).toString("hex"), ts: Date.now() })
}

export function parseOAuthState(state) {
  if (!state) {
    throw new Error("INVALID_STATE")
  }

  const parsed = decodeState(state)
  if (!parsed?.uid || !parsed?.nonce || !parsed?.ts) {
    throw new Error("INVALID_STATE")
  }

  if (Date.now() - Number(parsed.ts) > 10 * 60 * 1000) {
    throw new Error("STATE_EXPIRED")
  }

  return parsed
}
