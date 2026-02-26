const RUSSIAN_TAG_SYNONYM_MAP = new Map([
    ["важное", ["important", "priority", "favorite", "starred", "urgent", "critical"]],
    ["архив", ["archive", "archived", "history", "old"]],
    ["код", ["code", "coding", "development", "programming", "snippet", "javascript", "typescript", "python", "java", "html", "css", "git"]],
    ["учеба", ["study", "education", "learning", "school", "university", "lesson", "course"]],
    ["проект", ["project", "work", "task", "job", "planning", "product"]],
    ["идея", ["idea", "concept", "thought", "brainstorm", "insight"]]
])

const normalizeAiTagToRussian = (value) => {
    const normalizedValue = String(value || "").trim().toLowerCase()
    if (!normalizedValue) return ""
    for (const [russianTag, synonyms] of RUSSIAN_TAG_SYNONYM_MAP.entries()) {
        if (normalizedValue === russianTag) return russianTag
        if (synonyms.includes(normalizedValue)) return russianTag
    }
    return normalizedValue
}

const buildPageDrawingsRevision = (pageDrawings) => {
    const drawings = Array.isArray(pageDrawings) ? pageDrawings : []
    let hash = 2166136261
    hash ^= drawings.length
    hash = Math.imul(hash, 16777619)
    for (let index = 0; index < drawings.length; index++) {
        const drawing = typeof drawings[index] === "string" ? drawings[index] : ""
        let drawingHash = 2166136261
        for (let charIndex = 0; charIndex < drawing.length; charIndex++) {
            drawingHash ^= drawing.charCodeAt(charIndex)
            drawingHash = Math.imul(drawingHash, 16777619)
        }
        hash ^= drawingHash >>> 0
        hash = Math.imul(hash, 16777619)
    }
    return `pdr:${drawings.length}:${hash >>> 0}`
}

