export function bootstrapCore({ ThemeManager, Auth }) {
    const boot = () => {
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


        document.addEventListener("dblclick", (event) => {
            event.preventDefault()
        }, { passive: false })
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true })
        return
    }
    boot()
}
