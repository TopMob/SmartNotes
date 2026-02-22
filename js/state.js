const StateStore = (() => {
    const initialState = {
        user: null,
        notes: [],
        folders: [],
        view: "notes",
        activeFolderId: null,
        searchQuery: "",
        currentNote: null,
        tempRating: 0,
        config: { lang: "ru", folderViewMode: "compact", reduceMotion: false, editorTools: {}, notesFilter: { sort: "manual", folders: [] } },
        recording: false,
        mediaRecorder: null,
        editorDirty: false,
        isEditing: false,
        isTyping: false,
        orderHistory: [],
        appearanceDraft: null,
        originalUserSettings: null,
        draftUserSettings: null,
        saveStatus: { status: "idle", message: "", updatedAt: 0 },
        pagination: {
            displayLimit: 20,
            renderStep: 20,
            pageSize: 500,
            hasMoreOwnedNotes: false,
            loadingMoreOwnedNotes: false,
            lastOwnedNoteDocument: null,
            totalVisibleNotesCount: 0,
            renderedVisibleNotesCount: 0,
            searchActive: false
        }
    }

    let state = { ...initialState, config: { ...initialState.config }, pagination: { ...initialState.pagination } }
    const subscribers = new Set()

    const notifySubscribers = (nextState, previousState) => {
        subscribers.forEach(subscriber => {
            subscriber(nextState, previousState)
        })
    }

    const read = () => state

    const set = (updater) => {
        const previousState = state
        const nextState = typeof updater === "function" ? updater(previousState) : { ...previousState, ...updater }
        if (!nextState || typeof nextState !== "object") return state
        if (nextState === previousState) return state
        state = nextState
        notifySubscribers(state, previousState)
        return state
    }

    const update = (key, value) => set(previousState => ({ ...previousState, [key]: value }))

    const updateConfig = (updates) => set(previousState => ({ ...previousState, config: { ...previousState.config, ...updates } }))

    const resetSession = () => set(previousState => ({
        ...previousState,
        user: null,
        notes: [],
        folders: [],
        view: "notes",
        activeFolderId: null,
        searchQuery: "",
        currentNote: null,
        tempRating: 0,
        recording: false,
        mediaRecorder: null,
        editorDirty: false,
        isEditing: false,
        isTyping: false,
        orderHistory: [],
        appearanceDraft: null,
        originalUserSettings: null,
        draftUserSettings: null,
        saveStatus: { ...initialState.saveStatus },
        pagination: { ...initialState.pagination, renderStep: previousState.pagination.renderStep, pageSize: previousState.pagination.pageSize },
        config: { ...previousState.config }
    }))

    const subscribe = (subscriber) => {
        if (typeof subscriber !== "function") return () => {}
        subscribers.add(subscriber)
        return () => {
            subscribers.delete(subscriber)
        }
    }

    return {
        read,
        set,
        update,
        updateConfig,
        resetSession,
        subscribe,
        initialState: () => ({ ...initialState, config: { ...initialState.config }, saveStatus: { ...initialState.saveStatus }, pagination: { ...initialState.pagination } })
    }
})()
