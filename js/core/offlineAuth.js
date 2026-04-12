export const createOfflineAuthManager = ({ auth }) => {
    const hideSplash = () => {
        if (typeof window.hideSplashScreen === "function") window.hideSplashScreen()
    }

    const applySignedInUi = user => {
        const appScreen = document.getElementById("app")
        if (appScreen) {
            appScreen.style.display = "flex"
            appScreen.classList.add("active")
            appScreen.style.opacity = "1"
        }

        const userPhoto = document.getElementById("user-photo")
        const userName = document.getElementById("user-name")
        const userUid = document.getElementById("user-uid")
        if (userPhoto) userPhoto.src = user.photoURL || ""
        if (userName) userName.textContent = user.displayName || "Local User"
        if (userUid) userUid.textContent = String(user.uid || "local-user")
    }

    const startSession = async user => {
        StateActions.setUser(user)
        if (typeof SessionService !== "undefined" && typeof SessionService.startUserSession === "function") {
            await SessionService.startUserSession(user)
        }
        applySignedInUi(user)
        hideSplash()
    }

    return {
        async init() {
            auth.onAuthStateChanged(async user => {
                if (!user) return
                await startSession(user)
            })
            if (auth.currentUser) await startSession(auth.currentUser)
        },
        async login() {
            return true
        },
        async loginWithEmail() {
            return true
        },
        async logout() {
            return true
        },
        async switchAccount() {
            return true
        },
        async updateDisplayName(nextName = "") {
            const normalizedName = String(nextName || "").trim()
            if (!normalizedName) return false
            await auth.currentUser.updateProfile({ displayName: normalizedName })
            await DataPath.getUserRootReference(auth.currentUser)?.set({
                displayName: normalizedName,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
            applySignedInUi(auth.currentUser)
            return true
        },
        async updateAvatarFromFile(file) {
            if (!(file instanceof Blob)) return false
            const source = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result || ""))
                reader.onerror = () => reject(new Error("avatar_read_failed"))
                reader.readAsDataURL(file)
            })
            await auth.currentUser.updateProfile({ photoURL: source })
            await DataPath.getUserRootReference(auth.currentUser)?.set({
                avatarUrl: source,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
            applySignedInUi(auth.currentUser)
            return true
        }
    }
}
