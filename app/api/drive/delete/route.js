import { createDriveClientWithRefreshToken } from "@/lib/drive/client"
import { requireRequestAuth } from "@/lib/auth"
import { getDriveCorsHeaders, jsonResponse } from "@/lib/drive/cors"
import { mapDriveError } from "@/lib/drive/errors"
import { getGoogleDriveIntegration } from "@/lib/drive/integrationStore"

export const runtime = "nodejs"

async function readPayload(request) {
  try {
    const body = await request.json()
    return body && typeof body === "object" && !Array.isArray(body) ? body : {}
  } catch {
    return {}
  }
}

async function handleDelete(request) {
  try {
    const uid = await requireRequestAuth(request)
    const integration = await getGoogleDriveIntegration(uid)
    if (!integration?.refreshToken) {
      return jsonResponse(request, { success: false, error: "NOT_CONNECTED" }, 400, "POST, DELETE, OPTIONS")
    }

    const payload = await readPayload(request)
    const fileId = String(payload.fileId || "").trim()

    if (!fileId) {
      return jsonResponse(request, { success: false, error: "INVALID_PAYLOAD" }, 400, "POST, DELETE, OPTIONS")
    }

    const { drive } = createDriveClientWithRefreshToken(integration.refreshToken)
    await drive.files.delete({ fileId })

    return jsonResponse(request, { success: true }, 200, "POST, DELETE, OPTIONS")
  } catch (error) {
    const mappedError = mapDriveError(error)
    if (mappedError) {
      return jsonResponse(request, { success: false, error: mappedError }, 401, "POST, DELETE, OPTIONS")
    }

    if (String(error?.message || "") === "UNAUTHORIZED") {
      return jsonResponse(request, { success: false, error: "UNAUTHORIZED" }, 401, "POST, DELETE, OPTIONS")
    }

    return jsonResponse(request, { success: false, error: "INTERNAL_ERROR" }, 500, "POST, DELETE, OPTIONS")
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: getDriveCorsHeaders(request, "POST, DELETE, OPTIONS")
  })
}

export async function POST(request) {
  return handleDelete(request)
}

export async function DELETE(request) {
  return handleDelete(request)
}
