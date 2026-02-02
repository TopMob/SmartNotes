;(() => {
  const existing = window.state
  if (existing) return

  const state = {
    user: null,
    notes: [],
    folders: [],
    view: "notes",
    activeFolderId: null,
    searchQuery: "",
    currentNote: null,
    tempRating: 0,
    config: {
      lang: localStorage.getItem("app-lang") || "ru",
      folderViewMode: "compact",
      reduceMotion: false
    },
    driveToken: null,
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    editorDirty: false,
    lastSaved: null,
    orderHistory: []
  }

  window.state = state
})()
