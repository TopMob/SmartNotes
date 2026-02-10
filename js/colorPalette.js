const ColorPalette = (() => {
    const instances = new Map()
    let activePicker = null

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

    const normalizeHex = (value) => {
        const raw = String(value || "").trim()
        if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw
        if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`
        return "#000000"
    }

    const rgbToHex = (r, g, b) => {
        const toHex = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    const hexToRgb = (hex) => {
        const safe = normalizeHex(hex)
        const num = parseInt(safe.slice(1), 16)
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
    }

    const rgbToHsv = (r, g, b) => {
        const rr = r / 255
        const gg = g / 255
        const bb = b / 255
        const max = Math.max(rr, gg, bb)
        const min = Math.min(rr, gg, bb)
        const delta = max - min
        let hue = 0
        if (delta !== 0) {
            if (max === rr) hue = ((gg - bb) / delta) % 6
            else if (max === gg) hue = (bb - rr) / delta + 2
            else hue = (rr - gg) / delta + 4
        }
        hue = Math.round(hue * 60)
        if (hue < 0) hue += 360
        const sat = max === 0 ? 0 : delta / max
        const val = max
        return { h: hue, s: sat, v: val }
    }

    const hsvToRgb = (h, s, v) => {
        const c = v * s
        const hh = h / 60
        const x = c * (1 - Math.abs((hh % 2) - 1))
        let r = 0
        let g = 0
        let b = 0
        if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0]
        else if (hh >= 1 && hh < 2) [r, g, b] = [x, c, 0]
        else if (hh >= 2 && hh < 3) [r, g, b] = [0, c, x]
        else if (hh >= 3 && hh < 4) [r, g, b] = [0, x, c]
        else if (hh >= 4 && hh < 5) [r, g, b] = [x, 0, c]
        else if (hh >= 5 && hh <= 6) [r, g, b] = [c, 0, x]
        const m = v - c
        return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
    }

    const setPickerOpen = (picker, isOpen) => {
        picker.classList.toggle("is-open", isOpen)
        const trigger = picker.querySelector("[data-color-trigger]")
        if (trigger) trigger.setAttribute("aria-expanded", String(isOpen))
        if (isOpen) {
            activePicker = picker
            const state = instances.get(picker)
            if (state) schedulePanelPosition(state)
        } else if (activePicker === picker) activePicker = null
    }

    const schedulePanelPosition = (state) => {
        if (!state) return
        if (state.positionFrame) return
        state.positionFrame = requestAnimationFrame(() => {
            state.positionFrame = null
            if (state.picker?.classList.contains("is-open")) positionPanel(state)
        })
    }

    const getBoundsContainer = (picker) => {
        return picker.closest("#settings-content")
            || picker.closest(".modal-card")
            || picker.closest(".editor-toolbar")
            || picker.closest(".note-content-wrapper")
            || picker.closest(".note-editor")
            || document.body
    }

    const resolveContainerRect = (container) => {
        if (container && container !== document.body) return container.getBoundingClientRect()
        return {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
            width: window.innerWidth,
            height: window.innerHeight
        }
    }

    const positionPanel = (state) => {
        if (!state.panel || !state.picker) return
        const padding = 8
        state.panel.style.left = "0"
        state.panel.style.right = "auto"
        state.panel.style.top = "calc(100% + 10px)"
        state.panel.style.bottom = "auto"
        const pickerRect = state.picker.getBoundingClientRect()
        const panelRect = state.panel.getBoundingClientRect()
        const containerRect = resolveContainerRect(state.container)
        const containerLeft = containerRect.left + padding
        const containerRight = containerRect.right - padding
        const containerWidth = Math.max(0, containerRight - containerLeft)
        const pickerOffset = pickerRect.left - containerRect.left
        const centeredInPicker = (pickerRect.width - panelRect.width) / 2
        const centeredInContainer = (containerRect.width - panelRect.width) / 2 - pickerOffset
        let left = state.container?.id === "settings-content" ? centeredInContainer : centeredInPicker
        if (panelRect.width > containerWidth && containerWidth > 0) {
            left = centeredInContainer
        }
        const expectedRight = pickerRect.left + left + panelRect.width
        if (expectedRight > containerRight) {
            left -= expectedRight - containerRight
        }
        const expectedLeft = pickerRect.left + left
        if (expectedLeft < containerLeft) {
            left += containerLeft - expectedLeft
        }
        let top = pickerRect.height + 10
        const expectedBottom = pickerRect.top + top + panelRect.height
        if (expectedBottom > window.innerHeight - padding) {
            const spaceAbove = pickerRect.top - panelRect.height - 10
            top = spaceAbove >= padding ? -panelRect.height - 10 : Math.max(padding - pickerRect.top, top)
        }
        state.panel.style.left = `${left}px`
        state.panel.style.top = `${top}px`
    }

    const updateUi = (state) => {
        const { picker, hue, sat, val } = state
        const rgb = hsvToRgb(hue, sat, val)
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
        picker.style.setProperty("--picker-hue", `${hue}deg`)
        if (state.swatch) state.swatch.style.background = hex
        if (state.hexInput && state.hexInput.value.toLowerCase() !== hex.toLowerCase()) {
            state.hexInput.value = hex.toUpperCase()
        }
        if (state.svHandle) {
            state.svHandle.style.left = `${sat * 100}%`
            state.svHandle.style.top = `${(1 - val) * 100}%`
        }
        if (state.hueHandle) {
            state.hueHandle.style.left = `${(hue / 360) * 100}%`
        }
        if (state.input && state.input.value.toLowerCase() !== hex.toLowerCase()) {
            state.input.value = hex.toUpperCase()
        }
        return hex
    }

    const emitNow = (state, hex) => {
        if (!state.input) return
        state.input.value = hex.toUpperCase()
        state.input.setAttribute("value", hex.toUpperCase())
        const event = new Event("input", { bubbles: true })
        state.input.dispatchEvent(event)
        state.lastEmittedHex = hex
        state.lastEmittedAt = Date.now()
    }

    const emitChange = (state, hex, options = {}) => {
        if (!state.input) return
        const force = !!options.force
        const now = Date.now()
        const interval = 300
        if (force) {
            if (state.pendingEmitTimer) {
                clearTimeout(state.pendingEmitTimer)
                state.pendingEmitTimer = null
            }
            emitNow(state, hex)
            return
        }
        if (!state.lastEmittedAt || now - state.lastEmittedAt >= interval) {
            emitNow(state, hex)
            return
        }
        state.pendingHex = hex
        if (state.pendingEmitTimer) return
        const remaining = interval - (now - state.lastEmittedAt)
        state.pendingEmitTimer = setTimeout(() => {
            state.pendingEmitTimer = null
            if (!state.pendingHex) return
            const nextHex = state.pendingHex
            state.pendingHex = ""
            emitNow(state, nextHex)
        }, remaining)
    }

    const setColorFromHex = (state, hex, notify = true) => {
        const rgb = hexToRgb(hex)
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
        state.hue = hsv.h
        state.sat = hsv.s
        state.val = hsv.v
        const updatedHex = updateUi(state)
        if (notify) emitChange(state, updatedHex)
    }

    const handleSvPointer = (state, event) => {
        if (!state.sv) return
        const rect = state.sv.getBoundingClientRect()
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        const y = clamp((event.clientY - rect.top) / rect.height, 0, 1)
        state.sat = x
        state.val = 1 - y
        const hex = updateUi(state)
        emitChange(state, hex)
    }

    const handleHuePointer = (state, event) => {
        if (!state.hueElement) return
        const rect = state.hueElement.getBoundingClientRect()
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        state.hue = Math.round(x * 360)
        const hex = updateUi(state)
        emitChange(state, hex)
    }

    const trackPointer = (pointerId, moveHandler, upHandler) => {
        const onMove = (event) => {
            if (event.pointerId !== pointerId) return
            if (event.buttons === 0 && event.pointerType === "mouse") return
            event.preventDefault()
            moveHandler(event)
        }
        const onUp = (event) => {
            if (event.pointerId !== pointerId) return
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            if (typeof upHandler === "function") upHandler(event)
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
    }

    const suspendCanvasPointerEvents = (pointerId) => {
        const canvas = typeof EditorDrawing === "undefined" ? null : EditorDrawing.state?.canvas
        if (!canvas) return () => {}
        const previousPointerEvents = canvas.style.pointerEvents
        canvas.style.pointerEvents = "none"
        const restore = (event) => {
            if (event.pointerId !== pointerId) return
            window.removeEventListener("pointerup", restore)
            window.removeEventListener("pointercancel", restore)
            if (canvas.isConnected) canvas.style.pointerEvents = previousPointerEvents
        }
        window.addEventListener("pointerup", restore)
        window.addEventListener("pointercancel", restore)
        return restore
    }

    const bindPicker = (picker) => {
        if (instances.has(picker)) return
        const input = picker.querySelector("[data-color-input]")
        const trigger = picker.querySelector("[data-color-trigger]")
        const panel = picker.querySelector("[data-color-panel]")
        const sv = picker.querySelector("[data-color-sv]")
        const svHandle = picker.querySelector("[data-color-sv-handle]")
        const hueElement = picker.querySelector("[data-color-hue]")
        const hueHandle = picker.querySelector("[data-color-hue-handle]")
        const hexInput = picker.querySelector("[data-color-hex]")
        const swatch = picker.querySelector("[data-color-swatch]")

        const initial = normalizeHex(input?.value || picker.dataset.colorValue || "#111111")
        const state = {
            picker,
            input,
            panel,
            sv,
            svHandle,
            hueElement,
            hueHandle,
            hexInput,
            swatch,
            container: getBoundsContainer(picker),
            hue: 0,
            sat: 1,
            val: 1,
            lastEmittedAt: 0,
            lastEmittedHex: "",
            pendingHex: "",
            pendingEmitTimer: null
        }
        setColorFromHex(state, initial, false)
        if (input) input.value = initial.toUpperCase()
        if (hexInput) hexInput.value = initial.toUpperCase()

        if (trigger) {
            trigger.addEventListener("click", (event) => {
                event.preventDefault()
                event.stopPropagation()
                const next = !picker.classList.contains("is-open")
                if (activePicker && activePicker !== picker) setPickerOpen(activePicker, false)
                setPickerOpen(picker, next)
            })
        }

        if (sv) {
            sv.addEventListener("pointerdown", (event) => {
                event.preventDefault()
                event.stopPropagation()
                suspendCanvasPointerEvents(event.pointerId)
                sv.setPointerCapture?.(event.pointerId)
                handleSvPointer(state, event)
                trackPointer(event.pointerId, (moveEvent) => handleSvPointer(state, moveEvent), () => emitChange(state, updateUi(state), { force: true }))
            })
        }

        if (hueElement) {
            hueElement.addEventListener("pointerdown", (event) => {
                event.preventDefault()
                event.stopPropagation()
                suspendCanvasPointerEvents(event.pointerId)
                hueElement.setPointerCapture?.(event.pointerId)
                handleHuePointer(state, event)
                trackPointer(event.pointerId, (moveEvent) => handleHuePointer(state, moveEvent), () => emitChange(state, updateUi(state), { force: true }))
            })
        }

        if (hexInput) {
            hexInput.addEventListener("input", (event) => {
                const rawValue = String(event.target.value || "").trim()
                if (/^#?[0-9a-fA-F]{0,6}$/.test(rawValue)) return
                event.target.value = normalizeHex(rawValue).toUpperCase()
            })
            hexInput.addEventListener("blur", (event) => {
                const next = normalizeHex(event.target.value)
                event.target.value = next.toUpperCase()
                setColorFromHex(state, next)
            })
            hexInput.addEventListener("keydown", (event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                const next = normalizeHex(event.target.value)
                event.target.value = next.toUpperCase()
                setColorFromHex(state, next, true)
            })
        }

        if (input) {
            input.addEventListener("input", (event) => {
                const next = normalizeHex(event.target.value)
                setColorFromHex(state, next, false)
            })
        }

        if (panel) {
            panel.addEventListener("pointerdown", (event) => event.stopPropagation())
        }

        if (typeof ResizeObserver !== "undefined") {
            const resizeObserver = new ResizeObserver(() => {
                schedulePanelPosition(state)
            })
            if (state.panel) resizeObserver.observe(state.panel)
            if (state.container) resizeObserver.observe(state.container)
            state.resizeObserver = resizeObserver
        }

        instances.set(picker, state)
    }

    const init = (root = document) => {
        root.querySelectorAll("[data-color-picker]").forEach(bindPicker)
    }

    const syncInput = (input) => {
        if (!input) return
        const picker = input.closest("[data-color-picker]")
        if (!picker) return
        const state = instances.get(picker)
        if (!state) return
        const next = normalizeHex(input.value)
        setColorFromHex(state, next, false)
    }

    document.addEventListener("pointerdown", (event) => {
        if (!activePicker) return
        if (activePicker.contains(event.target)) return
        setPickerOpen(activePicker, false)
    })

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init())
    } else {
        init()
    }

    return { init, syncInput }
})()

window.ColorPalette = ColorPalette
