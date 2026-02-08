const Calculator = (() => {
    const findExpressionAroundCaret = (text, caretOffset) => {
        const allowed = /[0-9+\-*/().,%\s]/
        let start = caretOffset
        let end = caretOffset
        while (start > 0 && allowed.test(text[start - 1])) start -= 1
        while (end < text.length && allowed.test(text[end])) end += 1
        const slice = text.slice(start, end)
        const trimmed = slice.trim()
        if (!trimmed) return null
        if (!/[+\-*/%()]/.test(trimmed)) return null
        const leadingSpace = slice.indexOf(trimmed)
        const expressionStart = start + leadingSpace
        const expressionEnd = expressionStart + trimmed.length
        return { expression: trimmed, start: expressionStart, end: expressionEnd }
    }

    const tokenizeExpression = (expression) => {
        const tokens = []
        let index = 0
        let lastType = "start"
        const isNumberPart = (char) => /[0-9.,]/.test(char)
        while (index < expression.length) {
            const char = expression[index]
            if (/\s/.test(char)) {
                index += 1
                continue
            }
            if (isNumberPart(char)) {
                let numberText = ""
                let separatorCount = 0
                while (index < expression.length && isNumberPart(expression[index])) {
                    const current = expression[index]
                    if (current === "." || current === ",") {
                        separatorCount += 1
                        if (separatorCount > 1) return null
                        numberText += "."
                    } else {
                        numberText += current
                    }
                    index += 1
                }
                if (!numberText || numberText === ".") return null
                const value = Number(numberText)
                if (!Number.isFinite(value)) return null
                tokens.push({ type: "number", value })
                lastType = "number"
                continue
            }
            if (char === "(") {
                tokens.push({ type: "leftParen" })
                index += 1
                lastType = "leftParen"
                continue
            }
            if (char === ")") {
                if (lastType === "operator" || lastType === "leftParen" || lastType === "start") return null
                tokens.push({ type: "rightParen" })
                index += 1
                lastType = "rightParen"
                continue
            }
            if (char === "%") {
                if (!["number", "rightParen", "percent"].includes(lastType)) return null
                tokens.push({ type: "percent" })
                index += 1
                lastType = "percent"
                continue
            }
            if ("+-*/".includes(char)) {
                const isUnary = lastType === "start" || lastType === "operator" || lastType === "leftParen"
                if (isUnary) {
                    if (char === "+") {
                        index += 1
                        continue
                    }
                    tokens.push({ type: "operator", value: "neg" })
                    index += 1
                    lastType = "operator"
                    continue
                }
                tokens.push({ type: "operator", value: char })
                index += 1
                lastType = "operator"
                continue
            }
            return null
        }
        if (lastType === "operator" || lastType === "leftParen") return null
        return tokens
    }

    const toRpn = (tokens) => {
        const output = []
        const stack = []
        const operatorInfo = {
            "+": { precedence: 1, assoc: "left" },
            "-": { precedence: 1, assoc: "left" },
            "*": { precedence: 2, assoc: "left" },
            "/": { precedence: 2, assoc: "left" },
            "neg": { precedence: 3, assoc: "right" }
        }
        for (const token of tokens) {
            if (token.type === "number") {
                output.push(token)
                continue
            }
            if (token.type === "percent") {
                output.push(token)
                continue
            }
            if (token.type === "operator") {
                const currentInfo = operatorInfo[token.value]
                while (stack.length) {
                    const top = stack[stack.length - 1]
                    if (top.type !== "operator") break
                    const topInfo = operatorInfo[top.value]
                    const shouldPop = topInfo.precedence > currentInfo.precedence
                        || (topInfo.precedence === currentInfo.precedence && currentInfo.assoc === "left")
                    if (!shouldPop) break
                    output.push(stack.pop())
                }
                stack.push(token)
                continue
            }
            if (token.type === "leftParen") {
                stack.push(token)
                continue
            }
            if (token.type === "rightParen") {
                let found = false
                while (stack.length) {
                    const top = stack.pop()
                    if (top.type === "leftParen") {
                        found = true
                        break
                    }
                    output.push(top)
                }
                if (!found) return null
                continue
            }
            return null
        }
        while (stack.length) {
            const top = stack.pop()
            if (top.type === "leftParen" || top.type === "rightParen") return null
            output.push(top)
        }
        return output
    }

    const evaluateRpn = (tokens) => {
        const stack = []
        for (const token of tokens) {
            if (token.type === "number") {
                stack.push(token.value)
                continue
            }
            if (token.type === "percent") {
                if (!stack.length) return null
                const value = stack.pop()
                if (typeof value !== "number") return null
                stack.push({ type: "percent", value })
                continue
            }
            if (token.type === "operator") {
                if (token.value === "neg") {
                    if (!stack.length) return null
                    const value = stack.pop()
                    if (typeof value === "number") {
                        stack.push(-value)
                    } else if (value?.type === "percent") {
                        stack.push({ type: "percent", value: -value.value })
                    } else {
                        return null
                    }
                    continue
                }
                if (stack.length < 2) return null
                const right = stack.pop()
                const left = stack.pop()
                if (typeof left !== "number") return null
                let result = null
                if (typeof right === "number") {
                    switch (token.value) {
                        case "+":
                            result = left + right
                            break
                        case "-":
                            result = left - right
                            break
                        case "*":
                            result = left * right
                            break
                        case "/":
                            result = right === 0 ? null : left / right
                            break
                        default:
                            result = null
                            break
                    }
                } else if (right?.type === "percent") {
                    const ratio = right.value / 100
                    switch (token.value) {
                        case "+":
                            result = left + left * ratio
                            break
                        case "-":
                            result = left - left * ratio
                            break
                        case "*":
                            result = left * ratio
                            break
                        case "/":
                            result = ratio === 0 ? null : left / ratio
                            break
                        default:
                            result = null
                            break
                    }
                } else {
                    result = null
                }
                if (!Number.isFinite(result)) return null
                stack.push(result)
                continue
            }
            return null
        }
        if (stack.length !== 1) return null
        const finalValue = stack[0]
        if (typeof finalValue === "number") return finalValue
        if (finalValue?.type === "percent") return finalValue.value / 100
        return null
    }

    const evaluateExpression = (expression) => {
        const tokens = tokenizeExpression(expression)
        if (!tokens) return null
        const rpn = toRpn(tokens)
        if (!rpn) return null
        return evaluateRpn(rpn)
    }

    const formatResult = (value) => {
        const rounded = Math.round(value * 1000000000) / 1000000000
        return String(rounded)
    }

    return {
        findExpressionAroundCaret,
        evaluateExpression,
        formatResult
    }
})()

window.Calculator = Calculator
