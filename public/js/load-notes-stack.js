const NotesRepository = (() => {
    const isSharedAccessEnabled = () => window.AppFeatures?.sharedAccess === true
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
    function subscribeSharedEntries(user, next, error) {
        if (!isSharedAccessEnabled()) {
            if (typeof next === "function") next({ forEach() {} })
            return () => {}
        }
        const collection = DataPath.getUserSharedCollection(user, "sharedNotes")
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }
    function subscribeSharedNote(ownerUid, noteId, next, error) {
        if (!isSharedAccessEnabled() || !db) return () => {}
        return db.collection("users").doc(ownerUid).collection("notes").doc(noteId).onSnapshot(next, error)
    }
    return { subscribeOwnedNotes, loadMoreOwnedNotes, subscribeSharedEntries, subscribeSharedNote }
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
    async function resolveReference(user) {
        const primaryReference = DataPath.getUserSettingsReference(user)
        const fallbackReference = DataPath.getUserLegacySettingsReference(user)
        if (!primaryReference && !fallbackReference) return { reference: null, snapshot: null, storageType: null }
        if (primaryReference) {
            try {
                const snapshot = await primaryReference.get()
                return { reference: primaryReference, snapshot, storageType: "settings" }
            } catch (error) {
                if (String(error?.code || "") !== "permission-denied") throw error
            }
        }
        if (!fallbackReference) return { reference: null, snapshot: null, storageType: null }
        const snapshot = await fallbackReference.get()
        return { reference: fallbackReference, snapshot, storageType: "preferences" }
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

const WorkspacesRepository = (() => {
    const isWorkspacesEnabled = () => window.AppFeatures?.workspaces === true
    function getWorkspaceReference(workspaceId) {
        const normalizedWorkspaceId = String(workspaceId || "")
        if (!isWorkspacesEnabled() || !db || !normalizedWorkspaceId) return null
        return db.collection("workspaces").doc(normalizedWorkspaceId)
    }

    function getWorkspaceNotesCollection(workspaceId) {
        const workspaceReference = getWorkspaceReference(workspaceId)
        return workspaceReference ? workspaceReference.collection("notes") : null
    }

    function subscribeUserWorkspaces(user, next, error) {
        if (!isWorkspacesEnabled()) {
            if (typeof next === "function") next({ forEach() {} })
            return () => {}
        }
        const collection = DataPath.getUserSharedCollection(user, "sharedWorkspaces")
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }

    function subscribeWorkspace(workspaceId, next, error) {
        const workspaceReference = getWorkspaceReference(workspaceId)
        if (!workspaceReference) return () => {}
        return workspaceReference.onSnapshot(next, error)
    }

    function subscribeWorkspaceNotes(workspaceId, next, error) {
        const collection = getWorkspaceNotesCollection(workspaceId)
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }

    return {
        getWorkspaceReference,
        getWorkspaceNotesCollection,
        subscribeUserWorkspaces,
        subscribeWorkspace,
        subscribeWorkspaceNotes
    }
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
        if (value.seconds) return value.seconds * 1000
        if (value.toDate) return value.toDate().getTime()
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
    function aggregate(ownedNotes, sharedNotes, workspaceNotes, activeUid) {
        const mergedNotes = NotesStorage.applyStoredFavorites([...(ownedNotes || []), ...(sharedNotes || []), ...(workspaceNotes || [])])
        if (activeUid) NotesStorage.writeCachedNotes(activeUid, mergedNotes)
        NotesStorage.syncFavoritesStorage(mergedNotes)
        return mergedNotes
    }
    return { aggregate }
})()

const RemindersService = (() => {
    const reminderTimers = new Map()
    let unsubscribeState = null
    function clearTimers() {
        reminderTimers.forEach(timer => clearTimeout(timer))
        reminderTimers.clear()
    }
    function normalizeReminderTime(value) {
        if (value?.toDate) return value.toDate().getTime()
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
    function writeOriginal(settings) { StateStore.update("originalUserSettings", JSON.parse(JSON.stringify(settings))) }
    async function externalizeAppearanceMedia(settings) {
        const source = settings && typeof settings === "object" ? settings : null
        if (!source?.customTheme) return source
        const mediaService = window.ExternalMediaService || window.GoogleDriveMediaService
        const status = mediaService?.getStatus?.() || null
        if (!status?.linked || typeof mediaService?.uploadDataUrl !== "function") return source
        const nextSettings = JSON.parse(JSON.stringify(source))
        const entries = [
            { imageField: "mainBackgroundImage", urlField: "mainBackgroundUrl", fileNameBase: "main_background" },
            { imageField: "sidebarBackgroundImage", urlField: "sidebarBackgroundUrl", fileNameBase: "sidebar_background" }
        ]
        for (const entry of entries) {
            const imageValue = String(nextSettings.customTheme?.[entry.imageField] || "")
            if (!imageValue.startsWith("data:image/")) continue
            const publicUrl = await mediaService.uploadDataUrl(imageValue, { fileNameBase: entry.fileNameBase })
            nextSettings.customTheme[entry.urlField] = publicUrl
            nextSettings.customTheme[entry.imageField] = ""
        }
        return nextSettings
    }
    function applyToRuntime(userSettings, options = {}) {
        const settings = normalizeUserSettings(userSettings)
        ThemeManager.applySettings({ preset: settings.themeId, ...settings.customTheme }, options.persistTheme !== false)
        const mergedCustomPresets = ThemeManager.mergeCloudPresetsWithLocalPresets(ThemeManager.getCustomPresets(), settings.customPresets)
        ThemeManager.setCustomPresets(mergedCustomPresets)
        StateActions.updateConfig({ lang: settings.lang, folderViewMode: settings.folderViewMode, reduceMotion: settings.reduceMotion, interface: settings.interface })
        PaginationService.configureFromSettings(settings)
        if (options.resetVisibleLimit) PaginationService.resetVisibleLimit()
    }
    async function saveUserSettings(settingsToSave) {
        const user = StateStore.read().user
        if (!user) return null
        const externalizedSettings = await externalizeAppearanceMedia(settingsToSave)
        const normalized = normalizeUserSettings(externalizedSettings)
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

const SharedNotesService = (() => {
    const state = { user: null, unsubscribeEntries: null, sharedEntries: new Map(), sharedNotes: new Map(), sharedNoteUnsubscribers: new Map() }
    function shouldIgnoreSharedError(error) {
        const code = String(error?.code || "")
        return code === "permission-denied" || code === "failed-precondition"
    }
    function removeSharedEntry(sharedId) {
        const unsubscribeNote = state.sharedNoteUnsubscribers.get(sharedId)
        if (unsubscribeNote) unsubscribeNote()
        state.sharedNoteUnsubscribers.delete(sharedId)
        state.sharedEntries.delete(sharedId)
        state.sharedNotes.delete(sharedId)
    }
    function publishSharedNotes() {
        const sharedNotes = [...state.sharedNotes.values()]
        console.info("[Session] subscribe shared notes snapshot size=", sharedNotes.length)
        EventBus.publish("sharedNotesUpdated", sharedNotes)
    }
    function updateEntries(nextEntries) {
        const removedIds = []
        state.sharedEntries.forEach((entry, sharedId) => {
            if (!nextEntries.has(sharedId)) removedIds.push(sharedId)
        })
        removedIds.forEach(removeSharedEntry)
        nextEntries.forEach((entry, sharedId) => {
            if (!entry.permission) {
                removeSharedEntry(sharedId)
                return
            }
            if (state.sharedEntries.has(sharedId)) return
            state.sharedEntries.set(sharedId, entry)
            const unsubscribeNote = NotesRepository.subscribeSharedNote(entry.ownerUid, entry.noteId, noteSnapshot => {
                if (!noteSnapshot.exists) {
                    removeSharedEntry(sharedId)
                    publishSharedNotes()
                    return
                }
                const normalizedNote = NoteIO.normalizeNote({ id: entry.noteId, ...noteSnapshot.data() })
                const currentUserUid = state.user?.uid || ""
                const roles = normalizedNote.access?.roles && typeof normalizedNote.access.roles === "object" ? normalizedNote.access.roles : {}
                if (currentUserUid && !roles[currentUserUid]) {
                    removeSharedEntry(sharedId)
                    EventBus.publish("permissionRevoked", { sharedId, ownerUid: entry.ownerUid, noteId: entry.noteId })
                    publishSharedNotes()
                    return
                }
                state.sharedNotes.set(sharedId, {
                    ...normalizedNote,
                    id: CollaborationService.sharedNoteId(entry.ownerUid, entry.noteId),
                    access: { ownerUid: entry.ownerUid, ownerCollection: "users", noteId: entry.noteId, shareId: sharedId, roles: { ...roles, ...(currentUserUid ? { [currentUserUid]: entry.permission } : {}) } }
                })
                publishSharedNotes()
            }, error => {
                if (shouldIgnoreSharedError(error)) {
                    removeSharedEntry(sharedId)
                    publishSharedNotes()
                    return
                }
                EventBus.publish("sharedSyncError", error)
            })
            state.sharedNoteUnsubscribers.set(sharedId, unsubscribeNote)
        })
        publishSharedNotes()
    }
    function subscribe(user) {
        state.user = user
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = NotesRepository.subscribeSharedEntries(user, snapshot => {
            const entries = new Map()
            snapshot.forEach(documentEntry => {
                const entry = documentEntry.data() || {}
                entries.set(documentEntry.id, { id: documentEntry.id, noteId: entry.noteId, ownerUid: entry.ownerUid, permission: entry.permission || "viewer" })
            })
            updateEntries(entries)
        }, error => {
            if (shouldIgnoreSharedError(error)) {
                state.sharedEntries.clear()
                state.sharedNotes.clear()
                publishSharedNotes()
                return
            }
            EventBus.publish("sharedSyncError", error)
        })
    }
    function clear() {
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = null
        state.sharedNoteUnsubscribers.forEach(unsubscribe => unsubscribe())
        state.sharedNoteUnsubscribers.clear()
        state.sharedEntries.clear()
        state.sharedNotes.clear()
        state.user = null
    }
    return { subscribe, clear }
})()

const WorkspaceAccessService = (() => {
    const isWorkspacesEnabled = () => window.AppFeatures?.workspaces === true
    const shareCollection = "workspaceShares"
    const pendingTokenKey = "pending-workspace-share-token"

    function normalizeRole(role) {
        return role === "owner" || role === "editor" || role === "viewer" ? role : "editor"
    }

    function buildWorkspaceShareUrl(token) {
        const url = new URL(window.location.href)
        url.searchParams.set("workspaceShare", token)
        return url.toString()
    }

    function getWorkspaceShareTokenFromUrl() {
        const url = new URL(window.location.href)
        return String(url.searchParams.get("workspaceShare") || "").trim()
    }

    function normalizeShareToken(value) {
        const raw = String(value || "").trim()
        if (!raw) return ""
        if (/^[A-Za-z0-9_-]{12,}$/.test(raw)) return raw
        try {
            const url = new URL(raw)
            return String(url.searchParams.get("workspaceShare") || "").trim()
        } catch {
            return ""
        }
    }

    async function generateToken() {
        if (window.crypto?.getRandomValues) {
            const bytes = new Uint8Array(16)
            window.crypto.getRandomValues(bytes)
            const raw = String.fromCharCode(...bytes)
            return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
        }
        return `${Utils.generateId()}${Date.now().toString(36)}`
    }

    function getWorkspaceRole(workspace) {
        const userUid = StateStore.read().user?.uid || ""
        if (!workspace || !userUid) return "viewer"
        if (workspace.ownerUid === userUid) return "owner"
        if (workspace.role) return normalizeRole(workspace.role)
        return normalizeRole(workspace.members?.[userUid])
    }

    function canManageWorkspace(workspace) {
        return getWorkspaceRole(workspace) === "owner"
    }

    function canEditWorkspace(workspace) {
        const role = getWorkspaceRole(workspace)
        return role === "owner" || role === "editor"
    }

    async function createWorkspace(name, description = "") {
        if (!isWorkspacesEnabled()) return null
        const user = StateStore.read().user
        if (!db || !user?.uid) return null
        const normalizedName = String(name || "").trim()
        const normalizedDescription = String(description || "").trim()
        if (!normalizedName || normalizedName.length > 50 || normalizedDescription.length > 300) return null
        const workspaceReference = db.collection("workspaces").doc()
        const payload = {
            name: normalizedName,
            ownerUid: user.uid,
            members: { [user.uid]: "owner" },
            memberNames: { [user.uid]: String(user.displayName || (user.email ? user.email.split("@")[0] : user.uid) || user.uid) },
            description: normalizedDescription,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
        const membershipPayload = {
            workspaceId: workspaceReference.id,
            role: "owner",
            workspaceName: normalizedName,
            ownerUid: user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
        const batch = db.batch()
        batch.set(workspaceReference, payload)
        batch.set(DataPath.getUserSharedCollection(user, "sharedWorkspaces").doc(workspaceReference.id), membershipPayload, { merge: true })
        await batch.commit()
        return { id: workspaceReference.id, ...payload }
    }

    async function addMemberByUid(workspaceId, targetUid, role = "editor") {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        if (!db || !user?.uid) return false
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedTargetUid = String(targetUid || "").trim()
        if (!normalizedWorkspaceId || !normalizedTargetUid) return false
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(normalizedWorkspaceId)
        if (!workspaceReference) return false
        const workspaceSnapshot = await workspaceReference.get()
        if (!workspaceSnapshot.exists) return false
        const workspace = workspaceSnapshot.data() || {}
        if (String(workspace.ownerUid || "") !== user.uid) return false
        const userProfileSnapshot = await db.collection("users").doc(normalizedTargetUid).get().catch(() => null)
        const userProfile = userProfileSnapshot?.data?.() || {}
        const targetDisplayName = String(userProfile.displayName || normalizedTargetUid)
        await workspaceReference.update({
            [`members.${normalizedTargetUid}`]: normalizeRole(role),
            [`memberNames.${normalizedTargetUid}`]: targetDisplayName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        await db.collection("users").doc(normalizedTargetUid).collection("sharedWorkspaces").doc(normalizedWorkspaceId).set({
            workspaceId: normalizedWorkspaceId,
            role: normalizeRole(role),
            workspaceName: String(workspace.name || ""),
            ownerUid: workspace.ownerUid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        return true
    }

    async function createInviteLink(workspaceId, role = "editor") {
        if (!isWorkspacesEnabled()) return ""
        const user = StateStore.read().user
        if (!db || !user?.uid) return ""
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        if (!normalizedWorkspaceId) return ""
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(normalizedWorkspaceId)
        if (!workspaceReference) return ""
        const workspaceSnapshot = await workspaceReference.get()
        if (!workspaceSnapshot.exists) return ""
        const workspace = workspaceSnapshot.data() || {}
        if (String(workspace.ownerUid || "") !== user.uid) return ""
        const token = await generateToken()
        await db.collection(shareCollection).doc(token).set({
            workspaceId: normalizedWorkspaceId,
            workspaceName: String(workspace.name || ""),
            ownerUid: user.uid,
            role: normalizeRole(role),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        return buildWorkspaceShareUrl(token)
    }

    function captureWorkspaceShareToken() {
        if (!isWorkspacesEnabled()) return ""
        const token = getWorkspaceShareTokenFromUrl()
        if (!token) return ""
        SafeStorage.session.set(pendingTokenKey, token)
        const url = new URL(window.location.href)
        url.searchParams.delete("workspaceShare")
        window.history.replaceState({}, document.title, url.toString())
        return token
    }

    async function acceptWorkspaceShareToken(value, user) {
        if (!isWorkspacesEnabled()) return null
        if (!db || !user?.uid) return null
        const normalizedToken = normalizeShareToken(value)
        if (!normalizedToken) return null
        const shareSnapshot = await db.collection(shareCollection).doc(normalizedToken).get()
        if (!shareSnapshot.exists) return null
        const shareData = shareSnapshot.data() || {}
        const workspaceId = String(shareData.workspaceId || "")
        if (!workspaceId) return null
        const role = normalizeRole(shareData.role)
        const displayName = String(user.displayName || (user.email ? user.email.split("@")[0] : user.uid) || user.uid)
        await DataPath.getUserSharedCollection(user, "sharedWorkspaces").doc(workspaceId).set({
            workspaceId,
            role,
            workspaceName: String(shareData.workspaceName || ""),
            ownerUid: String(shareData.ownerUid || ""),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(workspaceId)
        if (workspaceReference) {
            try {
                await workspaceReference.set({
                    members: { [user.uid]: role },
                    memberNames: { [user.uid]: displayName },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true })
            } catch {
            }
        }
        return { workspaceId, role }
    }

    async function acceptPendingWorkspaceShare(user) {
        if (!isWorkspacesEnabled()) return null
        const token = SafeStorage.session.get(pendingTokenKey)
        if (!token) return null
        SafeStorage.session.remove(pendingTokenKey)
        return acceptWorkspaceShareToken(token, user)
    }

    async function acceptWorkspaceShareFromUrl(user) {
        if (!isWorkspacesEnabled()) return null
        const token = getWorkspaceShareTokenFromUrl()
        if (!token) return null
        captureWorkspaceShareToken()
        return acceptPendingWorkspaceShare(user)
    }

    function getWorkspaceById(workspaceId) {
        const normalizedWorkspaceId = String(workspaceId || "")
        if (!normalizedWorkspaceId) return null
        const workspaces = Array.isArray(StateStore.read().sharedWorkspaces) ? StateStore.read().sharedWorkspaces : []
        return workspaces.find(workspace => workspace.id === normalizedWorkspaceId) || null
    }


    async function updateWorkspace(workspaceId, updates = {}) {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        if (!db || !user?.uid || !normalizedWorkspaceId) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace || !canManageWorkspace(workspace)) return false
        const nextName = updates.name === undefined ? workspace.name : String(updates.name || "").trim()
        const nextDescription = updates.description === undefined ? String(workspace.description || "") : String(updates.description || "").trim()
        if (!nextName || nextName.length > 50 || nextDescription.length > 300) return false
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(normalizedWorkspaceId)
        if (!workspaceReference) return false
        await workspaceReference.set({
            name: nextName,
            description: nextDescription,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        await DataPath.getUserSharedCollection(user, "sharedWorkspaces").doc(normalizedWorkspaceId).set({
            workspaceId: normalizedWorkspaceId,
            workspaceName: nextName,
            ownerUid: workspace.ownerUid,
            role: workspace.role || "owner",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        return true
    }

    function getWorkspaceMembers(workspaceId) {
        if (!isWorkspacesEnabled()) return []
        const workspace = getWorkspaceById(workspaceId)
        if (!workspace) return []
        const members = workspace.members && typeof workspace.members === "object" ? workspace.members : {}
        const memberNames = workspace.memberNames && typeof workspace.memberNames === "object" ? workspace.memberNames : {}
        return Object.entries(members).map(([uid, role]) => ({
            uid: String(uid || ""),
            displayName: String(memberNames[uid] || uid || ""),
            role: role === "owner" || role === "editor" || role === "viewer" ? role : "viewer"
        }))
    }


    async function updateMemberRole(workspaceId, memberUid, role) {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedMemberUid = String(memberUid || "").trim()
        const normalizedRole = normalizeRole(role)
        if (!db || !user?.uid || !normalizedWorkspaceId || !normalizedMemberUid) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace || !canManageWorkspace(workspace)) return false
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(normalizedWorkspaceId)
        if (!workspaceReference) return false
        await workspaceReference.update({
            [`members.${normalizedMemberUid}`]: normalizedRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        await db.collection("users").doc(normalizedMemberUid).collection("sharedWorkspaces").doc(normalizedWorkspaceId).set({
            workspaceId: normalizedWorkspaceId,
            role: normalizedRole,
            workspaceName: String(workspace.name || ""),
            ownerUid: workspace.ownerUid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        return true
    }

    async function removeMember(workspaceId, memberUid) {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedMemberUid = String(memberUid || "").trim()
        if (!db || !user?.uid || !normalizedWorkspaceId || !normalizedMemberUid) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace || !canManageWorkspace(workspace)) return false
        if (normalizedMemberUid === workspace.ownerUid) return false
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(normalizedWorkspaceId)
        if (!workspaceReference) return false
        await workspaceReference.update({
            [`members.${normalizedMemberUid}`]: firebase.firestore.FieldValue.delete(),
            [`memberNames.${normalizedMemberUid}`]: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        await db.collection("users").doc(normalizedMemberUid).collection("sharedWorkspaces").doc(normalizedWorkspaceId).delete().catch(() => {})
        return true
    }

    async function updateMemberDisplayName(workspaceId, memberUid, displayName) {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedMemberUid = String(memberUid || "").trim()
        const normalizedDisplayName = String(displayName || "").trim()
        if (!db || !user?.uid || !normalizedWorkspaceId || !normalizedMemberUid || !normalizedDisplayName || normalizedDisplayName.length > 50) return false
        const workspaceReference = WorkspacesRepository.getWorkspaceReference(normalizedWorkspaceId)
        if (!workspaceReference) return false
        await workspaceReference.set({
            memberNames: { [normalizedMemberUid]: normalizedDisplayName },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        return true
    }

    function getCurrentUserUid() {
        return String(StateStore.read().user?.uid || "")
    }

    return {
        getWorkspaceRole,
        canManageWorkspace,
        canEditWorkspace,
        createWorkspace,
        addMemberByUid,
        createInviteLink,
        captureWorkspaceShareToken,
        normalizeShareToken,
        acceptWorkspaceShareToken,
        acceptPendingWorkspaceShare,
        acceptWorkspaceShareFromUrl,
        getWorkspaceById,
        getWorkspaceMembers,
        updateMemberDisplayName,
        updateMemberRole,
        removeMember,
        updateWorkspace,
        getCurrentUserUid
    }
})()

const WorkspacesService = (() => {
    const state = {
        user: null,
        unsubscribeEntries: null,
        workspaceUnsubscribers: new Map(),
        workspaceNotesUnsubscribers: new Map(),
        workspaceEntries: new Map(),
        workspaces: new Map(),
        workspaceNotes: new Map()
    }

    function cleanupWorkspace(workspaceId) {
        const unsubscribeWorkspace = state.workspaceUnsubscribers.get(workspaceId)
        if (unsubscribeWorkspace) unsubscribeWorkspace()
        state.workspaceUnsubscribers.delete(workspaceId)
        const unsubscribeWorkspaceNotes = state.workspaceNotesUnsubscribers.get(workspaceId)
        if (unsubscribeWorkspaceNotes) unsubscribeWorkspaceNotes()
        state.workspaceNotesUnsubscribers.delete(workspaceId)
        state.workspaceEntries.delete(workspaceId)
        state.workspaces.delete(workspaceId)
        state.workspaceNotes.delete(workspaceId)
    }

    function publishWorkspaces() {
        const userUid = state.user?.uid || ""
        const items = [...state.workspaces.values()].map(workspace => {
            const entry = state.workspaceEntries.get(workspace.id) || {}
            const role = workspace.ownerUid === userUid ? "owner" : (entry.role || workspace.members?.[userUid] || "viewer")
            return { ...workspace, role }
        }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), StateStore.read().config.lang || "ru"))
        StateStore.update("sharedWorkspaces", items)
    }

    function publishWorkspaceNotes() {
        const flattened = [...state.workspaceNotes.values()].flatMap(notes => notes)
        EventBus.publish("workspaceNotesUpdated", flattened)
    }

    function bindWorkspace(workspaceId, entry) {
        if (state.workspaceUnsubscribers.has(workspaceId)) return
        const unsubscribeWorkspace = WorkspacesRepository.subscribeWorkspace(workspaceId, snapshot => {
            if (!snapshot.exists) {
                cleanupWorkspace(workspaceId)
                publishWorkspaces()
                publishWorkspaceNotes()
                return
            }
            const data = snapshot.data() || {}
            const members = data.members && typeof data.members === "object" ? data.members : {}
            const memberNames = data.memberNames && typeof data.memberNames === "object" ? data.memberNames : {}
            state.workspaces.set(workspaceId, {
                id: workspaceId,
                name: String(data.name || entry.workspaceName || "Совместная папка"),
                ownerUid: String(data.ownerUid || entry.ownerUid || ""),
                description: String(data.description || ""),
                role: entry.role || "viewer",
                members,
                memberNames,
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null
            })
            publishWorkspaces()
        }, error => EventBus.publish("sharedSyncError", error))
        state.workspaceUnsubscribers.set(workspaceId, unsubscribeWorkspace)

        const unsubscribeWorkspaceNotes = WorkspacesRepository.subscribeWorkspaceNotes(workspaceId, snapshot => {
            const workspace = state.workspaces.get(workspaceId) || { id: workspaceId, ownerUid: entry.ownerUid || "", members: {}, memberNames: {}, role: entry.role || "viewer" }
            const notes = snapshot.docs.map(documentEntry => {
                const data = documentEntry.data() || {}
                const normalized = NoteIO.normalizeNote({ id: documentEntry.id, ...data })
                const ownerUid = String(workspace.ownerUid || normalized.ownerUid || "")
                return {
                    ...normalized,
                    id: `workspace_${workspaceId}_${documentEntry.id}`,
                    workspaceId,
                    access: {
                        ownerUid,
                        noteId: documentEntry.id,
                        workspaceId,
                        roles: workspace.members || {}
                    }
                }
            })
            state.workspaceNotes.set(workspaceId, notes)
            publishWorkspaceNotes()
        }, error => EventBus.publish("sharedSyncError", error))
        state.workspaceNotesUnsubscribers.set(workspaceId, unsubscribeWorkspaceNotes)
    }

    function subscribe(user) {
        state.user = user
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = WorkspacesRepository.subscribeUserWorkspaces(user, snapshot => {
            const nextEntries = new Map()
            snapshot.forEach(documentEntry => {
                const data = documentEntry.data() || {}
                const workspaceId = String(documentEntry.id || data.workspaceId || "")
                if (!workspaceId) return
                nextEntries.set(workspaceId, {
                    workspaceId,
                    ownerUid: String(data.ownerUid || ""),
                    role: String(data.role || "viewer"),
                    workspaceName: String(data.workspaceName || "")
                })
            })

            const removedIds = []
            state.workspaceEntries.forEach((_entry, workspaceId) => {
                if (!nextEntries.has(workspaceId)) removedIds.push(workspaceId)
            })
            removedIds.forEach(cleanupWorkspace)

            nextEntries.forEach((entry, workspaceId) => {
                state.workspaceEntries.set(workspaceId, entry)
                bindWorkspace(workspaceId, entry)
            })

            publishWorkspaces()
            publishWorkspaceNotes()
        }, error => EventBus.publish("sharedSyncError", error))
    }

    function clear() {
        if (state.unsubscribeEntries) state.unsubscribeEntries()
        state.unsubscribeEntries = null
        state.workspaceUnsubscribers.forEach(unsubscribe => unsubscribe())
        state.workspaceNotesUnsubscribers.forEach(unsubscribe => unsubscribe())
        state.workspaceUnsubscribers.clear()
        state.workspaceNotesUnsubscribers.clear()
        state.workspaceEntries.clear()
        state.workspaces.clear()
        state.workspaceNotes.clear()
        state.user = null
        StateStore.update("sharedWorkspaces", [])
    }

    return { subscribe, clear }
})()

const SessionService = (() => {
    const state = { activeUid: null, sessionStartPromise: null, foldersUnsubscribe: null, ownedNotes: [], sharedNotes: [], workspaceNotes: [] }
    function sortFolders(folders) {
        return [...folders].sort((firstFolder, secondFolder) => {
            const firstCreatedAt = firstFolder?.createdAt?.toDate ? firstFolder.createdAt.toDate().getTime() : Date.parse(firstFolder?.createdAt || "") || 0
            const secondCreatedAt = secondFolder?.createdAt?.toDate ? secondFolder.createdAt.toDate().getTime() : Date.parse(secondFolder?.createdAt || "") || 0
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            return String(firstFolder?.name || "").localeCompare(String(secondFolder?.name || ""), StateStore.read().config.lang || "ru")
        })
    }
    function publishNotes() {
        const aggregatedNotes = NotesAggregationService.aggregate(state.ownedNotes, state.sharedNotes, state.workspaceNotes, state.activeUid)
        StateStore.update("notes", aggregatedNotes)
    }
    function bindAggregation() {
        EventBus.subscribe("ownedNotesUpdated", ownedNotes => {
            state.ownedNotes = Array.isArray(ownedNotes) ? ownedNotes : []
            publishNotes()
        })
        EventBus.subscribe("sharedNotesUpdated", sharedNotes => {
            state.sharedNotes = Array.isArray(sharedNotes) ? sharedNotes : []
            publishNotes()
        })
        EventBus.subscribe("workspaceNotesUpdated", workspaceNotes => {
            state.workspaceNotes = Array.isArray(workspaceNotes) ? workspaceNotes : []
            publishNotes()
        })
    }
    bindAggregation()
    function stopUserSession() {
        if (state.foldersUnsubscribe) state.foldersUnsubscribe()
        state.foldersUnsubscribe = null
        SettingsSyncService.clear()
        OwnedNotesService.clear()
        if (window.AppFeatures?.sharedAccess === true) SharedNotesService.clear()
        if (window.AppFeatures?.workspaces === true) WorkspacesService.clear()
        RemindersService.stop()
        state.activeUid = null
        state.ownedNotes = []
        state.sharedNotes = []
        state.workspaceNotes = []
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
                if (window.AppFeatures?.workspaces === true && typeof WorkspaceAccessService !== "undefined") {
                    WorkspaceAccessService.captureWorkspaceShareToken()
                }
                await SettingsSyncService.initialize(user)
                OwnedNotesService.subscribe(user)
                const cachedNotes = NotesStorage.readCachedNotes(user.uid)
                if (cachedNotes.length) {
                    StateStore.update("notes", NotesStorage.applyStoredFavorites(cachedNotes))
                }
                if (state.foldersUnsubscribe) state.foldersUnsubscribe()
                state.foldersUnsubscribe = FoldersRepository.subscribeFolders(user, snapshot => {
                    const folders = sortFolders(snapshot.docs.map(documentEntry => ({ id: documentEntry.id, ...documentEntry.data() })))
                    StateStore.update("folders", folders)
                }, error => EventBus.publish("foldersSyncError", error))
                if (window.AppFeatures?.sharedAccess === true) SharedNotesService.subscribe(user)
                if (window.AppFeatures?.workspaces === true) WorkspacesService.subscribe(user)
                if (window.AppFeatures?.workspaces === true && typeof WorkspaceAccessService !== "undefined") {
                    await WorkspaceAccessService.acceptWorkspaceShareFromUrl(user)
                    await WorkspaceAccessService.acceptPendingWorkspaceShare(user)
                }
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

const NotesQueryService = (() => {
    function normalizeVisibleNotes(list, orderKey = "order") {
        if (!Array.isArray(list)) return []
        const normalizedNotes = list.map(note => {
            const normalizedNote = NoteIO.normalizeNote(note)
            if (note && note.access) normalizedNote.access = note.access
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
        if (value.seconds) return value.seconds * 1000
        if (value.toDate) return value.toDate().getTime()
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

        if (view === "shared_access") return []
        if (view === "notes") {
            filteredNotes = filteredNotes.filter(note => {
                if (note?.workspaceId) return false
                if (typeof CollaborationService !== "undefined" && CollaborationService.isSharedNote(note)) return false
                return true
            })
        }
        if (view === "reminders") filteredNotes = filteredNotes.filter(note => isReminderNote(note) && !note.isArchived && !note.trashedAt)
        if (view === "trash") filteredNotes = filteredNotes.filter(note => !!note.trashedAt)
        else filteredNotes = filteredNotes.filter(note => !note.trashedAt)

        if (view === "favorites") filteredNotes = filteredNotes.filter(note => note.isFavorite && !note.isArchived)
        else if (view === "archive") filteredNotes = filteredNotes.filter(note => note.isArchived)
        else if (view === "folder") filteredNotes = filteredNotes.filter(note => note.folderId === activeFolderId)
        else if (view === "shared_workspace") filteredNotes = filteredNotes.filter(note => note.workspaceId && note.workspaceId === stateSnapshot.activeSharedWorkspaceId)
        else if (view !== "locked" && view !== "reminders" && view !== "trash" && view !== "shared_access") filteredNotes = filteredNotes.filter(note => !note.isArchived)

        if (view !== "folder" && view !== "shared_workspace") {
            filteredNotes = filteredNotes.filter(note => !note.folderId || !hiddenFolderIdentifiers.has(note.folderId))
        }

        const configuredFilter = stateSnapshot.config?.notesFilter || { sort: "manual", folders: [], tags: [], updatedWindowDays: 0 }
        const selectedFolders = Array.isArray(configuredFilter.folders) ? configuredFilter.folders : []
        const selectedTags = Array.isArray(configuredFilter.tags) ? configuredFilter.tags : []
        const updatedWindowDays = Number(configuredFilter.updatedWindowDays || 0)
        const canUseFolderFilters = view !== "folder" && view !== "folders" && view !== "archive" && view !== "trash" && view !== "shared_workspace" && view !== "shared_access"

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
            ? normalizeVisibleNotes(searchResult.notes, stateSnapshot.view === "folder" ? "folderOrder" : (stateSnapshot.view === "shared_workspace" ? "workspaceOrder" : "order"))
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

const NotesPresenter = (() => {
    function getText(stateSnapshot, key, fallback) {
        const dict = LANG[stateSnapshot.config?.lang] || LANG.ru
        return dict[key] || fallback
    }
    function createViewModel(stateSnapshot) {
        const queryResult = NotesQueryService.execute(stateSnapshot, stateSnapshot.searchQuery || "")
        const visibleNotes = PaginationService.getVisibleNotesForRender(queryResult.notes, queryResult.view, stateSnapshot.searchQuery || "")
        const emptyState = queryResult.view === "locked"
            ? { icon: "lock", text: getText(stateSnapshot, "lock_center_empty", "No protected notes") }
            : queryResult.view === "reminders"
                ? { icon: "schedule", text: getText(stateSnapshot, "reminder_empty", "No reminders") }
                : queryResult.view === "shared_workspace"
                    ? { icon: "groups", text: getText(stateSnapshot, "shared_workspace_empty", "В этой папке пока нет заметок") }
                    : { icon: "note_add", text: getText(stateSnapshot, "empty", "Nothing here yet") }
        return { view: queryResult.view, notes: queryResult.notes, visibleNotes, emptyState, loadMoreState: PaginationService.getLoadMoreState() }
    }
    return { createViewModel }
})()

const NotesUIAdapter = (() => {
    function syncViewMeta() {
        UI.updateViewTitle()
        UI.updatePrimaryActionLabel()
    }

    function render(viewModel) {
        syncViewMeta()
        if (viewModel.view === "folders") {
            UI.renderFolderGrid()
            return
        }
        if (viewModel.view === "hidden_folders") {
            UI.renderHiddenFolders()
            return
        }
        if (viewModel.view === "shared_access") {
            UI.renderSharedAccessView()
            return
        }
        if (viewModel.view === "admin_tools") {
            UI.renderAdminToolsView()
            return
        }
        if (viewModel.view === "trash") {
            UI.renderTrash(viewModel.notes)
            return
        }
        UI.updateEmptyState(viewModel.emptyState.icon, viewModel.emptyState.text)
        NotesRenderer.render(viewModel.visibleNotes)
        UI.updateNotesLoadMoreButton(viewModel.loadMoreState)
    }
    return { render }
})()
