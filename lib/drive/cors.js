const PRIMARY_ORIGIN = "https://smartnotess.vercel.app"
const ALLOWED_HOSTS = new Set(["smartnotess.vercel.app", "localhost", "127.0.0.1"])

export function resolveDriveOrigin(originHeader) {
  if (!originHeader) {
    return PRIMARY_ORIGIN
  }

  try {
    const url = new URL(originHeader)
    if (ALLOWED_HOSTS.has(url.hostname)) {
      return url.origin
    }
  } catch {}

  return PRIMARY_ORIGIN
}

export function getDriveCorsHeaders(request, methods) {
  return {
    "Access-Control-Allow-Origin": resolveDriveOrigin(request.headers.get("origin")),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  }
}

export function jsonResponse(request, payload, status = 200, methods = "GET, OPTIONS") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getDriveCorsHeaders(request, methods)
    }
  })
}
