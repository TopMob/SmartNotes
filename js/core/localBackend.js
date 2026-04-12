const STORAGE_KEY = "smartnotes.localBackend.v1"

const cloneValue = value => {
    if (typeof structuredClone === "function") return structuredClone(value)
    return JSON.parse(JSON.stringify(value))
}

const isObject = value => !!value && typeof value === "object" && !Array.isArray(value)

const createTimestamp = (date = new Date()) => {
    const baseDate = date instanceof Date ? date : new Date(date)
    return {
        seconds: Math.floor(baseDate.getTime() / 1000),
        nanoseconds: (baseDate.getTime() % 1000) * 1_000_000,
        toDate: () => new Date(baseDate.getTime()),
        toMillis: () => baseDate.getTime(),
        toJSON: () => ({ __type: "timestamp", millis: baseDate.getTime() })
    }
}

const createSentinel = type => ({ __smartnotesSentinel: type })
const isServerTimestamp = value => isObject(value) && value.__smartnotesSentinel === "serverTimestamp"
const isDeleteSentinel = value => isObject(value) && value.__smartnotesSentinel === "delete"

const hydrateValue = value => {
    if (Array.isArray(value)) return value.map(item => hydrateValue(item))
    if (!isObject(value)) return value
    if (value.__type === "timestamp" && Number.isFinite(value.millis)) return createTimestamp(new Date(value.millis))
    const output = {}
    for (const [key, nestedValue] of Object.entries(value)) output[key] = hydrateValue(nestedValue)
    return output
}

const persistValue = value => {
    if (Array.isArray(value)) return value.map(item => persistValue(item))
    if (!isObject(value)) return value
    if (typeof value.toMillis === "function") return { __type: "timestamp", millis: value.toMillis() }
    const output = {}
    for (const [key, nestedValue] of Object.entries(value)) output[key] = persistValue(nestedValue)
    return output
}

const splitPath = path => String(path || "").split("/").filter(Boolean)
const joinPath = parts => parts.filter(Boolean).join("/")
const collectionPathOfDocument = path => {
    const parts = splitPath(path)
    parts.pop()
    return joinPath(parts)
}

const createLocalStore = () => {
    const listeners = new Set()

    const load = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            const parsed = raw ? JSON.parse(raw) : {}
            const docs = isObject(parsed.docs) ? parsed.docs : {}
            return { docs: hydrateValue(docs) }
        } catch {
            return { docs: {} }
        }
    }

    let state = load()

    const save = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ docs: persistValue(state.docs) }))
    }

    const notify = changedPaths => {
        for (const listener of listeners) listener(changedPaths)
    }

    const readDoc = path => {
        const value = state.docs[path]
        if (!value) return null
        return cloneValue(value)
    }

    const writeDoc = (path, data) => {
        state.docs[path] = cloneValue(data)
    }

    const removeDoc = path => {
        delete state.docs[path]
    }

    const readCollection = path => {
        const normalizedCollectionPath = joinPath(splitPath(path))
        const docs = []
        for (const [docPath, data] of Object.entries(state.docs)) {
            if (collectionPathOfDocument(docPath) !== normalizedCollectionPath) continue
            docs.push({ path: docPath, id: splitPath(docPath).at(-1), data: cloneValue(data) })
        }
        docs.sort((a, b) => a.id.localeCompare(b.id))
        return docs
    }

    const commit = (operations = []) => {
        if (!operations.length) return
        const changedPaths = new Set()
        for (const operation of operations) {
            const normalizedPath = joinPath(splitPath(operation.path))
            if (!normalizedPath) continue
            if (operation.type === "delete") {
                removeDoc(normalizedPath)
                changedPaths.add(normalizedPath)
                continue
            }
            if (operation.type === "set") {
                writeDoc(normalizedPath, operation.data)
                changedPaths.add(normalizedPath)
                continue
            }
            if (operation.type === "update") {
                const current = readDoc(normalizedPath) || {}
                writeDoc(normalizedPath, operation.data(current))
                changedPaths.add(normalizedPath)
            }
        }
        save()
        notify(changedPaths)
    }

    return {
        readDoc,
        readCollection,
        commit,
        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        }
    }
}

const setNestedValue = (target, keyPath, value) => {
    const keys = String(keyPath || "").split(".").filter(Boolean)
    if (!keys.length) return
    let cursor = target
    for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index]
        if (!isObject(cursor[key])) cursor[key] = {}
        cursor = cursor[key]
    }
    cursor[keys[keys.length - 1]] = value
}

