import { getSupabaseAdminClient } from "@/lib/supabase/admin"

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

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.id) {
    return null
  }

  return data.user.id
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
