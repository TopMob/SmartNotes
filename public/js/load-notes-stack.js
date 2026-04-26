const NotesRepository = (() => {
    function getCollection(user) {
        return DataPath.getUserNotesCollection(user)
    }
    function subscribeOwnedNotes(user, options, next, error) {
        const collection = getCollection(user)
        if (!collection) return () => {}
        let query = collection.limit(options?.pageSize || 500)
        if (options.startAfterDocument) query = query.startAfter(options.startAfterDocument)
        return query.onSnapshot(next, error)
    }
    async function loadMoreOwnedNotes(user, options) {
        const collection = getCollection(user)
        if (!collection || !options.startAfterDocument) return { documents: [], lastDocument: null }
        const snapshot = await collection.startAfter(options.startAfterDocument).limit(options?.pageSize || 500).get()
        return { documents: snapshot.docs, lastDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : options.startAfterDocument }
    }
    return { subscribeOwnedNotes, loadMoreOwnedNotes }
})()

const FoldersRepository = (() => {
    function subscribeFolders(user, next, error) {
        const collection = DataPath.getUserFoldersCollection(user)
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }
    return { subscribeFolders }
})()

const SettingsRepository = (() => {
    function buildHeaders(user) {
        const accessToken = String(user?.accessToken || window.__smartnotesGetSupabaseAccessToken?.() || "")
        return {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
    }
    function createSettingsReference(user) {
        if (!user?.uid) return null
        const endpoint = "/api/supabase/settings"
        const get = async () => {
            const response = await fetch(endpoint, { method: "GET", headers: buildHeaders(user) })
            if (!response.ok) throw new Error(`supabase-settings-http-${response.status}`)
            const payload = await response.json()
            const settings = payload?.settings && typeof payload.settings === "object" ? payload.settings : null
            return {
                exists: !!settings,
                data: () => (settings ? JSON.parse(JSON.stringify(settings)) : {})
            }
        }
        const set = async (payload, options = {}) => {
            const body = options?.merge ? { settings: payload || {} } : { settings: payload || {} }
            const response = await fetch(endpoint, {
                method: "POST",
                headers: buildHeaders(user),
                body: JSON.stringify(body)
            })
            if (!response.ok) throw new Error(`supabase-settings-save-http-${response.status}`)
            const result = await response.json()
            return result?.settings || null
        }
        const onSnapshot = (next, error) => {
            let cancelled = false
            let lastSerialized = ""
            const poll = async () => {
                if (cancelled) return
                try {
                    const snapshot = await get()
                    const serialized = JSON.stringify(snapshot.data())
                    if (serialized === lastSerialized) return
                    lastSerialized = serialized
                    if (typeof next === "function") next(snapshot)
                } catch (pollError) {
                    if (typeof error === "function") error(pollError)
                }
            }
            poll()
            const intervalId = setInterval(poll, 5000)
            return () => {
                cancelled = true
                clearInterval(intervalId)
            }
        }
        return { get, set, onSnapshot }
    }
    async function resolveReference(user) {
        const reference = createSettingsReference(user)
        if (!reference) return { reference: null, snapshot: null, storageType: null }
        const snapshot = await reference.get()
        return { reference, snapshot, storageType: "settings" }
    }
    async function write(reference, payload) {
        if (!reference) return
        await reference.set(payload, { merge: true })
    }
    function subscribe(reference, next, error) {
        if (!reference) return () => {}
        return reference.onSnapshot(next, error)
    }
    return { resolveReference, write, subscribe }
})()

const PaginationService = (() => {
    function readPaginationState() {
        return StateStore.read().pagination || {}
    }

    function writePaginationState(updater) {
        StateStore.set(previousState => {
            const currentPagination = previousState.pagination || {}
            const nextPagination = typeof updater === "function"
                ? updater(currentPagination)
                : { ...currentPagination, ...updater }
            if (nextPagination === currentPagination) return previousState
            const keys = Object.keys(nextPagination)
            const sameShape = keys.length === Object.keys(currentPagination).length
            const sameValues = sameShape && keys.every(key => currentPagination[key] === nextPagination[key])
            if (sameValues) return previousState
            return { ...previousState, pagination: nextPagination }
        })
    }

    function normalizeRenderStep(settings) {
        const configuredValue = Number(settings?.notesPerPage)
        if (configuredValue === 5 || configuredValue === 10 || configuredValue === 20 || configuredValue === 50) return configuredValue
        return 20
    }

    function getDisplayLimit() {
        const pagination = readPaginationState()
        return Number(pagination.displayLimit) || Number(pagination.renderStep) || 20
    }

    function setDisplayLimit(nextDisplayLimit) {
        const pagination = readPaginationState()
        const baseRenderStep = Number(pagination.renderStep) || 20
        const normalizedDisplayLimit = Math.max(baseRenderStep, Number(nextDisplayLimit) || baseRenderStep)
        if (normalizedDisplayLimit === Number(pagination.displayLimit)) return
        writePaginationState(previousPagination => ({ ...previousPagination, displayLimit: normalizedDisplayLimit }))
    }

    function configureFromSettings(settings) {
        const nextRenderStep = normalizeRenderStep(settings)
        writePaginationState(previousPagination => {
            const displayLimit = Math.max(nextRenderStep, Number(previousPagination.displayLimit) || nextRenderStep)
            if (Number(previousPagination.renderStep) === nextRenderStep && Number(previousPagination.displayLimit) === displayLimit) return previousPagination
            return { ...previousPagination, renderStep: nextRenderStep, displayLimit }
        })
    }

    function resetVisibleLimit() {
        const renderStep = Number(readPaginationState().renderStep) || 20
        setDisplayLimit(renderStep)
    }

    function setOwnedPaginationInfo(info) {
        const source = info && typeof info === "object" ? info : {}
        writePaginationState(previousPagination => ({
            ...previousPagination,
            hasMoreOwnedNotes: !!source.hasMoreOwnedNotes,
            lastOwnedNoteDocument: source.lastOwnedNoteDocument || null
        }))
    }

    function getOwnedPaginationInfo() {
        const pagination = readPaginationState()
        return {
            pageSize: Number(pagination.pageSize) || 500,
            hasMoreOwnedNotes: !!pagination.hasMoreOwnedNotes,
            loadingMoreOwnedNotes: !!pagination.loadingMoreOwnedNotes,
            lastOwnedNoteDocument: pagination.lastOwnedNoteDocument || null
        }
    }

    function setLoadingMoreOwnedNotes(value) {
        const nextValue = !!value
        writePaginationState(previousPagination => {
            if (!!previousPagination.loadingMoreOwnedNotes === nextValue) return previousPagination
            return { ...previousPagination, loadingMoreOwnedNotes: nextValue }
        })
    }

    function getVisibleNotesForRender(notesList, activeView, searchQuery) {
        const notes = Array.isArray(notesList) ? notesList : []
        const view = String(activeView || "notes")
        const isSupportedView = ["notes", "favorites", "archive", "folder", "reminders", "locked"].includes(view)
        const hasActiveSearch = String(searchQuery || "").trim().length > 0

        if (!isSupportedView || hasActiveSearch) {
            const total = notes.length
            writePaginationState(previousPagination => ({
                ...previousPagination,
                searchActive: hasActiveSearch,
                totalVisibleNotesCount: total,
                renderedVisibleNotesCount: total
            }))
            return notes
        }

        const visibleNotes = notes.slice(0, getDisplayLimit())
        writePaginationState(previousPagination => ({
            ...previousPagination,
            searchActive: false,
            totalVisibleNotesCount: notes.length,
            renderedVisibleNotesCount: visibleNotes.length
        }))
        return visibleNotes
    }

    function loadMoreVisibleNotes() {
        setDisplayLimit(getDisplayLimit() + (Number(readPaginationState().renderStep) || 20))
    }

    function shouldLoadMoreOwnedFromServer() {
        const pagination = readPaginationState()
        return !pagination.searchActive
            && !!pagination.hasMoreOwnedNotes
            && !pagination.loadingMoreOwnedNotes
            && getDisplayLimit() >= Number(pagination.totalVisibleNotesCount || 0)
    }

    function getLoadMoreState() {
        const pagination = readPaginationState()
        const totalVisibleNotesCount = Number(pagination.totalVisibleNotesCount || 0)
        const renderedVisibleNotesCount = Number(pagination.renderedVisibleNotesCount || 0)
        const canRevealMoreClientNotes = renderedVisibleNotesCount < totalVisibleNotesCount
        const shouldShowButton = !pagination.searchActive && (canRevealMoreClientNotes || !!pagination.hasMoreOwnedNotes)
        return {
            hasMoreItems: shouldShowButton,
            isLoading: !!pagination.loadingMoreOwnedNotes,
            totalVisibleNotesCount,
            renderedVisibleNotesCount,
            hasMoreOwnedNotes: !!pagination.hasMoreOwnedNotes,
            searchActive: !!pagination.searchActive
        }
    }

    return {
        configureFromSettings,
        resetVisibleLimit,
        setOwnedPaginationInfo,
        getOwnedPaginationInfo,
        setLoadingMoreOwnedNotes,
        getVisibleNotesForRender,
        loadMoreVisibleNotes,
        shouldLoadMoreOwnedFromServer,
        getLoadMoreState
    }
})()

const NotesSortingStrategy = (() => {
    function normalizeDateValue(value) {
        if (!value) return 0
        if (typeof value === "number") return value
        if (typeof value === "string") {
            const parsedDate = Date.parse(value)
            return Number.isNaN(parsedDate) ? 0 : parsedDate
        }
        if (value instanceof Date) return value.getTime()
        return 0
    }
    function sortOwnedNotes(notes, languageCode = "ru") {
        return [...notes].sort((firstNote, secondNote) => {
            const firstOrder = Number.isFinite(firstNote?.order) ? firstNote.order : Number.POSITIVE_INFINITY
            const secondOrder = Number.isFinite(secondNote?.order) ? secondNote.order : Number.POSITIVE_INFINITY
            if (firstOrder !== secondOrder) return firstOrder - secondOrder
            const firstCreatedAt = normalizeDateValue(firstNote?.createdAt)
            const secondCreatedAt = normalizeDateValue(secondNote?.createdAt)
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            const firstUpdatedAt = normalizeDateValue(firstNote?.updatedAt)
            const secondUpdatedAt = normalizeDateValue(secondNote?.updatedAt)
            if (firstUpdatedAt !== secondUpdatedAt) return secondUpdatedAt - firstUpdatedAt
            return String(firstNote?.id || "").localeCompare(String(secondNote?.id || ""), languageCode)
        })
    }
    return { sortOwnedNotes }
})()

const NotesAggregationService = (() => {
    function aggregate(ownedNotes, activeUid) {
        const mergedNotes = NotesStorage.applyStoredFavorites([...(ownedNotes || [])])
        if (activeUid) NotesStorage.writeCachedNotes(activeUid, mergedNotes)
        NotesStorage.syncFavoritesStorage(mergedNotes)
        return mergedNotes
    }
    return { aggregate }
})()

const normalizeFolderRecord = (rawFolder) => {
    const safe = rawFolder && typeof rawFolder === "object" ? rawFolder : {}
    const createdAt = NoteIO.normalizeDateInput(safe.createdAt ?? safe.created_at) || Utils.serverTimestamp()
    const updatedAt = NoteIO.normalizeDateInput(safe.updatedAt ?? safe.updated_at) || createdAt
    const rawAccessRole = String(safe.accessRole || safe.access_role || "").trim().toLowerCase()
    const rawAccessStatus = String(safe.accessStatus || safe.access_status || "").trim().toLowerCase()
    return {
        id: String(safe.id || ""),
        name: String(safe.name || "").trim(),
        description: String(safe.description || "").trim(),
        folderOrder: Number.isFinite(Number(safe.folderOrder))
            ? Number(safe.folderOrder)
            : Number.isFinite(Number(safe.sort_order))
                ? Number(safe.sort_order)
                : 0,
        isHidden: safe.isHidden === true || safe.is_hidden === true,
        isArchived: safe.isArchived === true || safe.is_archived === true,
        trashedAt: safe.trashedAt || null,
        createdAt,
        updatedAt,
        ownerUid: String(safe.ownerUid || safe.owner_uid || safe.user_id || ""),
        accessRole: rawAccessRole === "editor" || rawAccessRole === "viewer" ? rawAccessRole : "owner",
        accessStatus: ["pending", "accepted", "rejected"].includes(rawAccessStatus) ? rawAccessStatus : "accepted"
    }
}

const RemindersService = (() => {
    const reminderTimers = new Map()
    let unsubscribeState = null
    function clearTimers() {
        reminderTimers.forEach(timer => clearTimeout(timer))
        reminderTimers.clear()
    }
    function normalizeReminderTime(value) {
        if (value instanceof Date) return value.getTime()
        const parsedTime = Date.parse(value || "")
        return Number.isNaN(parsedTime) ? 0 : parsedTime
    }
    function schedule(notes) {
        clearTimers()
        ;(notes || []).forEach(note => {
            const reminderTime = normalizeReminderTime(note?.reminderAt)
            if (!reminderTime) return
            const delay = reminderTime - Date.now()
            if (delay <= 0 || delay > 2147483647) return
            const timer = setTimeout(() => EventBus.publish("reminderTriggered", note), delay)
            reminderTimers.set(String(note.id || reminderTime), timer)
        })
    }
    function start() {
        if (unsubscribeState) return
        unsubscribeState = StateStore.subscribe(nextState => {
            schedule(nextState.notes || [])
        })
        schedule(StateStore.read().notes || [])
    }
    function stop() {
        if (unsubscribeState) unsubscribeState()
        unsubscribeState = null
        clearTimers()
    }
    return { start, stop }
})()

const NOTIFICATION_PERMISSION_STATE_KEY = "reminder-notification-permission-state"

const NotificationService = (() => {
    const getPermission = () => {
        if (typeof Notification === "undefined") return "unsupported"
        return String(Notification.permission || "default")
    }

    const ensurePermission = async (options = {}) => {
        const force = options && options.force === true
        if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") {
            return { supported: false, permission: "unsupported", changed: false }
        }

        const currentPermission = getPermission()
        if (currentPermission === "granted" || currentPermission === "denied") {
            return { supported: true, permission: currentPermission, changed: false }
        }

        if (!force && SafeStorage.local.get(NOTIFICATION_PERMISSION_STATE_KEY) === "requested") {
            return { supported: true, permission: currentPermission, changed: false }
        }

        SafeStorage.local.set(NOTIFICATION_PERMISSION_STATE_KEY, "requested")
        const nextPermission = await Notification.requestPermission()
        return { supported: true, permission: String(nextPermission || "default"), changed: true }
    }

    const showReminderNotification = (title, body) => {
        if (typeof Notification === "undefined") return false
        if (getPermission() !== "granted") return false
        try {
            new Notification(String(title || ""), { body: String(body || "") })
            return true
        } catch {
            return false
        }
    }

    return {
        getPermission,
        ensurePermission,
        showReminderNotification
    }
})()

