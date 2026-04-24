import { NextRequest, NextResponse } from "next/server"
import { buildCspHeader, createCspNonce } from "@/lib/security/csp"

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

  return response
}

export function proxy(request: NextRequest) {
  return applySecurityHeaders(request)
}

export const middleware = proxy

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
