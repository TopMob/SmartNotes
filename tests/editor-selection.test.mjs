import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createSelectionHandlers } from '../public/js/editor/input-handlers.js'

const setup = () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="note-content-editable"><div class="note-page" contenteditable="true"><p><span>12</span><span>34</span></p></div></div></body></html>')
    global.window = dom.window
    global.document = dom.window.document
    global.Node = dom.window.Node
    global.NodeFilter = dom.window.NodeFilter
}

test('getCaretOffsetInBlock handles element startContainer offsets', () => {
    setup()
    const elements = { content: document.getElementById('note-content-editable') }
    const state = { savedSelectionRange: null, savedSelectionBookmark: null }
    const handlers = createSelectionHandlers({ elements, state })

    const block = elements.content.querySelector('p')
    const range = document.createRange()
    range.setStart(block, 1)
    range.collapse(true)

    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const offset = handlers.getCaretOffsetInBlock(block, range)
    assert.equal(offset, 2)

    handlers.placeCaretInBlockAtOffset(block, offset)
    const restored = window.getSelection().getRangeAt(0)
    const restoredOffset = handlers.getCaretOffsetInBlock(block, restored)
    assert.equal(restoredOffset, 2)
})
