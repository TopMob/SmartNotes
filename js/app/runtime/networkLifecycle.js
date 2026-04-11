(() => {
    const createNetworkLifecycleController = () => {
        let networkRetryTimer = null
        let networkListenersController = null

        const start = () => {
            if (networkListenersController) return
            networkListenersController = new AbortController()
            window.addEventListener("online", () => {
                clearTimeout(networkRetryTimer)
                networkRetryTimer = setTimeout(() => {
                    const user = StateStore.read().user
                    if (user?.uid) SessionService.startUserSession(user, { forceResubscribe: true }).catch(() => {})
                }, 1000)
            }, { signal: networkListenersController.signal })
        }

        const stop = () => {
            clearTimeout(networkRetryTimer)
            if (networkListenersController) networkListenersController.abort()
            networkListenersController = null
        }

        return { start, stop }
    }

    window.AppNetworkLifecycle = {
        createNetworkLifecycleController
    }
})()
