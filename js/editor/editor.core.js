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
        if (item) item.classList.toggle("checked", checkbox.checked)
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
      state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
        id: Utils.generateId(),
        title: "",
        content: "",
        tags: [],
        folderId: null,
        order: Date.now()
      }
      this.history = []
      this.future = []
      this.render()
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
      this.history.push(JSON.parse(JSON.stringify({ title: n.title, content: n.content, tags: n.tags })))
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
    }
  }

  window.Editor = Editor
})()
