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
        const accessToken = String(user?.accessToken || "")
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

const WorkspacesRepository = (() => {
    const isWorkspacesEnabled = () => window.AppFeatures?.workspaces === true
    const WORKSPACES_ENDPOINT = "/api/supabase/workspaces"
    const POLL_INTERVAL_MS = 5000

    function buildHeaders(user) {
        const accessToken = String(user?.accessToken || "")
        return {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
    }

    function normalizeRole(role) {
        if (role === "owner") return "owner"
        if (role === "admin") return "editor"
        if (role === "member") return "viewer"
        if (role === "editor") return "editor"
        return "viewer"
    }

    function cloneWorkspace(workspace) {
        return JSON.parse(JSON.stringify(workspace || null))
    }

    function normalizeWorkspacePayload(rawWorkspace, fallbackWorkspaceId = "") {
        const source = rawWorkspace && typeof rawWorkspace === "object" ? rawWorkspace : {}
        const membersSource = source.members && typeof source.members === "object" ? source.members : {}
        const memberNamesSource = source.memberNames && typeof source.memberNames === "object" ? source.memberNames : {}
        const members = {}
        Object.entries(membersSource).forEach(([uid, role]) => {
            const normalizedUid = String(uid || "").trim()
            if (!normalizedUid) return
            members[normalizedUid] = normalizeRole(role)
        })
        const memberNames = {}
        Object.entries(memberNamesSource).forEach(([uid, value]) => {
            const normalizedUid = String(uid || "").trim()
            if (!normalizedUid) return
            memberNames[normalizedUid] = String(value || normalizedUid)
        })
        return {
            id: String(source.id || fallbackWorkspaceId || ""),
            name: String(source.name || "Совместная папка"),
            description: source.description == null ? "" : String(source.description),
            ownerUid: String(source.ownerUid || source.owner_user_id || ""),
            role: normalizeRole(source.role),
            members,
            memberNames,
            createdAt: source.createdAt || source.created_at || null,
            updatedAt: source.updatedAt || source.updated_at || null
        }
    }

    async function request(user, method, endpoint, body) {
        const response = await fetch(endpoint, {
            method,
            headers: buildHeaders(user),
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        })
        if (!response.ok) throw new Error(`supabase-workspaces-http-${response.status}`)
        return response.json()
    }

    async function listUserWorkspaces(user) {
        const payload = await request(user, "GET", WORKSPACES_ENDPOINT)
        const items = Array.isArray(payload?.workspaces) ? payload.workspaces : []
        return items.map(item => normalizeWorkspacePayload(item, item?.id || "")).filter(item => item.id)
    }

    async function getWorkspace(user, workspaceId) {
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        if (!normalizedWorkspaceId) {
            return { exists: false, data: () => ({}) }
        }
        try {
            const payload = await request(user, "GET", `${WORKSPACES_ENDPOINT}?workspaceId=${encodeURIComponent(normalizedWorkspaceId)}`)
            const workspace = payload?.workspace ? normalizeWorkspacePayload(payload.workspace, normalizedWorkspaceId) : null
            return {
                exists: !!workspace,
                data: () => cloneWorkspace(workspace) || {}
            }
        } catch (error) {
            if (String(error?.message || "").includes("-404")) {
                return { exists: false, data: () => ({}) }
            }
            throw error
        }
    }

    function createPollingSubscription(loader, next, error, projectSnapshot) {
        let cancelled = false
        let lastSerialized = ""
        const poll = async () => {
            if (cancelled) return
            try {
                const payload = await loader()
                const serialized = JSON.stringify(payload)
                if (serialized === lastSerialized) return
                lastSerialized = serialized
                if (typeof next === "function") next(projectSnapshot(payload))
            } catch (pollError) {
                if (typeof error === "function") error(pollError)
            }
        }
        poll()
        const intervalId = setInterval(poll, POLL_INTERVAL_MS)
        return () => {
            cancelled = true
            clearInterval(intervalId)
        }
    }

    function subscribeUserWorkspaces(user, next, error) {
        if (!isWorkspacesEnabled()) {
            if (typeof next === "function") next({ forEach() {} })
            return () => {}
        }
        return createPollingSubscription(
            () => listUserWorkspaces(user),
            next,
            error,
            items => ({
                forEach(callback) {
                    items.forEach(item => {
                        callback({
                            id: item.id,
                            data: () => ({
                                workspaceId: item.id,
                                workspaceName: item.name,
                                ownerUid: item.ownerUid,
                                role: item.role
                            })
                        })
                    })
                }
            })
        )
    }

    function subscribeWorkspace(user, workspaceId, next, error) {
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        if (!normalizedWorkspaceId || !user?.uid) return () => {}
        return createPollingSubscription(
            () => getWorkspace(user, normalizedWorkspaceId),
            next,
            error,
            snapshot => ({
                exists: !!snapshot.exists,
                data: () => snapshot.data()
            })
        )
    }

    function subscribeWorkspaceNotes(workspaceId, next, error) {
        if (typeof next === "function") {
            next({ docs: [], forEach(callback) { (Array.isArray([]) ? [] : []).forEach(callback) } })
        }
        return () => {}
    }

    return {
        normalizeRole,
        listUserWorkspaces,
        getWorkspace,
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
    function aggregate(ownedNotes, workspaceNotes, activeUid) {
        const mergedNotes = NotesStorage.applyStoredFavorites([...(ownedNotes || []), ...(workspaceNotes || [])])
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

const WorkspaceAccessService = (() => {
    const isWorkspacesEnabled = () => window.AppFeatures?.workspaces === true
    const pendingTokenKey = "pending-workspace-share-token"
    const WORKSPACES_ENDPOINT = "/api/supabase/workspaces"
    const MEMBERS_ENDPOINT = "/api/supabase/workspace-members"
    const INVITES_ENDPOINT = "/api/supabase/workspace-invites"

    function normalizeRole(role) {
        if (role === "owner") return "owner"
        if (role === "admin" || role === "editor") return "editor"
        return "viewer"
    }

    function toBackendRole(role) {
        if (role === "owner") return "owner"
        if (role === "editor" || role === "admin") return "admin"
        return "member"
    }

    function buildHeaders(user) {
        const accessToken = String(user?.accessToken || "")
        return {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
    }

    async function request(user, method, endpoint, body) {
        const response = await fetch(endpoint, {
            method,
            headers: buildHeaders(user),
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        })
        if (!response.ok) return null
        return response.json()
    }

    function getDefaultDisplayName(user) {
        return String(user?.displayName || (user?.email ? user.email.split("@")[0] : user?.uid) || user?.uid || "")
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
        if (!user?.uid) return null
        const normalizedName = String(name || "").trim()
        const normalizedDescription = String(description || "").trim()
        if (!normalizedName || normalizedName.length > 50 || normalizedDescription.length > 300) return null
        const result = await request(user, "POST", WORKSPACES_ENDPOINT, {
            name: normalizedName,
            description: normalizedDescription
        })
        const workspace = result?.workspace
        if (!workspace?.id) return null
        return {
            id: String(workspace.id),
            name: String(workspace.name || normalizedName),
            ownerUid: String(workspace.owner_user_id || user.uid),
            members: { [user.uid]: "owner" },
            memberNames: { [user.uid]: getDefaultDisplayName(user) },
            description: workspace.description == null ? normalizedDescription : String(workspace.description),
            createdAt: workspace.created_at || null,
            updatedAt: workspace.updated_at || null,
            role: "owner"
        }
    }

    async function addMemberByUid(workspaceId, targetUid, role = "editor") {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        if (!user?.uid) return false
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedTargetUid = String(targetUid || "").trim()
        if (!normalizedWorkspaceId || !normalizedTargetUid) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace) return false
        if (String(workspace.ownerUid || "") !== user.uid) return false
        const result = await request(user, "POST", MEMBERS_ENDPOINT, {
            workspaceId: normalizedWorkspaceId,
            userId: normalizedTargetUid,
            role: toBackendRole(role)
        })
        return !!result?.membership
    }

    async function createInviteLink(workspaceId, role = "editor") {
        if (!isWorkspacesEnabled()) return ""
        const user = StateStore.read().user
        if (!user?.uid) return ""
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        if (!normalizedWorkspaceId) return ""
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace) return ""
        if (String(workspace.ownerUid || "") !== user.uid) return ""
        const result = await request(user, "POST", INVITES_ENDPOINT, {
            workspaceId: normalizedWorkspaceId,
            role: toBackendRole(role)
        })
        const token = String(result?.token || "")
        if (!token) return ""
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
        if (!user?.uid) return null
        const normalizedToken = normalizeShareToken(value)
        if (!normalizedToken) return null
        const result = await request(user, "PATCH", INVITES_ENDPOINT, { token: normalizedToken })
        const workspaceId = String(result?.membership?.workspace_id || result?.invite?.workspace_id || "")
        if (!workspaceId) return null
        const role = normalizeRole(result?.membership?.role || result?.invite?.role)
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
        if (!user?.uid || !normalizedWorkspaceId) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace || !canManageWorkspace(workspace)) return false
        const nextName = updates.name === undefined ? workspace.name : String(updates.name || "").trim()
        const nextDescription = updates.description === undefined ? String(workspace.description || "") : String(updates.description || "").trim()
        if (!nextName || nextName.length > 50 || nextDescription.length > 300) return false
        const result = await request(user, "PATCH", WORKSPACES_ENDPOINT, {
            workspaceId: normalizedWorkspaceId,
            name: nextName,
            description: nextDescription
        })
        return !!result?.workspace
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
        if (!user?.uid || !normalizedWorkspaceId || !normalizedMemberUid) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace || !canManageWorkspace(workspace)) return false
        const result = await request(user, "PATCH", MEMBERS_ENDPOINT, {
            workspaceId: normalizedWorkspaceId,
            userId: normalizedMemberUid,
            role: toBackendRole(normalizedRole)
        })
        return !!result?.membership
    }

    async function removeMember(workspaceId, memberUid) {
        if (!isWorkspacesEnabled()) return false
        const user = StateStore.read().user
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedMemberUid = String(memberUid || "").trim()
        if (!user?.uid || !normalizedWorkspaceId || !normalizedMemberUid) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace || !canManageWorkspace(workspace)) return false
        if (normalizedMemberUid === workspace.ownerUid) return false
        const result = await request(user, "DELETE", MEMBERS_ENDPOINT, {
            workspaceId: normalizedWorkspaceId,
            userId: normalizedMemberUid
        })
        return result?.removed === true
    }

    async function updateMemberDisplayName(workspaceId, memberUid, displayName) {
        if (!isWorkspacesEnabled()) return false
        const normalizedWorkspaceId = String(workspaceId || "").trim()
        const normalizedMemberUid = String(memberUid || "").trim()
        const normalizedDisplayName = String(displayName || "").trim()
        if (!normalizedWorkspaceId || !normalizedMemberUid || !normalizedDisplayName || normalizedDisplayName.length > 50) return false
        const workspace = getWorkspaceById(normalizedWorkspaceId)
        if (!workspace) return false
        const nextMemberNames = { ...(workspace.memberNames || {}), [normalizedMemberUid]: normalizedDisplayName }
        StateStore.update("sharedWorkspaces", (StateStore.read().sharedWorkspaces || []).map(item => {
            if (item.id !== normalizedWorkspaceId) return item
            return { ...item, memberNames: nextMemberNames }
        }))
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
        workspaceNotesUnsubscribers: new Map(),
        workspaceEntries: new Map(),
        workspaces: new Map(),
        workspaceNotes: new Map()
    }

    function cleanupWorkspace(workspaceId) {
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
            const role = workspace.ownerUid === userUid ? "owner" : WorkspacesRepository.normalizeRole(entry.role || workspace.role || workspace.members?.[userUid] || "viewer")
            return { ...workspace, role }
        }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), StateStore.read().config.lang || "ru"))
        StateStore.update("sharedWorkspaces", items)
    }

    function publishWorkspaceNotes() {
        const flattened = [...state.workspaceNotes.values()].flatMap(notes => notes)
        EventBus.publish("workspaceNotesUpdated", flattened)
    }

    function bindWorkspace(workspaceId, entry) {
        const upsertWorkspaceState = workspace => {
            const data = workspace && typeof workspace === "object" ? workspace : {}
            const members = data.members && typeof data.members === "object" ? data.members : {}
            const memberNames = data.memberNames && typeof data.memberNames === "object" ? data.memberNames : {}
            state.workspaces.set(workspaceId, {
                id: workspaceId,
                name: String(data.name || entry.workspaceName || "Совместная папка"),
                ownerUid: String(data.ownerUid || entry.ownerUid || ""),
                description: String(data.description || ""),
                role: WorkspacesRepository.normalizeRole(data.role || entry.role || "viewer"),
                members,
                memberNames,
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null
            })
            publishWorkspaces()
        }
        WorkspacesRepository.getWorkspace(state.user, workspaceId).then(snapshot => {
            if (!snapshot?.exists) {
                cleanupWorkspace(workspaceId)
                publishWorkspaces()
                publishWorkspaceNotes()
                return
            }
            upsertWorkspaceState(snapshot.data())
        }).catch(error => EventBus.publish("sharedSyncError", error))
        const unsubscribeWorkspace = WorkspacesRepository.subscribeWorkspace(state.user, workspaceId, snapshot => {
            if (!snapshot.exists) {
                cleanupWorkspace(workspaceId)
                publishWorkspaces()
                publishWorkspaceNotes()
                return
            }
            upsertWorkspaceState(snapshot.data())
        }, error => EventBus.publish("sharedSyncError", error))

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
        state.workspaceNotesUnsubscribers.set(workspaceId, () => {
            if (typeof unsubscribeWorkspace === "function") unsubscribeWorkspace()
            if (typeof unsubscribeWorkspaceNotes === "function") unsubscribeWorkspaceNotes()
        })
    }

    function subscribe(user) {
        if (window.AppFeatures?.workspaces !== true) {
            state.user = user
            StateStore.update("sharedWorkspaces", [])
            publishWorkspaceNotes()
            return
        }
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
        state.workspaceNotesUnsubscribers.forEach(unsubscribe => unsubscribe())
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
    const state = { activeUid: null, sessionStartPromise: null, foldersUnsubscribe: null, ownedNotes: [], workspaceNotes: [] }
    function sortFolders(folders) {
        return [...folders].sort((firstFolder, secondFolder) => {
            const firstCreatedAt = firstFolder?.createdAt?.toDate ? firstFolder.createdAt.toDate().getTime() : Date.parse(firstFolder?.createdAt || "") || 0
            const secondCreatedAt = secondFolder?.createdAt?.toDate ? secondFolder.createdAt.toDate().getTime() : Date.parse(secondFolder?.createdAt || "") || 0
            if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt
            return String(firstFolder?.name || "").localeCompare(String(secondFolder?.name || ""), StateStore.read().config.lang || "ru")
        })
    }
    function publishNotes() {
        const aggregatedNotes = NotesAggregationService.aggregate(state.ownedNotes, state.workspaceNotes, state.activeUid)
        StateStore.update("notes", aggregatedNotes)
    }
    function bindAggregation() {
        EventBus.subscribe("ownedNotesUpdated", ownedNotes => {
            state.ownedNotes = Array.isArray(ownedNotes) ? ownedNotes : []
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
        if (window.AppFeatures?.workspaces === true) WorkspacesService.clear()
        RemindersService.stop()
        state.activeUid = null
        state.ownedNotes = []
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
        else if (view !== "locked" && view !== "reminders" && view !== "trash") filteredNotes = filteredNotes.filter(note => !note.isArchived)

        if (view !== "folder" && view !== "shared_workspace") {
            filteredNotes = filteredNotes.filter(note => !note.folderId || !hiddenFolderIdentifiers.has(note.folderId))
        }

        const configuredFilter = stateSnapshot.config?.notesFilter || { sort: "manual", folders: [], tags: [], updatedWindowDays: 0 }
        const selectedFolders = Array.isArray(configuredFilter.folders) ? configuredFilter.folders : []
        const selectedTags = Array.isArray(configuredFilter.tags) ? configuredFilter.tags : []
        const updatedWindowDays = Number(configuredFilter.updatedWindowDays || 0)
        const canUseFolderFilters = view !== "folder" && view !== "folders" && view !== "archive" && view !== "trash" && view !== "shared_workspace"

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
