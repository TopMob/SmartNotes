export const validateFolderName = (name) => {
    const trimmedName = String(name || "").trim()
    if (!trimmedName || trimmedName.length > 50) return null
    return trimmedName
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
    canAddFolder,
    canAddCustomTheme,
    canAssignToFolder
}
