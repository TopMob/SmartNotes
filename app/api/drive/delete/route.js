import { createDriveClientWithRefreshToken } from "@/lib/drive/client"
import { requireRequestAuth } from "@/lib/auth"
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
      return Response.json({ success: false, error: "NOT_CONNECTED" }, { status: 400 })
    }

    const payload = await readPayload(request)
    const fileId = String(payload.fileId || "").trim()

    if (!fileId) {
      return Response.json({ success: false, error: "INVALID_PAYLOAD" }, { status: 400 })
    }

    const { drive } = createDriveClientWithRefreshToken(integration.refreshToken)
    await drive.files.delete({ fileId })

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    const mappedError = mapDriveError(error)
    if (mappedError) {
      return Response.json({ success: false, error: mappedError }, { status: 401 })
    }

    if (String(error?.message || "") === "UNAUTHORIZED") {
      return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    return Response.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request) {
  return handleDelete(request)
}

export async function DELETE(request) {
  return handleDelete(request)
}
