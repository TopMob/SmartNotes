const WorkspacesRepository = (() => {
    function getWorkspaceReference(workspaceId) {
        const normalizedWorkspaceId = String(workspaceId || "")
        if (!db || !normalizedWorkspaceId) return null
        return db.collection("workspaces").doc(normalizedWorkspaceId)
    }

    function getWorkspaceNotesCollection(workspaceId) {
        const workspaceReference = getWorkspaceReference(workspaceId)
        return workspaceReference ? workspaceReference.collection("notes") : null
    }

    function subscribeUserWorkspaces(user, next, error) {
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

