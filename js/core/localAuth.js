export function createLocalAuthManager({ auth, setLoginBusy, handleAuthError, getText }) {
    const readCredentials = () => {
        const email = prompt(getText("email_prompt", "Email"), "")
        const password = prompt(getText("password_prompt", "Password"), "")
        if (!email || !password) return null
        return { email: email.trim(), password }
    }

    const loginGuest = async () => {
        if (!auth) return
        setLoginBusy(true)
        try {
            await auth.signInAnonymously()
        } catch (error) {
            handleAuthError(error)
        }
        setLoginBusy(false)
    }

    const loginWithEmail = async () => {
        if (!auth) return
        const credentials = readCredentials()
        if (!credentials) return
        setLoginBusy(true)
        try {
            await auth.signInWithEmailAndPassword(credentials.email, credentials.password)
        } catch {
            try {
                await auth.createUserWithEmailAndPassword(credentials.email, credentials.password)
            } catch (error) {
                handleAuthError(error)
            }
        }
        setLoginBusy(false)
    }

    return {
        loginGuest,
        loginWithEmail
    }
}
