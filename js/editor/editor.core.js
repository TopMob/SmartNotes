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
      this.buildToolbar()
      this.bind()
    },

    bind() {
      if (this.els.title) {
        this.els.title.addEventListener("input", () => this.queueSnapshot())
      }

      if (this.els.content) {
        this.els.content.addEventListener("input", () => this.queueSnapshot())
        this.els.content.addEventListener("click", (e) => this.handleContentClick(e))
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
          this.removeTag(chip.textContent || "")
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

      const toolbarToggle = document.getElementById("toolbar-toggle")
      if (toolbarToggle && this.els.toolbar) {
        toolbarToggle.addEventListener("click", () => {
          this.els.toolbar.classList.toggle("is-hidden")
          toolbarToggle.querySelector("i").textContent = this.els.toolbar.classList.contains("is-hidden") ? "expand_more" : "expand_less"
        })
      }
    },

    handleContentClick(e) {
      const wrapper = e.target.closest(".media-wrapper")
      if (wrapper) {
        this.selectMedia(wrapper)
        return
      }
      this.deselectMedia()
      const checkbox = e.target.closest(".task-checkbox")
      if (checkbox) {
        const item = checkbox.closest(".task-item")
        if (item) item.classList.toggle("completed", checkbox.checked)
        this.queueSnapshot()
      }
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

    open(note) {
      state.selectedNote = note || null
      state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
        id: Utils.generateId(),
        title: "",
        content: "",
        tags: [],
        folderId: null,
        order: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
        favorite: false,
        archived: false,
        locked: false
      }
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

    create() {
      this.open(null)
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
      const snapshot = JSON.parse(JSON.stringify({ title: n.title, content: n.content, tags: n.tags }))
      const last = this.history[this.history.length - 1]
      if (last && JSON.stringify(last) === JSON.stringify(snapshot)) return
      this.history.push(snapshot)
      if (this.history.length > 80) this.history.shift()
      this.future = []
    },

    insertMedia(src) {
      const html = `<div class="media-wrapper" contenteditable="false" draggable="true"><img src="${Utils.escapeHtml(src)}"><span class="media-resize-handle"></span></div><br>`
      document.execCommand("insertHTML", false, html)
      this.queueSnapshot()
      this.makeMediaDraggable()
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
        `<span class="tag-chip">${Utils.escapeHtml(t)}</span>`
      ).join("")
    },

    applyFontSize() {
      const v = parseInt(this.els.sizeRange.value, 10)
      if (!v) return
      document.execCommand("fontSize", false, "7")
      this.els.content.querySelectorAll("font[size='7']").forEach(f => {
        f.removeAttribute("size")
        f.style.fontSize = `${10 + v * 2}px`
      })
      this.queueSnapshot()
    },

    undo() {
      if (this.history.length < 2) return
      const current = this.history.pop()
      this.future.push(current)
      const previous = this.history[this.history.length - 1]
      this.applySnapshot(previous)
    },

    redo() {
      if (!this.future.length) return
      const next = this.future.pop()
      this.history.push(next)
      this.applySnapshot(next)
    },

    applySnapshot(snapshot) {
      const n = state.currentNote
      if (!n || !snapshot) return
      n.title = snapshot.title || ""
      n.content = snapshot.content || ""
      n.tags = Array.isArray(snapshot.tags) ? snapshot.tags : []
      this.els.title.value = n.title
      this.els.content.innerHTML = n.content
      this.renderTags()
    },

    save() {
      const n = state.currentNote
      if (!n) return
      n.title = String(this.els.title.value || "").trim()
      n.content = String(this.els.content.innerHTML || "")
      n.tags = Array.isArray(n.tags) ? n.tags : []
      n.updatedAt = Date.now()
      if (window.AutoFolders) AutoFolders.apply(n)
      const existingIndex = state.notes.findIndex((x) => x.id === n.id)
      if (existingIndex === -1) state.notes.push(n)
      else state.notes[existingIndex] = n
      state.selectedNote = n
      localStorage.setItem("smartnotes:data:v1", JSON.stringify({ notes: state.notes, folders: state.folders, config: state.config }))
      if (window.UI) UI.render()
      if (window.UIToast) UIToast.show("Сохранено", "success")
    },

    deleteCurrent() {
      const n = state.currentNote
      if (!n) return
      if (window.UI?.confirm) {
        UI.confirm("Удалить заметку?").then((ok) => {
          if (!ok) return
          state.notes = state.notes.filter((x) => x.id !== n.id)
          localStorage.setItem("smartnotes:data:v1", JSON.stringify({ notes: state.notes, folders: state.folders, config: state.config }))
          this.close()
          if (window.UI) UI.render()
        })
      }
    },

    resetMediaTransform() {
      if (!this.selectedMedia) return
      const img = this.selectedMedia.querySelector("img")
      if (!img) return
      img.style.width = ""
      img.style.height = ""
      this.selectedMedia.style.marginLeft = ""
      this.selectedMedia.style.marginRight = ""
      delete this.selectedMedia.dataset.width
      delete this.selectedMedia.dataset.height
      this.queueSnapshot()
    },

    alignMediaOrText(direction) {
      if (!this.selectedMedia) return
      if (direction === "left") {
        this.selectedMedia.style.marginLeft = "0"
        this.selectedMedia.style.marginRight = "auto"
      }
      if (direction === "right") {
        this.selectedMedia.style.marginLeft = "auto"
        this.selectedMedia.style.marginRight = "0"
      }
      this.queueSnapshot()
    },

    drawOnSelectedMedia() {
      if (!this.selectedMedia) return
      const img = this.selectedMedia.querySelector("img")
      if (!img) return
      if (window.PhotoEditor) PhotoEditor.open(img.src, (updated) => {
        img.src = updated
        this.queueSnapshot()
      })
      if (window.UIModals) UIModals.open("photo-editor-modal")
    },

    deleteSelectedMedia() {
      if (!this.selectedMedia) return
      this.selectedMedia.remove()
      this.deselectMedia()
      this.queueSnapshot()
    },

    buildToolbar() {
      if (!this.els.toolbar) return
      this.els.toolbar.innerHTML = `
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-cmd="bold" aria-label="Жирный"><i class="material-icons-round" aria-hidden="true">format_bold</i></button></div>
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-cmd="italic" aria-label="Курсив"><i class="material-icons-round" aria-hidden="true">format_italic</i></button></div>
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-cmd="underline" aria-label="Подчеркнутый"><i class="material-icons-round" aria-hidden="true">format_underlined</i></button></div>
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-cmd="insertUnorderedList" aria-label="Список"><i class="material-icons-round" aria-hidden="true">format_list_bulleted</i></button></div>
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-action="task" aria-label="Задача"><i class="material-icons-round" aria-hidden="true">check_box</i></button></div>
        <div class="tool-wrapper"><label class="tool-btn" aria-label="Изображение"><i class="material-icons-round" aria-hidden="true">image</i><input class="hidden-color-input" type="file" accept="image/*"></label></div>
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-action="sketch" aria-label="Рисунок"><i class="material-icons-round" aria-hidden="true">draw</i></button></div>
        <div class="tool-wrapper"><button type="button" class="tool-btn" data-action="font" aria-label="Размер текста"><i class="material-icons-round" aria-hidden="true">format_size</i></button></div>
      `
      this.els.toolbar.addEventListener("click", (e) => {
        const btn = e.target.closest(".tool-btn")
        if (!btn) return
        const cmd = btn.dataset.cmd
        const action = btn.dataset.action
        if (cmd) {
          document.execCommand(cmd, false, null)
          this.queueSnapshot()
        }
        if (action === "task" && window.EditorTasks) EditorTasks.toggle()
        if (action === "sketch" && window.SketchService) {
          SketchService.open()
          if (window.UIModals) UIModals.open("sketch-modal")
        }
        if (action === "font" && this.els.sizePopup) {
          this.els.sizePopup.classList.toggle("hidden")
        }
      })

      const fileInput = this.els.toolbar.querySelector("input[type='file']")
      if (fileInput) {
        fileInput.addEventListener("change", async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const url = await this.fileToDataUrl(f)
          this.insertMedia(url)
          fileInput.value = ""
        })
      }
    }
  }

  window.Editor = Editor
})()
