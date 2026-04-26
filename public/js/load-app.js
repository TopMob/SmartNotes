const Calculator = (() => {
    const findExpressionAroundCaret = (text, caretOffset) => {
        const allowed = /[0-9+\-*/().,%\s]/
        let start = caretOffset
        let end = caretOffset
        while (start > 0 && allowed.test(text[start - 1])) start -= 1
        while (end < text.length && allowed.test(text[end])) end += 1
        const slice = text.slice(start, end)
        const trimmed = slice.trim()
        if (!trimmed) return null
        if (!/[+\-*/%()]/.test(trimmed)) return null
        const leadingSpace = slice.indexOf(trimmed)
        const expressionStart = start + leadingSpace
        const expressionEnd = expressionStart + trimmed.length
        return { expression: trimmed, start: expressionStart, end: expressionEnd }
    }

    const tokenizeExpression = (expression) => {
        const tokens = []
        let index = 0
        let lastType = "start"
        const isNumberPart = (char) => /[0-9.,]/.test(char)
        while (index < expression.length) {
            const char = expression[index]
            if (/\s/.test(char)) {
                index += 1
                continue
            }
            if (isNumberPart(char)) {
                let numberText = ""
                let separatorCount = 0
                while (index < expression.length && isNumberPart(expression[index])) {
                    const current = expression[index]
                    if (current === "." || current === ",") {
                        separatorCount += 1
                        if (separatorCount > 1) return null
                        numberText += "."
                    } else {
                        numberText += current
                    }
                    index += 1
                }
                if (!numberText || numberText === ".") return null
                const value = Number(numberText)
                if (!Number.isFinite(value)) return null
                tokens.push({ type: "number", value })
                lastType = "number"
                continue
            }
            if (char === "(") {
                tokens.push({ type: "leftParen" })
                index += 1
                lastType = "leftParen"
                continue
            }
            if (char === ")") {
                if (lastType === "operator" || lastType === "leftParen" || lastType === "start") return null
                tokens.push({ type: "rightParen" })
                index += 1
                lastType = "rightParen"
                continue
            }
            if (char === "%") {
                if (!["number", "rightParen", "percent"].includes(lastType)) return null
                tokens.push({ type: "percent" })
                index += 1
                lastType = "percent"
                continue
            }
            if ("+-*/".includes(char)) {
                const isUnary = lastType === "start" || lastType === "operator" || lastType === "leftParen"
                if (isUnary) {
                    if (char === "+") {
                        index += 1
                        continue
                    }
                    tokens.push({ type: "operator", value: "neg" })
                    index += 1
                    lastType = "operator"
                    continue
                }
                tokens.push({ type: "operator", value: char })
                index += 1
                lastType = "operator"
                continue
            }
            return null
        }
        if (lastType === "operator" || lastType === "leftParen") return null
        return tokens
    }

    const toRpn = (tokens) => {
        const output = []
        const stack = []
        const operatorInfo = {
            "+": { precedence: 1, assoc: "left" },
            "-": { precedence: 1, assoc: "left" },
            "*": { precedence: 2, assoc: "left" },
            "/": { precedence: 2, assoc: "left" },
            "neg": { precedence: 3, assoc: "right" }
        }
        for (const token of tokens) {
            if (token.type === "number") {
                output.push(token)
                continue
            }
            if (token.type === "percent") {
                output.push(token)
                continue
            }
            if (token.type === "operator") {
                const currentInfo = operatorInfo[token.value]
                while (stack.length) {
                    const top = stack[stack.length - 1]
                    if (top.type !== "operator") break
                    const topInfo = operatorInfo[top.value]
                    const shouldPop = topInfo.precedence > currentInfo.precedence
                        || (topInfo.precedence === currentInfo.precedence && currentInfo.assoc === "left")
                    if (!shouldPop) break
                    output.push(stack.pop())
                }
                stack.push(token)
                continue
            }
            if (token.type === "leftParen") {
                stack.push(token)
                continue
            }
            if (token.type === "rightParen") {
                let found = false
                while (stack.length) {
                    const top = stack.pop()
                    if (top.type === "leftParen") {
                        found = true
                        break
                    }
                    output.push(top)
                }
                if (!found) return null
                continue
            }
            return null
        }
        while (stack.length) {
            const top = stack.pop()
            if (top.type === "leftParen" || top.type === "rightParen") return null
            output.push(top)
        }
        return output
    }

    const evaluateRpn = (tokens) => {
        const stack = []
        for (const token of tokens) {
            if (token.type === "number") {
                stack.push(token.value)
                continue
            }
            if (token.type === "percent") {
                if (!stack.length) return null
                const value = stack.pop()
                if (typeof value !== "number") return null
                stack.push({ type: "percent", value })
                continue
            }
            if (token.type === "operator") {
                if (token.value === "neg") {
                    if (!stack.length) return null
                    const value = stack.pop()
                    if (typeof value === "number") {
                        stack.push(-value)
                    } else if (value?.type === "percent") {
                        stack.push({ type: "percent", value: -value.value })
                    } else {
                        return null
                    }
                    continue
                }
                if (stack.length < 2) return null
                const right = stack.pop()
                const left = stack.pop()
                if (typeof left !== "number") return null
                let result = null
                if (typeof right === "number") {
                    switch (token.value) {
                        case "+":
                            result = left + right
                            break
                        case "-":
                            result = left - right
                            break
                        case "*":
                            result = left * right
                            break
                        case "/":
                            result = right === 0 ? null : left / right
                            break
                        default:
                            result = null
                            break
                    }
                } else if (right?.type === "percent") {
                    const ratio = right.value / 100
                    switch (token.value) {
                        case "+":
                            result = left + left * ratio
                            break
                        case "-":
                            result = left - left * ratio
                            break
                        case "*":
                            result = left * ratio
                            break
                        case "/":
                            result = ratio === 0 ? null : left / ratio
                            break
                        default:
                            result = null
                            break
                    }
                } else {
                    result = null
                }
                if (!Number.isFinite(result)) return null
                stack.push(result)
                continue
            }
            return null
        }
        if (stack.length !== 1) return null
        const finalValue = stack[0]
        if (typeof finalValue === "number") return finalValue
        if (finalValue?.type === "percent") return finalValue.value / 100
        return null
    }

    const evaluateExpression = (expression) => {
        const tokens = tokenizeExpression(expression)
        if (!tokens) return null
        const rpn = toRpn(tokens)
        if (!rpn) return null
        return evaluateRpn(rpn)
    }

    const formatResult = (value) => {
        const rounded = Math.round(value * 1000000000) / 1000000000
        return String(rounded)
    }

    return {
        findExpressionAroundCaret,
        evaluateExpression,
        formatResult
    }
})();

