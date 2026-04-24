import { isSupabaseConfigured } from "@/lib/supabase"

export const runtime = "nodejs"

function readPublicSupabaseConfig() {
  return {
    url: String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
    publishableKey: String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim(),
    googleClientId: String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "").trim()
  }
}

function buildScriptResponseBody() {
  const payload = JSON.stringify(readPublicSupabaseConfig())
  return `window.SmartNotesSupabaseConfig = ${payload};`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const responseFormat = searchParams.get("format")

  if (!isSupabaseConfigured()) {
    if (responseFormat === "script") {
      return new Response("window.SmartNotesSupabaseConfig = null;", {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/javascript; charset=utf-8"
        }
      })
    }

    return Response.json(
      { ok: false, error: "SUPABASE_ENV_MISSING" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    )
  }

  if (responseFormat === "script") {
    return new Response(buildScriptResponseBody(), {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "Content-Type": "application/javascript; charset=utf-8"
      }
    })
  }

  const config = readPublicSupabaseConfig()
  return Response.json({
    ok: true,
    url: config.url,
    publishableKey: config.publishableKey,
    googleClientId: config.googleClientId
  }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
    }
  })
}
