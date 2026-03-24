const clampTableSize = (value, min, max) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return min
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

const buildTableHtml = (rows, cols) => {
    const normalizedRows = clampTableSize(rows, 1, 10)
    const normalizedCols = clampTableSize(cols, 1, 10)
    const bodyRows = Array.from({ length: normalizedRows }, () => {
        const columns = Array.from({ length: normalizedCols }, () => "<td><br></td>").join("")
        return `<tr>${columns}</tr>`
    }).join("")
    return `<table><tbody>${bodyRows}</tbody></table><p><br></p>`
}

export const createTableHandlers = (context) => {
    const insertTable = (options = {}) => {
        const rows = clampTableSize(options.rows, 1, 10)
        const cols = clampTableSize(options.cols, 1, 10)
        const html = buildTableHtml(rows, cols)
        context.insertHtmlAtSelection(html)
        context.storeSelection()
        return true
    }

    return { insertTable }
}
