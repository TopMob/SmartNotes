import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { normalizeParagraphModel } from '../js/editor/input/paragraph-model.js'
import { createClipboardHandlers } from '../js/editor/input/clipboard.js'

const installDom = () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
    global.window = dom.window
    global.document = dom.window.document
    global.Node = dom.window.Node
    global.NodeFilter = dom.window.NodeFilter
    global.InputEvent = dom.window.InputEvent
}

test('normalizeParagraphModel converts root div/text/br into p-only blocks', () => {
    installDom()
    const root = document.getElementById('root')
    root.innerHTML = 'alpha<br><div>beta</div><p><br></p><div><span>gamma</span></div>'
    normalizeParagraphModel(root)
    assert.equal(root.innerHTML, '<p>alpha</p><p><br></p><p>beta</p><p><br></p><p><span>gamma</span></p>')
})

test('clipboard plain text preserves single empty lines without doubling', () => {
    installDom()
    const handlers = createClipboardHandlers({
        elements: {},
        queueSnapshot: () => {},
        fileToDataUrl: async () => '',
        insertMedia: () => {},
        insertFragmentAtSelection: () => false,
        createFragmentFromHtml: (html) => {
            const template = document.createElement('template')
            template.innerHTML = html
            return template.content.cloneNode(true)
        },
        getActiveRangeInContent: () => null,
        restoreSelection: () => null,
        storeSelection: () => {},
        normalizeActivePage: () => false
    })

    const fragment = document.createDocumentFragment()
    const p1 = document.createElement('p')
    p1.textContent = '1'
    const p2 = document.createElement('p')
    p2.appendChild(document.createElement('br'))
    const p3 = document.createElement('p')
    p3.textContent = '2'
    fragment.append(p1, p2, p3)

    assert.equal(handlers.fragmentToPlainText(fragment), '1\n\n2')
})