const NoteIO = {
    toTimestampMillis(dateValue) {
        if (dateValue === null || dateValue === undefined || dateValue === "") return 0
        if (typeof dateValue?.toMillis === "function") {
            const millis = dateValue.toMillis()
            return Number.isFinite(millis) ? millis : 0
        }
        if (typeof dateValue?.toDate === "function") {
            const millis = dateValue.toDate().getTime()
            return Number.isFinite(millis) ? millis : 0
        }
        if (dateValue && typeof dateValue === "object" && Number.isFinite(dateValue.seconds)) {
            const millis = dateValue.seconds * 1000
            return Number.isFinite(millis) ? millis : 0
        }
        if (dateValue instanceof Date) {
            const millis = dateValue.getTime()
            return Number.isFinite(millis) ? millis : 0
        }
        if (typeof dateValue === "number") {
            return Number.isFinite(dateValue) ? dateValue : 0
        }
        const millis = Date.parse(String(dateValue))
        return Number.isFinite(millis) ? millis : 0
    },

    normalizeDateInput(dateValue) {
        if (dateValue === null || dateValue === undefined || dateValue === "") return null
        if (typeof dateValue?.toDate === "function") return dateValue
        if (dateValue && typeof dateValue === "object" && Number.isFinite(dateValue.seconds)) {
            return new Date(dateValue.seconds * 1000)
        }
        if (dateValue instanceof Date) {
            return Number.isFinite(dateValue.getTime()) ? new Date(dateValue.getTime()) : null
        }
        if (typeof dateValue === "number") {
            if (!Number.isFinite(dateValue)) return null
            const date = new Date(dateValue)
            return Number.isFinite(date.getTime()) ? date : null
        }
        if (typeof dateValue === "string") {
            const parsedMillis = Date.parse(dateValue)
            if (!Number.isFinite(parsedMillis)) return null
            return new Date(parsedMillis)
        }
        return null
    },

    normalizeNote(raw) {
        const safe = raw && typeof raw === "object" ? raw : {}
        const tags = Array.isArray(safe.tags)
            ? [...new Set(safe.tags.filter(value => value && typeof value === "string").map(value => value.trim()))]
            : []
        const hiddenTags = Array.isArray(safe.hiddenTags)
            ? [...new Set(safe.hiddenTags.filter(value => value && typeof value === "string").map(value => value.trim()))]
            : []
        const rawPageDrawings = Array.isArray(safe.pageDrawings) ? safe.pageDrawings : []
        const pageDrawings = rawPageDrawings.map(value => typeof value === "string" ? value : "")
        if (!pageDrawings.length && typeof safe.drawing === "string" && safe.drawing) {
            pageDrawings.push(safe.drawing)
        }
        const rawPageTitles = Array.isArray(safe.pageTitles) ? safe.pageTitles : []
        const pageTitles = rawPageTitles.map(value => typeof value === "string" ? value.slice(0, 15) : "")
        const normalizedCreatedAt = this.normalizeDateInput(safe.createdAt) || Utils.serverTimestamp()
        const normalizedUpdatedAt = this.normalizeDateInput(safe.updatedAt) || normalizedCreatedAt
        const createdAtMillis = this.toTimestampMillis(normalizedCreatedAt)
        const fallbackOrder = Number.isFinite(createdAtMillis) ? createdAtMillis : 0
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
        const noteAccessIdentifier = safe.access?.noteId ? String(safe.access.noteId) : ""
        const shareIdentifier = safe.access?.shareId ? String(safe.access.shareId) : ""
        const ownerCollectionName = safe.access?.ownerCollection ? String(safe.access.ownerCollection) : ""
        const access = {
            ownerUid,
            roles,
            noteId: noteAccessIdentifier,
            shareId: shareIdentifier,
            ownerCollection: ownerCollectionName
        }

        return {
            id: safe.id ? String(safe.id) : Utils.generateId(),
            title: safe.title ? String(safe.title).trim() : "",
            content: safe.content ? Utils.sanitizeHtml(String(safe.content)) : "",
            pageDrawings,
            pageTitles,
            pageDrawingsRevision: typeof safe.pageDrawingsRevision === "string" && safe.pageDrawingsRevision
                ? safe.pageDrawingsRevision
                : buildPageDrawingsRevision(pageDrawings),
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
            aiFolder: typeof safe.aiFolder === "string" ? safe.aiFolder : "",
            hiddenTags,
            aiTags: Array.isArray(safe.aiTags)
                ? [...new Set(safe.aiTags
                    .filter(value => value && typeof value === "string")
                    .map(value => normalizeAiTagToRussian(value))
                    .filter(Boolean))]
                : [],
            relevance: Number.isFinite(Number(safe.relevance)) ? Math.max(0, Math.min(100, Number(safe.relevance))) : 0,
            aiRelevance: Number.isFinite(Number(safe.aiRelevance))
                ? Math.max(0, Math.min(100, Number(safe.aiRelevance)))
                : (Number.isFinite(Number(safe.relevance)) ? Math.max(0, Math.min(100, Number(safe.relevance))) : 0),
            aiProcessed: typeof safe.aiProcessed === "boolean" ? safe.aiProcessed : false,
            aiVersion: Number.isFinite(Number(safe.aiVersion)) ? Number(safe.aiVersion) : 0,
            aiLastAnalyzed: safe.aiLastAnalyzed || null,
            order: typeof safe.order === "number" ? safe.order : fallbackOrder,
            createdAt: normalizedCreatedAt,
            updatedAt: normalizedUpdatedAt,
            ownerUid
        }
    },

    exportNote(note) {
        const safe = this.normalizeNote(note)
        const exportNote = {
            title: safe.title,
            content: safe.content,
            tags: safe.tags,
            pageTitles: safe.pageTitles,
            pageDrawings: safe.pageDrawings
        }
        return JSON.stringify({ version: 2, note: exportNote }, null, 2)
    },

    parseImport(parsed) {
        if (!parsed) return []
        if (parsed.note) return [this.normalizeNote(parsed.note)]
        if (Array.isArray(parsed.notes)) return parsed.notes.map(n => this.normalizeNote(n))
        if (Array.isArray(parsed)) return parsed.map(n => this.normalizeNote(n))
        if (typeof parsed === "object" && (parsed.title || parsed.content || parsed.tags || parsed.pageTitles || parsed.pageDrawings)) {
            return [this.normalizeNote(parsed)]
        }
        return []
    },

    fileNameFor(note) {
        const t = (note?.title || "note").trim().slice(0, 48)
        const safe = t.replace(/[^\p{L}\p{N}\-_]+/gu, " ").replace(/\s+/g, "_").trim() || "note"
        return `${safe}.json`
    }
}