const deleteNestedValue = (target, keyPath) => {
    const keys = String(keyPath || "").split(".").filter(Boolean)
    if (!keys.length) return
    let cursor = target
    for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index]
        if (!isObject(cursor[key])) return
        cursor = cursor[key]
    }
    delete cursor[keys[keys.length - 1]]
}

const prepareWriteValue = value => {
    if (Array.isArray(value)) return value.map(item => prepareWriteValue(item))
    if (!isObject(value)) return value
    if (isServerTimestamp(value)) return createTimestamp(new Date())
    if (isDeleteSentinel(value)) return value
    const output = {}
    for (const [key, nestedValue] of Object.entries(value)) output[key] = prepareWriteValue(nestedValue)
    return output
}

const applySet = (existing, payload, merge) => {
    const normalizedPayload = prepareWriteValue(payload)
    if (!merge) return cloneValue(normalizedPayload)
    const next = isObject(existing) ? cloneValue(existing) : {}
    for (const [key, value] of Object.entries(normalizedPayload)) {
        if (isDeleteSentinel(value)) {
            delete next[key]
            continue
        }
        next[key] = value
    }
    return next
}

const applyUpdate = (existing, payload) => {
    const next = isObject(existing) ? cloneValue(existing) : {}
    const normalizedPayload = prepareWriteValue(payload)
    for (const [key, value] of Object.entries(normalizedPayload)) {
        if (isDeleteSentinel(value)) {
            deleteNestedValue(next, key)
            continue
        }
        setNestedValue(next, key, value)
    }
    return next
}

const createLocalFirestore = () => {
    const store = createLocalStore()
    const queryListeners = new Set()

    const emitSnapshots = changedPaths => {
        for (const listener of queryListeners) listener(changedPaths)
    }

    store.subscribe(emitSnapshots)

    class DocumentSnapshot {
        constructor(path, data) {
            this.ref = new DocumentReference(path)
            this.id = splitPath(path).at(-1)
            this._data = data ? cloneValue(data) : null
            this.exists = !!data
        }
        data() {
            return this._data ? cloneValue(this._data) : undefined
        }
    }

    class QuerySnapshot {
        constructor(docs) {
            this.docs = docs
            this.empty = docs.length === 0
            this.size = docs.length
        }
    }

    class DocumentReference {
        constructor(path) {
            this.path = joinPath(splitPath(path))
            this.id = splitPath(this.path).at(-1)
        }
        async get() {
            return new DocumentSnapshot(this.path, store.readDoc(this.path))
        }
        async set(payload, options = {}) {
            const merge = options && options.merge === true
            store.commit([{ type: "update", path: this.path, data: current => applySet(current, payload, merge) }])
        }
        async update(payload) {
            store.commit([{ type: "update", path: this.path, data: current => applyUpdate(current, payload) }])
        }
        async delete() {
            store.commit([{ type: "delete", path: this.path }])
        }
        collection(name) {
            return new CollectionReference(joinPath([this.path, String(name || "")]))
        }
        onSnapshot(next, error) {
            const notify = () => {
                try {
                    next(new DocumentSnapshot(this.path, store.readDoc(this.path)))
                } catch (listenerError) {
                    if (typeof error === "function") error(listenerError)
                }
            }
            notify()
            const listener = changedPaths => {
                if (!changedPaths.has(this.path)) return
                notify()
            }
            queryListeners.add(listener)
            return () => queryListeners.delete(listener)
        }
    }

    class Query {
        constructor(collectionPath, options = {}) {
            this.collectionPath = collectionPath
            this.options = options
        }
        where(field, operator, value) {
            return new Query(this.collectionPath, { ...this.options, where: [...(this.options.where || []), { field, operator, value }] })
        }
        limit(count) {
            return new Query(this.collectionPath, { ...this.options, limit: Number(count) || 0 })
        }
        startAfter(documentSnapshot) {
            return new Query(this.collectionPath, { ...this.options, startAfter: documentSnapshot?.id || "" })
        }
        _resolveDocs() {
            let docs = store.readCollection(this.collectionPath)
            for (const whereClause of this.options.where || []) {
                docs = docs.filter(doc => {
                    const compared = doc.data?.[whereClause.field]
                    return whereClause.operator === "==" ? compared === whereClause.value : true
                })
            }
            docs.sort((a, b) => {
                const left = a.data?.updatedAt?.toMillis?.() || a.data?.createdAt?.toMillis?.() || 0
                const right = b.data?.updatedAt?.toMillis?.() || b.data?.createdAt?.toMillis?.() || 0
                if (left !== right) return right - left
                return b.id.localeCompare(a.id)
            })
            if (this.options.startAfter) {
                const index = docs.findIndex(doc => doc.id === this.options.startAfter)
                if (index >= 0) docs = docs.slice(index + 1)
            }
            if (this.options.limit > 0) docs = docs.slice(0, this.options.limit)
            return docs.map(entry => new DocumentSnapshot(entry.path, entry.data))
        }
        async get() {
            return new QuerySnapshot(this._resolveDocs())
        }
        onSnapshot(next, error) {
            const notify = () => {
                try {
                    next(new QuerySnapshot(this._resolveDocs()))
                } catch (listenerError) {
                    if (typeof error === "function") error(listenerError)
                }
            }
            notify()
            const listener = changedPaths => {
                const shouldNotify = Array.from(changedPaths).some(path => collectionPathOfDocument(path) === this.collectionPath)
                if (!shouldNotify) return
                notify()
            }
            queryListeners.add(listener)
            return () => queryListeners.delete(listener)
        }
    }

    class CollectionReference extends Query {
        constructor(path) {
            super(joinPath(splitPath(path)))
            this.path = this.collectionPath
        }
        doc(id = "") {
            const normalizedId = String(id || "").trim() || crypto.randomUUID()
            return new DocumentReference(joinPath([this.collectionPath, normalizedId]))
        }
        async add(payload) {
            const reference = this.doc()
            await reference.set(payload)
            return reference
        }
    }

    return {
        collection(name) {
            return new CollectionReference(joinPath([String(name || "")]))
        },
        batch() {
            const operations = []
            return {
                set(reference, payload, options = {}) {
                    operations.push({ type: "update", path: reference.path, data: current => applySet(current, payload, options.merge === true) })
                },
                update(reference, payload) {
                    operations.push({ type: "update", path: reference.path, data: current => applyUpdate(current, payload) })
                },
                delete(reference) {
                    operations.push({ type: "delete", path: reference.path })
                },
                async commit() {
                    store.commit(operations)
                }
            }
        }
    }
}

