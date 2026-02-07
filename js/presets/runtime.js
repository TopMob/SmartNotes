(() => {
    const applyPresetConfig = () => {
        const config = window.AppPresetConfig || {}
        const root = document.documentElement
        const cssVariables = config.cssVariables || {}
        Object.keys(cssVariables).forEach(key => {
            root.style.setProperty(key, cssVariables[key])
        })
        const rootAttributes = config.rootAttributes || {}
        Object.keys(rootAttributes).forEach(key => {
            root.setAttribute(key, rootAttributes[key])
        })
        const bodyClasses = config.bodyClasses || []
        if (document.body) {
            bodyClasses.forEach(name => document.body.classList.add(name))
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyPresetConfig)
    } else {
        applyPresetConfig()
    }
})()
