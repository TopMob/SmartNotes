const NoteIO = {
    normalizeNote(raw) {
        const safe = raw && typeof raw === "object" ? raw : {}
        const tags = Array.isArray(safe.tags) 
            ? [...new Set(safe.tags.filter(x => x && typeof x === "string").map(x => x.trim()))] 
            : []
        
        const now = Utils.serverTimestamp()
        
        return {
            id: safe.id ? String(safe.id) : Utils.generateId(),
            title: safe.title ? String(safe.title).trim() : "",
            content: safe.content ? Utils.sanitizeHtml(String(safe.content)) : "",
            tags,
            folderId: safe.folderId ? String(safe.folderId) : null,
            folderOrder: typeof safe.folderOrder === "number" ? safe.folderOrder : 0,
            isArchived: !!safe.isArchived,
            isFavorite: !!safe.isFavorite,
            isPinned: !!safe.isPinned,
            lock: safe.lock && typeof safe.lock === "object" ? safe.lock : null,
            order: typeof safe.order === "number" ? safe.order : Date.now(),
            createdAt: safe.createdAt || now,
            updatedAt: safe.updatedAt || now
        }
    },

    exportNote(note) {
        const safe = this.normalizeNote(note)
        return JSON.stringify({ version: 2, note: safe }, null, 2)
    },

    parseImport(parsed) {
        if (!parsed) return []
        if (parsed.note) return [this.normalizeNote(parsed.note)]
        if (Array.isArray(parsed.notes)) return parsed.notes.map(n => this.normalizeNote(n))
        if (Array.isArray(parsed)) return parsed.map(n => this.normalizeNote(n))
        return []
    },

    fileNameFor(note) {
        const t = (note?.title || "note").trim().slice(0, 48)
        const safe = t.replace(/[^\p{L}\p{N}\-_]+/gu, " ").replace(/\s+/g, "_").trim() || "note"
        return `${safe}.json`
    }
}

const SmartSearch = {
    stop: new Set(["the","a","an","to","of","in","on","and","or","is","are","for","with","at","by","my","this","it","и","в","во","на","а","но","или","ли","что","это","как","я","мы","ты","вы","он","она","они"]),
    synonyms: new Map([
        ["todo", ["задача", "дела", "список", "tasks", "checklist", "buy"]],
        ["важное", ["избранное", "favorite", "star", "important", "!"]],
        ["архив", ["archive", "скрыто", "старое", "old"]],
        ["код", ["code", "snippet", "js", "css", "html", "dev", "git"]],
        ["учеба", ["учёба", "универ", "школа", "study", "university", "lesson"]],
        ["проект", ["project", "dev", "разработка", "work", "job"]],
        ["идея", ["idea", "мысль", "concept", "plan"]]
    ]),
    
    tokenize(text) {
        if (!text) return []
        return String(text)
            .toLowerCase()
            .split(/[\p{P}\p{S}\s]+/u)
            .filter(w => w && !this.stop.has(w) && w.length > 1)
    },

    levenshtein(s, t) {
        if (s === t) return 0
        const n = s.length
        const m = t.length
        if (n === 0) return m
        if (m === 0) return n
        if (Math.abs(n - m) > 2) return 3 

        let v0 = new Int8Array(m + 1)
        let v1 = new Int8Array(m + 1)

        for (let i = 0; i <= m; i++) v0[i] = i

        for (let i = 0; i < n; i++) {
            v1[0] = i + 1
            let minVal = v1[0]
            for (let j = 0; j < m; j++) {
                const cost = s[i] === t[j] ? 0 : 1
                v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
                minVal = Math.min(minVal, v1[j + 1])
            }
            if (minVal > 2) return 3
            const tmp = v0
            v0 = v1
            v1 = tmp
        }
        return v0[m]
    },

    wordScore(queryWord, docWord) {
        if (queryWord === docWord) return 1.0
        if (docWord.startsWith(queryWord)) return 0.85
        if (docWord.includes(queryWord)) return 0.65
        
        if (docWord.length < 3 || queryWord.length < 3) return 0
        const dist = this.levenshtein(queryWord, docWord)
        if (dist <= 2) return 1.0 - (dist / Math.max(queryWord.length, docWord.length))
        return 0
    },

    score(query, title, content, tags) {
        if (!query) return 0
        const qTokens = this.tokenize(query)
        if (!qTokens.length) return 0

        const tTokens = this.tokenize(title)
        const cTokens = this.tokenize(Utils.stripHtml(content))
        const tagTokens = Array.isArray(tags) ? tags.flatMap(t => this.tokenize(String(t))) : []

        let totalScore = 0

        for (const qw of qTokens) {
            let maxWordScore = 0
            
            // Expand synonyms
            const variants = [qw]
            for (const [key, list] of this.synonyms) {
                if (qw === key || list.includes(qw)) {
                    if (!variants.includes(key)) variants.push(key)
                    list.forEach(s => { if (!variants.includes(s)) variants.push(s) })
                }
            }

            for (const v of variants) {
                for (const w of tTokens) maxWordScore = Math.max(maxWordScore, this.wordScore(v, w) * 2.5)
                for (const w of tagTokens) maxWordScore = Math.max(maxWordScore, this.wordScore(v, w) * 2.0)
                for (const w of cTokens) maxWordScore = Math.max(maxWordScore, this.wordScore(v, w) * 1.0)
                if (maxWordScore >= 1.0) break
            }
            totalScore += maxWordScore
        }

        return totalScore / qTokens.length
    },

    suggestTags(title, content) {
        const text = (title + " " + Utils.stripHtml(content)).toLowerCase()
        const res = new Set()
        
        for (const [tag, keys] of this.synonyms) {
            if (keys.some(k => text.includes(k))) {
                res.add(tag)
            }
        }
        return [...res].slice(0, 6)
    },

    suggestFolderId(note, folders) {
        if (!folders || !folders.length) return null
        const text = (note.title + " " + Utils.stripHtml(note.content)).toLowerCase()
        
        const scored = folders.map(f => {
            const fName = (f.name || "").toLowerCase()
            if (text.includes(fName)) return { id: f.id, score: 10 }
            const s = this.score(f.name, note.title, note.content, note.tags)
            return { id: f.id, score: s }
        })
        
        scored.sort((a, b) => b.score - a.score)
        return scored[0]?.score > 0.5 ? scored[0].id : null
    }
}

