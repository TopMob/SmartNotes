;(() => {
  if (window.Editor) return

  const Editor = {
    els: {},
    history: [],
    future: [],
    snapshotTimer: null,
    selectedMedia: null,
    resizeState: null,
    savedRange: null,
    recording: false,

    init() {
      this.els = {
        wrapper: document.getElementById("note-editor"),
        title: document.getElementById("note-title"),
        content: document.getElementById("note-content-editable"),
        toolbar: document.getElementById("editor-toolbar"),
        tagsInput: document.getElementById("note-tags-input"),
        tagsContainer: document.getElementById("note-tags-container"),
        sizePopup: document.getElementById("text-size-popup"),
        sizeRange: document.getElementById("font-size-range"),
        ctxMenu: document.getElementById("media-context-menu")
      }
      this.bind()
      this.buildToolbar()
    },

    bind() {
      if (this.els.title) {
        this.els.title.addEventListener("input", () => this.queueSnapshot())
      }

      if (this.els.content) {
        this.els.content.addEventListener("input", () => this.queueSnapshot())
        this.els.content.addEventListener("click", (e) => this.handleContentClick(e))
        this.els.content.addEventListener("change", (e) => this.handleContentChange(e))
        this.els.content.addEventListener("pointerdown", (e) => this.handleResizeStart(e))
      }

      if (this.els.tagsInput) {
        this.els.tagsInput.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return
          e.preventDefault()
          const v = String(this.els.tagsInput.value || "").trim()
          if (!v) return
          this.addTag(v.replace(/^#/, ""))
          this.els.tagsInput.value = ""
        })
      }

      if (this.els.tagsContainer) {
        this.els.tagsContainer.addEventListener("click", (e) => {
          const chip = e.target.closest(".tag-chip")
          if (!chip) return
          const tag = chip.dataset.tag
          if (tag) this.removeTag(tag)
        })
      }

      if (this.els.sizeRange) {
        this.els.sizeRange.addEventListener("input", () => this.applyFontSize())
      }

      const imgUpload = document.getElementById("img-upload")
      if (imgUpload) {
        imgUpload.addEventListener("change", async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const url = await this.fileToDataUrl(f)
          this.insertMedia(url)
          imgUpload.value = ""
        })
      }

      const lockApply = document.getElementById("lock-apply")
      if (lockApply) {
        lockApply.addEventListener("click", async () => {
          const input = document.getElementById("lock-password")
          const password = String(input?.value || "").trim()
          if (!password) {
            if (window.UIToast) UIToast.show("Введите пароль", "error")
            return
          }
          if (window.NoteLock) await NoteLock.setPassword(password)
          const note = state.currentNote
          if (note) note.locked = true
          if (input) input.value = ""
          if (window.UIModals) UIModals.close("lock-modal")
          this.queueSnapshot()
          if (window.UIToast) UIToast.show("Заметка защищена", "success")
        })
      }
    },

    buildToolbar() {
      if (!this.els.toolbar) return
      const tools = [
        { action: "bold", icon: "format_bold", title: "Жирный" },
        { action: "italic", icon: "format_italic", title: "Курсив" },
        { action: "underline", icon: "format_underlined", title: "Подчеркнуть" },
        { action: "h1", icon: "title", title: "Заголовок" },
        { action: "ul", icon: "format_list_bulleted", title: "Маркированный" },
        { action: "ol", icon: "format_list_numbered", title: "Нумерованный" },
        { action: "task", icon: "check_box", title: "Задача" },
        { action: "image", icon: "image", title: "Изображение" },
        { action: "sketch", icon: "gesture", title: "Рисунок" },
        { action: "voice", icon: "mic", title: "Голос" },
        { action: "size", icon: "text_fields", title: "Размер" }
      ]

      this.els.toolbar.innerHTML = tools.map((tool) => {
        return `<div class="tool-wrapper"><button type="button" class="tool-btn" data-tool="${tool.action}" aria-label="${tool.title}"><i class="material-icons-round" aria-hidden="true">${tool.icon}</i></button></div>`
      }).join("")

      this.els.toolbar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tool]")
        if (!btn) return
        const action = btn.dataset.tool
        this.handleTool(action, btn)
      })
    },

    handleTool(action, btn) {
      if (!action) return
      if (action === "image") {
        const imgUpload = document.getElementById("img-upload")
        if (imgUpload) imgUpload.click()
        return
      }
      if (action === "sketch") {
        if (window.SketchService) SketchService.open()
        return
      }
      if (action === "voice") {
        this.toggleVoiceRecording(btn)
        return
      }
      if (action === "task") {
        this.insertTaskItem()
        return
      }
      if (action === "size") {
        if (this.els.sizePopup) this.els.sizePopup.classList.toggle("hidden")
        return
      }
      if (action === "h1") {
        document.execCommand("formatBlock", false, "h2")
        this.queueSnapshot()
        return
      }
      if (action === "ul") {
        document.execCommand("insertUnorderedList")
        this.queueSnapshot()
        return
      }
      if (action === "ol") {
        document.execCommand("insertOrderedList")
        this.queueSnapshot()
        return
      }
      if (action === "bold" || action === "italic" || action === "underline") {
        document.execCommand(action)
        this.queueSnapshot()
      }
    },

    handleContentClick(e) {
      const wrapper = e.target.closest(".media-wrapper")
      if (wrapper) {
        this.selectMedia(wrapper)
        return
      }
      this.deselectMedia()
    },

    handleContentChange(e) {
      const checkbox = e.target.closest(".task-checkbox")
      if (!checkbox) return
      const item = checkbox.closest(".task-item")
      if (item) item.classList.toggle("completed", checkbox.checked)
      this.queueSnapshot()
    },

    handleResizeStart(e) {
      const handle = e.target.closest(".media-resize-handle")
      if (!handle) return
      const wrapper = handle.closest(".media-wrapper")
      const img = wrapper?.querySelector("img")
      if (!wrapper || !img) return

      const rect = img.getBoundingClientRect()
      const contentRect = this.els.content.getBoundingClientRect()
      this.resizeState = {
        wrapper,
        startX: e.clientX,
        startWidth: rect.width,
        ratio: rect.width / Math.max(1, rect.height),
        maxWidth: contentRect.width - 40
      }

      document.addEventListener("pointermove", this.handleResize)
      document.addEventListener("pointerup", this.stopResize)
    },

    handleResize: (e) => {
      const s = Editor.resizeState
      if (!s) return
      let w = s.startWidth + (e.clientX - s.startX)
      w = Utils.snap(w, 8)
      w = Utils.clamp(w, 120, s.maxWidth)
      const h = w / s.ratio
      const img = s.wrapper.querySelector("img")
      if (!img) return
      img.style.width = `${w}px`
      img.style.height = `${h}px`
      s.wrapper.dataset.width = `${w}`
      s.wrapper.dataset.height = `${h}`
    },

    stopResize: () => {
      if (!Editor.resizeState) return
      Editor.resizeState = null
      document.removeEventListener("pointermove", Editor.handleResize)
      document.removeEventListener("pointerup", Editor.stopResize)
      Editor.queueSnapshot()
    },

    async fileToDataUrl(file) {
      return await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result || ""))
        r.onerror = () => reject()
        r.readAsDataURL(file)
      })
    },

    create() {
      this.open(null)
    },

    open(note) {
      const now = Date.now()
      state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
        id: Utils.generateId(),
        title: "",
        content: "",
        tags: [],
        folderId: null,
        order: now,
        createdAt: now,
        updatedAt: now,
        favorite: false,
        pinned: false,
        archived: false,
        locked: false
      }
      state.selectedNote = note || null
      this.history = []
      this.future = []
      this.render()
      this.snapshot()
      this.els.wrapper.classList.add("active")
      setTimeout(() => this.els.content?.focus(), 80)
    },

    close() {
      this.els.wrapper.classList.remove("active")
      state.currentNote = null
      this.deselectMedia()
    },

    render() {
      const n = state.currentNote
      if (!n) return
      this.els.title.value = n.title || ""
      this.els.content.innerHTML = n.content || ""
      this.renderTags()
      this.makeMediaDraggable()
    },

    queueSnapshot() {
      clearTimeout(this.snapshotTimer)
      this.snapshotTimer = setTimeout(() => this.snapshot(), 220)
    },

    snapshot() {
      const n = state.currentNote
      if (!n) return
      n.title = String(this.els.title.value || "")
      n.content = String(this.els.content.innerHTML || "")
      const snap = JSON.parse(JSON.stringify({ title: n.title, content: n.content, tags: n.tags }))
      this.history.push(snap)
      if (this.history.length > 80) this.history.shift()
      this.future = []
    },

    applySnapshot(snapshot) {
      if (!snapshot) return
      const n = state.currentNote
      if (!n) return
      n.title = snapshot.title || ""
      n.content = snapshot.content || ""
      n.tags = Array.isArray(snapshot.tags) ? snapshot.tags : []
      this.els.title.value = n.title
      this.els.content.innerHTML = n.content
      this.renderTags()
      this.makeMediaDraggable()
    },

    undo() {
      if (this.history.length < 2) return
      const last = this.history.pop()
      if (last) this.future.push(last)
      const prev = this.history[this.history.length - 1]
      this.applySnapshot(prev)
    },

    redo() {
      if (!this.future.length) return
      const snap = this.future.pop()
      if (!snap) return
      this.history.push(snap)
      this.applySnapshot(snap)
    },

    save() {
      const n = state.currentNote
      if (!n) return
      n.title = String(this.els.title.value || "")
      n.content = String(this.els.content.innerHTML || "")
      n.updatedAt = Date.now()
      if (!n.createdAt) n.createdAt = n.updatedAt
      if (window.AutoFolders) AutoFolders.apply(n)

      if (!Array.isArray(state.notes)) state.notes = []
      const idx = state.notes.findIndex((note) => note.id === n.id)
      if (idx >= 0) {
        state.notes[idx] = JSON.parse(JSON.stringify(n))
        state.selectedNote = state.notes[idx]
      } else {
        state.notes.unshift(JSON.parse(JSON.stringify(n)))
        state.selectedNote = state.notes[0]
      }

      if (window.App && typeof App.persist === "function") App.persist()
      if (window.UI) UI.render()
      this.close()
    },

    async deleteCurrent() {
      const n = state.currentNote
      if (!n) return
      const confirmDelete = window.App?.confirm
      let ok = true
      if (confirmDelete) ok = await confirmDelete("Удалить заметку?")
      else ok = window.confirm("Удалить заметку?")
      if (!ok) return
      state.notes = state.notes.filter((note) => note.id !== n.id)
      state.selectedNote = null
      if (window.App && typeof App.persist === "function") App.persist()
      if (window.UI) UI.render()
      this.close()
    },

    insertMedia(src) {
      const html = `<div class="media-wrapper" contenteditable="false" draggable="true"><img src="${Utils.escapeHtml(src)}"><span class="media-resize-handle"></span></div><br>`
      document.execCommand("insertHTML", false, html)
      this.queueSnapshot()
      this.makeMediaDraggable()
    },

    insertTaskItem() {
      const html = `<div class="task-item"><input type="checkbox" class="task-checkbox"><span>Новая задача</span></div><br>`
      document.execCommand("insertHTML", false, html)
      this.queueSnapshot()
    },

    makeMediaDraggable() {
      this.els.content.querySelectorAll(".media-wrapper").forEach(w => {
        w.setAttribute("draggable", "true")
      })
    },

    selectMedia(el) {
      if (this.selectedMedia) this.selectedMedia.classList.remove("selected")
      this.selectedMedia = el
      el.classList.add("selected")
      if (!this.els.ctxMenu) return
      const r = el.getBoundingClientRect()
      this.els.ctxMenu.classList.remove("hidden")
      this.els.ctxMenu.style.top = `${r.top + window.scrollY - 48}px`
      this.els.ctxMenu.style.left = `${r.left + r.width / 2 - this.els.ctxMenu.offsetWidth / 2}px`
    },

    deselectMedia() {
      if (this.selectedMedia) this.selectedMedia.classList.remove("selected")
      this.selectedMedia = null
      this.els.ctxMenu?.classList.add("hidden")
    },

    resetMediaTransform() {
      const wrapper = this.selectedMedia
      if (!wrapper) return
      const img = wrapper.querySelector("img")
      if (!img) return
      img.style.width = ""
      img.style.height = ""
      wrapper.style.float = ""
      wrapper.style.margin = ""
      delete wrapper.dataset.width
      delete wrapper.dataset.height
      this.queueSnapshot()
    },

    alignMediaOrText(position) {
      const wrapper = this.selectedMedia
      if (!wrapper) return
      const map = { left: "left", right: "right", center: "" }
      const align = map[position] || ""
      wrapper.style.float = align
      wrapper.style.margin = align ? "6px 10px" : "0"
      this.queueSnapshot()
    },

    deleteSelectedMedia() {
      if (!this.selectedMedia) return
      this.selectedMedia.remove()
      this.deselectMedia()
      this.queueSnapshot()
    },

    drawOnSelectedMedia() {
      const wrapper = this.selectedMedia
      const img = wrapper?.querySelector("img")
      if (!img || !window.PhotoEditor) return
      PhotoEditor.open(img.src, (newSrc) => {
        img.src = newSrc
        this.queueSnapshot()
      })
    },

    addTag(tag) {
      const n = state.currentNote
      if (!n) return
      n.tags = Array.isArray(n.tags) ? n.tags : []
      const t = tag.trim()
      if (!t || n.tags.map(x => x.toLowerCase()).includes(t.toLowerCase())) return
      n.tags.push(t)
      this.renderTags()
      this.queueSnapshot()
    },

    removeTag(tag) {
      const n = state.currentNote
      if (!n || !Array.isArray(n.tags)) return
      n.tags = n.tags.filter(x => x.toLowerCase() !== tag.toLowerCase())
      this.renderTags()
      this.queueSnapshot()
    },

    renderTags() {
      const n = state.currentNote
      if (!n || !this.els.tagsContainer) return
      this.els.tagsContainer.innerHTML = n.tags.map(t =>
        `<span class="tag-chip" data-tag="${Utils.escapeHtml(t)}">${Utils.escapeHtml(t)}</span>`
      ).join("")
    },

    applyFontSize() {
      const v = parseInt(this.els.sizeRange.value, 10)
      if (!v) return
      document.execCommand("fontSize", false, "7")
      this.els.content.querySelectorAll("font[size='7']").forEach(f => {
        f.removeAttribute("size")
        f.style.fontSize = `${v}px`
      })
      this.queueSnapshot()
    },

    async toggleVoiceRecording(btn) {
      if (!window.VoiceService) return
      const indicator = document.getElementById("voice-indicator")
      if (!this.recording) {
        const ok = await VoiceService.start()
        if (!ok) {
          if (window.UIToast) UIToast.show("Нет доступа к микрофону", "error")
          return
        }
        this.recording = true
        if (btn) btn.classList.add("active")
        if (indicator) indicator.setAttribute("aria-hidden", "false")
        return
      }

      const blob = await VoiceService.stop()
      this.recording = false
      if (btn) btn.classList.remove("active")
      if (indicator) indicator.setAttribute("aria-hidden", "true")
      if (!blob) return
      const url = await this.fileToDataUrl(blob)
      const html = `<audio controls src="${Utils.escapeHtml(url)}"></audio><br>`
      document.execCommand("insertHTML", false, html)
      this.queueSnapshot()
    }
  }

  window.Editor = Editor
})()
