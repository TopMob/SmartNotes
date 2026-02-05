export function bootstrapCore({ ThemeManager, Auth }) {
    document.addEventListener("DOMContentLoaded", () => {
        if (ThemeManager && typeof ThemeManager.init === "function") {
            ThemeManager.init()
        }

        if (typeof UI !== "undefined" && UI.captureShareFromHash) {
            UI.captureShareFromHash()
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
    }, { once: true })
}
