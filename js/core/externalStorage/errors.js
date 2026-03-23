export const ERROR_CODES = {
    OFFLINE: "external-storage-offline",
    UNLINKED: "external-storage-unlinked",
    UNAVAILABLE: "external-storage-unavailable",
    SAVE_FAILED: "external-attachment-save-failed",
    INLINE_MEDIA_BLOCKED: "external-inline-media-blocked"
}

export const createExternalMediaError = (code, cause = null) => {
    const error = new Error(code)
    error.code = code
    if (cause) error.cause = cause
    return error
}

const inferAuthorizationErrorCode = (error) => {
    const code = String(error?.code || "").toLowerCase()
    const message = String(error?.message || "").toLowerCase()
    if (code.includes("popup") || code.includes("cancel") || code.includes("denied") || message.includes("popup") || message.includes("cancel") || message.includes("denied") || message.includes("token") || message.includes("consent")) {
        return ERROR_CODES.UNLINKED
    }
    return ERROR_CODES.UNAVAILABLE
}

export const normalizeExternalMediaErrorCode = (error) => {
    const rawCode = String(error?.code || error?.message || "")
    if (!rawCode) return ERROR_CODES.UNAVAILABLE
    if (Object.values(ERROR_CODES).includes(rawCode)) return rawCode
    if (rawCode === "drive-offline") return ERROR_CODES.OFFLINE
    if (rawCode === "drive-unavailable") return ERROR_CODES.UNLINKED
    if (rawCode.startsWith("drive-upload-failed") || rawCode.startsWith("drive-permission-failed") || rawCode === "drive-invalid-file" || rawCode === "drive-invalid-data-url") {
        return ERROR_CODES.SAVE_FAILED
    }
    return inferAuthorizationErrorCode(error)
}

export const resolveUserFacingError = (error, options = {}) => {
    const code = normalizeExternalMediaErrorCode(error)
    if (code === ERROR_CODES.UNLINKED) {
        return options.attachmentOnly
            ? { code, messageKey: "external_attachment_unavailable", fallbackMessage: "Disk is not connected, attachment unavailable" }
            : { code, messageKey: "external_storage_unlinked", fallbackMessage: "External storage is not connected" }
    }
    if (code === ERROR_CODES.OFFLINE || code === ERROR_CODES.UNAVAILABLE) {
        return { code, messageKey: "external_storage_unavailable", fallbackMessage: "External disk is temporarily unavailable" }
    }
    return { code, messageKey: "external_attachment_save_failed", fallbackMessage: "Unable to save attachment to external disk" }
}
