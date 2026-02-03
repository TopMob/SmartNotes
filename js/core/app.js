;(() => {
  if (window.App) return

  const defaultConfig = {
    lang: "ru",
    folderViewMode: "compact",
    reduceMotion: false
  }

  const App = {
    initialized: false,
    userKey: null,
    bindDone: false,

    handleUserChange(user) {
      const key = this.getStorageKey(user)
      if (this.userKey !== key) {
        this.userKey = key
        this.load()
        this.render()
      }
    },

    getStorageKey(user) {
      const uid = user?.uid || state.user?.uid || "guest"
      return `smartnotes:${uid}`
    },

    load() {
      const key = this.getStorageKey()
      const raw = localStorage.getItem(key)
      if (!raw) {
        state.notes = []
        state.folders = []
        state.config = { ...defaultConfig, ...(state.config || {}) }
        document.documentElement.classList.toggle("reduce-motion", !!state.config.reduceMotion)
        return
      }
      try {
        const data = JSON.parse(raw)
        state.notes = Array.isArray(data.notes) ? data.notes.map(this.normalizeNote) : []
        state.folders = Array.isArray(data.folders) ? data.folders.map(this.normalizeFolder) : []
        state.config = { ...defaultConfig, ...(data.config || {}) }
        document.documentElement.classList.toggle("reduce-motion", !!state.config.reduceMotion)
      } catch {
        state.notes = []
        state.folders = []
      }
    },

    persist() {
      const key = this.getStorageKey()
      const payload = {
        notes: Array.isArray(state.notes) ? state.notes : [],
        folders: Array.isArray(state.folders) ? state.folders : [],
        config: state.config || defaultConfig
      }
      try {
        localStorage.setItem(key, JSON.stringify(payload))
      } catch {
        if (window.UIToast) UIToast.show("Не удалось сохранить изменения", "error")
      }
    },

    normalizeNote(note) {
      const base = note || {}
      return {
        id: String(base.id || Utils.generateId()),
        title: String(base.title || ""),
        content: String(base.content || ""),
        tags: Array.isArray(base.tags) ? base.tags : [],
        folderId: base.folderId || null,
        order: base.order || Date.now(),
        createdAt: base.createdAt || base.order || Date.now(),
        updatedAt: base.updatedAt || base.order || Date.now(),
        favorite: !!base.favorite,
        pinned: !!base.pinned,
        archived: !!base.archived,
        locked: !!base.locked
      }
    },

    normalizeFolder(folder) {
      return {
        id: String(folder?.id || Utils.generateId()),
        name: String(folder?.name || "Папка")
      }
    },

    init() {
      if (this.initialized) return
      this.initialized = true
      this.userKey = this.getStorageKey()
      this.load()
      this.bind()
      this.consumeShareLink()
      this.render()
    },

    bind() {
      if (this.bindDone) return
      this.bindDone = true

      const searchInput = document.getElementById("search-input")
      if (searchInput) {
        searchInput.value = state.searchQuery || ""
        searchInput.addEventListener("input", (e) => {
          state.searchQuery = String(e.target.value || "")
          this.render()
        })
      }

      const importInput = document.getElementById("note-import")
      if (importInput) {
        importInput.addEventListener("change", (e) => this.handleImport(e))
      }

      document.addEventListener("click", (e) => {
        const folderBtn = e.target.closest("[data-folder-id]")
        if (folderBtn) {
          const id = folderBtn.dataset.folderId
          if (id) {
            state.view = "notes"
            state.activeFolderId = id
            this.render()
            if (window.UI) UI.toggleSidebar(false)
          }
        }
      })

      const notesContainer = document.getElementById("notes-container")
      if (notesContainer) {
        notesContainer.addEventListener("click", (e) => {
          const actionBtn = e.target.closest("[data-note-action]")
          if (actionBtn) {
            const card = actionBtn.closest(".note-card")
            const id = card?.dataset?.noteId
            if (!id) return
            const note = state.notes.find((n) => n.id === id)
            if (!note) return
            this.handleNoteAction(actionBtn.dataset.noteAction, note)
            return
          }

          const card = e.target.closest(".note-card")
          if (card && !e.target.closest("button")) {
            const id = card.dataset.noteId
            const note = state.notes.find((n) => n.id === id)
            if (!note) return
            if (note.locked && window.NoteLock && !NoteLock.canShow(note)) {
              this.promptUnlock().then((ok) => {
                if (ok) Editor.open(note)
              })
            } else {
              Editor.open(note)
            }
          }

          const folderCard = e.target.closest(".folder-card")
          if (folderCard?.dataset?.folderId) {
            state.view = "notes"
            state.activeFolderId = folderCard.dataset.folderId
            this.render()
          }
          if (folderCard?.dataset?.action === "add-folder") {
            this.createFolder()
          }
        })
      }

      document.addEventListener("click", (e) => {
        const shareBtn = e.target.closest("[data-action='open-share']")
        if (shareBtn) this.updateShareLink("share-link", false)
        const collabBtn = e.target.closest("[data-action='open-collab']")
        if (collabBtn) this.updateShareLink("collab-link", true)
      })

      const surveyBtn = document.getElementById("survey-submit")
      if (surveyBtn) {
        surveyBtn.addEventListener("click", () => {
          if (window.UIToast) UIToast.show("Спасибо за ответы!", "success")
          if (window.UIModals) UIModals.close("survey-modal")
        })
      }

      const themeSelect = document.getElementById("settings-theme")
      if (themeSelect) {
        themeSelect.value = localStorage.getItem("theme") || "dark"
        themeSelect.addEventListener("change", (e) => {
          const value = String(e.target.value || "dark")
          if (window.ThemeManager) ThemeManager.apply(value)
        })
      }

      const motionSelect = document.getElementById("settings-reduce-motion")
      if (motionSelect) {
        motionSelect.value = state.config?.reduceMotion ? "true" : "false"
        motionSelect.addEventListener("change", (e) => {
          const value = String(e.target.value || "false") === "true"
          state.config = state.config || { ...defaultConfig }
          state.config.reduceMotion = value
          document.documentElement.classList.toggle("reduce-motion", value)
          this.persist()
        })
      }

      window.addEventListener("beforeunload", () => this.persist())
    },

    handleNoteAction(action, note) {
      if (!action) return
      if (action === "pin") note.pinned = !note.pinned
      if (action === "favorite") note.favorite = !note.favorite
      if (action === "archive") note.archived = !note.archived
      if (action === "lock" && window.NoteLock) note.locked = !note.locked
      if (action === "open") Editor.open(note)
      this.persist()
      this.render()
    },

    async promptUnlock() {
      if (!localStorage.getItem("master-lock")) {
        if (window.UIToast) UIToast.show("Пароль не задан", "error")
        return false
      }
      const ok = await this.prompt("Введите пароль")
      if (!ok) return false
      if (!window.NoteLock) return false
      const success = await NoteLock.unlock(ok)
      if (!success && window.UIToast) UIToast.show("Неверный пароль", "error")
      if (success && window.UIToast) UIToast.show("Доступ разрешен", "success")
      return success
    },

    updateShareLink(inputId, collab) {
      const input = document.getElementById(inputId)
      if (!input) return
      const note = state.currentNote || state.selectedNote
      if (!note || !window.NoteShare) {
        input.value = ""
        return
      }
      const link = NoteShare.createLink(note)
      input.value = collab ? `${link}&collab=1` : link
    },

    handleImport(e) {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || ""))
          const items = Array.isArray(data) ? data : [data]
          const imported = items.map((item) => this.normalizeNote(item))
          state.notes = [...imported, ...(state.notes || [])]
          this.persist()
          this.render()
          if (window.UIToast) UIToast.show("Импортировано", "success")
        } catch {
          if (window.UIToast) UIToast.show("Файл не распознан", "error")
        }
      }
      reader.readAsText(file)
      e.target.value = ""
    },

    createFolder() {
      this.prompt("Название папки").then((name) => {
        const trimmed = String(name || "").trim()
        if (!trimmed) return
        const exists = state.folders.find((f) => f.name.toLowerCase() === trimmed.toLowerCase())
        if (exists) {
          if (window.UIToast) UIToast.show("Папка уже существует", "error")
          return
        }
        state.folders.push({ id: Utils.generateId(), name: trimmed })
        this.persist()
        this.render()
      })
    },

    render() {
      this.renderSidebar()
      this.renderNotes()
      this.updateViewTitle()
      const themeSelect = document.getElementById("settings-theme")
      if (themeSelect) themeSelect.value = localStorage.getItem("theme") || "dark"
      const motionSelect = document.getElementById("settings-reduce-motion")
      if (motionSelect) motionSelect.value = state.config?.reduceMotion ? "true" : "false"
    },

    renderSidebar() {
      const root = document.getElementById("folder-list-root")
      if (!root) return
      root.innerHTML = ""
      state.folders.forEach((folder) => {
        const count = state.notes.filter((n) => n.folderId === folder.id && !n.archived).length
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "nav-item folder-item"
        if (state.activeFolderId === folder.id && state.view === "notes") btn.classList.add("active")
        btn.dataset.folderId = folder.id
        btn.innerHTML = `<i class="material-icons-round" aria-hidden="true">folder</i><span>${Utils.escapeHtml(folder.name)}</span><span class="folder-count">${count}</span>`
        root.appendChild(btn)
      })
    },

    updateViewTitle() {
      const title = document.getElementById("current-view-title")
      if (!title) return
      if (state.view === "favorites") title.textContent = "Важное"
      else if (state.view === "archive") title.textContent = "Архив"
      else if (state.view === "folders") title.textContent = "Папки"
      else if (state.activeFolderId) {
        const folder = state.folders.find((f) => f.id === state.activeFolderId)
        title.textContent = folder ? folder.name : "Папка"
      } else {
        title.textContent = "Все записи"
      }

      document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
        item.classList.toggle("active", item.dataset.view === state.view)
      })
    },

    renderNotes() {
      const container = document.getElementById("notes-container")
      const empty = document.getElementById("empty-state")
      const loader = document.getElementById("app-loader")
      if (!container || !empty || !loader) return
      loader.classList.add("hidden")

      if (state.view === "folders") {
        container.innerHTML = this.renderFoldersView()
        empty.classList.toggle("hidden", container.children.length > 0)
        return
      }

      const notes = this.getFilteredNotes()
      container.innerHTML = notes.map((note) => this.renderNoteCard(note)).join("")
      empty.classList.toggle("hidden", notes.length > 0)
    },

    renderFoldersView() {
      const cards = state.folders.map((folder) => {
        const count = state.notes.filter((n) => n.folderId === folder.id && !n.archived).length
        return `<div class="folder-card" data-folder-id="${folder.id}"><div class="folder-title">${Utils.escapeHtml(folder.name)}</div><div class="folder-meta">${count} заметок</div></div>`
      })
      cards.unshift(`<div class="folder-card" data-action="add-folder"><div class="folder-title">Создать папку</div><div class="folder-meta">Добавить новую папку</div></div>`)
      return cards.join("")
    },

    getFilteredNotes() {
      let notes = Array.isArray(state.notes) ? [...state.notes] : []
      if (state.view === "favorites") notes = notes.filter((n) => n.favorite && !n.archived)
      else if (state.view === "archive") notes = notes.filter((n) => n.archived)
      else notes = notes.filter((n) => !n.archived)

      if (state.activeFolderId && state.view === "notes") {
        notes = notes.filter((n) => n.folderId === state.activeFolderId)
      }

      const query = String(state.searchQuery || "").trim()
      if (query) {
        if (window.SmartSearch) notes = SmartSearch.filter(notes, query)
        else {
          const lowered = query.toLowerCase()
          notes = notes.filter((note) => {
            const text = `${note.title} ${Utils.stripHtml(note.content)} ${(note.tags || []).join(" ")}`.toLowerCase()
            return text.includes(lowered)
          })
        }
      }

      notes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return (b.updatedAt || b.order || 0) - (a.updatedAt || a.order || 0)
      })
      return notes
    },

    renderNoteCard(note) {
      const content = Utils.stripHtml(note.content || "")
      const tags = Array.isArray(note.tags) && note.tags.length
        ? `<div class="note-meta"><i class="material-icons-round" aria-hidden="true">tag</i>${note.tags.map(t => `#${Utils.escapeHtml(t)}`).join(" ")}</div>`
        : ""
      const date = note.updatedAt ? Utils.formatDate(note.updatedAt) : ""
      const locked = note.locked && window.NoteLock && !NoteLock.canShow(note)
      const lockedOverlay = locked ? `<div class="locked-overlay"><i class="material-icons-round" aria-hidden="true">lock</i> Закрыто</div>` : ""
      const lockedClass = locked ? "locked-note" : ""
      const cardClass = ["note-card", lockedClass, note.pinned ? "pinned" : ""].filter(Boolean).join(" ")

      return `<div class="${cardClass}" data-note-id="${note.id}">
        <div class="card-actions">
          <button type="button" class="btn-icon" data-note-action="pin" aria-label="Закрепить"><i class="material-icons-round" aria-hidden="true">push_pin</i></button>
          <button type="button" class="btn-icon" data-note-action="favorite" aria-label="Важное"><i class="material-icons-round" aria-hidden="true">${note.favorite ? "star" : "star_border"}</i></button>
          <button type="button" class="btn-icon" data-note-action="archive" aria-label="Архив"><i class="material-icons-round" aria-hidden="true">${note.archived ? "unarchive" : "archive"}</i></button>
        </div>
        <h3>${Utils.escapeHtml(note.title || "Без названия")}</h3>
        <p>${Utils.escapeHtml(content || "")}</p>
        ${tags}
        <div class="note-meta"><i class="material-icons-round" aria-hidden="true">schedule</i>${date}</div>
        ${lockedOverlay}
      </div>`
    },

    async confirm(message) {
      return await new Promise((resolve) => {
        const modal = document.getElementById("confirm-modal")
        const title = document.getElementById("confirm-title")
        const ok = document.getElementById("confirm-ok")
        const cancel = document.getElementById("confirm-cancel")
        if (!modal || !ok || !cancel) return resolve(window.confirm(message))
        if (title) title.textContent = message
        const close = (value) => {
          modal.classList.remove("active")
          modal.style.display = "none"
          ok.removeEventListener("click", onOk)
          cancel.removeEventListener("click", onCancel)
          resolve(value)
        }
        const onOk = () => close(true)
        const onCancel = () => close(false)
        ok.addEventListener("click", onOk)
        cancel.addEventListener("click", onCancel)
        modal.style.display = "flex"
        requestAnimationFrame(() => modal.classList.add("active"))
      })
    },

    async prompt(titleText) {
      return await new Promise((resolve) => {
        const modal = document.getElementById("prompt-modal")
        const title = document.getElementById("prompt-title")
        const input = document.getElementById("prompt-input")
        const ok = document.getElementById("prompt-ok")
        const cancel = document.getElementById("prompt-cancel")
        if (!modal || !input || !ok || !cancel) return resolve(window.prompt(titleText || ""))
        if (title) title.textContent = titleText
        input.value = ""
        const close = (value) => {
          modal.classList.remove("active")
          modal.style.display = "none"
          ok.removeEventListener("click", onOk)
          cancel.removeEventListener("click", onCancel)
          resolve(value)
        }
        const onOk = () => close(input.value)
        const onCancel = () => close("")
        ok.addEventListener("click", onOk)
        cancel.addEventListener("click", onCancel)
        modal.style.display = "flex"
        requestAnimationFrame(() => modal.classList.add("active"))
        input.focus()
      })
    },

    consumeShareLink() {
      if (!window.NoteShare) return
      const payload = NoteShare.readLink()
      if (!payload?.data) return
      const note = this.normalizeNote(payload.data)
      state.notes.unshift(note)
      this.persist()
      const url = new URL(window.location.href)
      url.searchParams.delete("share")
      url.searchParams.delete("collab")
      window.history.replaceState({}, document.title, url.toString())
      if (window.UIToast) UIToast.show("Заметка добавлена из ссылки", "success")
    }
  }

  window.renderNotes = () => App.renderNotes()
  window.filterAndRender = (query) => {
    state.searchQuery = String(query || "")
    App.render()
  }
  window.switchView = (view) => {
    state.view = view
    if (view !== "notes") state.activeFolderId = null
    App.render()
    if (window.UI) UI.toggleSidebar(false)
  }

  window.App = App
  window.initApp = () => App.init()

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => App.init())
  } else {
    App.init()
  }
})()
