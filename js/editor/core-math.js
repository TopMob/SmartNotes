export const createMathHandlers = (context) => {
    const {
        elements,
        state,
        getActiveRangeInContent,
        getBlockFromRange,
        getCaretOffsetInBlock,
        createRangeFromOffsets,
        getPages,
        queueSnapshot
    } = context

    const confirmEquationAtCaret = () => {
        const range = getActiveRangeInContent()
        if (!range || !range.collapsed) return false
        const target = getBlockFromRange(range) || getPages()[state.pageIndex] || elements.content
        if (!target) return false
        const caretOffset = getCaretOffsetInBlock(target, range)
        if (caretOffset === null) return false
        const fullText = target.textContent || ""
        const expressionData = window.Calculator?.findExpressionAroundCaret?.(fullText, caretOffset)
        if (!expressionData) return false
        const result = window.Calculator?.evaluateExpression?.(expressionData.expression)
        if (!Number.isFinite(result)) return false
        const replaceRange = createRangeFromOffsets(target, expressionData.start, expressionData.end)
        if (!replaceRange) return false
        replaceRange.deleteContents()
        const formatted = window.Calculator?.formatResult?.(result) ?? String(result)
        replaceRange.insertNode(document.createTextNode(formatted))
        replaceRange.collapse(false)
        const sel = window.getSelection()
        if (sel) {
            sel.removeAllRanges()
            sel.addRange(replaceRange)
        }
        queueSnapshot()
        return true
    }

    const confirmEquation = () => {
        confirmEquationAtCaret()
    }

    return { confirmEquationAtCaret, confirmEquation }
}
