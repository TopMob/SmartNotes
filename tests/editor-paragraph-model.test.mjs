import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { normalizeParagraphModel } from '../js/editor/input/paragraph-model.js'
import { createClipboardHandlers } from '../js/editor/input/clipboard.js'
import { createSelectionHandlers } from '../js/editor/input/selection.js'

const installDom = (html = '<!doctype html><html><body><div id="root"></div></body></html>') => {
    const dom = new JSDOM(html)
    global.window = dom.window
    global.document = dom.window.document
    global.Node = dom.window.Node
    global.NodeFilter = dom.window.NodeFilter
    global.InputEvent = dom.window.InputEvent
}

const createClipboardMockEvent = () => {
    const data = new Map()
    return {
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true
        },
        clipboardData: {
            setData(type, value) {
                data.set(type, value)
            },
            getData(type) {
                return data.get(type) || ''
            }
        }
    }
}

const createPasteEvent = (plainText, html = '') => ({
    defaultPrevented: false,
    preventDefault() {
        this.defaultPrevented = true
    },
    clipboardData: {
        getData(type) {
            if (type === 'text/plain') return plainText
            if (type === 'text/html') return html
            return ''
        },
        items: []
    }
})

test('normalizeParagraphModel converts root div/text/br into p-only blocks', () => {
    installDom()
    const root = document.getElementById('root')
    root.innerHTML = 'alpha<br><div>beta</div><p><br></p><div><span>gamma</span></div>'
    normalizeParagraphModel(root)
    assert.equal(root.innerHTML, '<p>alpha</p><p><br></p><p>beta</p><p><br></p><p><span>gamma</span></p>')
})

test('handleCopy writes browser-like text/plain for sequential paragraphs', () => {
    installDom('<!doctype html><html><body><div id="note-content-editable"><div class="note-page" contenteditable="true"><p>1</p><p>2</p><p>3</p></div></div></body></html>')
    const content = document.getElementById('note-content-editable')
    const page = content.querySelector('.note-page')
    const handlers = createClipboardHandlers({
        elements: { content },
        queueSnapshot: () => {},
        fileToDataUrl: async () => '',
        insertMedia: () => {},
        insertFragmentAtSelection: () => false,
        createFragmentFromHtml: (html) => {
            const template = document.createElement('template')
            template.innerHTML = html
            return template.content.cloneNode(true)
        },
        getActiveRangeInContent: () => {
            const selection = window.getSelection()
            return selection.rangeCount ? selection.getRangeAt(0) : null
        },
        restoreSelection: () => null,
        storeSelection: () => {},
        normalizeActivePage: () => false
    })

    const range = document.createRange()
    range.setStartBefore(page.firstElementChild)
    range.setEndAfter(page.lastElementChild)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const copyEvent = createClipboardMockEvent()
    selection.toString = () => '1\n2\n3'
    handlers.handleCopy(copyEvent)

    assert.equal(copyEvent.defaultPrevented, true)
    assert.equal(copyEvent.clipboardData.getData('text/plain'), '1\n2\n3')
})

test('handleCopy preserves a real single empty line', () => {
    installDom('<!doctype html><html><body><div id="note-content-editable"><div class="note-page" contenteditable="true"><p>1</p><p><br></p><p>2</p></div></div></body></html>')
    const content = document.getElementById('note-content-editable')
    const page = content.querySelector('.note-page')
    const handlers = createClipboardHandlers({
        elements: { content },
        queueSnapshot: () => {},
        fileToDataUrl: async () => '',
        insertMedia: () => {},
        insertFragmentAtSelection: () => false,
        createFragmentFromHtml: (html) => {
            const template = document.createElement('template')
            template.innerHTML = html
            return template.content.cloneNode(true)
        },
        getActiveRangeInContent: () => {
            const selection = window.getSelection()
            return selection.rangeCount ? selection.getRangeAt(0) : null
        },
        restoreSelection: () => null,
        storeSelection: () => {},
        normalizeActivePage: () => false
    })

    const range = document.createRange()
    range.setStartBefore(page.firstElementChild)
    range.setEndAfter(page.lastElementChild)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const copyEvent = createClipboardMockEvent()
    selection.toString = () => '1\n\n2'
    handlers.handleCopy(copyEvent)

    assert.equal(copyEvent.clipboardData.getData('text/plain'), '1\n\n2')
})

test('plain text paste keeps separate paragraphs for single newlines', async () => {
    installDom('<!doctype html><html><body><div id="note-content-editable"><div class="note-page is-active" contenteditable="true"><p><br></p></div></div></body></html>')
    const content = document.getElementById('note-content-editable')
    const page = content.querySelector('.note-page')
    const state = { savedSelectionRange: null, savedSelectionBookmark: null }
    const selectionHandlers = createSelectionHandlers({ elements: { content }, state })
    const range = document.createRange()
    range.selectNodeContents(page.firstElementChild)
    range.collapse(true)
    selectionHandlers.setSelectionRange(range)

    const handlers = createClipboardHandlers({
        elements: { content },
        queueSnapshot: () => {},
        fileToDataUrl: async () => '',
        insertMedia: () => {},
        insertFragmentAtSelection: selectionHandlers.insertFragmentAtSelection,
        createFragmentFromHtml: selectionHandlers.createFragmentFromHtml,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        restoreSelection: selectionHandlers.restoreSelection,
        storeSelection: selectionHandlers.storeSelection,
        normalizeActivePage: () => normalizeParagraphModel(page)
    })

    await handlers.handlePaste(createPasteEvent('1\n2\n3'))

    assert.equal(page.innerHTML, '<p>1</p><p>2</p><p>3</p>')
})

test('plain text paste preserves single empty paragraph between lines', async () => {
    installDom('<!doctype html><html><body><div id="note-content-editable"><div class="note-page is-active" contenteditable="true"><p><br></p></div></div></body></html>')
    const content = document.getElementById('note-content-editable')
    const page = content.querySelector('.note-page')
    const state = { savedSelectionRange: null, savedSelectionBookmark: null }
    const selectionHandlers = createSelectionHandlers({ elements: { content }, state })
    const range = document.createRange()
    range.selectNodeContents(page.firstElementChild)
    range.collapse(true)
    selectionHandlers.setSelectionRange(range)

    const handlers = createClipboardHandlers({
        elements: { content },
        queueSnapshot: () => {},
        fileToDataUrl: async () => '',
        insertMedia: () => {},
        insertFragmentAtSelection: selectionHandlers.insertFragmentAtSelection,
        createFragmentFromHtml: selectionHandlers.createFragmentFromHtml,
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        restoreSelection: selectionHandlers.restoreSelection,
        storeSelection: selectionHandlers.storeSelection,
        normalizeActivePage: () => normalizeParagraphModel(page)
    })

    await handlers.handlePaste(createPasteEvent('1\n\n2'))

    assert.equal(page.innerHTML, '<p>1</p><p><br></p><p>2</p>')
})
