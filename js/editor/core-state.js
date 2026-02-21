export const CONFIG = {
    MAX_HISTORY: 100,
    SNAPSHOT_DELAY: 300,
    MIN_IMG_WIDTH: 100,
    MAX_IMG_WIDTH: 860
}

export const createEditorState = () => ({
    elements: {},
    history: [],
    future: [],
    selectedMediaElement: null,
    resizeState: null,
    dragState: null,
    observer: null,
    abortController: null,
    recordingStream: null,
    savedSelectionRange: null,
    alignMenuTarget: null,
    pageIndex: 0,
    titleTouched: false,
    autoSaveSnapshot: null,
    initialEditorState: null,
    isRenderingState: false,
    snapshotFrame: null,
    manualSaveInProgress: false,
    isSaving: false,
    drawingState: typeof EditorDrawing === "undefined"
        ? { active: false, isDrawing: false }
        : EditorDrawing.state
})
