const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder"

async function findFolderByName({ drive, name, parentId }) {
  const parentClause = parentId ? `'${parentId}' in parents and ` : ""
  const response = await drive.files.list({
    q: `${parentClause}mimeType='${DRIVE_FOLDER_MIME}' and name='${name}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  })

  return response?.data?.files?.[0]?.id || ""
}

async function createFolder({ drive, name, parentId }) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: DRIVE_FOLDER_MIME,
      parents: parentId ? [parentId] : ["root"]
    },
    fields: "id",
    supportsAllDrives: true
  })

  const folderId = response?.data?.id
  if (!folderId) {
    throw new Error(`DRIVE_FOLDER_CREATE_FAILED:${name}`)
  }

  return folderId
}

async function ensureFolder({ drive, name, parentId }) {
  const existingFolderId = await findFolderByName({ drive, name, parentId })
  if (existingFolderId) {
    return existingFolderId
  }

  return createFolder({ drive, name, parentId })
}

export async function ensureDefaultAttachmentsFolder(drive) {
  const smartNotesFolderId = await ensureFolder({
    drive,
    name: "SmartNotes",
    parentId: "root"
  })

  return ensureFolder({
    drive,
    name: "Attachments",
    parentId: smartNotesFolderId
  })
}
