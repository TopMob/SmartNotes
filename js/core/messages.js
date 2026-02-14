export const APP_MESSAGES = {
    folderNameTooLong: {
        key: "folder_name_too_long",
        fallback: "Folder name must not exceed 50 characters"
    },
    folderLimitReached: {
        key: "folder_limit",
        fallback: "Folder limit reached"
    },
    moveToTrashedFolderDenied: {
        key: "move_to_trashed_folder_denied",
        fallback: "Cannot move note into a trashed folder"
    },
    restored: {
        key: "restored",
        fallback: "Restored"
    },
    syncError: {
        key: "sync_error",
        fallback: "Sync error"
    }
}

export const getAppMessage = (uiInstance, descriptor) => {
    if (!descriptor) return ""
    if (uiInstance && typeof uiInstance.getText === "function") {
        return uiInstance.getText(descriptor.key, descriptor.fallback)
    }
    return descriptor.fallback
}

window.AppMessages = {
    APP_MESSAGES,
    getAppMessage
}
