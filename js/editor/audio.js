const EditorAudio = (() => {
    const state = { container: null }

    const getText = (key, fallback) => {
        if (typeof UI !== "undefined" && typeof UI.getText === "function") {
            return UI.getText(key, fallback)
        }
        return fallback
    }

    const formatTime = (value) => {
        const totalSeconds = Math.max(0, Math.floor(Number(value) || 0))
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        }
        return `${minutes}:${String(seconds).padStart(2, "0")}`
    }

    const getAudioBlock = (element) => element ? element.closest(".audio-block") : null

    const getAudioElement = (block) => block ? block.querySelector("audio") : null

    const updatePlayState = (block, audio) => {
        if (!block || !audio) return
        const icon = block.querySelector(".audio-play-icon")
        const isPlaying = !audio.paused && !audio.ended
        if (icon) icon.textContent = isPlaying ? "pause" : "play_arrow"
        block.classList.toggle("playing", isPlaying)
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

    const updateVolume = (block, audio) => {
        if (!block || !audio) return
        const volume = block.querySelector(".audio-volume")
        if (!volume || document.activeElement === volume) return
        volume.value = String(Math.round(audio.volume * 100))
    }

    const updateUi = (block, audio) => {
        updatePlayState(block, audio)
        updateProgress(block, audio)
        updateTimes(block, audio)
        updateVolume(block, audio)
    }

    const pauseOtherAudio = (currentAudio) => {
        if (!state.container || !currentAudio) return
        state.container.querySelectorAll(".audio-block audio").forEach(audio => {
            if (audio !== currentAudio) audio.pause()
        })
    }

    const ensureControls = (block, label) => {
        const controls = block.querySelector(".audio-controls")
        if (controls) return
        const createdControls = document.createElement("div")
        createdControls.className = "audio-controls"

        const playButton = document.createElement("button")
        playButton.type = "button"
        playButton.className = "audio-play"
        playButton.setAttribute("aria-label", getText("audio_play", "Play"))
        const playIcon = document.createElement("i")
        playIcon.className = "material-icons-round audio-play-icon"
        playIcon.setAttribute("aria-hidden", "true")
        playIcon.textContent = "play_arrow"
        playButton.appendChild(playIcon)

        const timeline = document.createElement("div")
        timeline.className = "audio-timeline"

        const progress = document.createElement("input")
        progress.type = "range"
        progress.min = "0"
        progress.max = "100"
        progress.step = "0.1"
        progress.value = "0"
        progress.className = "audio-progress"
        progress.setAttribute("aria-label", getText("audio_progress", "Timeline"))

        const time = document.createElement("div")
        time.className = "audio-time"

        const current = document.createElement("span")
        current.className = "audio-current"
        current.textContent = "0:00"

        const duration = document.createElement("span")
        duration.className = "audio-duration"
        duration.textContent = "0:00"

        time.append(current, duration)
        timeline.append(progress, time)

        const volume = document.createElement("input")
        volume.type = "range"
        volume.min = "0"
        volume.max = "100"
        volume.step = "1"
        volume.value = "100"
        volume.className = "audio-volume"
        volume.setAttribute("aria-label", getText("audio_volume", "Volume"))

        const title = document.createElement("span")
        title.className = "audio-title"
        title.textContent = label || getText("audio_note", "Audio")

        createdControls.append(playButton, timeline, volume, title)
        block.prepend(createdControls)
    }

    const initializeBlock = (block, label) => {
        if (!block || block.dataset.audioReady === "true") return
        const audio = getAudioElement(block)
        if (!audio) return
        ensureControls(block, label)
        audio.preload = "metadata"
        audio.addEventListener("loadedmetadata", () => updateUi(block, audio))
        audio.addEventListener("timeupdate", () => updateUi(block, audio))
        audio.addEventListener("durationchange", () => updateUi(block, audio))
        audio.addEventListener("play", () => updateUi(block, audio))
        audio.addEventListener("pause", () => updateUi(block, audio))
        audio.addEventListener("ended", () => updateUi(block, audio))
        block.dataset.audioReady = "true"
        updateUi(block, audio)
    }

    const createAudioBlockElement = (sourceUrl, label) => {
        const block = document.createElement("div")
        block.className = "audio-block"
        block.setAttribute("contenteditable", "false")
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
        const target = event.target.closest(".audio-play")
        if (!target) return
        const block = getAudioBlock(target)
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
    }

    const handleInput = (event) => {
        const control = event.target
        if (!(control instanceof HTMLInputElement)) return
        const block = getAudioBlock(control)
        const audio = getAudioElement(block)
        if (!audio) return
        if (control.classList.contains("audio-progress")) {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                const percent = Math.min(100, Math.max(0, Number(control.value) || 0))
                audio.currentTime = (audio.duration * percent) / 100
            }
        }
        if (control.classList.contains("audio-volume")) {
            const percent = Math.min(100, Math.max(0, Number(control.value) || 0))
            audio.volume = percent / 100
        }
        updateUi(block, audio)
    }

    const upgradeLegacyBlocks = (container) => {
        const legacyBlocks = Array.from(container.querySelectorAll(".audio-wrapper"))
        legacyBlocks.forEach(wrapper => {
            const audioElement = wrapper.querySelector("audio")
            const sourceUrl = audioElement ? (audioElement.getAttribute("src") || audioElement.currentSrc || audioElement.src) : ""
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
