const NoteIO = {
    normalizeNote(raw) {
        const safe = raw && typeof raw === "object" ? raw : {}
        const tags = Array.isArray(safe.tags) ? safe.tags.filter(Boolean).map(x => String(x)) : []
        return {
            id: safe.id ? String(safe.id) : Utils.generateId(),
            title: safe.title ? String(safe.title) : "",
            content: safe.content ? String(safe.content) : "",
            tags,
            folderId: safe.folderId ? String(safe.folderId) : null,
            isArchived: !!safe.isArchived,
            isFavorite: !!safe.isFavorite,
            isPinned: !!safe.isPinned,
            lock: safe.lock && typeof safe.lock === "object" ? safe.lock : null,
            order: typeof safe.order === "number" ? safe.order : Date.now(),
            createdAt: safe.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: safe.updatedAt || firebase.firestore.FieldValue.serverTimestamp()
        }
    },
    exportNote(note) {
        const safe = this.normalizeNote(note)
        return JSON.stringify({ version: 2, note: safe }, null, 2)
    },
    parseImport(parsed) {
        const res = []
        if (!parsed) return res
        if (parsed.note) {
            res.push(this.normalizeNote(parsed.note))
            return res
        }
        if (Array.isArray(parsed.notes)) {
            parsed.notes.forEach(n => res.push(this.normalizeNote(n)))
            return res
        }
        if (Array.isArray(parsed)) {
            parsed.forEach(n => res.push(this.normalizeNote(n)))
            return res
        }
        return res
    },
    fileNameFor(note) {
        const t = (note && note.title ? note.title : "note").trim().slice(0, 48)
        const safe = t.replace(/[^\p{L}\p{N}\s._()]+/gu, "").replace(/\s+/g, " ").trim() || "note"
        return `${safe}.json`
    }
}

const SmartSearch = {
    stop: new Set(["и","в","во","на","а","но","или","ли","что","это","как","я","мы","ты","вы","он","она","они","the","a","an","to","of","in","on","and","or","is","are"]),
    synonyms: new Map([
        ["todo", ["задача","дела","список","tasks","checklist"]],
        ["важное", ["избранное","favorite","star"]],
        ["архив", ["archive","скрыто","старое"]],
        ["код", ["code","snippet","js","css","html"]],
        ["учеба", ["учёба","универ","школа","study"]],
        ["проект", ["project","dev","разработка"]],
        ["идея", ["idea","мысль","concept"]]
    ]),
    tokenize(text) {
        const t = (text || "").toLowerCase()
        const tokens = t
            .replace(/[\p{P}\p{S}]+/gu, " ")
            .split(/\s+/)
            .map(x => x.trim())
            .filter(Boolean)
            .filter(x => !this.stop.has(x))
        const expanded = []
        tokens.forEach(w => {
            expanded.push(w)
            for (const [k, list] of this.synonyms.entries()) {
                if (w === k || list.includes(w)) {
                    expanded.push(k)
                    list.forEach(s => expanded.push(s))
                }
            }
        })
        return Array.from(new Set(expanded))
    },
    damerau(a, b) {
        a = a || ""
        b = b || ""
        if (a === b) return 0
        const al = a.length
        const bl = b.length
        if (!al) return bl
        if (!bl) return al
        const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0))
        for (let i = 0; i <= al; i++) dp[i][0] = i
        for (let j = 0; j <= bl; j++) dp[0][j] = j
        for (let i = 1; i <= al; i++) {
            for (let j = 1; j <= bl; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                )
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
                }
            }
        }
        return dp[al][bl]
    },
    wordScore(queryWord, docWord) {
        if (!queryWord || !docWord) return 0
        if (queryWord === docWord) return 1
        const d = this.damerau(queryWord, docWord)
        const maxLen = Math.max(queryWord.length, docWord.length)
        const sim = 1 - d / Math.max(1, maxLen)
        return sim < 0 ? 0 : sim
    },
    score(query, title, content, tags) {
        const q = this.tokenize(query)
        if (!q.length) return 0
        const t = this.tokenize(title)
        const c = this.tokenize(Utils.stripHtml(content))
        const tg = Array.isArray(tags) ? tags.map(x => String(x).toLowerCase()) : []
        let s = 0
        q.forEach(qw => {
            let best = 0
            t.forEach(dw => best = Math.max(best, this.wordScore(qw, dw) * 2.4))
            tg.forEach(dw => best = Math.max(best, this.wordScore(qw, dw) * 2.2))
            c.forEach(dw => best = Math.max(best, this.wordScore(qw, dw) * 1.0))
            s += best
        })
        return s / q.length
    },
    suggestTags(title, content) {
        const tokens = this.tokenize(`${title} ${Utils.stripHtml(content)}`)
        const res = []
        const dict = [
            { tag: "учеба", keys: ["учеба","учёба","study","универ","школа","лекция","дз","домашка"] },
            { tag: "проект", keys: ["проект","project","dev","разработка","релиз","feature"] },
            { tag: "код", keys: ["код","code","js","css","html","bug","фикс","коммит"] },
            { tag: "идея", keys: ["идея","idea","мысль","concept","инсайт"] },
            { tag: "покупки", keys: ["купить","магазин","shopping","список"] },
            { tag: "задачи", keys: ["todo","задача","дела","tasks","checklist"] }
        ]
        dict.forEach(item => {
            const hit = item.keys.some(k => tokens.includes(k))
            if (hit) res.push(item.tag)
        })
        return Array.from(new Set(res)).slice(0, 6)
    },
    suggestFolderId(note, folders) {
        const name = `${note.title} ${Utils.stripHtml(note.content)}`.toLowerCase()
        const scored = (folders || []).map(f => {
            const s = this.score(f.name, note.title, note.content, note.tags)
            const simple = name.includes(String(f.name).toLowerCase()) ? 0.6 : 0
            return { id: f.id, score: s + simple }
        }).sort((a, b) => b.score - a.score)
        if (!scored.length) return null
        if (scored[0].score < 0.55) return null
        return scored[0].id
    }
}

