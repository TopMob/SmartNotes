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
        appearanceDraft: null
    }

    let state = { ...initialState, config: { ...initialState.config } }

    const read = () => state

    const set = (updater) => {
        const next = typeof updater === "function" ? updater(state) : { ...state, ...updater }
        state = next
        return state
    }

    const update = (key, value) => set(prev => ({ ...prev, [key]: value }))

    const updateConfig = (updates) => set(prev => ({ ...prev, config: { ...prev.config, ...updates } }))

    const resetSession = () => set(prev => ({
        ...prev,
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
        config: { ...initialState.config }
    }))

    return {
        read,
        set,
        update,
        updateConfig,
        resetSession,
        initialState: () => ({ ...initialState, config: { ...initialState.config } })
    }
})()