window.NotificationService = NotificationService;

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
            interface: {
                showSavedFilters: StateStore.read().config.interface?.showSavedFilters !== false,
                showTagFilter: StateStore.read().config.interface?.showTagFilter !== false,
                showUpdatedPeriodFilter: StateStore.read().config.interface?.showUpdatedPeriodFilter !== false
            },
            customPresets: ThemeManager.getCustomPresets(),
            schemaVersion: 1
        }
    }
    function normalizeUserSettings(rawSettings) {
        const defaults = createDefaultUserSettings()
        const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {}
        const notesPerPageOptions = new Set([5, 10, 20, 50])
        const notesPerPage = notesPerPageOptions.has(Number(source.notesPerPage)) ? Number(source.notesPerPage) : 20
        const themeId = typeof source.themeId === "string" && source.themeId ? source.themeId : defaults.themeId
        const presetTheme = ThemeManager.resolvePreset(themeId)
        const customThemeSource = source.customTheme && typeof source.customTheme === "object" ? source.customTheme : defaults.customTheme
        const normalizedTheme = {
            p: typeof customThemeSource.p === "string" && customThemeSource.p.trim() ? ThemeManager.normalizeHex(customThemeSource.p) : presetTheme.p,
            bg: typeof customThemeSource.bg === "string" && customThemeSource.bg.trim() ? ThemeManager.normalizeHex(customThemeSource.bg) : presetTheme.bg,
            t: typeof customThemeSource.t === "string" && customThemeSource.t.trim() ? ThemeManager.normalizeHex(customThemeSource.t) : presetTheme.t,
            mainBackgroundUrl: String(customThemeSource.mainBackgroundUrl || ""), sidebarBackgroundUrl: String(customThemeSource.sidebarBackgroundUrl || ""),
            mainBackgroundImage: String(customThemeSource.mainBackgroundImage || ""), sidebarBackgroundImage: String(customThemeSource.sidebarBackgroundImage || ""),
            uiOpacity: typeof customThemeSource.uiOpacity === "number" ? customThemeSource.uiOpacity : 0.78,
            cardsOpacity: typeof customThemeSource.cardsOpacity === "number" ? customThemeSource.cardsOpacity : 0.9
        }
        return {
            notesPerPage,
            themeId,
            customTheme: normalizedTheme,
            backgroundType: ThemeManager.pickRuntimeBackgroundValue(normalizedTheme.mainBackgroundUrl, normalizedTheme.mainBackgroundImage) ? "image" : "none",
            backgroundValue: ThemeManager.pickRuntimeBackgroundValue(normalizedTheme.mainBackgroundUrl, normalizedTheme.mainBackgroundImage),
            lang: source.lang === "en" ? "en" : "ru",
            folderViewMode: source.folderViewMode === "full" ? "full" : "compact",
            reduceMotion: !!source.reduceMotion,
            interface: {
                showSavedFilters: source.interface?.showSavedFilters !== false,
                showTagFilter: source.interface?.showTagFilter !== false,
                showUpdatedPeriodFilter: source.interface?.showUpdatedPeriodFilter !== false
            },
            customPresets: Array.isArray(source.customPresets) ? source.customPresets : defaults.customPresets,
            schemaVersion: 1
        }
    }
    function getCacheKey(uid) { return `user-settings-cache:${String(uid || "")}` }
    function cloneSettings(settings) {
        return JSON.parse(JSON.stringify(settings))
    }
    function writeOriginal(settings) {
        const cloned = cloneSettings(settings)
        StateStore.set(previousState => ({
            ...previousState,
            originalUserSettings: cloned,
            draftUserSettings: cloneSettings(cloned)
        }))
    }
    function applyToRuntime(userSettings, options = {}) {
        const settings = normalizeUserSettings(userSettings)
        const mergedCustomPresets = ThemeManager.mergeCloudPresetsWithLocalPresets(ThemeManager.getCustomPresets(), settings.customPresets)
        ThemeManager.setCustomPresets(mergedCustomPresets)
        ThemeManager.applySettings({ preset: settings.themeId, ...settings.customTheme }, options.persistTheme !== false)
        StateActions.updateConfig({ lang: settings.lang, folderViewMode: settings.folderViewMode, reduceMotion: settings.reduceMotion, interface: settings.interface })
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

const OwnedNotesService = (() => {
    const state = { unsubscribe: null, user: null, notes: [] }
    function applySnapshot(snapshot) {
        const incomingNotes = snapshot.docs.map(documentEntry => NoteIO.normalizeNote({ id: documentEntry.id, ...documentEntry.data() }))
        state.notes = NotesSortingStrategy.sortOwnedNotes(incomingNotes, StateStore.read().config.lang || "ru")
        console.info("[Session] subscribe owned notes snapshot size=", state.notes.length)
        PaginationService.setOwnedPaginationInfo({ hasMoreOwnedNotes: snapshot.docs.length >= PaginationService.getOwnedPaginationInfo().pageSize, lastOwnedNoteDocument: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null })
        EventBus.publish("ownedNotesUpdated", state.notes.slice())
    }
    async function loadMore() {
        if (!state.user) return
        const paginationInfo = PaginationService.getOwnedPaginationInfo()
        if (!paginationInfo.hasMoreOwnedNotes || paginationInfo.loadingMoreOwnedNotes) return
        PaginationService.setLoadingMoreOwnedNotes(true)
        try {
            const response = await NotesRepository.loadMoreOwnedNotes(state.user, { pageSize: paginationInfo.pageSize, startAfterDocument: paginationInfo.lastOwnedNoteDocument })
            const nextNotes = response.documents.map(documentEntry => NoteIO.normalizeNote({ id: documentEntry.id, ...documentEntry.data() }))
            const existingById = new Map(state.notes.map(note => [note.id, note]))
            nextNotes.forEach(note => existingById.set(note.id, note))
            state.notes = NotesSortingStrategy.sortOwnedNotes([...existingById.values()], StateStore.read().config.lang || "ru")
            PaginationService.setOwnedPaginationInfo({ hasMoreOwnedNotes: response.documents.length >= paginationInfo.pageSize, lastOwnedNoteDocument: response.lastDocument })
            EventBus.publish("ownedNotesUpdated", state.notes.slice())
        } finally {
            PaginationService.setLoadingMoreOwnedNotes(false)
            EventBus.publish("paginationUpdated", PaginationService.getLoadMoreState())
        }
    }
    function subscribe(user) {
        state.user = user
        if (state.unsubscribe) state.unsubscribe()
        console.info("[Session] subscribe owned notes begin")
        state.unsubscribe = NotesRepository.subscribeOwnedNotes(user, { pageSize: PaginationService.getOwnedPaginationInfo().pageSize }, applySnapshot, error => EventBus.publish("notesSyncError", error))
    }
    function clear() {
        if (state.unsubscribe) state.unsubscribe()
        state.unsubscribe = null
        state.user = null
        state.notes = []
    }
    function getNotes() {
        return state.notes.slice()
    }
    return { subscribe, clear, loadMore, getNotes }
})()

const SessionService = (() => {
    const state = { activeUid: null, sessionStartPromise: null, foldersUnsubscribe: null, ownedNotes: [] }
    function sortFolders(folders) {
        return [...folders].sort((firstFolder, secondFolder) => {
            const firstCreatedAt = firstFolder?.createdAt instanceof Date ? firstFolder.createdAt.getTime() : Date.parse(firstFolder?.createdAt || "") || 0
            const secondCreatedAt = secondFolder?.createdAt instanceof Date ? secondFolder.createdAt.getTime() : Date.parse(secondFolder?.createdAt || "") || 0
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            return String(firstFolder?.name || "").localeCompare(String(secondFolder?.name || ""), StateStore.read().config.lang || "ru")
        })
    }
    function publishNotes() {
        const aggregatedNotes = NotesAggregationService.aggregate(state.ownedNotes, state.activeUid)
        StateStore.update("notes", aggregatedNotes)
    }
    function bindAggregation() {
        EventBus.subscribe("ownedNotesUpdated", ownedNotes => {
            state.ownedNotes = Array.isArray(ownedNotes) ? ownedNotes : []
            publishNotes()
        })
    }
    bindAggregation()
    function stopUserSession() {
        if (state.foldersUnsubscribe) state.foldersUnsubscribe()
        state.foldersUnsubscribe = null
        SettingsSyncService.clear()
        OwnedNotesService.clear()
        RemindersService.stop()
        state.activeUid = null
        state.ownedNotes = []
        StateStore.resetSession()
    }
    async function startUserSession(user, options = {}) {
        console.info("[Session] startUserSession begin", user?.uid || "")
        if (!user?.uid) return
        const userIdentifier = String(user.uid)
        if (!options.forceResubscribe && state.activeUid === userIdentifier && state.sessionStartPromise) return state.sessionStartPromise
        state.activeUid = userIdentifier
        state.sessionStartPromise = (async () => {
            try {
                StateActions.setUser(user)
                await DataPath.ensureUserDocument(user)
                await SettingsSyncService.initialize(user)
                OwnedNotesService.subscribe(user)
                const cachedNotes = NotesStorage.readCachedNotes(user.uid)
                if (cachedNotes.length) {
                    StateStore.update("notes", NotesStorage.applyStoredFavorites(cachedNotes))
                }
                if (state.foldersUnsubscribe) state.foldersUnsubscribe()
                state.foldersUnsubscribe = FoldersRepository.subscribeFolders(user, snapshot => {
                    const folders = sortFolders(snapshot.docs.map(documentEntry => normalizeFolderRecord({ id: documentEntry.id, ...documentEntry.data() })))
                    StateStore.update("folders", folders)
                }, error => EventBus.publish("foldersSyncError", error))
                RemindersService.start()
                return true
            } catch (error) {
                console.error("[Session] error", { code: error?.code || "", message: error?.message || String(error || ""), stack: error?.stack || "" })
                EventBus.publish("notesLoadFailed", error)
                throw error
            }
        })()
        return state.sessionStartPromise
    }
    return { startUserSession, stopUserSession }
})()

window.SessionService = SessionService

const NotesQueryService = (() => {
    function normalizeVisibleNotes(list, orderKey = "order") {
        if (!Array.isArray(list)) return []
        const normalizedNotes = list.map(note => {
            const normalizedNote = NoteIO.normalizeNote(note)
            return normalizedNote
        })
        normalizedNotes.sort((firstNote, secondNote) => {
            if (!!secondNote.isPinned !== !!firstNote.isPinned) return firstNote.isPinned ? -1 : 1
            const firstValue = typeof firstNote[orderKey] === "number" ? firstNote[orderKey] : 0
            const secondValue = typeof secondNote[orderKey] === "number" ? secondNote[orderKey] : 0
            return firstValue - secondValue
        })
        return normalizedNotes
    }

    function getTimestampValue(value) {
        if (!value) return 0
        if (typeof value === "number") return value
        if (typeof value === "string") {
            const parsedDate = Date.parse(value)
            return Number.isNaN(parsedDate) ? 0 : parsedDate
        }
        if (value instanceof Date) return value.getTime()
        return 0
    }

    function getTextLength(note) {
        const noteText = `${note.title || ""} ${Utils.stripHtml(note.content || "")}`.trim()
        return noteText.length
    }

    function sortVisibleNotes(list, sortMode, scores, languageCode) {
        const pinnedNotes = list.filter(note => !!note.isPinned)
        const unpinnedNotes = list.filter(note => !note.isPinned)
        const compareNotes = (firstNote, secondNote) => {
            if (sortMode === "title") {
                return String(firstNote.title || "").localeCompare(String(secondNote.title || ""), languageCode, { sensitivity: "base" })
            }
            if (sortMode === "length") {
                return getTextLength(secondNote) - getTextLength(firstNote)
            }
            if (sortMode === "importance") {
                if (!!secondNote.isFavorite !== !!firstNote.isFavorite) return firstNote.isFavorite ? -1 : 1
                return getTimestampValue(secondNote.updatedAt || secondNote.createdAt) - getTimestampValue(firstNote.updatedAt || firstNote.createdAt)
            }
            if (sortMode === "relevance") {
                const firstRelevance = scores
                    ? (scores.get(firstNote.id) || 0)
                    : (Number.isFinite(Number(firstNote.relevance)) ? Number(firstNote.relevance) : (Number(firstNote.aiRelevance) || 0))
                const secondRelevance = scores
                    ? (scores.get(secondNote.id) || 0)
                    : (Number.isFinite(Number(secondNote.relevance)) ? Number(secondNote.relevance) : (Number(secondNote.aiRelevance) || 0))
                if (secondRelevance !== firstRelevance) return secondRelevance - firstRelevance
                return getTimestampValue(secondNote.updatedAt || secondNote.createdAt) - getTimestampValue(firstNote.updatedAt || firstNote.createdAt)
            }
            return getTimestampValue(secondNote.updatedAt || secondNote.createdAt) - getTimestampValue(firstNote.updatedAt || firstNote.createdAt)
        }
        pinnedNotes.sort(compareNotes)
        unpinnedNotes.sort(compareNotes)
        return [...pinnedNotes, ...unpinnedNotes]
    }

    function isHiddenLocked(note) {
        return !!(note && note.lock && note.lock.hidden)
    }

    function isReminderNote(note) {
        return getTimestampValue(note?.reminderAt) > Date.now()
    }

    function matchesTagFilters(note, selectedTags) {
        const normalizedSelectedTags = Array.isArray(selectedTags)
            ? selectedTags.map(tag => String(tag || "").trim().toLocaleLowerCase()).filter(Boolean)
            : []
        if (!normalizedSelectedTags.length) return true
        const noteTags = [
            ...(Array.isArray(note?.tags) ? note.tags : []),
            ...(Array.isArray(note?.hiddenTags) ? note.hiddenTags : [])
        ]
            .map(tag => String(tag || "").trim().toLocaleLowerCase())
            .filter(Boolean)
        if (!noteTags.length) return false
        return normalizedSelectedTags.some(tag => noteTags.includes(tag))
    }

    function matchesUpdatedWindow(note, updatedWindowDays) {
        const normalizedWindowDays = Number(updatedWindowDays || 0)
        if (!normalizedWindowDays) return true
        const noteTimestamp = getTimestampValue(note?.updatedAt || note?.createdAt)
        if (!noteTimestamp) return false
        const threshold = Date.now() - (normalizedWindowDays * 24 * 60 * 60 * 1000)
        return noteTimestamp >= threshold
    }

    function filterByView(notes, stateSnapshot) {
        const view = stateSnapshot.view
        const activeFolderId = stateSnapshot.activeFolderId
        const hiddenFolderIdentifiers = new Set(
            (stateSnapshot.folders || [])
                .filter(folder => folder.isHidden && !folder.trashedAt)
                .map(folder => folder.id)
        )

        let filteredNotes = Array.isArray(notes) ? notes.slice() : []
        if (view === "locked") {
            filteredNotes = filteredNotes.filter(isHiddenLocked)
        } else {
            filteredNotes = filteredNotes.filter(note => !isHiddenLocked(note))
        }

        if (view === "notes") filteredNotes = filteredNotes.filter(note => !!note)
        if (view === "reminders") filteredNotes = filteredNotes.filter(note => isReminderNote(note) && !note.isArchived && !note.trashedAt)
        if (view === "trash") filteredNotes = filteredNotes.filter(note => !!note.trashedAt)
        else filteredNotes = filteredNotes.filter(note => !note.trashedAt)

        if (view === "favorites") filteredNotes = filteredNotes.filter(note => note.isFavorite && !note.isArchived)
        else if (view === "archive") filteredNotes = filteredNotes.filter(note => note.isArchived)
        else if (view === "folder") filteredNotes = filteredNotes.filter(note => note.folderId === activeFolderId)
        else if (view !== "locked" && view !== "reminders" && view !== "trash") filteredNotes = filteredNotes.filter(note => !note.isArchived)

        if (view !== "folder") {
            filteredNotes = filteredNotes.filter(note => !note.folderId || !hiddenFolderIdentifiers.has(note.folderId))
        }

        const configuredFilter = stateSnapshot.config?.notesFilter || { sort: "manual", folders: [], tags: [], updatedWindowDays: 0 }
        const selectedFolders = Array.isArray(configuredFilter.folders) ? configuredFilter.folders : []
        const selectedTags = Array.isArray(configuredFilter.tags) ? configuredFilter.tags : []
        const updatedWindowDays = Number(configuredFilter.updatedWindowDays || 0)
        const canUseFolderFilters = view !== "folder" && view !== "folders" && view !== "archive" && view !== "trash"

        if (canUseFolderFilters && selectedFolders.length) {
            filteredNotes = filteredNotes.filter(note => {
                if (!note.folderId) return selectedFolders.includes("none")
                return selectedFolders.includes(note.folderId)
            })
        }

        filteredNotes = filteredNotes.filter(note => matchesTagFilters(note, selectedTags))
        filteredNotes = filteredNotes.filter(note => matchesUpdatedWindow(note, updatedWindowDays))

        return filteredNotes
    }

    function applySearch(notes, query) {
        const normalizedQuery = String(query || "").trim()
        if (!normalizedQuery) return { notes, scores: null }
        try {
            const normalizedNeedle = normalizedQuery.toLocaleLowerCase()
            const scoredNotes = notes.map(note => {
                const titleScore = SmartSearch.score(normalizedQuery, note.title, "", note.tags, [], note.hiddenTags)
                const contentScore = SmartSearch.score(normalizedQuery, "", note.content, [], [], [])
                const tagsScore = SmartSearch.score(normalizedQuery, "", "", note.tags, [], [])
                const hiddenTagsScore = SmartSearch.score(normalizedQuery, "", "", [], [], note.hiddenTags)
                const combinedScore = (titleScore * 4.6) + (contentScore * 2.4) + (tagsScore * 1.4) + (hiddenTagsScore * 1.1)
                const highestFieldScore = Math.max(titleScore, contentScore, tagsScore, hiddenTagsScore)
                return {
                    note,
                    score: combinedScore,
                    highestFieldScore,
                    titleScore,
                    contentScore,
                    tagsScore,
                    hiddenTagsScore
                }
            }).map(item => {
                const normalizedTitle = String(item.note?.title || "").toLocaleLowerCase()
                if (normalizedTitle === normalizedNeedle) return { ...item, score: item.score + 3 }
                if (normalizedTitle.startsWith(normalizedNeedle)) return { ...item, score: item.score + 1.8 }
                if (normalizedTitle.includes(normalizedNeedle)) return { ...item, score: item.score + 0.9 }
                return item
            }).filter(item => {
                if (item.titleScore >= 0.23) return true
                if (item.tagsScore >= 0.31 || item.hiddenTagsScore >= 0.34) return true
                return item.contentScore >= 0.42 && item.highestFieldScore >= 0.42
            })
            return {
                notes: scoredNotes.map(item => item.note),
                scores: new Map(scoredNotes.map(item => [item.note.id, item.score]))
            }
        } catch (error) {
            EventBus.publish("searchFailed", error)
            return { notes, scores: null }
        }
    }

    function execute(stateSnapshot, query) {
        const filteredByView = filterByView(stateSnapshot.notes || [], stateSnapshot)
        const searchResult = applySearch(filteredByView, query)
        const configuredSortMode = stateSnapshot.config?.notesFilter?.sort || "updated"
        const useRelevanceSorting = String(query || "").trim().length > 0
        const sortMode = useRelevanceSorting ? "relevance" : configuredSortMode
        const sortedNotes = sortMode === "manual"
            ? normalizeVisibleNotes(searchResult.notes, stateSnapshot.view === "folder" ? "folderOrder" : "order")
            : sortVisibleNotes(searchResult.notes, sortMode, sortMode === "relevance" ? searchResult.scores : null, stateSnapshot.config?.lang || "ru")
        return {
            view: stateSnapshot.view,
            notes: sortedNotes
        }
    }

    return {
        execute
    }
})()

window.NotesQueryService = NotesQueryService

