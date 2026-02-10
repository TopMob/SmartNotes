const NoteIO = {
    normalizeNote(raw) {
        const safe = raw && typeof raw === "object" ? raw : {}
        const tags = Array.isArray(safe.tags) 
            ? [...new Set(safe.tags.filter(x => x && typeof x === "string").map(x => x.trim()))] 
            : []
        const rawPageDrawings = Array.isArray(safe.pageDrawings) ? safe.pageDrawings : []
        const pageDrawings = rawPageDrawings.map(value => typeof value === "string" ? value : "")
        if (!pageDrawings.length && typeof safe.drawing === "string" && safe.drawing) {
            pageDrawings.push(safe.drawing)
        }
        const now = Utils.serverTimestamp()
        const ownerUid = safe.ownerUid
            ? String(safe.ownerUid)
            : (safe.ownerId ? String(safe.ownerId) : (StateStore.read().user?.uid || null))
        const rolesSource = safe.access && typeof safe.access === "object" && safe.access.roles && typeof safe.access.roles === "object"
            ? safe.access.roles
            : null
        const allowSource = safe.access && typeof safe.access === "object" && Array.isArray(safe.access.allow)
            ? safe.access.allow
            : []
        const roles = {}
        if (rolesSource) {
            Object.entries(rolesSource).forEach(([uid, role]) => {
                const normalizedUid = String(uid || "").trim()
                if (!normalizedUid) return
                const normalizedRole = role === "owner" || role === "editor" || role === "viewer"
                    ? role
                    : "viewer"
                roles[normalizedUid] = normalizedRole
            })
        }
        allowSource.forEach(uid => {
            const normalizedUid = String(uid || "").trim()
            if (!normalizedUid) return
            if (!roles[normalizedUid]) roles[normalizedUid] = "viewer"
        })
        if (ownerUid) roles[ownerUid] = "owner"
        const access = {
            ownerUid,
            roles
        }

        return {
            id: safe.id ? String(safe.id) : Utils.generateId(),
            title: safe.title ? String(safe.title).trim() : "",
            content: safe.content ? Utils.sanitizeHtml(String(safe.content)) : "",
            pageDrawings,
            tags,
            folderId: safe.folderId ? String(safe.folderId) : null,
            folderOrder: typeof safe.folderOrder === "number" ? safe.folderOrder : 0,
            isArchived: !!safe.isArchived,
            isFavorite: !!safe.isFavorite,
            isPinned: !!safe.isPinned,
            access,
            lock: safe.lock && typeof safe.lock === "object" ? safe.lock : null,
            reminderAt: safe.reminderAt || safe.futureAt || null,
            trashedAt: safe.trashedAt || null,
            contentType: safe.contentType ? String(safe.contentType) : "text",
            order: typeof safe.order === "number" ? safe.order : Date.now(),
            createdAt: safe.createdAt || now,
            updatedAt: safe.updatedAt || now,
            ownerUid
        }
    },

    exportNote(note) {
        const safe = this.normalizeNote(note)
        const exportNote = {
            title: safe.title,
            content: safe.content,
            tags: safe.tags,
            pageDrawings: safe.pageDrawings
        }
        return JSON.stringify({ version: 2, note: exportNote }, null, 2)
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

const CollaborationService = {
    shareCollection: "noteShares",
    sharedNotesCollection: "sharedNotes",
    pendingTokenKey: "pending-share-token",
    getAccess(note) {
        const access = note && typeof note === "object" ? note.access : null
        return access && typeof access === "object" ? access : null
    },
    getRole(note) {
        const access = this.getAccess(note)
        const currentUserUid = StateStore.read().user?.uid || ""
        if (!currentUserUid) return "viewer"
        if (access?.ownerUid && access.ownerUid === currentUserUid) return "owner"
        const role = access?.roles && typeof access.roles === "object" ? access.roles[currentUserUid] : ""
        if (role === "owner" || role === "editor" || role === "viewer") return role
        return "viewer"
    },
    canEdit(note) {
        const role = this.getRole(note)
        return role === "owner" || role === "editor"
    },
    canManage(note) {
        return this.getRole(note) === "owner"
    },
    isSharedNote(note) {
        const access = this.getAccess(note)
        const userUid = StateStore.read().user?.uid
        return !!(access && access.ownerUid && access.ownerUid !== userUid)
    },
    sharedNoteId(ownerUid, noteId) {
        return `shared_${ownerUid}_${noteId}`
    },
    normalizePermission(value) {
        return value === "editor" || value === "edit" ? "editor" : "viewer"
    },
    async generateToken() {
        if (window.crypto?.getRandomValues) {
            const bytes = new Uint8Array(16)
            window.crypto.getRandomValues(bytes)
            const raw = String.fromCharCode(...bytes)
            return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
        }
        return `${Utils.generateId()}${Date.now().toString(36)}`
    },
    buildShareUrl(token) {
        const url = new URL(window.location.href)
        url.searchParams.set("share", token)
        return url.toString()
    },
    getShareTokenFromUrl() {
        const url = new URL(window.location.href)
        const token = url.searchParams.get("share")
        return token ? token.trim() : ""
    },
    captureShareToken() {
        const token = this.getShareTokenFromUrl()
        if (!token) return ""
        sessionStorage.setItem(this.pendingTokenKey, token)
        const url = new URL(window.location.href)
        url.searchParams.delete("share")
        window.history.replaceState({}, document.title, url.toString())
        return token
    },
    async acceptPendingShare(user) {
        const token = sessionStorage.getItem(this.pendingTokenKey)
        if (!token) return null
        sessionStorage.removeItem(this.pendingTokenKey)
        return this.acceptShareToken(token, user)
    },
    async createShareLink(note, permission) {
        const user = StateStore.read().user
        if (!db || !user || !note) return ""
        const access = this.getAccess(note)
        const ownerUid = access?.ownerUid || user.uid
        if (ownerUid !== user.uid) return ""
        const noteId = access?.noteId || note.id
        const token = await this.generateToken()
        const ownerCollection = "users"
        const payload = {
            ownerUid,
            ownerCollection,
            noteId,
            permission: this.normalizePermission(permission),
            createdAt: Utils.serverTimestamp()
        }
        await db.collection(this.shareCollection).doc(token).set(payload)
        return this.buildShareUrl(token)
    },
    async acceptShareToken(token, user) {
        if (!db || !user) return null
        const trimmed = String(token || "").trim()
        if (!trimmed) return null
        const doc = await db.collection(this.shareCollection).doc(trimmed).get()
        if (!doc.exists) return null
        const data = doc.data() || {}
        if (!data.ownerUid || !data.noteId) return null
        const permission = this.normalizePermission(data.permission)
        const entryId = `${data.ownerUid}_${data.noteId}`
        const entry = {
            ownerUid: data.ownerUid,
            ownerCollection: "users",
            noteId: data.noteId,
            permission,
            shareToken: trimmed,
            updatedAt: Utils.serverTimestamp()
        }
        await DataPath.getUserSharedCollection(user, this.sharedNotesCollection).doc(entryId).set(entry, { merge: true })
        return { id: entryId, ...entry }
    },
    getNoteReference(note, user) {
        if (!db || !user || !note) return null
        const access = this.getAccess(note)
        const ownerUid = access?.ownerUid || user.uid
        const noteId = access?.noteId || note.id
        return db.collection("users").doc(ownerUid).collection("notes").doc(noteId)
    },
    async copyToClipboard(text) {
        const value = String(text || "")
        if (!value) return false
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(value)
                return true
            } catch {
                return false
            }
        }
        const textarea = document.createElement("textarea")
        textarea.value = value
        textarea.setAttribute("readonly", "true")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(textarea)
        return ok
    }
}

window.CollaborationService = CollaborationService
