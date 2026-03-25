import { ERROR_CODES, createExternalMediaError } from './errors.js'

export const INLINE_MEDIA_PATTERN = /^data:(image|audio)\//i
export const INLINE_MEDIA_URL_PATTERN = /data:(image|audio)\//i

export const isInlineMediaSource = (value) => INLINE_MEDIA_PATTERN.test(String(value || '').trim())
export const containsInlineMedia = (value) => INLINE_MEDIA_URL_PATTERN.test(String(value || ''))

export const getInlineMediaSummary = (note) => {
    const normalizedNote = note && typeof note === 'object' ? note : {}
    const content = String(normalizedNote.content || '')
    const pageDrawings = Array.isArray(normalizedNote.pageDrawings) ? normalizedNote.pageDrawings : []
    const htmlMatches = content.match(/data:(image|audio)\//gi) || []
    const drawingMatches = pageDrawings.filter(item => isInlineMediaSource(item))
    return {
        count: htmlMatches.length + drawingMatches.length,
        hasInlineMedia: containsInlineMedia(content) || drawingMatches.length > 0
    }
}

const stripInlineHtmlMedia = (html) => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = String(html || '')
    Array.from(wrapper.querySelectorAll('img[src], audio[src], audio source[src]')).forEach(element => {
        const source = String(element.getAttribute('src') || '').trim()
        if (!isInlineMediaSource(source)) return
        if (element.tagName.toLowerCase() === 'source') {
            const parent = element.parentElement
            element.remove()
            if (parent && parent.tagName.toLowerCase() === 'audio' && !parent.querySelector('source[src], [src]')) parent.remove()
            return
        }
        element.remove()
    })
    return wrapper.innerHTML
}

const stripInlinePageDrawings = (pageDrawings) => (Array.isArray(pageDrawings) ? pageDrawings : []).map(source => isInlineMediaSource(source) ? '' : source)

export const createExternalMediaPipeline = ({ uploadDataUrl, sanitizeFileNamePart }) => {
    const externalizeHtmlMedia = async (html, options = {}) => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = String(html || '')
        const mediaElements = Array.from(wrapper.querySelectorAll('img[src], audio[src], audio source[src]'))
        let changed = false
        const failures = []
        const mode = options.mode === 'best-effort' ? 'best-effort' : 'strict'

        for (let index = 0; index < mediaElements.length; index += 1) {
            const element = mediaElements[index]
            const source = String(element.getAttribute('src') || '').trim()
            if (!isInlineMediaSource(source)) continue
            const fileNameBase = `${options.fileNameBase || 'attachment'}_${index + 1}`
            try {
                const publicUrl = await uploadDataUrl(source, { fileNameBase })
                element.setAttribute('src', publicUrl)
                if (element.tagName.toLowerCase() === 'audio' && element instanceof HTMLMediaElement) {
                    element.src = publicUrl
                }
                changed = true
            } catch (error) {
                failures.push({ type: 'html', source, error, tagName: String(element.tagName || '').toLowerCase() })
                if (mode !== 'best-effort') throw error
                if (element.tagName.toLowerCase() === 'source') {
                    const parent = element.parentElement
                    element.remove()
                    if (parent && parent.tagName.toLowerCase() === 'audio' && !parent.querySelector('source[src], [src]')) parent.remove()
                } else {
                    element.remove()
                }
                changed = true
            }
        }

        let nextHtml = wrapper.innerHTML
        if (containsInlineMedia(nextHtml)) {
            if (mode === 'best-effort') {
                nextHtml = stripInlineHtmlMedia(nextHtml)
                changed = true
            } else {
                throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
            }
        }

        return { html: nextHtml, changed, failures }
    }

    const externalizePageDrawings = async (pageDrawings, options = {}) => {
        const drawings = Array.isArray(pageDrawings) ? pageDrawings.slice() : []
        let changed = false
        const failures = []
        const mode = options.mode === 'best-effort' ? 'best-effort' : 'strict'
        for (let index = 0; index < drawings.length; index += 1) {
            const source = String(drawings[index] || '').trim()
            if (!isInlineMediaSource(source)) continue
            try {
                drawings[index] = await uploadDataUrl(source, {
                    fileNameBase: `${options.fileNameBase || 'drawing'}_${index + 1}`
                })
                changed = true
            } catch (error) {
                failures.push({ type: 'drawing', source, index, error })
                if (mode !== 'best-effort') throw error
                drawings[index] = ''
                changed = true
            }
        }
        const hasInlineMedia = drawings.some(item => isInlineMediaSource(item))
        if (hasInlineMedia) {
            if (mode === 'best-effort') return { pageDrawings: stripInlinePageDrawings(drawings), changed: true, failures }
            throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
        }
        return { pageDrawings: drawings, changed, failures }
    }

    const externalizeNoteMedia = async (note, options = {}) => {
        const normalizedNote = note && typeof note === 'object' ? { ...note } : {}
        const htmlResult = await externalizeHtmlMedia(normalizedNote.content || '', {
            fileNameBase: options.fileNameBase || sanitizeFileNamePart(normalizedNote.title || normalizedNote.id || 'note_media', 'note_media'),
            mode: options.mode
        })
        const drawingsResult = await externalizePageDrawings(normalizedNote.pageDrawings || [], {
            fileNameBase: `${options.fileNameBase || sanitizeFileNamePart(normalizedNote.title || normalizedNote.id || 'note_drawing', 'note_drawing')}_drawing`,
            mode: options.mode
        })
        const nextNote = {
            ...normalizedNote,
            content: htmlResult.html,
            pageDrawings: drawingsResult.pageDrawings
        }
        if (getInlineMediaSummary(nextNote).hasInlineMedia) {
            if (options.mode === 'best-effort') {
                return {
                    note: {
                        ...nextNote,
                        content: stripInlineHtmlMedia(nextNote.content),
                        pageDrawings: stripInlinePageDrawings(nextNote.pageDrawings)
                    },
                    changed: true,
                    failures: [...htmlResult.failures, ...drawingsResult.failures]
                }
            }
            throw createExternalMediaError(ERROR_CODES.INLINE_MEDIA_BLOCKED)
        }
        return {
            note: nextNote,
            changed: htmlResult.changed || drawingsResult.changed,
            failures: [...htmlResult.failures, ...drawingsResult.failures]
        }
    }

    return {
        externalizeHtmlMedia,
        externalizePageDrawings,
        externalizeNoteMedia
    }
}