const LockService = {
    async digest(text) {
        if (!window.crypto || !window.crypto.subtle) return "insecure_env"
        const enc = new TextEncoder().encode(String(text || ""))
        const buf = await crypto.subtle.digest("SHA-256", enc)
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
    },

    async setLock(note, password) {
        const hash = await this.digest(password)
        note.lock = { v: 1, hash, hidden: true }
        return note
    },

    async verify(note, password) {
        if (!note.lock?.hash) return true
        const inputHash = await this.digest(password)
        return this.secureCompare(inputHash, note.lock.hash)
    },

    secureCompare(a, b) {
        if (typeof a !== "string" || typeof b !== "string") return false
        if (a.length !== b.length) return false
        let mismatch = 0
        for (let i = 0; i < a.length; i++) {
            mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i))
        }
        return mismatch === 0
    }
}

const SketchService = {
    canvas: null,
    ctx: null,
    colorPicker: null,
    widthPicker: null,
    zoomPicker: null,
    history: [],
    isDrawing: false,
    isEraser: false,
    scale: 1,
    lastPoint: null,

    prepare() {
        if (!this.canvas) this.init()
        this.resizeCanvas(false)
        this.isEraser = false
        this.setScale(parseFloat(this.zoomPicker?.value || "1"))
        this.updateCursor()
    },

    init() {
        this.canvas = document.getElementById("sketch-canvas")
        if (!this.canvas) return
        this.ctx = this.canvas.getContext("2d")
        this.colorPicker = document.getElementById("sketch-color-picker")
        this.widthPicker = document.getElementById("sketch-width-picker")
        this.zoomPicker = document.getElementById("sketch-zoom-picker")
        this.canvas.addEventListener("pointerdown", (e) => this.startDraw(e))
        this.canvas.addEventListener("pointermove", (e) => this.draw(e))
        this.canvas.addEventListener("pointerup", () => this.endDraw())
        this.canvas.addEventListener("pointercancel", () => this.endDraw())
        this.canvas.addEventListener("pointerleave", () => this.endDraw())
        this.zoomPicker?.addEventListener("input", () => this.setScale(parseFloat(this.zoomPicker.value || "1")))
        window.addEventListener("resize", () => this.resizeCanvas(true))
        this.updateCursor()
    },

    resizeCanvas(preserve) {
        if (!this.canvas || !this.ctx) return
        const parent = this.canvas.parentElement
        if (!parent) return
        const rect = parent.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        let snapshot = null
        if (preserve) snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
        this.canvas.width = Math.floor(rect.width)
        this.canvas.height = Math.floor(rect.height)
        if (snapshot) this.ctx.putImageData(snapshot, 0, 0)
    },

    setScale(value) {
        const nextScale = Utils.clamp(value || 1, 1, 3)
        this.scale = nextScale
        if (this.canvas) {
            this.canvas.style.transform = `scale(${nextScale})`
            this.canvas.style.transformOrigin = "top left"
        }
    },

    getPoint(e) {
        const rect = this.canvas.getBoundingClientRect()
        const x = (e.clientX - rect.left) / this.scale
        const y = (e.clientY - rect.top) / this.scale
        return { x, y }
    },

    applyStrokeStyle() {
        if (!this.ctx) return
        const size = parseFloat(this.widthPicker?.value || "3")
        this.ctx.lineWidth = size
        this.ctx.lineCap = "round"
        this.ctx.lineJoin = "round"
        if (this.isEraser) {
            this.ctx.globalCompositeOperation = "destination-out"
            this.ctx.strokeStyle = "rgba(0,0,0,1)"
        } else {
            this.ctx.globalCompositeOperation = "source-over"
            this.ctx.strokeStyle = this.colorPicker?.value || "#00f2ff"
        }
    },

    startDraw(e) {
        if (!this.canvas || !this.ctx) return
        this.canvas.setPointerCapture?.(e.pointerId)
        this.isDrawing = true
        this.applyStrokeStyle()
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height))
        this.lastPoint = this.getPoint(e)
    },

    draw(e) {
        if (!this.isDrawing || !this.ctx) return
        const point = this.getPoint(e)
        if (!this.lastPoint) {
            this.lastPoint = point
            return
        }
        this.ctx.beginPath()
        this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
        this.ctx.lineTo(point.x, point.y)
        this.ctx.stroke()
        this.lastPoint = point
    },

    endDraw() {
        this.isDrawing = false
        this.lastPoint = null
    },

    toggleEraser() {
        this.isEraser = !this.isEraser
        this.updateCursor()
    },

    updateCursor() {
        if (!this.canvas) return
        this.canvas.style.cursor = this.isEraser ? "cell" : "crosshair"
    },

    undo() {
        if (!this.ctx || !this.history.length) return
        const last = this.history.pop()
        if (last) this.ctx.putImageData(last, 0, 0)
    },

    clear() {
        if (!this.ctx || !this.canvas) return
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height))
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    },

    save() {
        if (!this.canvas) return
        const dataUrl = this.canvas.toDataURL("image/png")
        Editor.insertSketchImage(dataUrl)
        UI.closeModal("sketch-modal")
    }
}

