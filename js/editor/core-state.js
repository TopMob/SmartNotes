var els = {}
var history = []
var future = []
var selectedMedia = null
var resizeState = null
var dragState = null
var observer = null
var abortController = null
var recordingStream = null
var savedRange = null
var alignMenuTarget = null
var pageIndex = 0
var titleTouched = false
var autoSaveSnapshot = null
var isRenderingState = false
var snapshotFrame = null
var drawingState = typeof EditorDrawing === "undefined"
    ? { active: false, isDrawing: false }
    : EditorDrawing.state

const CONFIG = {
    MAX_HISTORY: 100,
    SNAPSHOT_DELAY: 300,
    MIN_IMG_WIDTH: 100,
    MAX_IMG_WIDTH: 860
}
