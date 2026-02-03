;(() => {
  if (window.UI) return

  const STORAGE_KEY = "smartnotes:data:v1"

  const elements = {
    notesContainer: null,
    emptyState: null,
    folderList: null,
    currentViewTitle: null,
    sidebar: null,
    app: null,
    userName: null,
    userPhoto: null,
    userDropdown: null,
    toolbar: null
  }

  const safeParse = (value, fallback) => {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }

  const persist = () => {
    const payload = {
      notes: state.notes,
      folders: state.folders,
      config: state.config
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  const hydrate = () => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = safeParse(raw, null)
    if (!data) return
    state.notes = Array.isArray(data.notes) ? data.notes : []
    state.folders = Array.isArray(data.folders) ? data.folders : []
    state.config = { ...state.config, ...(data.config || {}) }
  }

  const showToast = (message, type) => {
    if (window.UIToast) UIToast.show(message, type)
  }

  const formatCountLabel = (count) => {
    if (count === 1) return "заметка"
    if (count > 1 && count < 5) return "заметки"
    return "заметок"
  }

  const ensureElements = () => {
    elements.notesContainer = document.getElementById("notes-container")
    elements.emptyState = document.getElementById("empty-state")
    elements.folderList = document.getElementById("folder-list-root")
    elements.currentViewTitle = document.getElementById("current-view-title")
    elements.sidebar = document.getElementById("sidebar")
    elements.app = document.getElementById("app")
    elements.userName = document.getElementById("user-name")
    elements.userPhoto = document.getElementById("user-photo")
    elements.userDropdown = document.getElementById("user-dropdown")
    elements.toolbar = document.getElementById("editor-toolbar")
  }

  const selectView = (view) => {
    state.view = view
    if (elements.currentViewTitle) {
      const map = {
        notes: "Все записи",
        favorites: "Важное",
        archive: "Архив",
        folders: "Папки"
      }
      if (view === "notes" && state.activeFolderId) {
        const folder = state.folders.find((f) => f.id === state.activeFolderId)
        elements.currentViewTitle.textContent = folder?.name || map[view] || "SmartNotes"
      } else {
        elements.currentViewTitle.textContent = map[view] || "SmartNotes"
      }
    }
    document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view)
    })
  }

  const getVisibleNotes = () => {
    let notes = [...state.notes]
    if (state.view === "favorites") notes = notes.filter((n) => n.favorite && !n.archived)
    if (state.view === "archive") notes = notes.filter((n) => n.archived)
    if (state.view === "notes") notes = notes.filter((n) => !n.archived)
    if (state.activeFolderId && state.view !== "archive") notes = notes.filter((n) => n.folderId === state.activeFolderId)
    if (window.UINoteVisibility) notes = UINoteVisibility.filter(notes)
    if (state.searchQuery) {
      if (window.SmartSearch) notes = SmartSearch.filter(notes, state.searchQuery)
      else notes = notes.filter((n) => (n.title || "").toLowerCase().includes(state.searchQuery.toLowerCase()))
    }
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return (b.updatedAt || b.order || 0) - (a.updatedAt || a.order || 0)
    })
    return notes
  }

  const renderEmptyState = (show) => {
    if (!elements.emptyState) return
    elements.emptyState.classList.toggle("hidden", !show)
  }

  const renderFolderList = () => {
    if (!elements.folderList) return
    elements.folderList.innerHTML = ""
    state.folders.forEach((folder) => {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "nav-item"
      btn.dataset.folderId = folder.id
      btn.classList.toggle("active", state.activeFolderId === folder.id)
      btn.innerHTML = `<i class="material-icons-round" aria-hidden="true">folder</i><span>${Utils.escapeHtml(folder.name)}</span>`
      btn.addEventListener("click", () => {
        state.activeFolderId = folder.id
        selectView("notes")
        render()
      })
      elements.folderList.appendChild(btn)
    })
  }

  const renderFoldersGrid = () => {
    if (!elements.notesContainer) return
    elements.notesContainer.innerHTML = ""
    state.folders.forEach((folder) => {
      const count = state.notes.filter((n) => n.folderId === folder.id && !n.archived).length
      const card = document.createElement("div")
      card.className = "folder-card"
      card.innerHTML = `<div class="folder-title">${Utils.escapeHtml(folder.name)}</div><div class="folder-meta">${count} ${formatCountLabel(count)}</div>`
      card.addEventListener("click", () => {
        state.activeFolderId = folder.id
        selectView("notes")
        render()
      })
      elements.notesContainer.appendChild(card)
    })
    renderEmptyState(!state.folders.length)
  }

  const renderNotesGrid = () => {
    if (!elements.notesContainer) return
    const notes = getVisibleNotes()
    elements.notesContainer.innerHTML = ""
    notes.forEach((note) => {
      const card = document.createElement("article")
      card.className = "note-card"
      card.dataset.noteId = note.id
      card.innerHTML = `
        <div class="card-actions">
          <button type="button" class="btn-icon" data-note-action="pin" aria-label="Закрепить"><i class="material-icons-round" aria-hidden="true">${note.pinned ? "push_pin" : "push_pin"}</i></button>
          <button type="button" class="btn-icon" data-note-action="favorite" aria-label="Важное"><i class="material-icons-round" aria-hidden="true">${note.favorite ? "star" : "star_border"}</i></button>
          <button type="button" class="btn-icon" data-note-action="archive" aria-label="Архив"><i class="material-icons-round" aria-hidden="true">archive</i></button>
          <button type="button" class="btn-icon" data-note-action="delete" aria-label="Удалить"><i class="material-icons-round" aria-hidden="true">delete</i></button>
        </div>
        <h3>${Utils.escapeHtml(note.title || "Без названия")}</h3>
        <p>${Utils.escapeHtml(Utils.stripHtml(note.content || ""))}</p>
        <div class="note-meta">
          <i class="material-icons-round" aria-hidden="true">schedule</i>
          <span>${Utils.formatDate(note.updatedAt || note.order)}</span>
        </div>
      `
      if (window.UINoteState) UINoteState.apply(card, note)
      if (note.locked && !NoteLock.canShow(note)) {
        card.classList.add("locked-note")
        const overlay = document.createElement("div")
        overlay.className = "locked-overlay"
        overlay.textContent = "Заметка заблокирована"
        card.appendChild(overlay)
      }
      elements.notesContainer.appendChild(card)
    })
    renderEmptyState(!notes.length)
  }

  const updateUserUI = () => {
    if (!elements.userName || !elements.userPhoto) return
    const user = state.user
    if (user) {
      elements.userName.textContent = user.displayName || user.email || "Пользователь"
      if (user.photoURL) elements.userPhoto.src = user.photoURL
    } else {
      elements.userName.textContent = "Гость"
      elements.userPhoto.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    }
  }

  const handleNoteClick = async (target) => {
    const card = target.closest(".note-card")
    if (!card) return
    const note = state.notes.find((n) => n.id === card.dataset.noteId)
    if (!note) return
    if (note.locked && !NoteLock.canShow(note)) {
      const result = await prompt("Введите пароль")
      if (!result) return
      const ok = NoteLock.unlock(result)
      if (!ok) {
        showToast("Неверный пароль", "error")
        return
      }
      render()
      return
    }
    state.selectedNote = note
    if (window.Editor) Editor.open(note)
  }

  const confirm = (title = "Подтвердите") => {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirm-modal")
      const titleEl = document.getElementById("confirm-title")
      const cancelBtn = document.getElementById("confirm-cancel")
      const okBtn = document.getElementById("confirm-ok")
      if (!modal || !cancelBtn || !okBtn) {
        resolve(false)
        return
      }
      titleEl.textContent = title
      const cleanup = () => {
        cancelBtn.removeEventListener("click", onCancel)
        okBtn.removeEventListener("click", onOk)
      }
      const onCancel = () => {
        cleanup()
        UIModals.close("confirm-modal")
        resolve(false)
      }
      const onOk = () => {
        cleanup()
        UIModals.close("confirm-modal")
        resolve(true)
      }
      cancelBtn.addEventListener("click", onCancel)
      okBtn.addEventListener("click", onOk)
      UIModals.open("confirm-modal")
    })
  }

  const prompt = (title = "Введите значение") => {
    return new Promise((resolve) => {
      const modal = document.getElementById("prompt-modal")
      const titleEl = document.getElementById("prompt-title")
      const input = document.getElementById("prompt-input")
      const cancelBtn = document.getElementById("prompt-cancel")
      const okBtn = document.getElementById("prompt-ok")
      if (!modal || !input || !cancelBtn || !okBtn) {
        resolve("")
        return
      }
      input.value = ""
      titleEl.textContent = title
      const cleanup = () => {
        cancelBtn.removeEventListener("click", onCancel)
        okBtn.removeEventListener("click", onOk)
      }
      const onCancel = () => {
        cleanup()
        UIModals.close("prompt-modal")
        resolve("")
      }
      const onOk = () => {
        cleanup()
        UIModals.close("prompt-modal")
        resolve(input.value)
      }
      cancelBtn.addEventListener("click", onCancel)
      okBtn.addEventListener("click", onOk)
      UIModals.open("prompt-modal")
      input.focus()
    })
  }

  const toggleSidebar = (force) => {
    if (!elements.sidebar) return
    const isActive = elements.sidebar.classList.contains("active")
    const next = typeof force === "boolean" ? force : !isActive
    elements.sidebar.classList.toggle("active", next)
  }

  const toggleUserMenu = () => {
    if (!elements.userDropdown) return
    elements.userDropdown.classList.toggle("active")
  }

  const closeUserMenuOnOutside = () => {
    document.addEventListener("click", (e) => {
      if (!elements.userDropdown) return
      if (e.target.closest(".user-avatar-wrapper")) return
      elements.userDropdown.classList.remove("active")
    })
  }

  const updateTheme = (themeKey) => {
    state.config.theme = themeKey
    if (window.ThemeManager) ThemeManager.apply(themeKey)
    persist()
  }

  const applyReduceMotion = (enabled) => {
    state.config.reduceMotion = enabled
    document.documentElement.style.setProperty("--motion-enabled", enabled ? "0" : "1")
    persist()
  }

  const attachSettingsHandlers = () => {
    const themeSelect = document.getElementById("theme-select")
    const reduceMotionToggle = document.getElementById("reduce-motion-toggle")
    if (themeSelect) {
      themeSelect.value = state.config.theme || "dark"
      themeSelect.addEventListener("change", () => updateTheme(themeSelect.value))
    }
    if (reduceMotionToggle) {
      reduceMotionToggle.checked = !!state.config.reduceMotion
      reduceMotionToggle.addEventListener("change", () => applyReduceMotion(reduceMotionToggle.checked))
    }
  }

  const bindSketchControls = () => {
    const color = document.getElementById("sketch-color-picker")
    const width = document.getElementById("sketch-width-picker")
    if (color && width) {
      const apply = () => {
        if (window.SketchService) SketchService.setBrush(color.value, parseInt(width.value, 10) || 3)
      }
      color.addEventListener("input", apply)
      width.addEventListener("input", apply)
    }
  }

  const bindPhotoControls = () => {
    const color = document.getElementById("photo-color-picker")
    const width = document.getElementById("photo-width-picker")
    if (color && width) {
      const apply = () => {
        if (window.PhotoEditor) PhotoEditor.setBrush(color.value, parseInt(width.value, 10) || 3)
      }
      color.addEventListener("input", apply)
      width.addEventListener("input", apply)
    }
  }

  const bindLockControls = () => {
    const lockApply = document.getElementById("lock-apply")
    const lockInput = document.getElementById("lock-password")
    if (!lockApply || !lockInput) return
    lockApply.addEventListener("click", () => {
      if (!state.currentNote) {
        showToast("Сначала откройте заметку", "error")
        return
      }
      const value = lockInput.value.trim()
      if (!value) {
        showToast("Введите пароль", "error")
        return
      }
      const saved = localStorage.getItem("master-lock")
      if (saved && saved !== value) {
        showToast("Неверный пароль", "error")
        return
      }
      if (!saved) NoteLock.setPassword(value)
      NoteLock.lockNote(state.currentNote)
      state.currentNote.updatedAt = Date.now()
      const idx = state.notes.findIndex((n) => n.id === state.currentNote.id)
      if (idx !== -1) state.notes[idx] = state.currentNote
      else state.notes.push(state.currentNote)
      persist()
      if (window.UIModals) UIModals.close("lock-modal")
      showToast("Заметка защищена", "success")
      render()
    })
  }

  const bindUnlockControls = () => {
    const unlockBtn = document.getElementById("unlock-apply")
    const unlockInput = document.getElementById("unlock-password")
    if (!unlockBtn || !unlockInput) return
    unlockBtn.addEventListener("click", () => {
      const value = unlockInput.value.trim()
      if (!value) {
        showToast("Введите пароль", "error")
        return
      }
      const ok = NoteLock.unlock(value)
      if (!ok) {
        showToast("Неверный пароль", "error")
        return
      }
      unlockInput.value = ""
      if (window.UIModals) UIModals.close("lock-center-modal")
      showToast("Заметки разблокированы", "success")
      render()
    })
  }

  const bindSurveyControls = () => {
    const submitBtn = document.getElementById("survey-submit")
    if (!submitBtn) return
    submitBtn.addEventListener("click", () => {
      const q1 = document.getElementById("survey-q1")?.value.trim() || ""
      const q2 = document.getElementById("survey-q2")?.value.trim() || ""
      const q3 = document.getElementById("survey-q3")?.value.trim() || ""
      if (!q1 && !q2 && !q3) {
        showToast("Ответьте хотя бы на один вопрос", "error")
        return
      }
      if (window.UsageSurvey) UsageSurvey.submit({ q1, q2, q3 })
      showToast("Спасибо!", "success")
      if (window.UIModals) UIModals.close("survey-modal")
    })
  }

  const bindGlobalEvents = () => {
    document.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")
      if (!action) return
      if (action.dataset.action === "create-note") {
        if (window.Editor) Editor.create()
      }
      if (action.dataset.action === "open-settings") {
        if (window.UIModals) UIModals.open("settings-modal")
      }
    })

    if (elements.notesContainer) {
      elements.notesContainer.addEventListener("click", (e) => {
        if (e.target.closest("[data-note-action]")) return
        handleNoteClick(e.target)
      })
    }

    const searchInput = document.getElementById("search-input")
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.searchQuery = searchInput.value.trim()
        render()
      })
    }
  }

  const registerModalHooks = () => {
    const shareBtn = document.querySelector("[data-action='open-share']")
    const collabBtn = document.querySelector("[data-action='open-collab']")
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        const link = document.getElementById("share-link")
        if (!link || !state.currentNote) return
        link.value = NoteShare.createLink(state.currentNote)
      })
    }
    if (collabBtn) {
      collabBtn.addEventListener("click", () => {
        const link = document.getElementById("collab-link")
        if (!link || !state.currentNote) return
        const payload = { ...state.currentNote, mode: "collab", ts: Date.now() }
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
        link.value = `${location.origin}${location.pathname}?share=${encoded}`
      })
    }
  }

  const handleImport = () => {
    const input = document.getElementById("note-import")
    if (!input) return
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const data = safeParse(text, null)
      const content = data?.content ? data.content : Utils.escapeHtml(text).replace(/\n/g, "<br>")
      const note = {
        id: Utils.generateId(),
        title: data?.title || file.name.replace(/\.[^/.]+$/, "") || "Импорт",
        content,
        tags: Array.isArray(data?.tags) ? data.tags : [],
        folderId: data?.folderId || null,
        pinned: !!data?.pinned,
        favorite: !!data?.favorite,
        archived: !!data?.archived,
        locked: !!data?.locked,
        order: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      state.notes.push(note)
      persist()
      render()
      showToast("Импортировано", "success")
      input.value = ""
    })
  }

  const handleShareImport = () => {
    const payload = NoteShare.readLink()
    if (!payload) return
    const exists = state.notes.find((n) => n.id === payload.id)
    if (exists) return
    const note = {
      id: payload.id || Utils.generateId(),
      title: payload.title || "Shared note",
      content: payload.content || "",
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      folderId: payload.folderId || null,
      pinned: false,
      favorite: false,
      archived: false,
      locked: false,
      order: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    state.notes.push(note)
    persist()
    render()
    if (window.Editor) Editor.open(note)
  }

  const triggerImport = () => {
    const input = document.getElementById("note-import")
    if (input) input.click()
  }

  const primaryAction = () => {
    if (window.Editor) Editor.create()
  }

  const submitFeedback = () => {
    const text = document.getElementById("feedback-text")
    if (!text) return
    const feedback = text.value.trim()
    if (!feedback) {
      showToast("Введите отзыв", "error")
      return
    }
    const payload = {
      message: feedback,
      rating: state.tempRating || 0,
      ts: Date.now()
    }
    localStorage.setItem(`feedback:${payload.ts}`, JSON.stringify(payload))
    if (window.db && state.user) {
      db.collection("feedback").add({ ...payload, user: state.user.uid }).catch(() => 0)
    }
    text.value = ""
    state.tempRating = 0
    showToast("Спасибо за отзыв!", "success")
    if (window.UIModals) UIModals.close("rate-modal")
  }

  const bindRatingStars = () => {
    document.querySelectorAll(".stars-row .star").forEach((star) => {
      star.addEventListener("click", () => {
        const value = parseInt(star.dataset.val || "0", 10)
        state.tempRating = value
        document.querySelectorAll(".stars-row .star").forEach((s) => {
          const val = parseInt(s.dataset.val || "0", 10)
          s.textContent = val <= value ? "star" : "star_border"
        })
      })
    })
  }

  const onAuthReady = (user) => {
    state.user = user
    updateUserUI()
    render()
  }

  const init = () => {
    hydrate()
    ensureElements()
    applyReduceMotion(!!state.config.reduceMotion)
    if (window.ThemeManager) ThemeManager.apply(state.config.theme || "dark")
    selectView(state.view)
    renderFolderList()
    render()
    bindGlobalEvents()
    registerModalHooks()
    handleImport()
    handleShareImport()
    attachSettingsHandlers()
    bindSketchControls()
    bindPhotoControls()
    bindRatingStars()
    closeUserMenuOnOutside()
    bindLockControls()
    bindUnlockControls()
    bindSurveyControls()
    if (window.UsageSurvey && UsageSurvey.shouldShow()) {
      setTimeout(() => {
        if (window.UIModals) UIModals.open("survey-modal")
      }, 1200)
    }
  }

  const render = () => {
    selectView(state.view)
    renderFolderList()
    if (state.view === "folders") renderFoldersGrid()
    else renderNotesGrid()
    updateUserUI()
  }

  window.UI = {
    init,
    render,
    showToast,
    confirm,
    prompt,
    primaryAction,
    toggleSidebar,
    toggleUserMenu,
    submitFeedback,
    triggerImport,
    onAuthReady
  }

  window.renderNotes = render
  window.filterAndRender = (query) => {
    state.searchQuery = query || ""
    render()
  }
  window.switchView = (view) => {
    state.view = view
    state.activeFolderId = null
    render()
  }
})()