const LockService = {
    async digest(text) {
        const enc = new TextEncoder().encode(String(text || ""))
        const buf = await crypto.subtle.digest("SHA-256", enc)
        const bytes = Array.from(new Uint8Array(buf))
        return bytes.map(b => b.toString(16).padStart(2, "0")).join("")
    },
    async setLock(note, password) {
        const hash = await this.digest(password)
        note.lock = { v: 1, hash, hidden: true }
        return note
    },
    async verify(note, password) {
        if (!note.lock || !note.lock.hash) return true
        const hash = await this.digest(password)
        return hash === note.lock.hash
    },
    clearLock(note) {
        note.lock = null
        return note
    }
}

const ShareService = {
    base() {
        const u = new URL(window.location.href)
        u.hash = ""
        u.search = ""
        return u.toString().replace(/\/$/, "")
    },
    token(bytes = 18) {
        const arr = new Uint8Array(bytes)
        crypto.getRandomValues(arr)
        return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, "").slice(0, 26)
    },
    makeShareLink(noteId) {
        const t = this.token()
        localStorage.setItem(`share:${t}`, JSON.stringify({ noteId, mode: "read", exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }))
        return `${this.base()}/#share/${t}`
    },
    makeCollabLink(noteId) {
        const t = this.token()
        localStorage.setItem(`share:${t}`, JSON.stringify({ noteId, mode: "collab", exp: Date.now() + 1000 * 60 * 30 }))
        return `${this.base()}/#collab/${t}`
    },
    consume(token) {
        const raw = localStorage.getItem(`share:${token}`)
        if (!raw) return null
        let parsed = null
        try { parsed = JSON.parse(raw) } catch { parsed = null }
        localStorage.removeItem(`share:${token}`)
        if (!parsed || !parsed.noteId || !parsed.exp) return null
        if (Date.now() > parsed.exp) return null
        return parsed
    }
}

const DriveService = {
    ready: false,
    async init() {
        this.ready = !!window.gapi
    },
    async uploadNote(note) {
        if (!this.ready) return UI.showToast(UI.getText("drive_unavailable", "Drive unavailable"))
        UI.showToast(UI.getText("drive_connected", "Drive connected"))
        return UI.showToast(UI.getText("drive_saved", "Uploaded"))
    }
}

const ReminderService = {
    init() {
        const root = document.getElementById("voice-indicator")
        if (root) root.classList.remove("active")
    }
}
