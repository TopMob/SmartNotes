import { requireUidFromRequest } from "@/lib/drive/auth"
import { getDriveCorsHeaders, jsonResponse } from "@/lib/drive/cors"
import { getGoogleDriveIntegration } from "@/lib/drive/integrationStore"

export const runtime = "nodejs"

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: getDriveCorsHeaders(request, "GET, OPTIONS")
  })
}

export async function GET(request) {
  try {
    const uid = await requireUidFromRequest(request)
    const integration = await getGoogleDriveIntegration(uid)
    const connected = Boolean(integration?.refreshToken)

    return jsonResponse(
      request,
      {
        connected,
        email: connected ? integration?.email || "" : "",
        debug: {
          hasDoc: Boolean(integration?.hasDoc),
          hasRefreshToken: Boolean(integration?.refreshToken)
        }
      },
      200,
      "GET, OPTIONS"
    )
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return jsonResponse(request, { success: false, error: "UNAUTHORIZED" }, 401, "GET, OPTIONS")
    }

    console.error("[drive-status] failed", {
      message: error?.message,
      stack: error?.stack
    })

    return jsonResponse(request, { success: false, error: "INTERNAL_ERROR" }, 500, "GET, OPTIONS")
  }
}
