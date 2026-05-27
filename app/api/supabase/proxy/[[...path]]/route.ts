import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config"

export const runtime = "nodejs"

async function handleProxy(request: Request, pathParams: Promise<{ path?: string[] }>) {
  // Await the params object as required by Next.js 15+
  await pathParams
  
  const supabaseUrl = getSupabaseUrl().replace(/\/+$/g, "")
  const url = new URL(request.url)
  const pathSegment = url.pathname.replace(/^\/api\/supabase\/proxy/, "")
  const targetUrl = `${supabaseUrl}${pathSegment}${url.search}`

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    // Exclude headers that should not be forwarded
    if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length") {
      headers.set(key, value)
    }
  })

  // Ensure apikey is set for Supabase requests
  if (!headers.has("apikey")) {
    headers.set("apikey", getSupabasePublishableKey())
  }

  let body: ArrayBuffer | undefined = undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.arrayBuffer()
    } catch {
      // Empty body or couldn't parse
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual"
    })

    const responseHeaders = new Headers()
    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      // Copy key headers
      if (
        lowerKey === "content-type" ||
        lowerKey === "cache-control" ||
        lowerKey === "location" ||
        lowerKey === "www-authenticate"
      ) {
        responseHeaders.set(key, value)
      }
    })

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders
    })
  } catch (error) {
    console.error("[SUPABASE_PROXY_ERROR]", error)
    return Response.json(
      { ok: false, error: "SUPABASE_PROXY_UPSTREAM_FAILED" },
      { status: 502 }
    )
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}

export async function POST(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}

export async function PUT(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}

export async function OPTIONS(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}

export async function HEAD(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, params)
}
