const SettingsSyncService = (() => {
    const state = { unsubscribe: null, reference: null }
    function createDefaultUserSettings() {
        const cachedThemeSettings = ThemeManager.getSavedSettings()
        return {
            notesPerPage: 20,
            themeId: cachedThemeSettings.preset || "oled",
            customTheme: {
                p: cachedThemeSettings.p || ThemeManager.themes.oled.p,
                bg: cachedThemeSettings.bg || ThemeManager.themes.oled.bg,
                t: cachedThemeSettings.t || ThemeManager.themes.oled.t,
                mainBackgroundUrl: cachedThemeSettings.mainBackgroundUrl || "",
                sidebarBackgroundUrl: cachedThemeSettings.sidebarBackgroundUrl || "",
                mainBackgroundImage: cachedThemeSettings.mainBackgroundImage || "",
                sidebarBackgroundImage: cachedThemeSettings.sidebarBackgroundImage || "",
                uiOpacity: typeof cachedThemeSettings.uiOpacity === "number" ? cachedThemeSettings.uiOpacity : 0.78,
                cardsOpacity: typeof cachedThemeSettings.cardsOpacity === "number" ? cachedThemeSettings.cardsOpacity : 0.9
            },
            backgroundType: (cachedThemeSettings.mainBackgroundUrl || cachedThemeSettings.mainBackgroundImage) ? "image" : "none",
            backgroundValue: cachedThemeSettings.mainBackgroundUrl || cachedThemeSettings.mainBackgroundImage || "",
            lang: StateStore.read().config.lang || "ru",
            folderViewMode: StateStore.read().config.folderViewMode || "compact",
            reduceMotion: !!StateStore.read().config.reduceMotion,
            customPresets: ThemeManager.getCustomPresets(),
            schemaVersion: 1
        }
    }
    function normalizeUserSettings(rawSettings) {
        const defaults = createDefaultUserSettings()
        const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {}
        const notesPerPageOptions = new Set([5, 10, 20, 50])
        const notesPerPage = notesPerPageOptions.has(Number(source.notesPerPage)) ? Number(source.notesPerPage) : 20
        const customThemeSource = source.customTheme && typeof source.customTheme === "object" ? source.customTheme : defaults.customTheme
        const normalizedTheme = {
            p: ThemeManager.normalizeHex(customThemeSource.p), bg: ThemeManager.normalizeHex(customThemeSource.bg), t: ThemeManager.normalizeHex(customThemeSource.t),
            mainBackgroundUrl: String(customThemeSource.mainBackgroundUrl || ""), sidebarBackgroundUrl: String(customThemeSource.sidebarBackgroundUrl || ""),
            mainBackgroundImage: String(customThemeSource.mainBackgroundImage || ""), sidebarBackgroundImage: String(customThemeSource.sidebarBackgroundImage || ""),
            uiOpacity: typeof customThemeSource.uiOpacity === "number" ? customThemeSource.uiOpacity : 0.78,
            cardsOpacity: typeof customThemeSource.cardsOpacity === "number" ? customThemeSource.cardsOpacity : 0.9
        }
        return {
            notesPerPage,
            themeId: typeof source.themeId === "string" && source.themeId ? source.themeId : defaults.themeId,
            customTheme: normalizedTheme,
            backgroundType: ThemeManager.pickRuntimeBackgroundValue(normalizedTheme.mainBackgroundUrl, normalizedTheme.mainBackgroundImage) ? "image" : "none",
            backgroundValue: ThemeManager.pickRuntimeBackgroundValue(normalizedTheme.mainBackgroundUrl, normalizedTheme.mainBackgroundImage),
            lang: source.lang === "en" ? "en" : "ru",
            folderViewMode: source.folderViewMode === "full" ? "full" : "compact",
            reduceMotion: !!source.reduceMotion,
            customPresets: Array.isArray(source.customPresets) ? source.customPresets : defaults.customPresets,
            schemaVersion: 1
        }
    }
    function getCacheKey(uid) { return `user-settings-cache:${String(uid || "")}` }
    function writeOriginal(settings) { StateStore.update("originalUserSettings", JSON.parse(JSON.stringify(settings))) }
    function applyToRuntime(userSettings, options = {}) {
        const settings = normalizeUserSettings(userSettings)
        ThemeManager.applySettings({ preset: settings.themeId, ...settings.customTheme }, options.persistTheme !== false)
        const mergedCustomPresets = ThemeManager.mergeCloudPresetsWithLocalPresets(ThemeManager.getCustomPresets(), settings.customPresets)
        ThemeManager.setCustomPresets(mergedCustomPresets)
        StateActions.updateConfig({ lang: settings.lang, folderViewMode: settings.folderViewMode, reduceMotion: settings.reduceMotion })
        PaginationService.configureFromSettings(settings)
        if (options.resetVisibleLimit) PaginationService.resetVisibleLimit()
    }
    async function saveUserSettings(settingsToSave) {
        const user = StateStore.read().user
        if (!user) return null
        const normalized = normalizeUserSettings(settingsToSave)
        const resolved = state.reference ? { reference: state.reference } : await SettingsRepository.resolveReference(user)
        if (!resolved.reference) return null
        await SettingsRepository.write(resolved.reference, normalized)
        state.reference = resolved.reference
        SafeStorage.local.setJson(getCacheKey(user.uid), normalized)
        writeOriginal(normalized)
        EventBus.publish("settingsSaved", normalized)
        return normalized
    }
    async function initialize(user) {
        const cached = SafeStorage.local.getJson(getCacheKey(user.uid), null)
        const initialSettings = normalizeUserSettings(cached || createDefaultUserSettings())
        writeOriginal(initialSettings)
        applyToRuntime(initialSettings, { resetVisibleLimit: true, persistTheme: false })
        const resolved = await SettingsRepository.resolveReference(user)
        if (!resolved.reference) return
        state.reference = resolved.reference
        let loaded = initialSettings
        if (resolved.snapshot && resolved.snapshot.exists) loaded = normalizeUserSettings(resolved.snapshot.data() || {})
        else await SettingsRepository.write(resolved.reference, loaded)
        SafeStorage.local.setJson(getCacheKey(user.uid), loaded)
        writeOriginal(loaded)
        applyToRuntime(loaded, { resetVisibleLimit: true, persistTheme: false })
        if (state.unsubscribe) state.unsubscribe()
        state.unsubscribe = SettingsRepository.subscribe(resolved.reference, nextSnapshot => {
            if (!nextSnapshot.exists) return
            const incoming = normalizeUserSettings(nextSnapshot.data() || {})
            SafeStorage.local.setJson(getCacheKey(user.uid), incoming)
            writeOriginal(incoming)
            applyToRuntime(incoming, { resetVisibleLimit: false, persistTheme: false })
        }, error => EventBus.publish("settingsSyncError", error))
    }
    function clear() { if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null; state.reference = null }
    return { initialize, clear, saveUserSettings, applyUserSettingsToRuntime: applyToRuntime, normalizeUserSettings }
})()
