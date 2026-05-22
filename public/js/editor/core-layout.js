const MOBILE_QUERY = "(max-width: 760px)"
const DESKTOP_BOTTOM_EXTRA = 4
const MOBILE_BOTTOM_EXTRA = 44
const SYNC_DEBOUNCE_MS = 60
const MIN_PANEL_HEIGHT = 10

export const createEditorLayoutHandlers = ({ elements }) => {
    let bottomPanelObserver = null
    let mobileMediaQuery = null
    let releaseViewportListener = null
    let savedBodyOverflow = null
    let savedBodyPaddingRight = null
    let syncDebounceTimer = null
    let lastAppliedOffset = null

    const getToolbarToggleButton = () => document.getElementById("toolbar-toggle")

    const getToolbar = () => elements.toolbar || document.getElementById("editor-toolbar")

    const getScrollArea = () => elements.scrollArea || document.querySelector(".editor-scroll-area")

    const getBottomPanel = () => document.querySelector(".editor-bottom-panel")

    const getSafeNumber = (value) => {
        const numeric = Number.parseFloat(String(value || "0"))
        return Number.isFinite(numeric) ? numeric : 0
    }

    const syncToolbarToggleState = () => {
        const toolbarElement = getToolbar()
        const toggleButton = getToolbarToggleButton()
        if (!toolbarElement || !toggleButton) return
        const hidden = toolbarElement.classList.contains("is-hidden")
        const iconElement = toggleButton.querySelector("i")
        if (iconElement) {
            iconElement.textContent = hidden ? "expand_more" : "expand_less"
        }
        const label = hidden
            ? UI.getText("toolbar_show", "Показать панель инструментов")
            : UI.getText("toolbar_hide", "Скрыть панель инструментов")
        toggleButton.setAttribute("aria-label", label)
    }

    const syncBottomOffset = () => {
        const scrollAreaElement = getScrollArea()
        if (!scrollAreaElement) return
        const bottomPanelElement = getBottomPanel()
        if (!bottomPanelElement) {
            scrollAreaElement.style.removeProperty("--editor-bottom-offset")
            lastAppliedOffset = null
            return
        }
        const panelRect = bottomPanelElement.getBoundingClientRect()
        const computedPanelStyles = window.getComputedStyle(bottomPanelElement)
        const panelMarginTop = getSafeNumber(computedPanelStyles.marginTop)
        const panelMarginBottom = getSafeNumber(computedPanelStyles.marginBottom)
        const panelHeight = Math.min(panelRect.height, 100)

        if (panelHeight < MIN_PANEL_HEIGHT) return

        const baseOffset = panelHeight + panelMarginTop + panelMarginBottom + DESKTOP_BOTTOM_EXTRA
        const mobileOffset = panelHeight + panelMarginTop + panelMarginBottom + MOBILE_BOTTOM_EXTRA
        const isMobile = window.matchMedia(MOBILE_QUERY).matches
        const nextOffset = Math.ceil(isMobile ? mobileOffset : baseOffset)

        if (nextOffset < 0) return
        if (lastAppliedOffset !== null && Math.abs(nextOffset - lastAppliedOffset) < 2) return

        const savedScrollTop = scrollAreaElement.scrollTop
        scrollAreaElement.style.setProperty("--editor-bottom-offset", `${nextOffset}px`)
        lastAppliedOffset = nextOffset

        if (scrollAreaElement.scrollTop !== savedScrollTop) {
            scrollAreaElement.scrollTop = savedScrollTop
        }
    }

    const debouncedSyncBottomOffset = () => {
        if (syncDebounceTimer !== null) return
        syncDebounceTimer = setTimeout(() => {
            syncDebounceTimer = null
            syncBottomOffset()
        }, SYNC_DEBOUNCE_MS)
    }

    const releaseBodyLock = () => {
        if (savedBodyOverflow !== null) {
            document.body.style.overflow = savedBodyOverflow
            savedBodyOverflow = null
        }
        if (savedBodyPaddingRight !== null) {
            document.body.style.paddingRight = savedBodyPaddingRight
            savedBodyPaddingRight = null
        }
        document.body.style.overscrollBehavior = ""
        document.documentElement.style.overscrollBehavior = ""
    }

    const lockBodyScroll = () => {
        if (savedBodyOverflow === null) {
            savedBodyOverflow = document.body.style.overflow || ""
            savedBodyPaddingRight = document.body.style.paddingRight || ""
        }
        const scrollbarCompensation = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
        document.body.style.overflow = "hidden"
        document.body.style.paddingRight = scrollbarCompensation > 0 ? `${scrollbarCompensation}px` : savedBodyPaddingRight
        document.body.style.overscrollBehavior = "none"
        document.documentElement.style.overscrollBehavior = "none"
    }

    const installBottomPanelObserver = () => {
        if (bottomPanelObserver) return
        const panel = getBottomPanel()
        if (!panel) return
        bottomPanelObserver = new ResizeObserver(() => debouncedSyncBottomOffset())
        bottomPanelObserver.observe(panel)
    }

    const installViewportListener = () => {
        if (!window.visualViewport || releaseViewportListener) return
        const listener = () => debouncedSyncBottomOffset()
        window.visualViewport.addEventListener("resize", listener)
        window.visualViewport.addEventListener("scroll", listener)
        releaseViewportListener = () => {
            window.visualViewport.removeEventListener("resize", listener)
            window.visualViewport.removeEventListener("scroll", listener)
            releaseViewportListener = null
        }
    }

    const installMediaQueryListener = () => {
        if (mobileMediaQuery) return
        mobileMediaQuery = window.matchMedia(MOBILE_QUERY)
        mobileMediaQuery.addEventListener("change", syncBottomOffset)
    }

    const uninstallMediaQueryListener = () => {
        if (!mobileMediaQuery) return
        mobileMediaQuery.removeEventListener("change", syncBottomOffset)
        mobileMediaQuery = null
    }

    const activate = () => {
        lockBodyScroll()
        installBottomPanelObserver()
        installViewportListener()
        installMediaQueryListener()
        syncToolbarToggleState()
        syncBottomOffset()
    }

    const deactivate = () => {
        releaseBodyLock()
        if (syncDebounceTimer !== null) {
            clearTimeout(syncDebounceTimer)
            syncDebounceTimer = null
        }
        if (bottomPanelObserver) {
            bottomPanelObserver.disconnect()
            bottomPanelObserver = null
        }
        if (releaseViewportListener) {
            releaseViewportListener()
        }
        uninstallMediaQueryListener()
        lastAppliedOffset = null
        const scrollAreaElement = getScrollArea()
        if (scrollAreaElement) {
            scrollAreaElement.style.removeProperty("--editor-bottom-offset")
        }
    }

    const toggleToolbar = () => {
        const toolbarElement = getToolbar()
        if (!toolbarElement) return false
        toolbarElement.classList.toggle("is-hidden")
        syncToolbarToggleState()
        syncBottomOffset()
        return !toolbarElement.classList.contains("is-hidden")
    }

    return {
        activate,
        deactivate,
        syncBottomOffset,
        syncToolbarToggleState,
        toggleToolbar
    }
}