const SaveStateService = {
    updateUiStatus(status, message = "") {
        const normalizedStatus = typeof status === "string" && status ? status : "idle"
        const normalizedMessage = typeof message === "string" ? message : ""
        StateStore.update("saveStatus", { status: normalizedStatus, message: normalizedMessage, updatedAt: Date.now() })
        if (typeof document !== "undefined" && document.documentElement) {
            document.documentElement.dataset.saveStatus = normalizedStatus
        }
    },

    markSaving() {
        this.updateUiStatus("saving", UI.getText("saving", "Saving..."))
    },

    markSaved() {
        this.updateUiStatus("saved", UI.getText("saved", "Saved"))
    },

    handleStorageWriteResult(result, options = {}) {
        const normalizedResult = result && typeof result === "object" ? result : { success: false, errorType: "unknown" }
        if (normalizedResult.success) {
            if (options.markSaved) this.markSaved()
            return normalizedResult
        }
        const errorType = String(normalizedResult.errorType || "unknown")
        let message = UI.getText("save_failed", "Save failed")
        if (errorType === "quota_exceeded") message = UI.getText("save_failed_quota", "Storage is full. Some old cache was removed")
        if (errorType === "storage_unavailable") message = UI.getText("save_failed_storage_unavailable", "Storage is unavailable in this browser mode")
        if (errorType === "indexeddb_write_failed") message = UI.getText("save_failed_fallback", "Unable to save to fallback storage")
        this.updateUiStatus("error", message)
        if (options.showToast !== false) UI.showToast(message)
        return normalizedResult
    },

    handleRemoteSaveError(error, options = {}) {
        const errorCode = error?.code ? ` (${error.code})` : ""
        const message = `${UI.getText("save_failed", "Save failed")}${errorCode}`
        this.updateUiStatus("error", message)
        if (options.showToast !== false) UI.showToast(message)
    }
}