window.Calculator = Calculator;

const getNotesScrollContainer = () => document.getElementById("notes-content-area")

const renderFromState = (options = {}) => {
    const shouldPreserveScrollPosition = !!options.preserveScrollPosition
    const scrollContainer = shouldPreserveScrollPosition ? getNotesScrollContainer() : null
    const scrollTopBeforeRender = scrollContainer ? scrollContainer.scrollTop : 0
    const viewModel = NotesPresenter.createViewModel(StateStore.read())
    NotesUIAdapter.render(viewModel)
    UI.updateNavigationActiveState()
    if (scrollContainer) scrollContainer.scrollTop = scrollTopBeforeRender
}

const createStateRenderingController = () => {
    let unsubscribeStateRender = null

    const start = () => {
        if (unsubscribeStateRender) return
        unsubscribeStateRender = StateStore.subscribe((nextState, previousState) => {
            const configChanged = nextState.config !== previousState.config
            const languageChanged = configChanged && nextState.config.lang !== previousState.config.lang
            if (languageChanged) UI.applyLangToDom()

            const folderUiDependenciesChanged = nextState.folders !== previousState.folders
                || nextState.activeFolderId !== previousState.activeFolderId
                || languageChanged
                || (configChanged && nextState.config.folderViewMode !== previousState.config.folderViewMode)
            if (folderUiDependenciesChanged) UI.renderFolders()

            const paginationStateChanged = nextState.pagination !== previousState.pagination
            const displayLimitChanged = paginationStateChanged && nextState.pagination.displayLimit !== previousState.pagination.displayLimit
            const loadMoreStateChanged = paginationStateChanged
                && (
                    nextState.pagination.loadingMoreOwnedNotes !== previousState.pagination.loadingMoreOwnedNotes
                    || nextState.pagination.hasMoreOwnedNotes !== previousState.pagination.hasMoreOwnedNotes
                    || nextState.pagination.totalVisibleNotesCount !== previousState.pagination.totalVisibleNotesCount
                    || nextState.pagination.renderedVisibleNotesCount !== previousState.pagination.renderedVisibleNotesCount
                    || nextState.pagination.searchActive !== previousState.pagination.searchActive
                )

            const shouldRenderNotes = nextState.notes !== previousState.notes
                || nextState.view !== previousState.view
                || nextState.activeFolderId !== previousState.activeFolderId
                || nextState.searchQuery !== previousState.searchQuery
                || nextState.folders !== previousState.folders
                || languageChanged
                || displayLimitChanged
                || (configChanged && nextState.config.notesFilter !== previousState.config.notesFilter)

            if (shouldRenderNotes) {
                renderFromState({ preserveScrollPosition: displayLimitChanged })
                return
            }

            if (loadMoreStateChanged) {
                UI.updateNotesLoadMoreButton(PaginationService.getLoadMoreState())
            }
        })
    }

    const stop = () => {
        if (typeof unsubscribeStateRender === "function") unsubscribeStateRender()
        unsubscribeStateRender = null
    }

    return { start, stop, renderFromState }
}

