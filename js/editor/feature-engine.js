"use strict";

import { createMediaHandlers } from "./core-media.js"
import { createLinkHandlers } from "./core-links.js"
import { createEditorCommands } from "./editor-commands.js"
import { ensureDrawingLoaded } from "./drawing-loader.js"

export const createFeatureEngine = (context) => {
    const media = createMediaHandlers(context.media)
    const commands = createEditorCommands(context.commands)
    const links = createLinkHandlers({
        getActiveRangeInContent: context.commands.getActiveRangeInContent,
        getEditorCommands: () => commands,
        openFromList: context.openFromList
    })

    let mathHandlersPromise = null
    let mathHandlers = null
    const loadMath = async () => {
        if (!mathHandlersPromise) {
            mathHandlersPromise = import("./core-math.js").then(module => {
                mathHandlers = module.createMathHandlers(context.math)
                return mathHandlers
            })
        }
        return mathHandlersPromise
    }

    const commandDispatcher = (type, payload) => {
        const handlers = {
            bold: () => commands.toggleBold(),
            italic: () => commands.toggleItalic(),
            underline: () => commands.toggleUnderline(),
            strike: () => commands.toggleStrike(),
            bullet: () => commands.toggleBulletedList(),
            number: () => commands.toggleNumberedList(),
            clear: () => commands.clearFormatting(),
            link: () => commands.insertLink(payload?.url || "", payload || {}),
            align: () => commands.alignText(payload?.side)
        }
        const execute = handlers[type]
        if (!execute) return false
        return !!execute()
    }

    const confirmEquationAtCaret = () => {
        if (mathHandlers) return mathHandlers.confirmEquationAtCaret()
        loadMath()
        return false
    }

    const drawing = {
        ensureLoaded: async () => ensureDrawingLoaded(),
        configure: async (config) => {
            const instance = await ensureDrawingLoaded()
            instance?.configure?.(config)
            return instance
        },
        setupControls: async () => {
            const instance = await ensureDrawingLoaded()
            instance?.setupControls?.()
            return instance
        },
        toggleMode: async () => {
            const instance = await ensureDrawingLoaded()
            instance?.toggleDrawingMode?.()
            return instance
        },
        isReady: () => typeof window.EditorDrawing !== "undefined",
        getInstance: () => window.EditorDrawing
    }

    return {
        media,
        links,
        commands,
        commandDispatcher,
        confirmEquationAtCaret,
        loadMath,
        drawing
    }
}