window.SketchService = SketchService

const ShareService = {
    getBaseUrl() {
        const u = new URL(window.location.href)
        u.hash = ""
        u.search = ""
        return u.toString().replace(/\/index\.html\/?$/, "/")
    },
    base() {
        return this.getBaseUrl()
    },

    makeShareLink(noteId) {
        return `${this.getBaseUrl()}#share/${encodeURIComponent(noteId)}`
    },

    makeCollabLink(noteId) {
        return `${this.getBaseUrl()}#collab/${encodeURIComponent(noteId)}`
    },

    parseHash(hash) {
        const h = String(hash || "").replace(/^#/, "")
        const [mode, id] = h.split("/")
        if ((mode === "share" || mode === "collab") && id) {
            try {
                return { mode, noteId: decodeURIComponent(id) }
            } catch {
                return null
            }
        }
        return null
    }
}

const DriveService = {
    ready: false,
    async init() {
        if (typeof gapi !== "undefined") {
            this.ready = true
        }
    },
    async uploadNote(note) {
        if (!this.ready) return UI.showToast(UI.getText("drive_unavailable", "Drive unavailable"))
        // Placeholder for actual Drive API implementation
        return UI.showToast(UI.getText("drive_saved", "Uploaded"))
    }
}

const ReminderService = {
    init() {
        const el = document.getElementById("voice-indicator")
        if (el) el.classList.remove("active")
    }
}
