import { getCountLabel } from "../editor/core-utils.js"

const getCleanText = (html) => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html || ""
    wrapper.querySelectorAll("br").forEach(element => element.replaceWith("\n"))
    const text = wrapper.textContent || ""
    return text.replace(/\n{3,}/g, "\n\n").trim()
}

const getMediaCounts = (html) => {
    if (!html) return { images: 0, audio: 0 }
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html
    return {
        images: wrapper.querySelectorAll("img").length,
        audio: wrapper.querySelectorAll("audio").length
    }
}

const formatMediaSummary = (counts) => {
    const parts = []
    if (counts.images) {
        parts.push(`${counts.images} ${getCountLabel(counts.images, "media_photo", "media_photos")}`)
    }
    if (counts.audio) {
        parts.push(`${counts.audio} ${getCountLabel(counts.audio, "media_audio", "media_audios")}`)
    }
    return parts.join(" · ")
}

const buildAutoTitle = (note) => {
    const text = getCleanText(note.content || "")
    if (text) {
        const firstLine = text.split(/\r?\n/).find(line => line.trim()) || text
        const normalized = firstLine.trim()
        return normalized.length > 60 ? `${normalized.slice(0, 57)}…` : normalized
    }
    const mediaSummary = formatMediaSummary(getMediaCounts(note.content || ""))
    return mediaSummary || UI.getText("untitled_note", "Untitled")
}

const buildPreviewText = (note) => {
    const text = getCleanText(note.content || "")
    if (text) return text
    const mediaSummary = formatMediaSummary(getMediaCounts(note.content || ""))
    return mediaSummary || UI.getText("empty_note", "No content")
}

window.NoteText = {
    buildAutoTitle,
    buildPreviewText
}
