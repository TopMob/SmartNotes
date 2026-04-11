(() => {
    const DRIVE_LAST_MANUAL_BACKUP_AT_KEY = "drive-last-manual-backup-at"

    const buildExportFileName = (note, extension) => {
        const baseName = NoteIO.fileNameFor(note).replace(/\.json$/i, "")
        return `${baseName}.${extension}`
    }

    const buildNoteTextExport = (note) => {
        const contentWrapper = document.createElement("div")
        contentWrapper.innerHTML = Utils.sanitizeHtml(note.content || "")
        contentWrapper.querySelectorAll("img, figure, picture, svg, canvas").forEach(element => element.remove())
        const contentText = Utils.stripHtml(contentWrapper.innerHTML).replace(/\r\n/g, "\n").trim()
        const titleText = (note.title || NoteText.buildAutoTitle(note)).trim()
        const parts = []
        if (titleText) parts.push(titleText)
        if (contentText) parts.push(contentText)
        return parts.join("\n\n")
    }

    const buildSafeExportPagesHtml = (note) => {
        const safeContentHtml = Utils.sanitizeHtml(note.content || "")
        const contentWrapper = document.createElement("div")
        contentWrapper.innerHTML = safeContentHtml
        const pages = Array.from(contentWrapper.querySelectorAll(".note-page"))
        const pageDrawings = Array.isArray(note.pageDrawings) ? note.pageDrawings : []
        const sourcePages = pages.length ? pages : [contentWrapper]
        const exportRoot = document.createElement("div")
        sourcePages.forEach((page, index) => {
            const pageElement = document.createElement("div")
            pageElement.className = "note-page"
            const pageHtml = page.innerHTML || ""
            pageElement.innerHTML = Utils.sanitizeHtml(pageHtml)
            const drawingSource = pageDrawings[index]
            if (typeof drawingSource === "string" && drawingSource.trim()) {
                const drawingElement = document.createElement("img")
                drawingElement.className = "note-drawing"
                drawingElement.alt = ""
                drawingElement.src = drawingSource
                pageElement.appendChild(drawingElement)
            }
            exportRoot.appendChild(pageElement)
        })
        return Utils.sanitizeHtml(exportRoot.innerHTML)
    }

    const buildPrintableNoteHtml = (note, dict) => {
        const titleText = (note.title || NoteText.buildAutoTitle(note)).trim()
        const formattedDate = Utils.formatDate(note.updatedAt || note.createdAt || Date.now())
        return {
            language: StateStore.read().config.lang || "ru",
            printableTitle: titleText || dict.untitled_note || "Untitled",
            printableDate: formattedDate,
            printableContentHtml: buildSafeExportPagesHtml(note),
            printableStyles: `
        :root { color-scheme: light dark; }
        body { margin: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f1f1f; background: #ffffff; }
        h1 { font-size: 24px; margin: 0 0 6px; }
        .note-date { font-size: 12px; color: #6f6f6f; margin-bottom: 18px; }
        .note-content { font-size: 14px; line-height: 1.6; }
        .note-page { position: relative; padding: 18px; border: 1px solid #e6e6e6; border-radius: 12px; margin-bottom: 18px; min-height: 240px; }
        .note-page:last-child { margin-bottom: 0; }
        .note-drawing { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
        .note-content img { max-width: 100%; height: auto; }
        .note-content ul, .note-content ol { padding-left: 22px; }
        .note-content p { margin: 0 0 10px; }
        @media print {
            body { margin: 20mm; }
            .note-page { break-inside: avoid; }
        }
    `
        }
    }

    const openPrintWindow = (printableDocument, dict) => {
        const frame = document.createElement("iframe")
        frame.style.position = "fixed"
        frame.style.right = "0"
        frame.style.bottom = "0"
        frame.style.width = "0"
        frame.style.height = "0"
        frame.style.border = "0"
        frame.style.opacity = "0"
        frame.setAttribute("aria-hidden", "true")
        frame.src = "about:blank"
        document.body.appendChild(frame)
        frame.addEventListener("load", () => {
            const doc = frame.contentDocument
            if (!doc) {
                frame.remove()
                UI.showToast(dict.popup_blocked || "Allow popups to print")
                return
            }
            doc.documentElement.lang = printableDocument.language
            doc.head.replaceChildren()
            const metaCharset = doc.createElement("meta")
            metaCharset.setAttribute("charset", "utf-8")
            const documentTitle = doc.createElement("title")
            documentTitle.textContent = printableDocument.printableTitle
            const stylesElement = doc.createElement("style")
            stylesElement.textContent = printableDocument.printableStyles
            doc.head.append(metaCharset, documentTitle, stylesElement)
            doc.body.replaceChildren()
            const headerElement = doc.createElement("header")
            const titleElement = doc.createElement("h1")
            titleElement.textContent = printableDocument.printableTitle
            const dateElement = doc.createElement("div")
            dateElement.className = "note-date"
            dateElement.textContent = printableDocument.printableDate
            headerElement.append(titleElement, dateElement)
            const contentElement = doc.createElement("main")
            contentElement.className = "note-content"
            contentElement.innerHTML = printableDocument.printableContentHtml
            doc.body.append(headerElement, contentElement)
            requestAnimationFrame(() => {
                if (!frame.contentWindow) {
                    UI.showToast(dict.popup_blocked || "Allow popups to print")
                    frame.remove()
                    return
                }
                frame.contentDocument.title = printableDocument.printableTitle
                frame.contentWindow.focus()
                frame.contentWindow.print()
                setTimeout(() => frame.remove(), 1200)
            })
        }, { once: true })
    }

    window.UINoteActionsExport = {
        DRIVE_LAST_MANUAL_BACKUP_AT_KEY,
        buildExportFileName,
        buildNoteTextExport,
        buildPrintableNoteHtml,
        openPrintWindow
    }
})()
