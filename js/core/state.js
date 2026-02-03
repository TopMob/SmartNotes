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
    selectedNote: null,
    tempRating: 0,
    config: {
      lang: localStorage.getItem("app-lang") || "ru",
      folderViewMode: "compact",
      reduceMotion: false,
      theme: localStorage.getItem("theme") || "dark"
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
