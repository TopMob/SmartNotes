export function createLocalAuthManager({ auth, setLoginBusy, handleAuthError, getText }) {
    const uiState = {
        initialized: false,
        mode: "signin"
    }

    const elementIds = {
        signInForm: "email-signin-form",
        signUpForm: "email-signup-form",
        signInTab: "email-signin-tab",
        signUpTab: "email-signup-tab",
        signInEmail: "email-signin-input",
        signUpEmail: "email-signup-input",
        signInPassword: "password-signin-input",
        signUpPassword: "password-signup-input",
        signUpPasswordRepeat: "password-signup-repeat-input",
        feedback: "email-auth-feedback"
    }

    const getElement = id => document.getElementById(id)

    const setFeedback = (message, type = "error") => {
        const feedbackElement = getElement(elementIds.feedback)
        if (!feedbackElement) return
        feedbackElement.textContent = message || ""
        feedbackElement.classList.toggle("is-error", type === "error")
        feedbackElement.classList.toggle("is-success", type === "success")
    }

    const setMode = mode => {
        uiState.mode = mode === "signup" ? "signup" : "signin"
        const signInFormElement = getElement(elementIds.signInForm)
        const signUpFormElement = getElement(elementIds.signUpForm)
        const signInTabElement = getElement(elementIds.signInTab)
        const signUpTabElement = getElement(elementIds.signUpTab)
        const isSignIn = uiState.mode === "signin"

        signInFormElement?.classList.toggle("hidden", !isSignIn)
        signUpFormElement?.classList.toggle("hidden", isSignIn)
        signInTabElement?.classList.toggle("active", isSignIn)
        signUpTabElement?.classList.toggle("active", !isSignIn)
        signInTabElement?.setAttribute("aria-selected", isSignIn ? "true" : "false")
        signUpTabElement?.setAttribute("aria-selected", isSignIn ? "false" : "true")
        setFeedback("")
    }

    const togglePasswordVisibility = buttonElement => {
        const targetId = buttonElement?.dataset.toggleTarget
        const inputElement = targetId ? getElement(targetId) : null
        if (!inputElement) return
        const nextType = inputElement.type === "password" ? "text" : "password"
        inputElement.type = nextType
        buttonElement.textContent = nextType === "password"
            ? getText("show_password", "Show")
            : getText("hide_password", "Hide")
    }

    const normalizeEmail = value => String(value || "").trim().toLowerCase()

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i

    const isEmailFormatValid = email => emailPattern.test(String(email || ""))

    const readSignInCredentials = () => {
        const email = normalizeEmail(getElement(elementIds.signInEmail)?.value)
        const password = String(getElement(elementIds.signInPassword)?.value || "")
        return { email, password }
    }

    const readSignUpCredentials = () => {
        const email = normalizeEmail(getElement(elementIds.signUpEmail)?.value)
        const password = String(getElement(elementIds.signUpPassword)?.value || "")
        const passwordRepeat = String(getElement(elementIds.signUpPasswordRepeat)?.value || "")
        return { email, password, passwordRepeat }
    }

    const validateSignInCredentials = credentials => {
        if (!credentials.email || !credentials.password) {
            setFeedback(getText("auth_fill_required", "Fill in email and password"))
            return false
        }
        if (!isEmailFormatValid(credentials.email)) {
            setFeedback(getText("auth_invalid_email_format", "Введите корректный email"))
            return false
        }
        return true
    }

    const validateSignUpCredentials = credentials => {
        if (!credentials.email || !credentials.password || !credentials.passwordRepeat) {
            setFeedback(getText("auth_fill_required", "Fill in all required fields"))
            return false
        }
        if (!isEmailFormatValid(credentials.email)) {
            setFeedback(getText("auth_invalid_email_format", "Введите корректный email"))
            return false
        }
        if (credentials.password.length < 6) {
            setFeedback(getText("auth_password_short", "Password must contain at least 6 characters"))
            return false
        }
        if (credentials.password !== credentials.passwordRepeat) {
            setFeedback(getText("auth_password_mismatch", "Введите два одинаковых пароля"))
            return false
        }
        return true
    }

    const fetchMethods = async email => {
        if (!auth || !email) return []
        try {
            const methods = await auth.fetchSignInMethodsForEmail(email)
            return Array.isArray(methods) ? methods : []
        } catch (error) {
            handleAuthError(error)
            return []
        }
    }

    const isGoogleOnlyAccount = methods => methods.includes("google.com") && !methods.includes("password")

    const signInWithEmail = async () => {
        if (!auth) return
        const credentials = readSignInCredentials()
        if (!validateSignInCredentials(credentials)) return

        const methods = await fetchMethods(credentials.email)
        if (!methods.length) {
            setFeedback(getText("auth_email_not_found", "Аккаунт с таким email не найден"))
            return
        }
        if (methods.length && !methods.includes("password")) {
            if (isGoogleOnlyAccount(methods)) {
                setFeedback(getText("auth_email_google_only", "Этот email зарегистрирован через Google. Войдите через Google."))
                return
            }
            setFeedback(getText("auth_email_provider_conflict", "Для этого email используется другой способ входа"))
            return
        }

        setLoginBusy(true)
        setFeedback("")
        try {
            await auth.signInWithEmailAndPassword(credentials.email, credentials.password)
        } catch (error) {
            handleAuthError(error)
        }
        setLoginBusy(false)
    }

    const signUpWithEmail = async () => {
        if (!auth) return
        const credentials = readSignUpCredentials()
        if (!validateSignUpCredentials(credentials)) return

        const methods = await fetchMethods(credentials.email)
        if (isGoogleOnlyAccount(methods)) {
            setFeedback(getText("auth_email_google_only", "Этот email зарегистрирован через Google. Войдите через Google."))
            return
        }
        if (methods.includes("password")) {
            setFeedback(getText("auth_email_exists", "Пользователь с таким email уже существует. Выполните вход."))
            setMode("signin")
            const signInEmailElement = getElement(elementIds.signInEmail)
            if (signInEmailElement) signInEmailElement.value = credentials.email
            return
        }

        setLoginBusy(true)
        setFeedback("")
        try {
            await auth.createUserWithEmailAndPassword(credentials.email, credentials.password)
        } catch (error) {
            handleAuthError(error)
        }
        setLoginBusy(false)
    }

    const sendPasswordReset = async () => {
        if (!auth) return
        const email = normalizeEmail(getElement(elementIds.signInEmail)?.value)
        if (!email) {
            setFeedback(getText("auth_reset_enter_email", "Введите email для восстановления пароля"))
            return
        }
        if (!isEmailFormatValid(email)) {
            setFeedback(getText("auth_invalid_email_format", "Введите корректный email"))
            return
        }

        const methods = await fetchMethods(email)
        if (!methods.includes("password")) {
            if (isGoogleOnlyAccount(methods)) {
                setFeedback(getText("auth_email_google_only", "Этот email зарегистрирован через Google. Войдите через Google."))
                return
            }
            setFeedback(getText("auth_email_not_found", "Аккаунт с таким email не найден"))
            return
        }

        setLoginBusy(true)
        setFeedback("")
        try {
            await auth.sendPasswordResetEmail(email)
            setFeedback(getText("auth_reset_sent", "Письмо для восстановления пароля отправлено"), "success")
        } catch (error) {
            handleAuthError(error)
        }
        setLoginBusy(false)
    }

    const bindUi = () => {
        if (uiState.initialized) return
        uiState.initialized = true

        const signInTabElement = getElement(elementIds.signInTab)
        const signUpTabElement = getElement(elementIds.signUpTab)
        const signInFormElement = getElement(elementIds.signInForm)
        const signUpFormElement = getElement(elementIds.signUpForm)

        signInTabElement?.addEventListener("click", () => setMode("signin"))
        signUpTabElement?.addEventListener("click", () => setMode("signup"))

        signInFormElement?.addEventListener("submit", event => {
            event.preventDefault()
            signInWithEmail()
        })

        signUpFormElement?.addEventListener("submit", event => {
            event.preventDefault()
            signUpWithEmail()
        })

        document.querySelectorAll(".btn-auth-toggle-password").forEach(buttonElement => {
            buttonElement.addEventListener("click", () => togglePasswordVisibility(buttonElement))
        })

        document.querySelectorAll("[data-auth-action='forgot-password']").forEach(buttonElement => {
            buttonElement.addEventListener("click", () => sendPasswordReset())
        })

        setMode("signin")
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
        bindUi()
        setMode("signin")
        getElement(elementIds.signInEmail)?.focus()
    }

    return {
        bindUi,
        loginGuest,
        loginWithEmail
    }
}
