export function createLocalAuthManager({ auth, setLoginBusy, handleAuthError, getText }) {
    const uiState = {
        initialized: false,
        mode: "signin",
        requestInFlight: false
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

    const runWithBusyState = async task => {
        if (uiState.requestInFlight) return false
        uiState.requestInFlight = true
        setLoginBusy(true)
        try {
            await task()
            return true
        } finally {
            uiState.requestInFlight = false
            setLoginBusy(false)
        }
    }

    const signInWithEmail = async () => {
        if (!auth) return
        const credentials = readSignInCredentials()
        if (!validateSignInCredentials(credentials)) return

        setFeedback("")
        await runWithBusyState(async () => {
            await auth.signInWithEmailAndPassword(credentials.email, credentials.password)
        }).catch(error => {
            handleAuthError(error)
        })
    }

    const signUpWithEmail = async () => {
        if (!auth) return
        const credentials = readSignUpCredentials()
        if (!validateSignUpCredentials(credentials)) return

        setFeedback("")
        await runWithBusyState(async () => {
            const result = await auth.createUserWithEmailAndPassword(credentials.email, credentials.password)
            if (result?.pendingConfirmation) {
                setFeedback(getText("auth_email_not_confirmed_signup", "Проверьте почту и подтвердите регистрацию"), "success")
            }
        }).catch(error => {
            handleAuthError(error)
        })
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

        setFeedback("")
        await runWithBusyState(async () => {
            await auth.sendPasswordResetEmail(email)
            setFeedback(getText("auth_reset_sent", "Письмо для восстановления пароля отправлено"), "success")
        }).catch(error => {
            handleAuthError(error)
        })
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

    const loginWithEmail = async () => {
        bindUi()
        setMode("signin")
        getElement(elementIds.signInEmail)?.focus()
    }

    return {
        bindUi,
        loginWithEmail
    }
}

