import { createDriveClientWithRefreshToken } from "@/lib/drive/client"
import { requireRequestAuth } from "@/lib/auth"
import { getDriveCorsHeaders, jsonResponse } from "@/lib/drive/cors"
import { mapDriveError } from "@/lib/drive/errors"
import { getGoogleDriveIntegration } from "@/lib/drive/integrationStore"
import { ensureDefaultAttachmentsFolder } from "@/lib/drive/folders"
import { buildFileName, parseDataUrl } from "@/lib/drive/media"
import { buildUploadErrorBody, logUploadContext, logUploadError } from "@/lib/drive/uploadDiagnostics"
import { ensurePublicReadPermission, uploadFileToDrive } from "@/lib/drive/uploadFile"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = Number(process.env.DRIVE_MAX_UPLOAD_BYTES || 10 * 1024 * 1024)

async function readPayload(request) {
  try {
    const body = await request.json()
    return body && typeof body === "object" && !Array.isArray(body) ? body : {}
  } catch {
    return {}
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: getDriveCorsHeaders(request, "POST, OPTIONS")
  })
}

export async function POST(request) {
  let uploadContext = {
    uid: "",
    hasRefreshToken: false,
    mimeType: "",
    bufferByteLength: 0,
    fileName: "",
    folderId: ""
  }

  try {
    const uid = await requireRequestAuth(request)
    const integration = await getGoogleDriveIntegration(uid)
    if (!integration?.refreshToken) {
      return jsonResponse(request, { success: false, error: "NOT_CONNECTED" }, 400, "POST, OPTIONS")
    }

    const payload = await readPayload(request)
    const dataUrl = payload.dataUrl
    const fileNameBase = payload.fileNameBase
    const folderId = typeof payload.folderId === "string" ? payload.folderId.trim() : ""

    if (!dataUrl) {
      return jsonResponse(request, { success: false, error: "INVALID_PAYLOAD" }, 400, "POST, OPTIONS")
    }

    const { mimeType, buffer } = parseDataUrl(dataUrl)
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return jsonResponse(request, { success: false, error: "PAYLOAD_TOO_LARGE" }, 413, "POST, OPTIONS")
    }

    const { drive } = createDriveClientWithRefreshToken(integration.refreshToken)
    const name = buildFileName(fileNameBase, mimeType)

    uploadContext = {
      uid,
      hasRefreshToken: Boolean(integration.refreshToken),
      mimeType,
      bufferByteLength: buffer.byteLength,
      fileName: name,
      folderId
    }

    logUploadContext({ uid, integration, mimeType, buffer, fileName: name, folderId })

    const targetFolderId = folderId || (await ensureDefaultAttachmentsFolder(drive))

    const uploaded = await uploadFileToDrive({
      drive,
      name,
      mimeType,
      buffer,
      folderId: targetFolderId
    })
    await ensurePublicReadPermission({ drive, fileId: uploaded.fileId })

    return jsonResponse(
      request,
      {
        success: true,
        fileId: uploaded.fileId,
        imageUrl: uploaded.imageUrl,
        webViewLink: uploaded.webViewLink,
        webContentLink: uploaded.webContentLink,
        mimeType,
        size: buffer.byteLength
      },
      200,
      "POST, OPTIONS"
    )
  } catch (error) {
    const mappedError = mapDriveError(error)
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return jsonResponse(request, { success: false, error: "UNAUTHORIZED" }, 401, "POST, OPTIONS")
    }

    logUploadError(error, uploadContext)

    const status = Number(error?.response?.status || 0)
    if (status >= 400 && status < 600) {
      return jsonResponse(request, buildUploadErrorBody(error, mappedError), status, "POST, OPTIONS")
    }

    if (mappedError) {
      return jsonResponse(request, buildUploadErrorBody(error, mappedError), 401, "POST, OPTIONS")
    }

    return jsonResponse(request, buildUploadErrorBody(error, null), 500, "POST, OPTIONS")
  }
}
