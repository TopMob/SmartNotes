const runtimeScriptRegistry = new Map()

const runtimeScripts = [
    "drawing-engine.js",
    "drawing.js"
]

const toRuntimeScriptUrl = (fileName) => new URL(fileName, import.meta.url).toString()

const loadRuntimeScript = (fileName) => {
    const existingPromise = runtimeScriptRegistry.get(fileName)
    if (existingPromise) return existingPromise
    const scriptPromise = new Promise((resolve, reject) => {
        const scriptElement = document.createElement("script")
        scriptElement.src = toRuntimeScriptUrl(fileName)
        scriptElement.defer = true
        scriptElement.onload = () => resolve()
        scriptElement.onerror = () => reject(new Error(`Failed to load ${fileName}`))
        document.head.appendChild(scriptElement)
    })
    runtimeScriptRegistry.set(fileName, scriptPromise)
    return scriptPromise
}

export const ensureEditorRuntimeScripts = async () => {
    for (const runtimeScript of runtimeScripts) {
        await loadRuntimeScript(runtimeScript)
    }
}
