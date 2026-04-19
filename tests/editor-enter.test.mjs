import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { createSelectionHandlers, createEnterHandlers } from "../public/js/editor/input-handlers.js"

const setupEditor = (html) => {
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
    global.window = dom.window
    global.document = dom.window.document
    global.Node = dom.window.Node
    global.NodeFilter = dom.window.NodeFilter
    global.InputEvent = dom.window.InputEvent
    const elements = { content: document.getElementById("note-content-editable") }
    const state = { savedSelectionRange: null, savedSelectionBookmark: null }
    const selectionHandlers = createSelectionHandlers({ elements, state })
    const enterHandlers = createEnterHandlers({
        elements,
        queueSnapshot: () => {},
        getActiveRangeInContent: selectionHandlers.getActiveRangeInContent,
        getActiveBlock: selectionHandlers.getActiveBlock,
        placeCaretAtStart: selectionHandlers.placeCaretAtStart,
        setSelectionRange: selectionHandlers.setSelectionRange
    })
    return { elements, selectionHandlers, enterHandlers }
}

const dispatchEnterBeforeInput = (enterHandlers) => {
    let prevented = false
    enterHandlers.handleBeforeInput({
        defaultPrevented: false,
        inputType: "insertParagraph",
        preventDefault: () => { prevented = true }
    })
    assert.equal(prevented, true)
}

test("Enter splits paragraph in the middle and places caret into new block", () => {
    const { elements, enterHandlers } = setupEditor('<div id="note-content-editable"><div class="note-page" contenteditable="true"><p>hello world</p></div></div>')
    const textNode = elements.content.querySelector("p").firstChild
    const range = document.createRange()
    range.setStart(textNode, 5)
    range.collapse(true)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    dispatchEnterBeforeInput(enterHandlers)
    const blocks = elements.content.querySelectorAll("p")
    assert.equal(blocks.length, 2)
    assert.equal(blocks[0].textContent, "hello")
    assert.equal(blocks[1].textContent, " world")
    const activeRange = window.getSelection().getRangeAt(0)
    assert.equal(activeRange.collapsed, true)
    assert.equal(blocks[1].contains(activeRange.startContainer), true)
    assert.equal(activeRange.startOffset, 0)
})

test("Enter at end creates new empty paragraph and keeps caret there", () => {
    const { elements, enterHandlers } = setupEditor('<div id="note-content-editable"><div class="note-page" contenteditable="true"><p>hello</p></div></div>')
    const textNode = elements.content.querySelector("p").firstChild
    const range = document.createRange()
    range.setStart(textNode, textNode.textContent.length)
    range.collapse(true)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    dispatchEnterBeforeInput(enterHandlers)
    const blocks = elements.content.querySelectorAll("p")
    assert.equal(blocks.length, 2)
    assert.equal(blocks[0].textContent, "hello")
    assert.equal(blocks[1].innerHTML.toLowerCase(), "<br>")
    const activeRange = window.getSelection().getRangeAt(0)
    assert.equal(blocks[1].contains(activeRange.startContainer), true)
})
