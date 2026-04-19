import { requireRequestAuth } from "@/lib/auth"

export async function requireUidFromRequest(request) {
  return requireRequestAuth(request)
}
