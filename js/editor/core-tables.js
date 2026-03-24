const clampTableSize = (value, min, max) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return min
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

const createTableCell = () => {
    const cell = document.createElement("td")
    cell.appendChild(document.createElement("br"))
    return cell
}

const createTableRow = (columns) => {
    const row = document.createElement("tr")
    for (let index = 0; index < columns; index += 1) {
        row.appendChild(createTableCell())
    }
    return row
}

const buildTableHtml = (rows, cols) => {
    const normalizedRows = clampTableSize(rows, 1, 20)
    const normalizedCols = clampTableSize(cols, 1, 12)
    const bodyRows = Array.from({ length: normalizedRows }, () => {
        const columns = Array.from({ length: normalizedCols }, () => "<td><br></td>").join("")
        return `<tr>${columns}</tr>`
    }).join("")
    return `<table><tbody>${bodyRows}</tbody></table><p><br></p>`
}

const parseSizeInput = (rawValue, defaults = { rows: 2, cols: 3 }) => {
    const value = String(rawValue || "").trim().toLowerCase()
    const match = value.match(/^(?:new\s+)?(\d{1,2})\s*[xх]\s*(\d{1,2})$/i)
    if (!match) return { rows: defaults.rows, cols: defaults.cols, valid: false }
    return {
        rows: clampTableSize(match[1], 1, 20),
        cols: clampTableSize(match[2], 1, 12),
        valid: true
    }
}

const findCellContext = (range) => {
    if (!range) return null
    const startNode = range.startContainer?.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer?.parentElement
    const cell = startNode?.closest?.("td,th") || null
    if (!cell) return null
    const row = cell.closest("tr")
    const table = cell.closest("table")
    if (!row || !table) return null
    const cellIndex = Array.from(row.children).indexOf(cell)
    return { cell, row, table, cellIndex }
}

const placeCaretAtStart = (element, root) => {
    const target = element?.querySelector?.("br") || element
    if (!target) return
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    if (target.nodeType === Node.TEXT_NODE) {
        range.setStart(target, 0)
    } else {
        range.selectNodeContents(target)
        range.collapse(true)
    }
    selection.removeAllRanges()
    selection.addRange(range)
    root?.focus?.()
}

export const createTableHandlers = (context) => {
    const getCurrentContext = () => findCellContext(context.getActiveRangeInContent())

    const insertTable = (options = {}) => {
        const rows = clampTableSize(options.rows, 1, 20)
        const cols = clampTableSize(options.cols, 1, 12)
        context.insertHtmlAtSelection(buildTableHtml(rows, cols))
        context.storeSelection()
        return true
    }

    const addRowAfter = () => {
        const tableContext = getCurrentContext()
        if (!tableContext) return false
        const columns = Math.max(1, tableContext.row.children.length)
        const nextRow = createTableRow(columns)
        tableContext.row.insertAdjacentElement("afterend", nextRow)
        placeCaretAtStart(nextRow.children[0], context.getRoot())
        context.storeSelection()
        context.queueSnapshot()
        return true
    }

    const removeCurrentRow = () => {
        const tableContext = getCurrentContext()
        if (!tableContext) return false
        const rows = Array.from(tableContext.table.querySelectorAll("tr"))
        if (rows.length <= 1) {
            return removeTable()
        }
        const nextRow = tableContext.row.nextElementSibling || tableContext.row.previousElementSibling
        tableContext.row.remove()
        if (nextRow?.children?.length) placeCaretAtStart(nextRow.children[Math.max(0, Math.min(tableContext.cellIndex, nextRow.children.length - 1))], context.getRoot())
        context.storeSelection()
        context.queueSnapshot()
        return true
    }

    const addColumnAfter = () => {
        const tableContext = getCurrentContext()
        if (!tableContext) return false
        const targetIndex = tableContext.cellIndex + 1
        const rows = Array.from(tableContext.table.querySelectorAll("tr"))
        rows.forEach(row => {
            const cells = Array.from(row.children)
            const referenceCell = cells[targetIndex] || null
            const newCell = createTableCell()
            if (referenceCell) row.insertBefore(newCell, referenceCell)
            else row.appendChild(newCell)
        })
        const refreshedRows = Array.from(tableContext.table.querySelectorAll("tr"))
        const activeRow = refreshedRows[Array.from(tableContext.row.parentElement.children).indexOf(tableContext.row)] || refreshedRows[0]
        const activeCell = activeRow?.children?.[targetIndex] || null
        if (activeCell) placeCaretAtStart(activeCell, context.getRoot())
        context.storeSelection()
        context.queueSnapshot()
        return true
    }

    const removeCurrentColumn = () => {
        const tableContext = getCurrentContext()
        if (!tableContext) return false
        const rows = Array.from(tableContext.table.querySelectorAll("tr"))
        const columnsCount = Math.max(0, tableContext.row.children.length)
        if (columnsCount <= 1) {
            return removeTable()
        }
        const targetIndex = tableContext.cellIndex
        rows.forEach(row => {
            const cell = row.children[targetIndex]
            if (cell) cell.remove()
        })
        const nextIndex = Math.max(0, targetIndex - 1)
        const fallbackCell = rows[0]?.children?.[nextIndex] || null
        if (fallbackCell) placeCaretAtStart(fallbackCell, context.getRoot())
        context.storeSelection()
        context.queueSnapshot()
        return true
    }

    const removeTable = () => {
        const tableContext = getCurrentContext()
        if (!tableContext) return false
        const paragraph = document.createElement("p")
        paragraph.appendChild(document.createElement("br"))
        tableContext.table.replaceWith(paragraph)
        placeCaretAtStart(paragraph, context.getRoot())
        context.storeSelection()
        context.queueSnapshot()
        return true
    }

    const isSelectionInsideTable = () => !!getCurrentContext()

    const applyAction = (rawAction) => {
        const action = String(rawAction || "").trim().toLowerCase()
        if (!action) return false
        if (action === "+r") return addRowAfter()
        if (action === "-r") return removeCurrentRow()
        if (action === "+c") return addColumnAfter()
        if (action === "-c") return removeCurrentColumn()
        if (action === "del") return removeTable()
        return false
    }

    return {
        parseSizeInput,
        insertTable,
        isSelectionInsideTable,
        addRowAfter,
        removeCurrentRow,
        addColumnAfter,
        removeCurrentColumn,
        removeTable,
        applyAction
    }
}
