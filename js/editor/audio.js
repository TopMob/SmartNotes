const EditorAudio = (() => {
    const state = {
        container: null,
        activeAudio: null
    }

    const persistedSources = new WeakSet()

    const getText = (key, fallback) => {
        if (typeof UI !== "undefined" && typeof UI.getText === "function") {
            return UI.getText(key, fallback)
        }
        return fallback
    }

    const formatTime = (value) => {
        const totalSeconds = Math.max(0, Math.floor(Number(value) || 0))
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${String(seconds).padStart(2, "0")}`
    }

    const getAudioBlock = (element) => element ? element.closest(".audio-block") : null
    const getAudioElement = (block) => block ? block.querySelector("audio") : null

    const updatePlayState = (block, audio) => {
        if (!block || !audio) return
        const button = block.querySelector(".audio-play")
        const icon = block.querySelector(".audio-play-icon")
        const isPlaying = !audio.paused && !audio.ended
        if (icon) icon.textContent = isPlaying ? "❚❚" : "▶"
        if (button) button.setAttribute("aria-label", getText(isPlaying ? "audio_pause" : "audio_play", isPlaying ? "Pause" : "Play"))
        block.classList.toggle("playing", isPlaying)
        if (isPlaying) state.activeAudio = audio
    }

    const updateProgress = (block, audio) => {
        if (!block || !audio) return
        const progress = block.querySelector(".audio-progress")
        if (!progress) return
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
            progress.value = "0"
            return
        }
        const percent = (audio.currentTime / audio.duration) * 100
        progress.value = String(Math.min(100, Math.max(0, percent)))
    }

    const updateTimes = (block, audio) => {
        if (!block || !audio) return
        const current = block.querySelector(".audio-current")
        const duration = block.querySelector(".audio-duration")
        if (current) current.textContent = formatTime(audio.currentTime)
        if (duration) duration.textContent = formatTime(audio.duration)
    }

    const updateUi = (block, audio) => {
        updatePlayState(block, audio)
        updateProgress(block, audio)
        updateTimes(block, audio)
    }

    const pauseOtherAudio = (currentAudio) => {
        if (!state.container || !currentAudio) return
        state.container.querySelectorAll(".audio-block audio").forEach(audio => {
            if (audio !== currentAudio) audio.pause()
        })
    }

    const removeAudioBlock = (block) => {
        if (!block) return
        const audio = getAudioElement(block)
        if (audio) {
            audio.pause()
            if (state.activeAudio === audio) state.activeAudio = null
        }
        const siblingBreak = block.nextSibling
        block.remove()
        if (siblingBreak && siblingBreak.nodeName === "BR") siblingBreak.remove()
        if (typeof SmartNotesEditor !== "undefined" && typeof SmartNotesEditor.saveSnapshot === "function") {
            SmartNotesEditor.saveSnapshot()
        }
    }

    const ensureControls = (block, label) => {
        const controls = block.querySelector(".audio-controls")
        const hasRequiredControls = controls
            && controls.querySelector(".audio-play")
            && controls.querySelector(".audio-progress")
            && controls.querySelector(".audio-delete")
        if (hasRequiredControls) return
        if (controls) controls.remove()

        const wrapper = document.createElement("div")
        wrapper.className = "audio-controls"

        const dragButton = document.createElement("button")
        dragButton.type = "button"
        dragButton.className = "audio-drag-handle"
        dragButton.setAttribute("aria-label", getText("audio_drag", "Move audio"))
        const dragIcon = document.createElement("span")
        dragIcon.className = "audio-control-icon"
        dragIcon.setAttribute("aria-hidden", "true")
        dragIcon.textContent = "⋮⋮"
        dragButton.appendChild(dragIcon)

        const playButton = document.createElement("button")
        playButton.type = "button"
        playButton.className = "audio-play"
        playButton.setAttribute("aria-label", getText("audio_play", "Play"))
        const playIcon = document.createElement("span")
        playIcon.className = "audio-play-icon"
        playIcon.setAttribute("aria-hidden", "true")
        playIcon.textContent = "▶"
        playButton.appendChild(playIcon)

        const timeline = document.createElement("div")
        timeline.className = "audio-timeline"

        const titleRow = document.createElement("div")
        titleRow.className = "audio-title-row"
        const title = document.createElement("span")
        title.className = "audio-title"
        title.textContent = label || getText("audio_note", "Audio")

        const time = document.createElement("div")
        time.className = "audio-time"
        const current = document.createElement("span")
        current.className = "audio-current"
        current.textContent = "0:00"
        const duration = document.createElement("span")
        duration.className = "audio-duration"
        duration.textContent = "0:00"
        time.append(current, duration)
        titleRow.append(title, time)

        const progress = document.createElement("input")
        progress.type = "range"
        progress.min = "0"
        progress.max = "100"
        progress.step = "0.1"
        progress.value = "0"
        progress.className = "audio-progress"
        progress.setAttribute("aria-label", getText("audio_progress", "Timeline"))

        timeline.append(titleRow, progress)

        const deleteButton = document.createElement("button")
        deleteButton.type = "button"
        deleteButton.className = "audio-delete"
        deleteButton.setAttribute("aria-label", getText("audio_delete", "Delete audio"))
        const deleteIcon = document.createElement("span")
        deleteIcon.className = "audio-control-icon"
        deleteIcon.setAttribute("aria-hidden", "true")
        deleteIcon.textContent = "✕"
        deleteButton.appendChild(deleteIcon)

        wrapper.append(dragButton, playButton, timeline, deleteButton)
        block.prepend(wrapper)
    }

    const resolveAudioSource = (audio) => {
        if (!audio) return ""
        const sourceElement = audio.querySelector("source[src]")
        if (sourceElement && sourceElement.getAttribute("src")) return sourceElement.getAttribute("src") || ""
        const attributeSource = audio.getAttribute("src")
        if (attributeSource) return attributeSource
        if (audio.currentSrc) return audio.currentSrc
        return audio.src || ""
    }

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("Audio conversion failed"))
        reader.readAsDataURL(blob)
    })

    const persistAudioSource = async (audio) => {
        if (!audio || persistedSources.has(audio)) return
        persistedSources.add(audio)
        const source = resolveAudioSource(audio)
        if (!source || !source.startsWith("blob:")) return
        try {
            const response = await fetch(source)
            const blob = await response.blob()
            const dataUrl = await blobToDataUrl(blob)
            if (!dataUrl) return
            audio.setAttribute("src", dataUrl)
            audio.src = dataUrl
            audio.load()
        } catch {
            persistedSources.delete(audio)
        }
    }

    const initializeBlock = (block, label) => {
        if (!block || block.dataset.audioReady === "true") return
        const audio = getAudioElement(block)
        if (!audio) return
        const normalizedSource = resolveAudioSource(audio)
        if (normalizedSource && !audio.getAttribute("src")) {
            audio.setAttribute("src", normalizedSource)
            audio.src = normalizedSource
        }
        block.classList.add("media-draggable-item")
        block.setAttribute("draggable", "true")
        block.setAttribute("contenteditable", "false")
        ensureControls(block, label)
        audio.preload = "metadata"
        audio.addEventListener("loadedmetadata", () => updateUi(block, audio))
        audio.addEventListener("timeupdate", () => updateUi(block, audio))
        audio.addEventListener("durationchange", () => updateUi(block, audio))
        audio.addEventListener("play", () => updateUi(block, audio))
        audio.addEventListener("pause", () => updateUi(block, audio))
        audio.addEventListener("ended", () => updateUi(block, audio))
        audio.addEventListener("loadeddata", () => persistAudioSource(audio), { once: true })
        block.dataset.audioReady = "true"
        persistAudioSource(audio)
        updateUi(block, audio)
    }

    const createAudioBlockElement = (sourceUrl, label) => {
        const block = document.createElement("div")
        block.className = "audio-block media-draggable-item"
        block.setAttribute("contenteditable", "false")
        block.setAttribute("draggable", "true")
        const audio = document.createElement("audio")
        if (sourceUrl) audio.src = sourceUrl
        audio.preload = "metadata"
        block.appendChild(audio)
        initializeBlock(block, label)
        return block
    }

    const createAudioBlockHtml = (sourceUrl, label) => {
        const container = document.createElement("div")
        container.appendChild(createAudioBlockElement(sourceUrl, label))
        container.appendChild(document.createElement("br"))
        return container.innerHTML
    }

    const handleClick = (event) => {
        const playButton = event.target.closest(".audio-play")
        if (playButton) {
            const block = getAudioBlock(playButton)
            const audio = getAudioElement(block)
            if (!audio) return
            const isPlaying = !audio.paused && !audio.ended
            if (isPlaying) {
                audio.pause()
            } else {
                pauseOtherAudio(audio)
                audio.play().catch(() => null)
            }
            updateUi(block, audio)
            return
        }

        const deleteButton = event.target.closest(".audio-delete")
        if (deleteButton) {
            const block = getAudioBlock(deleteButton)
            removeAudioBlock(block)
        }
    }

    const handleInput = (event) => {
        const control = event.target
        if (!(control instanceof HTMLInputElement)) return
        if (!control.classList.contains("audio-progress")) return
        const block = getAudioBlock(control)
        const audio = getAudioElement(block)
        if (!audio) return
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            const percent = Math.min(100, Math.max(0, Number(control.value) || 0))
            audio.currentTime = (audio.duration * percent) / 100
            updateUi(block, audio)
        }
    }

    const upgradeLegacyBlocks = (container) => {
        const legacyBlocks = Array.from(container.querySelectorAll(".audio-wrapper"))
        legacyBlocks.forEach(wrapper => {
            const audioElement = wrapper.querySelector("audio")
            const sourceUrl = resolveAudioSource(audioElement)
            if (!sourceUrl) return
            const label = wrapper.querySelector(".audio-label")?.textContent || ""
            const newBlock = createAudioBlockElement(sourceUrl, label)
            wrapper.replaceWith(newBlock)
        })
    }

    const sync = (container) => {
        const target = container || state.container
        if (!target) return
        upgradeLegacyBlocks(target)
        target.querySelectorAll(".audio-block").forEach(block => initializeBlock(block))
    }

    const bind = ({ container, signal }) => {
        if (!container) return
        state.container = container
        container.addEventListener("click", handleClick, { signal })
        container.addEventListener("input", handleInput, { signal })
        container.addEventListener("change", handleInput, { signal })
    }

    return {
        bind,
        sync,
        createAudioBlockHtml
    }
})()
