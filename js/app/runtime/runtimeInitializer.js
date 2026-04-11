(() => {
    const disableServiceWorkerCaching = async () => {
        try {
            if (!("serviceWorker" in navigator)) return
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(registrations.map(registration => registration.unregister()))
            if ("caches" in window) {
                const cacheKeys = await caches.keys()
                await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)))
            }
        } catch (error) {
            console.warn("[Core] service worker cleanup skipped", { message: error?.message || String(error || "") })
        }
    }

    const createRuntimeInitializer = () => {
        let initializationPromise = null

        const stateRenderer = window.AppStateRenderer?.createStateRenderingController?.()
        const uiEvents = window.AppUiEvents?.createUiEventsController?.()
        const networkLifecycle = window.AppNetworkLifecycle?.createNetworkLifecycleController?.()

        const initializeRuntime = async () => {
            disableServiceWorkerCaching()
            if (typeof UI.init === "function") UI.init()
            if (typeof window.SmartNotesEditor?.init === "function") window.SmartNotesEditor.init()
            stateRenderer?.start?.()
            uiEvents?.start?.()
            networkLifecycle?.start?.()
            const user = StateStore.read().user
            if (user?.uid) await SessionService.startUserSession(user)
            stateRenderer?.renderFromState?.()
        }

        const init = async () => {
            if (!initializationPromise) initializationPromise = initializeRuntime()
            return initializationPromise
        }

        const initWhenDomReady = () => {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                    init().catch(error => console.error("[Core] NotesApplication init failed", { message: error?.message || String(error || "") }))
                }, { once: true })
                return
            }
            init().catch(error => console.error("[Core] NotesApplication init failed", { message: error?.message || String(error || "") }))
        }

        return {
            init,
            initWhenDomReady
        }
    }

    window.AppRuntimeInitializer = {
        createRuntimeInitializer
    }
})()
