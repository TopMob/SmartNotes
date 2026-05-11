import { NextRequest, NextResponse } from "next/server"
import { buildCspHeader, createCspNonce } from "@/lib/security/csp"

function buildPublicSupabaseConfigCookie() {
  const payload = encodeURIComponent(JSON.stringify({
    url: String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
    publishableKey: String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim(),
    googleClientId: String(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "").trim()
  }))

  return `smartnotes-supabase-config=${payload}; Path=/; SameSite=Lax; Max-Age=86400; Secure`
}

function applySecurityHeaders(request: NextRequest) {
  const nonce = createCspNonce()
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })

  response.headers.set("Content-Security-Policy", buildCspHeader(nonce))
  response.headers.set("x-nonce", nonce)
  response.headers.append("Set-Cookie", buildPublicSupabaseConfigCookie())

  return response
}

export function proxy(request: NextRequest) {
  return applySecurityHeaders(request)
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
}
