import { requireUidFromRequest } from "@/lib/drive/auth"
import { createGoogleDriveConnectUrl } from "@/lib/drive/connectUrl"
import { getDriveCorsHeaders, jsonResponse } from "@/lib/drive/cors"

export const runtime = "nodejs"

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: getDriveCorsHeaders(request, "POST, OPTIONS")
  })
}

export async function POST(request) {
  try {
    const uid = await requireUidFromRequest(request)
    const { url } = await createGoogleDriveConnectUrl(uid)

    return jsonResponse(request, { url }, 200, "POST, OPTIONS")
  } catch (error) {
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return jsonResponse(request, { success: false, error: "UNAUTHORIZED" }, 401, "POST, OPTIONS")
    }

    return jsonResponse(request, { success: false, error: "INTERNAL_ERROR" }, 500, "POST, OPTIONS")
  }
}