const isNonCriticalSyncError = (error) => {
    const errorCode = String(error?.code || "")
    return errorCode === "permission-denied" || errorCode === "failed-precondition" || errorCode === "not-found"
}

const reportSyncError = (error, context) => {
    const details = { code: error?.code || "", message: error?.message || String(error || "") }
    if (isNonCriticalSyncError(error)) {
        console.info(`[Session] ${context} secondary error`, details)
        return
    }
    UI.showToast(UI.getText("sync_error", "Sync error"))
    console.error(`[Session] ${context} error`, details)
}

const createUiEventsController = () => {
    let unsubscribeUiEvents = []

    const clear = () => {
        if (!unsubscribeUiEvents.length) return
        unsubscribeUiEvents.forEach(unsubscribe => {
            if (typeof unsubscribe === "function") unsubscribe()
        })
        unsubscribeUiEvents = []
    }

    const start = () => {
        clear()
        unsubscribeUiEvents.push(EventBus.subscribe("reminderTriggered", note => {
            UI.showToast(`${UI.getText("reminder_note", "Reminder")}: ${note.title || UI.getText("untitled_note", "Untitled")}`)
            window.NotificationService?.showReminderNotification?.(
                note.title || UI.getText("untitled_note", "Untitled"),
                UI.getText("reminder_note", "Reminder")
            )
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("settingsSaved", () => {
            UI.showToast(UI.getText("settings_saved", "Настройки сохранены"))
        }))
        unsubscribeUiEvents.push(EventBus.subscribe("notesLoadFailed", error => reportSyncError(error, "notes load")))
        unsubscribeUiEvents.push(EventBus.subscribe("notesSyncError", error => reportSyncError(error, "owned notes sync")))
        unsubscribeUiEvents.push(EventBus.subscribe("foldersSyncError", error => reportSyncError(error, "folders sync")))
    }

    return { start, stop: clear }
}

const createNetworkLifecycleController = () => {
    let networkRetryTimer = null
    let networkListenersController = null
    const getSessionService = () => globalThis.SessionService || window.SessionService || null

    const start = () => {
        if (networkListenersController) return
        networkListenersController = new AbortController()
        window.addEventListener("online", () => {
            clearTimeout(networkRetryTimer)
            networkRetryTimer = setTimeout(() => {
                const user = StateStore.read().user
                const sessionService = getSessionService()
                if (user?.uid && sessionService?.startUserSession) {
                    sessionService.startUserSession(user, { forceResubscribe: true }).catch(() => {})
                }
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

const createRuntimeInitializer = () => {
    let initializationPromise = null

    const stateRenderer = createStateRenderingController()
    const uiEvents = createUiEventsController()
    const networkLifecycle = createNetworkLifecycleController()

    const initializeRuntime = async () => {
        if (typeof UI.init === "function") UI.init()
        if (typeof window.SmartNotesEditor?.init === "function") window.SmartNotesEditor.init()
        stateRenderer.start()
        uiEvents.start()
        networkLifecycle.start()
        const user = StateStore.read().user
        if (user?.uid && typeof UI.handleInviteLinkFromUrl === "function") {
            await UI.handleInviteLinkFromUrl()
        }
        stateRenderer.renderFromState()
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

const NotesApplication = (() => {
    const runtime = createRuntimeInitializer()
    return {
        init: runtime.init,
        initWhenDomReady: runtime.initWhenDomReady
    }
})()

window.initApp = () => NotesApplication.init()
NotesApplication.initWhenDomReady()
