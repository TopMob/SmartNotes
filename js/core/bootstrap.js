export function bootstrapCore({ ThemeManager, Auth }) {
    document.addEventListener("DOMContentLoaded", () => {
        if (typeof ThemeManager !== "undefined" && ThemeManager && typeof ThemeManager.init === "function") {
            ThemeManager.init()
        }
        if (typeof UI !== "undefined" && UI.captureShareFromHash) UI.captureShareFromHash()

        const loginButton = document.querySelector("[data-action='login']")
        if (loginButton) {
            loginButton.addEventListener("click", () => Auth.login())
        }

        Auth.init().catch(() => null)

        document.addEventListener("dblclick", (event) => {
            event.preventDefault()
        }, { passive: false })
    })
}
