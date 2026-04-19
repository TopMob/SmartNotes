import { createDriveClientWithRefreshToken } from "@/lib/drive/client"
import { requireRequestAuth } from "@/lib/auth"
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
      return Response.json({ success: false, error: "NOT_CONNECTED" }, { status: 400 })
    }

    const payload = await readPayload(request)
    const dataUrl = payload.dataUrl
    const fileNameBase = payload.fileNameBase
    const folderId = typeof payload.folderId === "string" ? payload.folderId.trim() : ""

    if (!dataUrl) {
      return Response.json({ success: false, error: "INVALID_PAYLOAD" }, { status: 400 })
    }

    const { mimeType, buffer } = parseDataUrl(dataUrl)
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return Response.json({ success: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 })
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

    return Response.json(
      {
        success: true,
        fileId: uploaded.fileId,
        imageUrl: uploaded.imageUrl,
        webViewLink: uploaded.webViewLink,
        webContentLink: uploaded.webContentLink,
        mimeType,
        size: buffer.byteLength
      },
      { status: 200 }
    )
  } catch (error) {
    const mappedError = mapDriveError(error)
    if (String(error?.message || "") === "UNAUTHORIZED") {
      return Response.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    logUploadError(error, uploadContext)

    const status = Number(error?.response?.status || 0)
    if (status >= 400 && status < 600) {
      return Response.json(buildUploadErrorBody(error, mappedError), { status })
    }

    if (mappedError) {
      return Response.json(buildUploadErrorBody(error, mappedError), { status: 401 })
    }

    return Response.json(buildUploadErrorBody(error, null), { status: 500 })
  }
}
