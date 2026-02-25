export const validateFolderName = (name) => {
    const trimmedName = String(name || "").trim()
    if (!trimmedName || trimmedName.length > 50) return null
    return trimmedName
}

export const FOLDER_DESCRIPTION_SOFT_LIMIT = 300
export const FOLDER_DESCRIPTION_HARD_LIMIT = 300

export const validateFolderDescription = (description) => {
    const trimmedDescription = String(description || "").trim()
    if (trimmedDescription.length > FOLDER_DESCRIPTION_HARD_LIMIT) return null
    return trimmedDescription
}

export const canAddFolder = (currentCount) => Number(currentCount) < 10

export const canAddCustomTheme = (count) => {
    const customThemeCount = Number(count)
    if (!Number.isFinite(customThemeCount)) return true
    return customThemeCount < ThemeManager.maxCustomPresets
}

export const canAssignToFolder = (folder) => !!folder && folder.trashedAt == null

window.Validators = {
    validateFolderName,
    validateFolderDescription,
    canAddFolder,
    canAddCustomTheme,
    canAssignToFolder,
    FOLDER_DESCRIPTION_SOFT_LIMIT,
    FOLDER_DESCRIPTION_HARD_LIMIT
}
