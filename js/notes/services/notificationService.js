const NOTIFICATION_PERMISSION_STATE_KEY = "reminder-notification-permission-state"

const NotificationService = (() => {
    const getPermission = () => {
        if (typeof Notification === "undefined") return "unsupported"
        return String(Notification.permission || "default")
    }

    const ensurePermission = async (options = {}) => {
        const force = options && options.force === true
        if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") {
            return { supported: false, permission: "unsupported", changed: false }
        }

        const currentPermission = getPermission()
        if (currentPermission === "granted" || currentPermission === "denied") {
            return { supported: true, permission: currentPermission, changed: false }
        }

        if (!force && SafeStorage.local.get(NOTIFICATION_PERMISSION_STATE_KEY) === "requested") {
            return { supported: true, permission: currentPermission, changed: false }
        }

        SafeStorage.local.set(NOTIFICATION_PERMISSION_STATE_KEY, "requested")
        const nextPermission = await Notification.requestPermission()
        return { supported: true, permission: String(nextPermission || "default"), changed: true }
    }

    const showReminderNotification = (title, body) => {
        if (typeof Notification === "undefined") return false
        if (getPermission() !== "granted") return false
        try {
            new Notification(String(title || ""), { body: String(body || "") })
            return true
        } catch {
            return false
        }
    }

    return {
        getPermission,
        ensurePermission,
        showReminderNotification
    }
})()

window.NotificationService = NotificationService

