import { getFirebaseAuth } from "./firebaseAdmin"

export function readBearerToken(request) {
  const authorization = request.headers.get("authorization") || ""
  const [scheme, token] = authorization.split(" ")

  if (scheme !== "Bearer" || !token) {
    return null
  }

  return token
}

async function decodeUidFromRequest(request) {
  const token = readBearerToken(request)
  if (!token) {
    return null
  }

  const decodedToken = await getFirebaseAuth().verifyIdToken(token)
  if (!decodedToken?.uid) {
    return null
  }

  return decodedToken.uid
}

export async function verifyRequestAuth(request) {
  return decodeUidFromRequest(request)
}

export async function requireRequestAuth(request) {
  const uid = await decodeUidFromRequest(request)
  if (!uid) {
    throw new Error("UNAUTHORIZED")
  }

  return uid
}
