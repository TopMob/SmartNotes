import { Readable } from "node:stream"
import { buildDriveLinks } from "@/lib/drive/urls"

export async function uploadFileToDrive({ drive, name, mimeType, buffer, folderId }) {
  const file = await drive.files.create({
    requestBody: {
      name,
      parents: folderId ? [folderId] : undefined
    },
    media: {
      mimeType,
      body: Readable.from(buffer)
    },
    supportsAllDrives: true,
    fields: "id,webViewLink,webContentLink"
  })

  const fileId = file?.data?.id
  if (!fileId) {
    throw new Error("DRIVE_FILE_ID_MISSING")
  }

  const fallbackLinks = buildDriveLinks(fileId)

  return {
    fileId,
    webViewLink: file.data.webViewLink || fallbackLinks.webViewLink,
    webContentLink: file.data.webContentLink || fallbackLinks.webContentLink,
    imageUrl: fallbackLinks.imageUrl
  }
}

export async function ensurePublicReadPermission({ drive, fileId }) {
  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: {
      role: "reader",
      type: "anyone"
    }
  })

  return { isPublic: true }
}
