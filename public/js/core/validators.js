export const validateFolderName = (name) => {
    const trimmedName = String(name || "").trim()
    if (!trimmedName || trimmedName.length > 50) return null
    return trimmedName
}

export const FOLDER_DESCRIPTION_SOFT_LIMIT = 300
export const FOLDER_DESCRIPTION_HARD_LIMIT = 300

export const validateFolderDescription = (description) => {
    const trimmedDescription = String(description || "").trim()
    if (trimmedDescription.length > FOLDER_DESCRIPTION_HARD_LIMIT) return null
    return trimmedDescription
}

export const canAddFolder = (currentCount) => Number(currentCount) < 10

export const canAddCustomTheme = (count) => {
    const customThemeCount = Number(count)
    if (!Number.isFinite(customThemeCount)) return true
    return customThemeCount < ThemeManager.maxCustomPresets
}

export const canAssignToFolder = (folder) => !!folder && folder.trashedAt == null

window.Validators = {
    validateFolderName,
    validateFolderDescription,
    canAddFolder,
    canAddCustomTheme,
    canAssignToFolder,
    FOLDER_DESCRIPTION_SOFT_LIMIT,
    FOLDER_DESCRIPTION_HARD_LIMIT
}


export const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    debounce: (func, wait) => {
        let timeout = null
        return function (...args) {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => func.apply(this, args), wait)
        }
    },
    formatDate: (value) => {
        if (value === null || value === undefined || value === "") return ""
        let date = null
        if (value instanceof Date) {
            date = new Date(value.getTime())
        } else if (value && typeof value.toDate === "function") {
            date = value.toDate()
        } else if (value && typeof value === "object" && Number.isFinite(value.seconds)) {
            date = new Date(value.seconds * 1000)
        } else if (typeof value === "string") {
            const parsedTimestamp = Date.parse(value)
            date = new Date(parsedTimestamp)
        } else if (typeof value === "number") {
            date = new Date(value)
        } else {
            date = new Date(value)
        }
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ""
        const lang = (typeof StateStore !== "undefined" && StateStore.read().config && StateStore.read().config.lang) || "ru"
        try {
            return new Intl.DateTimeFormat(lang, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date)
        } catch {
            return date.toLocaleDateString()
        }
    },
    stripHtml: (html) => {
        if (!html) return ""
        const tmp = document.createElement("div")
        tmp.innerHTML = html
        return tmp.textContent || tmp.innerText || ""
    },
    escapeHtml: (value) => {
        if (value === null || value === undefined) return ""
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    },
    serverTimestamp: () => {
        if (typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue) {
            return firebase.firestore.FieldValue.serverTimestamp()
        }
        return Date.now()
    },
    sanitizeHtml: (html) => {
        const allowedTags = new Set(["b", "strong", "i", "em", "u", "s", "del", "strike", "br", "hr", "p", "div", "ul", "ol", "li", "span", "img", "a", "audio", "source", "button", "input", "table", "thead", "tbody", "tfoot", "tr", "td", "th"])
        const allowedClasses = new Set([
            "media-wrapper",
            "media-resize-handle",
            "align-left",
            "align-right",
            "align-center",
            "audio-wrapper",
            "audio-player",
            "audio-icon",
            "audio-label",
            "audio-block",
            "audio-controls",
            "audio-play",
            "audio-play-icon",
            "audio-control-icon",
            "audio-drag-handle",
            "audio-delete",
            "audio-timeline",
            "audio-title-row",
            "audio-progress",
            "audio-time",
            "audio-current",
            "audio-duration",
            "audio-volume",
            "audio-title",
            "media-draggable-item",
            "playing",
            "note-page",
            "note-drawing"
        ])
        const allowAttrs = {
            a: new Set(["href", "target", "rel", "data-note-id"]),
            img: new Set(["src", "alt", "width", "height"]),
            div: new Set(["id", "contenteditable", "draggable", "data-width", "data-height", "data-align", "align", "style"]),
            p: new Set(["data-align", "align", "style"]),
            li: new Set(["data-align", "align", "style"]),
            h1: new Set(["data-align", "align", "style"]),
            h2: new Set(["data-align", "align", "style"]),
            h3: new Set(["data-align", "align", "style"]),
            h4: new Set(["data-align", "align", "style"]),
            h5: new Set(["data-align", "align", "style"]),
            h6: new Set(["data-align", "align", "style"]),
            blockquote: new Set(["data-align", "align", "style"]),
            audio: new Set(["src", "controls", "preload"]),
            source: new Set(["src", "type"]),
            button: new Set(["type", "aria-label"]),
            input: new Set(["type", "checked", "aria-label"]),
            td: new Set(["colspan", "rowspan"]),
            th: new Set(["colspan", "rowspan"])
        }
        const wrapper = document.createElement("div")
        wrapper.innerHTML = String(html || "")
        const isSafeUrl = (value) => {
            const v = String(value || "").trim()
            if (!v) return false
            if (v.startsWith("data:image")) return true
            if (v.startsWith("data:audio")) return true
            if (v.startsWith("https://")) return true
            if (v.startsWith("http://")) return true
            if (v.startsWith("mailto:")) return true
            return false
        }
        const normalizeStyle = (tag, styleValue) => {
            const declarations = String(styleValue || "").split(";").map(part => part.trim()).filter(Boolean)
            if (!declarations.length) return ""
            const normalized = []
            declarations.forEach(declaration => {
                const separatorIndex = declaration.indexOf(":")
                if (separatorIndex < 0) return
                const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
                const value = declaration.slice(separatorIndex + 1).trim().toLowerCase()
                const textAlignAllowedTags = new Set(["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"])
                if (property === "text-align" && textAlignAllowedTags.has(tag) && ["left", "right", "center", "justify"].includes(value)) {
                    normalized.push(`text-align:${value}`)
                    return
                }
                if ((property === "width" || property === "height") && tag === "img") {
                    if (/^\d+(\.\d+)?px$/.test(value)) normalized.push(`${property}:${value}`)
                }
            })
            return normalized.join(";")
        }

        const sanitizeNumericDataAttribute = (element, attributeName) => {
            const rawValue = element.getAttribute(attributeName)
            if (rawValue === null) return
            const parsed = Number.parseFloat(rawValue)
            if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5000) {
                element.removeAttribute(attributeName)
                return
            }
            element.setAttribute(attributeName, String(Math.round(parsed * 100) / 100))
        }

        const sanitizeTextAlignmentAttribute = (element, attributeName) => {
            const value = String(element.getAttribute(attributeName) || "").trim().toLowerCase()
            if (!["left", "right", "center", "justify"].includes(value)) {
                element.removeAttribute(attributeName)
                return
            }
            element.setAttribute(attributeName, value)
        }

        const walk = (node) => {
            const children = Array.from(node.childNodes)
            children.forEach(child => {
                if (child.nodeType !== Node.ELEMENT_NODE) return
                const tag = child.tagName.toLowerCase()
                if (!allowedTags.has(tag)) {
                    const textNode = document.createTextNode(child.textContent || "")
                    child.replaceWith(textNode)
                    return
                }
                Array.from(child.attributes).forEach(attr => {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith("on")) {
                        child.removeAttribute(attr.name)
                        return
                    }
                    if (name === "class") {
                        const safe = String(attr.value || "")
                            .split(/\s+/)
                            .filter(cls => allowedClasses.has(cls))
                        if (safe.length) child.setAttribute("class", safe.join(" "))
                        else child.removeAttribute("class")
                        return
                    }
                    const allowed = allowAttrs[tag]
                    if (!allowed || !allowed.has(name)) child.removeAttribute(attr.name)
                })
                if (child.hasAttribute("style")) {
                    const normalizedStyle = normalizeStyle(tag, child.getAttribute("style"))
                    if (normalizedStyle) child.setAttribute("style", normalizedStyle)
                    else child.removeAttribute("style")
                }
                if (child.hasAttribute("align")) {
                    sanitizeTextAlignmentAttribute(child, "align")
                    const alignValue = child.getAttribute("align")
                    if (alignValue) {
                        const normalizedStyle = normalizeStyle(tag, `text-align:${alignValue}`)
                        if (normalizedStyle) child.setAttribute("style", normalizedStyle)
                    }
                    child.removeAttribute("align")
                }
                if (tag === "div" && child.classList.contains("media-wrapper")) {
                    sanitizeNumericDataAttribute(child, "data-width")
                    sanitizeNumericDataAttribute(child, "data-height")
                }
                if (child.hasAttribute("data-align")) sanitizeTextAlignmentAttribute(child, "data-align")

                if (tag === "a") {
                    const href = child.getAttribute("href")
                    if (!isSafeUrl(href) || String(href || "").startsWith("data:")) {
                        child.removeAttribute("href")
                    } else if (String(href || "").startsWith("http")) {
                        child.setAttribute("rel", "noopener noreferrer")
                        child.setAttribute("target", "_blank")
                    }
                }
                if (tag === "input") {
                    const type = String(child.getAttribute("type") || "").toLowerCase()
                    if (type !== "checkbox") {
                        child.remove()
                        return
                    }
                }
                if (tag === "img") {
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:image")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                    const width = Number.parseFloat(child.getAttribute("width") || "")
                    const height = Number.parseFloat(child.getAttribute("height") || "")
                    if (!Number.isFinite(width) || width <= 0 || width > 5000) child.removeAttribute("width")
                    if (!Number.isFinite(height) || height <= 0 || height > 5000) child.removeAttribute("height")
                }
                if (tag === "audio") {
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:audio")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                }
                if (tag === "source") {
                    const sourceParent = child.parentElement?.tagName?.toLowerCase()
                    if (sourceParent !== "audio") {
                        child.remove()
                        return
                    }
                    const src = child.getAttribute("src")
                    const s = String(src || "")
                    if (!isSafeUrl(s) || (s.startsWith("data:") && !s.startsWith("data:audio")) || s.startsWith("http:")) {
                        child.removeAttribute("src")
                    }
                }
                walk(child)
            })
        }
        walk(wrapper)
        return wrapper.innerHTML
    }
}

