function getGoogleErrorPayload(error) {
  const responseData = error?.response?.data
  if (!responseData) {
    return null
  }

  if (typeof responseData === "string") {
    return responseData
  }

  try {
    return JSON.parse(JSON.stringify(responseData))
  } catch {
    return String(responseData)
  }
}

export function logUploadContext({ uid, integration, mimeType, buffer, fileName, folderId }) {
  console.info("[drive-upload] context", {
    uid,
    hasRefreshToken: Boolean(integration?.refreshToken),
    mimeType,
    bufferByteLength: buffer?.byteLength || 0,
    fileName,
    folderId: folderId || ""
  })
}

export function logUploadError(error, context) {
  console.error("[drive-upload] failed", {
    ...context,
    message: error?.message,
    stack: error?.stack,
    responseData: getGoogleErrorPayload(error)
  })
}

export function buildUploadErrorBody(error, mappedError) {
  const responseData = getGoogleErrorPayload(error)

  if (mappedError) {
    return {
      success: false,
      error: mappedError,
      diagnostics: {
        message: error?.message || "",
        responseData
      }
    }
  }

  if (responseData || error?.message) {
    return {
      success: false,
      error: "DRIVE_API_ERROR",
      diagnostics: {
        message: error?.message || "",
        responseData
      }
    }
  }

  return { success: false, error: "INTERNAL_ERROR" }
}
