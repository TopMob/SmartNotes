function detectMobilePlatform() {
    const userAgent = String(navigator.userAgent || "").toLowerCase()
    const platform = String(navigator.platform || "").toLowerCase()
    const touchPoints = Number(navigator.maxTouchPoints || 0)

    const isIphoneFamily = /iphone|ipad|ipod/.test(userAgent)
    const isIpadDesktopMode = platform === "macintel" && touchPoints > 1
    if (isIphoneFamily || isIpadDesktopMode) return "ios"
    if (/android/.test(userAgent)) return "android"
    return "other"
}

function applyMobilePlatformAttributes() {
    const platformType = detectMobilePlatform()
    const rootElement = document.documentElement
    const bodyElement = document.body
    if (!rootElement || !bodyElement) return

    const classNames = ["platform-ios", "platform-android", "platform-other"]
    rootElement.classList.remove(...classNames)
    bodyElement.classList.remove(...classNames)

    const className = platformType === "ios"
        ? "platform-ios"
        : platformType === "android"
            ? "platform-android"
            : "platform-other"

    rootElement.classList.add(className)
    bodyElement.classList.add(className)
    rootElement.dataset.mobilePlatform = platformType
    bodyElement.dataset.mobilePlatform = platformType
}

function deferUntilAfterPaint(callback) {
    if (typeof callback !== "function") return
    const run = () => {
        if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(() => callback(), { timeout: 2000 })
            return
        }
        window.setTimeout(callback, 0)
    }
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => run())
        return
    }
    run()
}

export function bootstrapCore({ ThemeManager, Auth }) {
    const boot = () => {
        applyMobilePlatformAttributes()
        if (ThemeManager && typeof ThemeManager.init === "function") {
            ThemeManager.init()
        }

        const loginButton = document.querySelector("[data-action='login']")
        if (loginButton && !loginButton.dataset.authBound) {
            loginButton.dataset.authBound = "1"
            loginButton.addEventListener("click", () => {
                Auth.login()
            })
        }

        deferUntilAfterPaint(() => {
            document.addEventListener("dblclick", (event) => {
                event.preventDefault()
            }, { passive: false })
        })

        document.addEventListener("submit", (event) => {
            const formElement = event.target
            if (!(formElement instanceof HTMLFormElement)) return
            if (formElement.id !== "email-signin-form" && formElement.id !== "email-signup-form") return
            event.preventDefault()
        }, true)
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true })
        return
    }
    boot()
}

