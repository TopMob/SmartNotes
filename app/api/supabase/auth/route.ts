export const runtime = "nodejs"

const AUTH_PROXY_TIMEOUT_MS = 12000

function readSupabaseAuthConfig() {
  return {
    url: String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/g, ""),
    publishableKey: String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim()
  }
}

function normalizeAuthPath(value: unknown) {
  const path = String(value || "").trim().replace(/^\/+/, "")
  const basePath = path.split("?")[0]
  const allowedPaths = new Set(["token", "signup", "recover", "user", "logout"])
  return allowedPaths.has(basePath) ? path : ""
}

function normalizeMethod(value: unknown) {
  const method = String(value || "GET").trim().toUpperCase()
  return ["GET", "POST", "PUT"].includes(method) ? method : "GET"
}

export async function POST(request: Request) {
  const config = readSupabaseAuthConfig()
  if (!config.url || !config.publishableKey) {
    return Response.json({ error: "SUPABASE_ENV_MISSING" }, { status: 500 })
  }

  let payload: Record<string, unknown>
  try {
    const body = await request.json()
    payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    return Response.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const authPath = normalizeAuthPath(payload.path)
  if (!authPath) {
    return Response.json({ error: "AUTH_PATH_NOT_ALLOWED" }, { status: 400 })
  }

  const method = normalizeMethod(payload.method)
  const accessToken = String(payload.accessToken || "").trim()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_PROXY_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(`${config.url}/auth/v1/${authPath}`, {
      method,
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken || config.publishableKey}`,
        "Content-Type": "application/json"
      },
      body: method === "GET" ? undefined : JSON.stringify(payload.body || {}),
      signal: controller.signal
    })

    const responseText = await upstreamResponse.text()
    return new Response(responseText || "{}", {
      status: upstreamResponse.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8"
      }
    })
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError"
    return Response.json({ error: isAbort ? "AUTH_PROXY_TIMEOUT" : "AUTH_PROXY_FAILED" }, { status: 504 })
  } finally {
    clearTimeout(timeoutId)
  }
}