const createLocalUser = (seed = {}) => {
    const now = new Date()
    const profile = {
        uid: "local-user",
        email: "local@smartnotes.app",
        displayName: "Local User",
        photoURL: "",
        providerData: [{ providerId: "local" }],
        metadata: { creationTime: now.toISOString(), lastSignInTime: now.toISOString() },
        ...seed
    }
    return {
        ...profile,
        async getIdToken() {
            return "local-token"
        },
        async updateProfile(patch = {}) {
            if (typeof patch.displayName === "string") this.displayName = patch.displayName
            if (typeof patch.photoURL === "string") this.photoURL = patch.photoURL
        }
    }
}

const createLocalAuth = () => {
    const listeners = new Set()
    const auth = {
        currentUser: createLocalUser(),
        onAuthStateChanged(next) {
            listeners.add(next)
            setTimeout(() => next(auth.currentUser), 0)
            return () => listeners.delete(next)
        },
        async signOut() {
            auth.currentUser = createLocalUser()
            for (const listener of listeners) listener(auth.currentUser)
        }
    }
    return auth
}

export const installFirebaseCompat = () => {
    const Timestamp = class {
        constructor(seconds, nanoseconds) {
            this.seconds = Number(seconds) || 0
            this.nanoseconds = Number(nanoseconds) || 0
        }
        toDate() {
            return new Date((this.seconds * 1000) + Math.floor(this.nanoseconds / 1_000_000))
        }
        toMillis() {
            return this.toDate().getTime()
        }
        static now() {
            const now = Date.now()
            return new Timestamp(Math.floor(now / 1000), (now % 1000) * 1_000_000)
        }
    }

    window.firebase = {
        firestore: {
            Timestamp,
            FieldValue: {
                serverTimestamp: () => createSentinel("serverTimestamp"),
                delete: () => createSentinel("delete")
            }
        }
    }
}

export const initLocalBackend = () => {
    installFirebaseCompat()
    const db = createLocalFirestore()
    const auth = createLocalAuth()
    return { db, auth }
}
