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
        if (isOpen) activePicker = picker
        else if (activePicker === picker) activePicker = null
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

    const emitChange = (state, hex) => {
        if (!state.input) return
        const event = new Event("input", { bubbles: true })
        state.input.dispatchEvent(event)
        state.input.setAttribute("value", hex)
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
        if (!state.hue) return
        const rect = state.hue.getBoundingClientRect()
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        state.hue = Math.round(x * 360)
        const hex = updateUi(state)
        emitChange(state, hex)
    }

    const trackPointer = (pointerId, moveHandler) => {
        const onMove = (event) => {
            if (event.pointerId !== pointerId) return
            if (event.buttons === 0 && event.pointerType === "mouse") return
            moveHandler(event)
        }
        const onUp = (event) => {
            if (event.pointerId !== pointerId) return
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
        }
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
    }

    const bindPicker = (picker) => {
        if (instances.has(picker)) return
        const input = picker.querySelector("[data-color-input]")
        const trigger = picker.querySelector("[data-color-trigger]")
        const panel = picker.querySelector("[data-color-panel]")
        const sv = picker.querySelector("[data-color-sv]")
        const svHandle = picker.querySelector("[data-color-sv-handle]")
        const hue = picker.querySelector("[data-color-hue]")
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
            hue,
            hueHandle,
            hexInput,
            swatch,
            hue: 0,
            sat: 1,
            val: 1
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
                sv.setPointerCapture?.(event.pointerId)
                handleSvPointer(state, event)
                trackPointer(event.pointerId, (moveEvent) => handleSvPointer(state, moveEvent))
            })
        }

        if (hue) {
            hue.addEventListener("pointerdown", (event) => {
                event.preventDefault()
                hue.setPointerCapture?.(event.pointerId)
                handleHuePointer(state, event)
                trackPointer(event.pointerId, (moveEvent) => handleHuePointer(state, moveEvent))
            })
        }

        if (hexInput) {
            hexInput.addEventListener("input", (event) => {
                const next = normalizeHex(event.target.value)
                setColorFromHex(state, next)
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
