import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const loadWindowScript = async (window, filePath, transform = source => source) => {
    const source = transform(await readFile(new URL(`../${filePath}`, import.meta.url), 'utf8'))
    const script = new vm.Script(source, { filename: filePath })
    script.runInContext(window)
}

const loadUiBaseScript = async window => loadWindowScript(window, 'js/ui/base.js', source => source.replace('const UI = {', 'window.UI = {'))

const loadExternalStorageScripts = async window => {
    const toWindowGlobal = source => source
        .replace(/^import .*$/gm, '')
        .replace(/export const ([A-Za-z0-9_]+)\s*=/g, 'var $1 = window.$1 =')
        .replace(/export function ([A-Za-z0-9_]+)\s*\(/g, 'window.$1 = function $1(')

    await loadWindowScript(window, 'js/core/externalStorage/errors.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/externalStorage/mediaPipeline.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/externalStorage/service.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/externalStorage/providers/googleDrive/state.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/externalStorage/providers/googleDrive/folders.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/externalStorage/providers/googleDrive/auth.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/externalStorage/providers/googleDrive/provider.js', toWindowGlobal)
    await loadWindowScript(window, 'js/core/googleDriveMedia.js', source => source
        .replace(/^import .*$/gm, '')
        .replace('export const GoogleDriveMediaService = {', 'window.GoogleDriveMediaService = {'))
}

const createBaseWindow = () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <div id="note-actions-modal" class="modal-overlay"><div id="note-actions-content"></div></div>
        <div id="active-folder-menu-wrapper"></div>
        <div id="note-editor"><button id="editor-actions" data-action="editor-note-actions"></button></div>
        <div id="grid"></div>
        <div id="lock-center-list"></div>
        <div id="lock-center-empty"></div>
    </body></html>`, { url: 'https://smartnotes.test/', runScripts: 'outside-only' })
    const { window } = dom
    window.console = console
    window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} })
    window.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0)
    window.cancelAnimationFrame = timerId => clearTimeout(timerId)
    window.UI = {
        els: {
            grid: window.document.getElementById('grid'),
            sidebar: null,
            sidebarOverlay: null,
            userMenu: null,
            filterMenu: null,
            filterButton: null,
            activeFolderMenu: null,
            folderList: null,
            filterSort: null,
            filterFolders: null
        },
        toggleSidebar() {},
        toggleUserMenu() {},
        toggleFilterMenu() {},
        toggleActiveFolderMenu() {},
        closeModal(id) {
            const element = window.document.getElementById(id)
            element?.classList.remove('active')
        },
        getText(_key, fallback) {
            return fallback
        },
        showToast(message) {
            window.__lastToast = message
        },
        resolveNoteById(noteId) {
            const state = window.StateStore.read()
            if (state.currentNote && (!noteId || state.currentNote.id === noteId)) return state.currentNote
            return state.notes.find(note => note.id === noteId) || null
        },
        applyInputAutocompletePolicy() {}
    }
    window.Object.assign(window.UI.els, { grid: window.document.getElementById('grid') })
    window.StateStore = {
        state: {
            notes: [],
            folders: [],
            currentNote: null,
            user: { uid: 'user-1' },
            config: { lang: 'en' }
        },
        read() {
            return this.state
        },
        update(key, value) {
            this.state[key] = value
        }
    }
    window.StateActions = {
        setNotes(notes) {
            window.StateStore.state.notes = notes
        },
        updateConfig(next) {
            window.StateStore.state.config = { ...window.StateStore.state.config, ...next }
        }
    }
    window.Utils = {
        generateId: (() => {
            let index = 0
            return () => `generated-${++index}`
        })(),
        sanitizeHtml(value) {
            return String(value || '')
        },
        stripHtml(value) {
            return String(value || '').replace(/<[^>]+>/g, ' ')
        },
        escapeHtml(value) {
            return String(value || '')
        },
        formatDate() {
            return '2026-03-22'
        },
        debounce(fn) {
            return fn
        },
        serverTimestamp() {
            return new Date('2026-03-22T00:00:00.000Z')
        }
    }
    window.NoteIO = {
        normalizeNote(note) {
            return {
                id: String(note?.id || window.Utils.generateId()),
                title: String(note?.title || ''),
                content: String(note?.content || ''),
                tags: Array.isArray(note?.tags) ? [...note.tags] : [],
                pageTitles: Array.isArray(note?.pageTitles) ? [...note.pageTitles] : [],
                pageDrawings: Array.isArray(note?.pageDrawings) ? [...note.pageDrawings] : [],
                pageDrawingsRevision: String(note?.pageDrawingsRevision || ''),
                folderId: note?.folderId ? String(note.folderId) : null,
                reminderAt: note?.reminderAt || null,
                createdAt: note?.createdAt || new Date('2026-03-22T00:00:00.000Z'),
                updatedAt: note?.updatedAt || new Date('2026-03-22T00:00:00.000Z'),
                ownerUid: String(note?.ownerUid || 'user-1'),
                access: note?.access || null,
                hiddenTags: Array.isArray(note?.hiddenTags) ? [...note.hiddenTags] : []
            }
        },
        parseImportBundle(parsed) {
            return parsed
        }
    }
    window.Validators = {
        validateFolderName(value) {
            return String(value || '').trim().slice(0, 50)
        },
        validateFolderDescription(value) {
            return String(value || '').slice(0, 300)
        },
        canAssignToFolder() {
            return true
        },
        canAddFolder() {
            return true
        },
        FOLDER_DESCRIPTION_SOFT_LIMIT: 300,
        FOLDER_DESCRIPTION_HARD_LIMIT: 300
    }
    window.firebase = {
        firestore: {
            FieldValue: {
                serverTimestamp() {
                    return { serverTimestamp: true }
                },
                delete() {
                    return { deleted: true }
                }
            },
            Timestamp: {
                fromMillis(value) {
                    return new Date(value)
                },
                fromDate(value) {
                    return new Date(value)
                }
            }
        }
    }
    window.db = {
        batch() {
            return {
                operations: [],
                set(ref, payload) {
                    this.operations.push({ type: 'set', ref, payload })
                },
                commit: async function () {
                    window.__lastBatchCommit = this.operations.slice()
                }
            }
        }
    }
    window.DataPath = {
        getUserFoldersCollection() {
            return {
                doc(id) {
                    return { id }
                }
            }
        },
        getUserNotesCollection() {
            return {
                doc(id) {
                    return { id }
                }
            }
        }
    }
    window.Auth = { login() {}, loginWithEmail() {}, logout() {}, switchAccount() {} }
    window.LANG = { en: {}, ru: {} }
    window.isHiddenLocked = note => !!note?.lock?.hidden
    window.getLockedNotes = () => window.StateStore.state.notes.filter(note => note?.lock?.hidden)
    return window
}

test('openNoteActions resolves notes even before note-actions renderer script loads', async () => {
    const window = createBaseWindow()
    const note = { id: 'note-base', title: 'Base note', content: '<p>Body</p>', lock: null }
    window.StateStore.state.notes = [note]
    window.StateStore.state.currentNote = null

    await loadUiBaseScript(window)
    await loadWindowScript(window, 'js/ui/layout.js')
    window.UI.openModal = id => {
        const element = window.document.getElementById(id)
        element?.classList.add('active')
        return !!element
    }
    window.UI.showToast = message => {
        window.__lastToast = message
    }

    await loadWindowScript(window, 'js/notes/actions.js')

    const opened = window.openNoteActions('note-base')
    assert.equal(opened, true)
    assert.equal(window.UI.currentNoteActionId, 'note-base')
    assert.equal(typeof window.UI.renderNoteActions, 'function')
    assert.match(window.document.getElementById('note-actions-content').innerHTML, /note-copy-text/)
})

test('note actions chain opens modal from card and editor entry points', async () => {
    const window = createBaseWindow()
    const note = { id: 'note-1', title: 'Hello', content: '<p>Body</p>', lock: null }
    window.StateStore.state.notes = [note]
    window.StateStore.state.currentNote = note

    await loadWindowScript(window, 'js/ui.settings.js')
    await loadWindowScript(window, 'js/ui/layout.js')
    await loadWindowScript(window, 'js/notes/actions.js')
    await loadWindowScript(window, 'js/ui/events.js')

    const grid = window.document.getElementById('grid')
    grid.innerHTML = `<div class="note-card" data-note-id="note-1"><button class="action-btn" data-action="note-menu" data-note-id="note-1">...</button></div>`
    window.UI.bindEvents()

    grid.querySelector('[data-action="note-menu"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    assert.equal(window.document.getElementById('note-actions-modal').classList.contains('active'), true)
    assert.match(window.document.getElementById('note-actions-content').innerHTML, /note-copy-text/)
    assert.equal(window.UI.currentNoteActionId, 'note-1')

    window.UI.closeModal('note-actions-modal')
    window.document.getElementById('editor-actions').dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    assert.equal(window.document.getElementById('note-actions-modal').classList.contains('active'), true)
})

test('hidden current note can still open note actions from editor entry point', async () => {
    const window = createBaseWindow()
    const hiddenNote = { id: 'hidden-1', title: 'Secret', content: '<p>Body</p>', lock: { hidden: true } }
    window.StateStore.state.notes = [hiddenNote]
    window.StateStore.state.currentNote = hiddenNote

    await loadWindowScript(window, 'js/ui.settings.js')
    await loadWindowScript(window, 'js/ui/layout.js')
    await loadWindowScript(window, 'js/notes/actions.js')

    const opened = window.openNoteActions('hidden-1')
    assert.equal(opened, true)
    assert.equal(window.document.getElementById('note-actions-modal').classList.contains('active'), true)
})

test('saveImportedFolders maps old ids to existing folder and avoids duplicate writes', async () => {
    const window = createBaseWindow()
    window.StateStore.state.folders = [{ id: 'folder-existing', name: 'Work', trashedAt: null }]

    await loadWindowScript(window, 'js/ui/layout.js')

    const mapping = await window.UI.saveImportedFolders(window.StateStore.state.user, [
        { sourceId: 'old-work', id: 'import-1', name: 'Work', description: '' },
        { sourceId: 'old-home', id: 'import-2', name: 'Home', description: '' }
    ])

    assert.equal(mapping.get('old-work'), 'folder-existing')
    assert.equal(mapping.get('old-home'), 'import-2')
    assert.equal(window.__lastBatchCommit.length, 1)
    assert.equal(window.__lastBatchCommit[0].ref.id, 'import-2')
})

test('importNotesWithRecovery keeps note data when media upload fails', async () => {
    const window = createBaseWindow()
    window.GoogleDriveMediaService = {
        getInlineMediaSummary(note) {
            return { hasInlineMedia: /data:image\//.test(String(note?.content || '')) }
        },
        async externalizeNoteMedia(note) {
            if (/data:image\//.test(String(note?.content || ''))) {
                throw new Error('drive-upload-failed:500')
            }
            return { note, failures: [] }
        }
    }

    await loadWindowScript(window, 'js/ui/layout.js')

    const results = await window.UI.importNotesWithRecovery([
        {
            title: 'Imported',
            content: '<p>Text before</p><img src="data:image/png;base64,AAA">',
            folderId: 'legacy-folder'
        }
    ], 'user-1', new Map([['legacy-folder', 'folder-new']]))

    assert.equal(results.length, 1)
    assert.equal(results[0].note.folderId, 'folder-new')
    assert.equal(/data:image\//.test(results[0].note.content), false)
    assert.match(results[0].note.content, /Text before/)
    assert.equal(results[0].failedMediaCount > 0, true)
})

test('prepareExportNotes removes inline media and NoteExport payload keeps notes and folders', async () => {
    const window = createBaseWindow()
    window.GoogleDriveMediaService = {
        async externalizeNoteMedia(note) {
            return {
                note: {
                    ...note,
                    content: String(note.content || '').replace(/data:image\/png;base64,AAA/g, 'https://drive.test/file-1'),
                    pageDrawings: (note.pageDrawings || []).map(value => String(value || '').replace(/data:image\/png;base64,AAA/g, 'https://drive.test/file-1'))
                }
            }
        },
        getInlineMediaSummary(note) {
            return {
                hasInlineMedia: /data:image\//.test(String(note?.content || '')) || (note?.pageDrawings || []).some(value => /data:image\//.test(String(value || '')))
            }
        }
    }

    await loadWindowScript(window, 'js/ui/layout.js')
    await loadWindowScript(window, 'js/core/noteExport.js')

    const exportedNotes = await window.UI.prepareExportNotes([
        { id: 'note-1', title: 'Pic', content: '<img src="data:image/png;base64,AAA">', pageDrawings: ['data:image/png;base64,AAA'] }
    ])

    assert.equal(/data:image\//.test(exportedNotes[0].content), false)
    assert.equal(/data:image\//.test(exportedNotes[0].pageDrawings[0]), false)

    const payload = window.NoteExportService.buildExportPayload({
        notes: exportedNotes,
        folders: [{ id: 'folder-1', name: 'Folder', description: '' }],
        scope: 'all'
    })

    assert.equal(Array.isArray(payload.notes), true)
    assert.equal(Array.isArray(payload.folders), true)
    assert.equal(payload.notes.length, 1)
    assert.equal(payload.folders.length, 1)
})

test('lock center three dots opens shared note actions modal for hidden notes', async () => {
    const window = createBaseWindow()
    const hiddenNote = { id: 'hidden-2', title: 'Secret', content: '<p>Body</p>', lock: { hidden: true } }
    window.StateStore.state.notes = [hiddenNote]
    window.StateStore.state.currentNote = null

    await loadWindowScript(window, 'js/ui.settings.js')
    await loadWindowScript(window, 'js/ui/layout.js')
    await loadWindowScript(window, 'js/notes/actions.js')
    await loadWindowScript(window, 'js/ui/render/lock.js')
    await loadWindowScript(window, 'js/ui/events.js')

    window.UI.bindEvents()
    window.UI.renderLockCenter()
    window.document.querySelector('[data-action="lock-note-menu"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    assert.equal(window.document.getElementById('note-actions-modal').classList.contains('active'), true)
    assert.match(window.document.getElementById('note-actions-content').innerHTML, /note-copy-text/)
})

test('import strips inline media when external storage service is unavailable', async () => {
    const window = createBaseWindow()
    await loadWindowScript(window, 'js/ui/layout.js')

    const result = await window.UI.normalizeImportedNoteMedia({
        id: 'legacy-note',
        content: '<p>Text before</p><img src="data:image/png;base64,AAA">',
        pageDrawings: ['data:image/png;base64,AAA']
    })

    assert.equal(/data:image\//.test(result.note.content), false)
    assert.equal(result.note.pageDrawings.length, 0)
    assert.equal(result.failedMediaCount > 0, true)
})

test('html paste with inline media is blocked when external storage is unavailable', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true"></div></body></html>', { url: 'https://smartnotes.test/', runScripts: 'outside-only' })
    const { window } = dom
    window.console = console
    window.UI = {
        getText(_key, fallback) {
            return fallback
        },
        showToast(message) {
            window.__lastToast = message
        }
    }
    window.Utils = {
        sanitizeHtml(value) {
            return String(value || '')
        }
    }
    window.document.getSelection = () => ({ removeAllRanges() {}, addRange() {} })

    await loadWindowScript(window, 'js/editor/core-input.js', source => source.replace('export const createInputHandlers =', 'window.createInputHandlers ='))

    const handlers = window.createInputHandlers({
        elements: { content: window.document.getElementById('editor') },
        state: {},
        queueSnapshot() {},
        fileToDataUrl: async () => 'https://drive.test/file',
        insertMedia() {},
        restoreSelection() { return null },
        confirmEquationAtCaret() { return false }
    })

    await handlers.handlePaste({
        preventDefault() {},
        clipboardData: {
            items: [],
            getData(type) {
                if (type === 'text/html') return '<p><img src="data:image/png;base64,AAA"></p>'
                return ''
            }
        }
    })

    assert.equal(window.document.getElementById('editor').innerHTML, '')
    assert.match(window.__lastToast, /attachment unavailable|вложение недоступно/i)
})

test('google drive media service persists link state, restores silently, and uploads into SmartNotes/Attachments', async () => {
    const persistedDriveState = {}
    const buildWindow = () => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://smartnotes.test/', runScripts: 'outside-only' })
        const { window } = dom
        window.console = console
        window.Blob = globalThis.Blob
        window.atob = globalThis.atob
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
        window.HTMLMediaElement = dom.window.HTMLMediaElement
        window.firebaseConfig = { clientId: 'client-id' }
        window.auth = {
            currentUser: {
                uid: 'user-1',
                email: 'user-1@example.com',
                providerData: [{ providerId: 'google.com' }]
            },
            app: { options: { clientId: 'client-id' } }
        }
        window.SafeStorage = {
            local: {
                getJson(key, fallback = null) {
                    return key in persistedDriveState ? persistedDriveState[key] : fallback
                },
                setJson(key, value) {
                    persistedDriveState[key] = value
                    return true
                }
            }
        }
        return window
    }

    const tokenPrompts = []
    const createdFolders = []
    let uploadCalls = 0
    let permissionCalls = 0
    let uploadedBody = ''

    const firstWindow = buildWindow()
    firstWindow.requestGoogleAccessToken = async ({ prompt }) => {
        tokenPrompts.push(prompt)
        return { accessToken: 'token-1', expiresIn: 3600 }
    }
    firstWindow.fetch = async (url, options = {}) => {
        const targetUrl = String(url)
        if (targetUrl.includes('/permissions')) {
            permissionCalls += 1
            return { ok: true, status: 200, json: async () => ({}) }
        }
        if (targetUrl.includes('upload/drive/v3/files')) {
            uploadCalls += 1
            uploadedBody = await options.body.text()
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'file-1',
                    name: 'file-1',
                    mimeType: 'image/png',
                    webContentLink: 'https://drive.google.com/uc?id=file-1&export=download'
                })
            }
        }
        if ((options.method || 'GET') === 'POST') {
            const payload = JSON.parse(String(options.body || '{}'))
            const folderId = payload.name === 'SmartNotes'
                ? 'folder-root'
                : payload.name === 'Attachments'
                    ? 'folder-attachments'
                    : payload.name === 'Backups'
                        ? 'folder-backups'
                        : 'folder-exports'
            createdFolders.push({ name: payload.name, parents: payload.parents || [] })
            return { ok: true, status: 200, json: async () => ({ id: folderId, name: payload.name, parents: payload.parents || [] }) }
        }
        return { ok: true, status: 200, json: async () => ({ files: [] }) }
    }

    await loadExternalStorageScripts(firstWindow)

    const firstStatus = await firstWindow.GoogleDriveMediaService.handleSignedInUser(firstWindow.auth.currentUser, { interactiveAllowed: true })
    assert.equal(firstStatus.connected, true)
    assert.equal(firstStatus.linked, true)
    assert.deepEqual(createdFolders, [
        { name: 'SmartNotes', parents: [] },
        { name: 'Attachments', parents: ['folder-root'] },
        { name: 'Backups', parents: ['folder-root'] },
        { name: 'Exports', parents: ['folder-root'] }
    ])
    assert.equal(tokenPrompts[0], 'consent')

    const secondWindow = buildWindow()
    secondWindow.requestGoogleAccessToken = async ({ prompt }) => {
        tokenPrompts.push(prompt)
        return { accessToken: 'token-2', expiresIn: 3600 }
    }
    secondWindow.fetch = async (url, options = {}) => {
        const targetUrl = String(url)
        if (targetUrl.includes('/permissions')) {
            permissionCalls += 1
            return { ok: true, status: 200, json: async () => ({}) }
        }
        if (targetUrl.includes('upload/drive/v3/files')) {
            uploadCalls += 1
            uploadedBody = await options.body.text()
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'file-1',
                    name: 'file-1',
                    mimeType: 'image/png',
                    webContentLink: 'https://drive.google.com/uc?id=file-1&export=download'
                })
            }
        }
        return { ok: true, status: 200, json: async () => ({ files: [] }) }
    }

    await loadExternalStorageScripts(secondWindow)

    const restoredStatus = await secondWindow.GoogleDriveMediaService.handleSignedInUser(secondWindow.auth.currentUser, { interactiveAllowed: false })
    assert.equal(restoredStatus.connected, false)
    assert.equal(restoredStatus.linked, true)
    assert.equal(restoredStatus.attachmentsId, 'folder-attachments')
    assert.equal(restoredStatus.exportsId, 'folder-exports')
    assert.equal(tokenPrompts.length, 1)

    const note = {
        title: 'Cache',
        content: '<p><img src="data:image/png;base64,AAA"></p><p><img src="data:image/png;base64,AAA"></p>',
        pageDrawings: ['data:image/png;base64,AAA']
    }

    const result = await secondWindow.GoogleDriveMediaService.externalizeNoteMedia(note)
    assert.equal(/data:image\//.test(result.note.content), false)
    assert.equal(/data:image\//.test(result.note.pageDrawings[0]), false)
    assert.match(result.note.content, /https:\/\/lh3\.googleusercontent\.com\/d\/file-1/)
    assert.match(uploadedBody, /"parents":\["folder-attachments"\]/)
    assert.equal(tokenPrompts[1], '')
    assert.equal(uploadCalls, 1)
    assert.equal(permissionCalls, 1)
})
