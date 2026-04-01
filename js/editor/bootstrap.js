import { ensureEditorRuntimeScripts } from "./runtime-loader.js"

const syncFallback = {
    getToolList: () => [],
    getEnabledTools: () => ({})
}

const asyncMethods = new Set([
    "init",
    "open",
    "openFromList",
    "refreshFromRemote",
    "close",
    "save",
    "undo",
    "redo",
    "deleteCurrent",
    "toggleToolbar",
    "setToolEnabled",
    "resetMediaTransform",
    "alignMediaOrText",
    "deleteSelectedMedia",
    "confirmEquation",
    "addPage",
    "deleteActivePage",
    "selectPage",
    "nextPage",
    "prevPage",
    "applyLink",
    "handlePaste",
    "saveSnapshot"
])

let editorApiPromise = null

const resolveEditorApi = async () => {
    if (!editorApiPromise) {
        editorApiPromise = (async () => {
            await ensureEditorRuntimeScripts()
            const module = await import("./core-api.js")
            return module.EditorAPI
        })()
    }
    return editorApiPromise
}

const invokeAsync = async (methodName, args) => {
    const editorApi = await resolveEditorApi()
    const method = editorApi?.[methodName]
    if (typeof method !== "function") return null
    return method(...args)
}

window.SmartNotesEditor = new Proxy({}, {
    get(_, property) {
        if (property === "__resolve") return resolveEditorApi
        if (typeof property !== "string") return undefined
        if (property in syncFallback) return syncFallback[property]
        if (!asyncMethods.has(property)) return undefined
        return (...args) => invokeAsync(property, args)
    }
})
