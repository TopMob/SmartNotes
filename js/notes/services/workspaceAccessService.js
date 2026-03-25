const WorkspaceAccessService = (() => {
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

    async function createWorkspace(name) {
        const user = StateStore.read().user
        if (!db || !user?.uid) return null
        const normalizedName = String(name || "").trim()
        if (!normalizedName) return null
        const workspaceReference = db.collection("workspaces").doc()
        const payload = {
            name: normalizedName,
            ownerUid: user.uid,
            members: { [user.uid]: "owner" },
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
        await workspaceReference.update({
            [`members.${normalizedTargetUid}`]: normalizeRole(role),
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
        const token = getWorkspaceShareTokenFromUrl()
        if (!token) return ""
        SafeStorage.session.set(pendingTokenKey, token)
        const url = new URL(window.location.href)
        url.searchParams.delete("workspaceShare")
        window.history.replaceState({}, document.title, url.toString())
        return token
    }

    async function acceptWorkspaceShareToken(value, user) {
        if (!db || !user?.uid) return null
        const normalizedToken = normalizeShareToken(value)
        if (!normalizedToken) return null
        const shareSnapshot = await db.collection(shareCollection).doc(normalizedToken).get()
        if (!shareSnapshot.exists) return null
        const shareData = shareSnapshot.data() || {}
        const workspaceId = String(shareData.workspaceId || "")
        if (!workspaceId) return null
        const role = normalizeRole(shareData.role)
        await DataPath.getUserSharedCollection(user, "sharedWorkspaces").doc(workspaceId).set({
            workspaceId,
            role,
            workspaceName: String(shareData.workspaceName || ""),
            ownerUid: String(shareData.ownerUid || ""),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        return { workspaceId, role }
    }

    async function acceptPendingWorkspaceShare(user) {
        const token = SafeStorage.session.get(pendingTokenKey)
        if (!token) return null
        SafeStorage.session.remove(pendingTokenKey)
        return acceptWorkspaceShareToken(token, user)
    }

    async function acceptWorkspaceShareFromUrl(user) {
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
        getCurrentUserUid
    }
})()