const SmartSearch = {
    stop: new Set([
        "the","a","an","to","of","in","on","and","or","is","are","for","with","at","by","my","this","it",
        "и","в","во","на","а","но","или","ли","что","это","как","я","мы","ты","вы","он","она","они"
    ]),
    keyboardMapEnglishToRussian: new Map([
        ["q","й"],["w","ц"],["e","у"],["r","к"],["t","е"],["y","н"],["u","г"],["i","ш"],["o","щ"],["p","з"],["[","х"],["]","ъ"],
        ["a","ф"],["s","ы"],["d","в"],["f","а"],["g","п"],["h","р"],["j","о"],["k","л"],["l","д"],[";","ж"],["'","э"],
        ["z","я"],["x","ч"],["c","с"],["v","м"],["b","и"],["n","т"],["m","ь"],[",","б"],[".","ю"],["`","ё"]
    ]),
    russianToEnglishTranslitMap: new Map([
        ["щ","shch"],["ш","sh"],["ч","ch"],["ц","ts"],["ю","yu"],["я","ya"],["ё","yo"],["ж","zh"],["х","kh"],
        ["а","a"],["б","b"],["в","v"],["г","g"],["д","d"],["е","e"],["з","z"],["и","i"],["й","y"],["к","k"],
        ["л","l"],["м","m"],["н","n"],["о","o"],["п","p"],["р","r"],["с","s"],["т","t"],["у","u"],["ф","f"],
        ["ъ",""] ,["ы","y"],["ь",""] ,["э","e"]
    ]),
    synonyms: [
        ["важное", "избранное", "favorite", "star", "important", "приоритет", "priority"],
        ["архив", "archive", "скрыто", "старое", "old", "archived"],
        ["код", "code", "snippet", "js", "css", "html", "dev", "git", "разработка"],
        ["учеба", "учёба", "универ", "школа", "study", "university", "lesson", "education"],
        ["проект", "project", "dev", "разработка", "work", "job", "task"],
        ["идея", "idea", "мысль", "concept", "plan"],
        ["мессенджер", "чат", "chat", "messages", "сообщения", "коммуникации"],
        ["вкладки", "табы", "tabs", "tab", "preset", "пресеты", "presets"]
    ],

    keyboardMapRussianToEnglish: null,
    synonymIndex: null,

    buildKeyboardMapRussianToEnglish() {
        if (this.keyboardMapRussianToEnglish) return this.keyboardMapRussianToEnglish
        const reverseMap = new Map()
        this.keyboardMapEnglishToRussian.forEach((russianChar, englishChar) => {
            reverseMap.set(russianChar, englishChar)
        })
        this.keyboardMapRussianToEnglish = reverseMap
        return reverseMap
    },

    buildSynonymIndex() {
        if (this.synonymIndex) return this.synonymIndex
        const index = new Map()
        this.synonyms.forEach(group => {
            const normalizedGroup = group.map(value => this.normalizeToken(value)).filter(Boolean)
            normalizedGroup.forEach(word => {
                if (!index.has(word)) index.set(word, new Set())
                normalizedGroup.forEach(groupWord => index.get(word).add(groupWord))
            })
        })
        this.synonymIndex = index
        return index
    },

    normalizeToken(value) {
        return String(value || "").trim().toLowerCase().replace(/ё/g, "е")
    },

    convertKeyboardLayout(value, targetLayout) {
        const sourceText = String(value || "")
        if (!sourceText) return ""
        const map = targetLayout === "russian" ? this.keyboardMapEnglishToRussian : this.buildKeyboardMapRussianToEnglish()
        return Array.from(sourceText).map(character => {
            const lowerChar = character.toLowerCase()
            const convertedChar = map.get(lowerChar)
            if (!convertedChar) return character
            return character === lowerChar ? convertedChar : convertedChar.toUpperCase()
        }).join("")
    },

    transliterateRussianToEnglish(value) {
        return Array.from(String(value || "")).map(character => {
            const lowerChar = character.toLowerCase()
            const convertedChar = this.russianToEnglishTranslitMap.get(lowerChar)
            if (convertedChar === undefined) return character
            return character === lowerChar ? convertedChar : convertedChar.charAt(0).toUpperCase() + convertedChar.slice(1)
        }).join("")
    },

    simplifyEnglishPhonetics(value) {
        return String(value || "")
            .replace(/shch/g, "sch")
            .replace(/yo/g, "io")
            .replace(/yu/g, "iu")
            .replace(/ya/g, "ia")
            .replace(/zh/g, "j")
            .replace(/kh/g, "h")
    },

    stemToken(token) {
        const normalizedToken = this.normalizeToken(token)
        if (normalizedToken.length < 4) return normalizedToken
        const russianSuffixes = ["иями","ями","ами","иях","его","ого","ему","ому","ыми","ими","ий","ый","ой","ая","яя","ое","ее","ов","ев","ие","ые","ую","юю","ам","ям","ах","ях","ом","ем","а","я","ы","и","у","ю","е","о"]
        const englishSuffixes = ["ingly","edly","ment","ness","tion","ions","ing","ers","ies","ied","ed","er","es","s"]
        const suffixes = /[а-яё]/i.test(normalizedToken) ? russianSuffixes : englishSuffixes
        for (const suffix of suffixes) {
            if (normalizedToken.endsWith(suffix) && normalizedToken.length - suffix.length >= 3) {
                return normalizedToken.slice(0, normalizedToken.length - suffix.length)
            }
        }
        return normalizedToken
    },

    expandTokenVariants(token) {
        const normalizedToken = this.normalizeToken(token)
        if (!normalizedToken) return []
        const tokenVariants = new Set([normalizedToken])
        const russianLayoutVariant = this.normalizeToken(this.convertKeyboardLayout(normalizedToken, "russian"))
        const englishLayoutVariant = this.normalizeToken(this.convertKeyboardLayout(normalizedToken, "english"))
        const transliteratedVariant = this.normalizeToken(this.transliterateRussianToEnglish(normalizedToken))
        const simplifiedTransliteration = this.normalizeToken(this.simplifyEnglishPhonetics(transliteratedVariant))
        const normalizedStem = this.stemToken(normalizedToken)
        tokenVariants.add(russianLayoutVariant)
        tokenVariants.add(englishLayoutVariant)
        tokenVariants.add(transliteratedVariant)
        tokenVariants.add(simplifiedTransliteration)
        tokenVariants.add(normalizedStem)
        tokenVariants.add(this.stemToken(russianLayoutVariant))
        tokenVariants.add(this.stemToken(englishLayoutVariant))

        const synonymIndex = this.buildSynonymIndex()
        const lookupVariants = [normalizedToken, russianLayoutVariant, englishLayoutVariant, normalizedStem]
        lookupVariants.forEach(lookupVariant => {
            if (!lookupVariant) return
            const synonymSet = synonymIndex.get(lookupVariant)
            if (!synonymSet) return
            synonymSet.forEach(value => tokenVariants.add(value))
        })

        return [...tokenVariants].filter(Boolean)
    },

    tokenize(text) {
        if (!text) return []
        const normalizedText = this.normalizeToken(text)
        const russianLayoutText = this.normalizeToken(this.convertKeyboardLayout(normalizedText, "russian"))
        const englishLayoutText = this.normalizeToken(this.convertKeyboardLayout(normalizedText, "english"))
        const transliteratedText = this.normalizeToken(this.transliterateRussianToEnglish(normalizedText))
        const variants = [normalizedText, russianLayoutText, englishLayoutText, transliteratedText]
        const tokenSet = new Set()
        variants.forEach(source => {
            source
                .split(/[\p{P}\p{S}\s]+/u)
                .filter(word => word && !this.stop.has(word) && word.length > 1)
                .forEach(word => {
                    tokenSet.add(word)
                    tokenSet.add(this.stemToken(word))
                })
        })
        return [...tokenSet].filter(Boolean)
    },

    levenshtein(sourceWord, targetWord) {
        if (sourceWord === targetWord) return 0
        const sourceLength = sourceWord.length
        const targetLength = targetWord.length
        if (sourceLength === 0) return targetLength
        if (targetLength === 0) return sourceLength
        if (Math.abs(sourceLength - targetLength) > 3) return 4

        let previousRow = new Int16Array(targetLength + 1)
        let currentRow = new Int16Array(targetLength + 1)

        for (let columnIndex = 0; columnIndex <= targetLength; columnIndex += 1) previousRow[columnIndex] = columnIndex

        for (let rowIndex = 0; rowIndex < sourceLength; rowIndex += 1) {
            currentRow[0] = rowIndex + 1
            let minimumDistance = currentRow[0]
            for (let columnIndex = 0; columnIndex < targetLength; columnIndex += 1) {
                const substitutionCost = sourceWord[rowIndex] === targetWord[columnIndex] ? 0 : 1
                currentRow[columnIndex + 1] = Math.min(
                    currentRow[columnIndex] + 1,
                    previousRow[columnIndex + 1] + 1,
                    previousRow[columnIndex] + substitutionCost
                )
                minimumDistance = Math.min(minimumDistance, currentRow[columnIndex + 1])
            }
            if (minimumDistance > 3) return 4
            const swapBuffer = previousRow
            previousRow = currentRow
            currentRow = swapBuffer
        }
        return previousRow[targetLength]
    },

    wordScore(queryWord, documentWord) {
        if (queryWord === documentWord) return 1
        if (documentWord.startsWith(queryWord) || queryWord.startsWith(documentWord)) return 0.9
        if (documentWord.includes(queryWord) || queryWord.includes(documentWord)) return 0.72

        if (documentWord.length < 3 || queryWord.length < 3) return 0
        const distance = this.levenshtein(queryWord, documentWord)
        if (distance <= 3) return 1 - (distance / Math.max(queryWord.length, documentWord.length))
        return 0
    },

    score(query, title, content, tags, aiTags, hiddenTags) {
        if (!query) return 0
        const queryTokens = this.tokenize(query)
        if (!queryTokens.length) return 0

        const weightedDocumentTokens = []
        this.tokenize(title).forEach(token => weightedDocumentTokens.push({ token, weight: 3.6 }))
        this.tokenize(Utils.stripHtml(content)).forEach(token => weightedDocumentTokens.push({ token, weight: 0.95 }))
        if (Array.isArray(tags)) {
            tags.forEach(tag => this.tokenize(String(tag)).forEach(token => weightedDocumentTokens.push({ token, weight: 4.2 })))
        }
        if (Array.isArray(hiddenTags)) {
            hiddenTags.forEach(tag => this.tokenize(String(tag)).forEach(token => weightedDocumentTokens.push({ token, weight: 4.4 })))
        }
        if (Array.isArray(aiTags)) {
            aiTags.forEach(tag => this.tokenize(String(tag)).forEach(token => weightedDocumentTokens.push({ token, weight: 3.6 })))
        }

        if (!weightedDocumentTokens.length) return 0

        const normalizedQuery = this.normalizeToken(query)
        const normalizedTitle = this.normalizeToken(title)
        const normalizedVisibleTags = Array.isArray(tags) ? tags.map(tag => this.normalizeToken(tag)).join(" ") : ""
        const normalizedHiddenTags = Array.isArray(hiddenTags) ? hiddenTags.map(tag => this.normalizeToken(tag)).join(" ") : ""
        const normalizedAiTags = Array.isArray(aiTags) ? aiTags.map(tag => this.normalizeToken(tag)).join(" ") : ""

        let aggregatedScore = 0

        queryTokens.forEach(queryToken => {
            let highestTokenScore = 0
            const queryVariants = this.expandTokenVariants(queryToken)
            queryVariants.forEach(queryVariant => {
                weightedDocumentTokens.forEach(documentTokenData => {
                    const candidateScore = this.wordScore(queryVariant, documentTokenData.token) * documentTokenData.weight
                    if (candidateScore > highestTokenScore) highestTokenScore = candidateScore
                })
            })
            if (normalizedTitle.includes(queryToken)) highestTokenScore += 0.5
            if (normalizedVisibleTags.includes(queryToken)) highestTokenScore += 0.75
            if (normalizedHiddenTags.includes(queryToken)) highestTokenScore += 0.8
            if (normalizedAiTags.includes(queryToken)) highestTokenScore += 0.6
            aggregatedScore += highestTokenScore
        })

        if (normalizedTitle.includes(normalizedQuery)) aggregatedScore += 0.9
        if (normalizedVisibleTags.includes(normalizedQuery)) aggregatedScore += 1.15
        if (normalizedHiddenTags.includes(normalizedQuery)) aggregatedScore += 1.2
        if (normalizedAiTags.includes(normalizedQuery)) aggregatedScore += 0.95

        const normalizedScore = aggregatedScore / queryTokens.length
        return Math.max(0, Math.min(3, normalizedScore)) / 3
    },

    suggestTags(title, content) {
        const text = (title + " " + Utils.stripHtml(content)).toLowerCase()
        const out = new Set()
        const synonymIndex = this.buildSynonymIndex()
        const textTokens = this.tokenize(text)
        textTokens.forEach(token => {
            const synonyms = synonymIndex.get(token)
            if (!synonyms) return
            synonyms.forEach(synonymWord => {
                if (/^[a-z0-9]+$/i.test(synonymWord)) return
                out.add(synonymWord)
            })
        })
        return [...out].slice(0, 6)
    },

    suggestFolderId(note, folders) {
        if (!folders || !folders.length) return null
        const text = (note.title + " " + Utils.stripHtml(note.content)).toLowerCase()

        const scored = folders.map(folder => {
            const folderName = (folder.name || "").toLowerCase()
            const folderDescription = String(folder.description || "")
            if (folderName && text.includes(folderName)) return { id: folder.id, score: 10 }
            const scoreByName = this.score(folder.name, note.title, note.content, note.tags, note.aiTags, note.hiddenTags)
            const scoreByDescription = folderDescription
                ? this.score(folderDescription, note.title, note.content, note.tags, note.aiTags, note.hiddenTags)
                : 0
            return { id: folder.id, score: Math.max(scoreByName, scoreByDescription) }
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
        SafeStorage.session.set(this.pendingTokenKey, token)
        const url = new URL(window.location.href)
        url.searchParams.delete("share")
        window.history.replaceState({}, document.title, url.toString())
        return token
    },
    async acceptPendingShare(user) {
        const token = SafeStorage.session.get(this.pendingTokenKey)
        if (!token) return null
        SafeStorage.session.remove(this.pendingTokenKey)
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
window.SaveStateService = SaveStateService
