export function bootstrapCore({ ThemeManager, Auth }) {
    document.addEventListener("DOMContentLoaded", () => {
        if (ThemeManager && typeof ThemeManager.init === "function") {
            ThemeManager.init()
        }

        if (typeof UI !== "undefined" && UI.captureShareFromHash) {
            UI.captureShareFromHash()
        }

        Auth.init().catch(() => null)

        document.addEventListener("dblclick", (event) => {
            event.preventDefault()
        }, { passive: false })
    }, { once: true })
}
