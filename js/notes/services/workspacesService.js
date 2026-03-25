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
