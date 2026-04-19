import { NextRequest, NextResponse } from "next/server"
import { resolveDriveOrigin } from "@/lib/drive/cors"
import { buildCspHeader, createCspNonce } from "@/lib/security/csp"

function buildDriveCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  }
}

function applyCorsHeaders(response: NextResponse, headers: Record<string, string>) {
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

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
  const isDriveApiRoute = request.nextUrl.pathname.startsWith("/api/drive")

  if (isDriveApiRoute) {
    const origin = resolveDriveOrigin(request.headers.get("origin"))
    const corsHeaders = buildDriveCorsHeaders(origin)

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders
      })
    }

    const driveResponse = NextResponse.next()
    applyCorsHeaders(driveResponse, corsHeaders)
    return driveResponse
  }

  const baseResponse = NextResponse.next()
  return applySecurityHeaders(request, baseResponse)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
}
