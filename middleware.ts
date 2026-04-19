import { NextRequest, NextResponse } from "next/server"
import { buildCspHeader, createCspNonce } from "@/lib/security/csp"

function applySecurityHeaders(request: NextRequest, response: NextResponse) {
  const nonce = createCspNonce()
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set("x-nonce", nonce)

  response.headers.set("Content-Security-Policy", buildCspHeader(nonce))
  response.headers.set("x-nonce", nonce)

  return NextResponse.next({
    request: {
      headers: requestHeaders
    },
    headers: response.headers
  })
}

export function middleware(request: NextRequest) {
  const baseResponse = NextResponse.next()
  return applySecurityHeaders(request, baseResponse)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
}