export const normalizeDateValue = (value) => {
    if (value === null || value === undefined || value === "") return 0
    if (typeof value?.toDate === "function") {
        const timestamp = value.toDate().getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (value && typeof value === "object" && Number.isFinite(value.seconds)) {
        const timestamp = value.seconds * 1000
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (value instanceof Date) {
        const timestamp = value.getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
    }
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    const parsedTimestamp = Date.parse(String(value))
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0
}

export const buildNotePayload = ({ note, user, access } = {}) => {
    const ownerUid = access?.ownerUid || user?.uid || note?.ownerUid || ""
    const roleMap = access?.roles && typeof access.roles === "object" ? access.roles : {}
    const targetIdentifier = access?.noteId || note?.id || Utils.generateId()
    const workspaceId = access?.workspaceId || note?.workspaceId || null
    const normalizedNote = NoteIO.normalizeNote({ ...note, id: targetIdentifier, ownerUid })
    return {
        ...normalizedNote,
        ownerUid,
        access: {
            ownerUid,
            workspaceId,
            noteId: targetIdentifier,
            roles: workspaceId ? roleMap : {
                ...roleMap,
                [ownerUid]: "owner"
            }
        }
    }
}

export const buildNoteUpdatePayload = (updates = {}, options = {}) => {
    const payload = { ...updates }
    const shouldUpdateTimestamp = options.updateTimestamp !== false
    if (shouldUpdateTimestamp && payload.updatedAt === undefined) {
        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp()
    }
    return payload
}

window.NoteHelpers = {
    normalizeDateValue,
    buildNotePayload,
    buildNoteUpdatePayload
}

export const APP_MESSAGES = {
    folderNameTooLong: {
        key: "folder_name_too_long",
        fallback: "Folder name must not exceed 50 characters"
    },
    folderLimitReached: {
        key: "folder_limit",
        fallback: "Folder limit reached"
    },
    moveToTrashedFolderDenied: {
        key: "move_to_trashed_folder_denied",
        fallback: "Cannot move note into a trashed folder"
    },
    restored: {
        key: "restored",
        fallback: "Restored"
    },
    syncError: {
        key: "sync_error",
        fallback: "Sync error"
    }
}

export const getAppMessage = (uiInstance, descriptor) => {
    if (!descriptor) return ""
    if (uiInstance && typeof uiInstance.getText === "function") {
        return uiInstance.getText(descriptor.key, descriptor.fallback)
    }
    return descriptor.fallback
}

window.AppMessages = {
    APP_MESSAGES,
    getAppMessage
}

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

    const fetchMethods = async email => {
        if (!auth || !email) return []
        try {
            const methods = await auth.fetchSignInMethodsForEmail(email)
            return Array.isArray(methods) ? methods : []
        } catch (error) {
            handleAuthError(error)
            return null
        }
    }

    const isGoogleOnlyAccount = methods => methods.includes("google.com") && !methods.includes("password")

    const signInWithEmail = async () => {
        if (!auth) return
        const credentials = readSignInCredentials()
        if (!validateSignInCredentials(credentials)) return

        const methods = await fetchMethods(credentials.email)
        if (methods === null) return
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

        const methods = await fetchMethods(credentials.email)
        if (methods === null) return
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

        setFeedback("")
        await runWithBusyState(async () => {
            await auth.createUserWithEmailAndPassword(credentials.email, credentials.password)
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

        const methods = await fetchMethods(email)
        if (methods === null) return
        if (!methods.includes("password")) {
            if (isGoogleOnlyAccount(methods)) {
                setFeedback(getText("auth_email_google_only", "Этот email зарегистрирован через Google. Войдите через Google."))
                return
            }
            setFeedback(getText("auth_email_not_found", "Аккаунт с таким email не найден"))
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

"use strict";

import { initFirebase } from "./firebase.js"
import { createAuthManager } from "./auth.js"

const usersCollectionName = "users"

const resolveUserIdentifier = user => {
    if (!user || !user.uid) return ""
    return String(user.uid)
}

const getUserRootReference = (db, user) => {
    const userIdentifier = resolveUserIdentifier(user)
    if (!db || !userIdentifier) return null
    return db.collection(usersCollectionName).doc(userIdentifier)
}

const buildUserDocumentPayload = (user, createdAtValue) => {
    const userIdentifier = resolveUserIdentifier(user)
    const providerId = Array.isArray(user?.providerData) && user.providerData.length
        ? String(user.providerData[0]?.providerId || "")
        : ""
    const payload = {
        uid: userIdentifier,
        email: user?.email ? String(user.email).toLowerCase() : null,
        providerId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }
    if (createdAtValue !== undefined) payload.createdAt = createdAtValue
    return payload
}

const createRefsApi = (db) => ({
    getUserStorageCollectionName: () => usersCollectionName,
    getUserRootReference: user => getUserRootReference(db, user),
    ensureUserDocument: async (user) => {
        const rootReference = getUserRootReference(db, user)
        if (!rootReference) return null
        const existingDocument = await rootReference.get()
        const existingData = existingDocument.exists ? (existingDocument.data() || {}) : {}
        const createdAtValue = existingData.createdAt ?? firebase.firestore.FieldValue.serverTimestamp()
        const payload = buildUserDocumentPayload(user, createdAtValue)
        await rootReference.set(payload, { merge: true })
        return rootReference
    },
    getUserNotesCollection(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("notes") : null
    },
    getUserFoldersCollection(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("folders") : null
    },
    getUserSharedCollection(user, sharedCollectionName) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection(sharedCollectionName) : null
    },
    getUserSettingsReference(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("settings").doc("profile") : null
    },
    getUserLegacySettingsReference(user) {
        const rootReference = getUserRootReference(db, user)
        return rootReference ? rootReference.collection("preferences").doc("profile") : null
    }
})

const infraState = {
    app: null,
    auth: null,
    db: null,
    authManager: null,
    refsApi: null
}

const InfraEngine = {
    init() {
        if (infraState.auth && infraState.db) return infraState
        const { app, auth, db } = initFirebase()
        infraState.app = app
        infraState.auth = auth
        infraState.db = db
        infraState.refsApi = createRefsApi(db)
        window.auth = auth
        window.db = db
        window.DataPath = infraState.refsApi
        return infraState
    },
    createAuth() {
        if (infraState.authManager) return infraState.authManager
        if (!infraState.auth) this.init()
        infraState.authManager = createAuthManager({ auth: infraState.auth })
        return infraState.authManager
    },
    login() {
        const manager = this.createAuth()
        return manager.login()
    },
    logout() {
        const manager = this.createAuth()
        return manager.logout()
    },
    getUser() {
        return infraState.auth?.currentUser || null
    },
    getRefs() {
        if (!infraState.refsApi) this.init()
        return infraState.refsApi
    },
    getAuth() {
        if (!infraState.auth) this.init()
        return infraState.auth
    },
    getDb() {
        if (!infraState.db) this.init()
        return infraState.db
    }
}

window.InfraEngine = InfraEngine

export { InfraEngine }
