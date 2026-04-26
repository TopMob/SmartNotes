import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase"

export const runtime = "nodejs"

const ALLOWED_AUTH_PATHS = new Set(["signup", "token", "recover", "logout"])

function buildSupabaseAuthUrl(path: string) {
  const normalizedPath = String(path || "").replace(/^\/+/, "")
  return `${getSupabaseUrl().replace(/\/+$/g, "")}/auth/v1/${normalizedPath}`
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  })
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return jsonResponse({ ok: false, error: "SUPABASE_ENV_MISSING" }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: "BAD_REQUEST" }, 400)
  }

  const path = String(body.path || "").trim()
  if (!path) {
    return jsonResponse({ ok: false, error: "BAD_REQUEST" }, 400)
  }

  if (!ALLOWED_AUTH_PATHS.has(path)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403)
  }

  const upstreamBody = body.body && typeof body.body === "object"
    ? body.body as Record<string, unknown>
    : body

  try {
    const upstreamResponse = await fetch(buildSupabaseAuthUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: getSupabasePublishableKey(),
        Authorization: `Bearer ${getSupabasePublishableKey()}`
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store"
    })

    const payload = await upstreamResponse.json().catch(() => ({}))
    return jsonResponse(payload as Record<string, unknown>, upstreamResponse.status)
  } catch {
    return jsonResponse({ ok: false, error: "SUPABASE_AUTH_UPSTREAM_FAILED" }, 502)
  }
}
