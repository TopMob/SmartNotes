const App = (() => {
  const state = {
    user: null,
    notes: [],
    folders: [],
    activeView: 'notes',
    activeFolder: null,
    activeNote: null,
    ui: {
      sidebarOpen: true,
      modal: null,
      theme: {
        preset: 'default',
        accent: '#00ffcc',
        bg: '#0a0a0a'
      }
    }
  }

  const els = {}

  function cache() {
    const ids = [
      'sidebar','menu-open','add-note','notes-grid','search','editor','editor-back','note-title','note-text','note-tags','note-datetime','archive-note','delete-note','priority','pin','folder-modal','create-folder-btn','folder-name','folder-color','folder-create','folder-cancel','settings-modal','open-settings','settings-close','accent-color','bg-color','advanced-palette','feedback-modal','open-feedback','feedback-close','feedback-text','feedback-send','confirm-switch','switch-account','switch-confirm','switch-cancel','confirm-signout','sign-out','signout-confirm','signout-cancel','profile-menu','avatar'
    ]
    ids.forEach(id => els[id] = document.getElementById(id))
    els.notesView = document.getElementById('notes-view')
    els.foldersList = document.getElementById('folders-list')
    els.modalLayer = document.getElementById('modal-layer')
  }

  function bind() {
    els.menuOpen.onclick = toggleSidebar
    els.addNote.onclick = createNote
    els.editorBack.onclick = closeEditor
    els.archiveNote.onclick = toggleArchive
    els.deleteNote.onclick = deleteNote
    els.priority.onclick = cyclePriority
    els.pin.onclick = togglePin
    els.createFolderBtn.onclick = () => openModal('folder-modal')
    els.folderCancel.onclick = () => closeModal('folder-modal')
    els.folderCreate.onclick = createFolder
    els.openSettings.onclick = () => openModal('settings-modal')
    els.settingsClose.onclick = () => closeModal('settings-modal')
    els.openFeedback.onclick = () => openModal('feedback-modal')
    els.feedbackClose.onclick = () => closeModal('feedback-modal')
    els.feedbackSend.onclick = submitFeedback
    els.switchAccount.onclick = () => openModal('confirm-switch')
    els.switchCancel.onclick = () => closeModal('confirm-switch')
    els.switchConfirm.onclick = switchAccount
    els.signOut.onclick = () => openModal('confirm-signout')
    els.signoutCancel.onclick = () => closeModal('confirm-signout')
    els.signoutConfirm.onclick = signOut
    els.search.oninput = handleSearch
    els.avatar.onclick = toggleProfile
    document.addEventListener('keydown', handleKeys)
  }

  function init() {
    cache()
    bind()
    load()
    render()
  }

  function load() {
    const saved = localStorage.getItem('smartnotes')
    if (saved) Object.assign(state, JSON.parse(saved))
  }

  function save() {
    localStorage.setItem('smartnotes', JSON.stringify(state))
  }

  function render() {
    renderFolders()
    renderNotes()
    applyTheme()
  }

  function renderNotes(list = null) {
    els.notesGrid.innerHTML = ''
    const notes = list || state.notes
    notes.filter(n => state.activeView === 'archive' ? n.archived : !n.archived)
      .filter(n => !state.activeFolder || n.folder === state.activeFolder)
      .sort(sortNotes)
      .forEach(n => els.notesGrid.appendChild(noteCard(n)))
  }

  function noteCard(note) {
    const d = document.createElement('div')
    d.className = 'note-card'
    if (note.pinned) d.classList.add('pinned')
    d.onclick = () => openEditor(note.id)
    const t = document.createElement('div')
    t.className = 'note-title'
    t.textContent = note.title || 'Без названия'
    const p = document.createElement('div')
    p.className = 'note-preview'
    p.textContent = note.text.slice(0, 200)
    const f = document.createElement('div')
    f.className = 'note-footer'
    const tags = document.createElement('div')
    tags.className = 'note-tags'
    note.tags.forEach(tag => {
      const s = document.createElement('span')
      s.className = 'tag-pill'
      s.textContent = tag
      tags.appendChild(s)
    })
    const date = document.createElement('div')
    date.className = 'note-date'
    date.textContent = new Date(note.updated).toLocaleString()
    f.append(tags, date)
    d.append(t, p, f)
    return d
  }

  function renderFolders() {
    els.foldersList.innerHTML = ''
    state.folders.forEach(f => {
      const b = document.createElement('div')
      b.className = 'folder-item'
      if (state.activeFolder === f.id) b.classList.add('active')
      b.onclick = () => { state.activeFolder = f.id; renderNotes(); save() }
      const info = document.createElement('div')
      info.className = 'folder-info'
      const dot = document.createElement('span')
      dot.className = 'folder-dot'
      dot.style.background = f.color
      const name = document.createElement('span')
      name.className = 'folder-name-text'
      name.textContent = f.name
      info.append(dot, name)
      b.appendChild(info)
      els.foldersList.appendChild(b)
    })
  }

  function createNote() {
    const id = crypto.randomUUID()
    const n = { id, title: '', text: '', tags: [], folder: state.activeFolder, archived: false, pinned: false, priority: 0, created: Date.now(), updated: Date.now() }
    state.notes.push(n)
    openEditor(id)
    save()
  }

  function openEditor(id) {
    const n = state.notes.find(x => x.id === id)
    if (!n) return
    state.activeNote = id
    els.noteTitle.value = n.title
    els.noteText.value = n.text
    els.noteTags.value = n.tags.join(' ')
    els.noteDatetime.value = n.datetime || ''
    openModal('editor')
  }

  function closeEditor() {
    if (!state.activeNote) return
    const n = state.notes.find(x => x.id === state.activeNote)
    n.title = els.noteTitle.value
    n.text = els.noteText.value
    n.tags = els.noteTags.value.split(/\s+/).filter(Boolean)
    n.datetime = els.noteDatetime.value
    n.updated = Date.now()
    state.activeNote = null
    closeModal('editor')
    renderNotes()
    save()
  }

  function toggleArchive() {
    const n = getActiveNote()
    if (!n) return
    n.archived = !n.archived
    closeEditor()
  }

  function deleteNote() {
    const id = state.activeNote
    state.notes = state.notes.filter(n => n.id !== id)
    state.activeNote = null
    closeModal('editor')
    renderNotes()
    save()
  }

  function cyclePriority() {
    const n = getActiveNote()
    if (!n) return
    n.priority = (n.priority + 1) % 4
    save()
  }

  function togglePin() {
    const n = getActiveNote()
    if (!n) return
    n.pinned = !n.pinned
    save()
  }

  function sortNotes(a, b) {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned
    if (a.priority !== b.priority) return b.priority - a.priority
    return b.updated - a.updated
  }

  function handleSearch(e) {
    const q = e.target.value.trim().toLowerCase()
    if (!q) return renderNotes()
    const tags = q.match(/#\w+/g)?.map(t => t.slice(1)) || []
    const text = q.replace(/#\w+/g, '').trim()
    const res = state.notes.filter(n => {
      const textOk = text ? (n.title + ' ' + n.text).toLowerCase().includes(text) : true
      const tagsOk = tags.length ? tags.every(t => n.tags.includes(t)) : true
      return textOk && tagsOk
    })
    renderNotes(res)
  }

  function createFolder() {
    const name = els.folderName.value.trim()
    if (!name) return
    const f = { id: crypto.randomUUID(), name, color: els.folderColor.value }
    state.folders.push(f)
    els.folderName.value = ''
    closeModal('folder-modal')
    renderFolders()
    save()
  }

  function toggleSidebar() {
    state.ui.sidebarOpen = !state.ui.sidebarOpen
    els.sidebar.classList.toggle('closed', !state.ui.sidebarOpen)
    save()
  }

  function openModal(id) {
    els.modalLayer.hidden = false
    const m = document.getElementById(id)
    m.hidden = false
    state.ui.modal = id
  }

  function closeModal(id) {
    const m = document.getElementById(id)
    if (m) m.hidden = true
    els.modalLayer.hidden = true
    state.ui.modal = null
  }

  function toggleProfile() {
    els.profileMenu.hidden = !els.profileMenu.hidden
  }

  function submitFeedback() {
    els.feedbackText.value = ''
    closeModal('feedback-modal')
  }

  function switchAccount() {
    closeModal('confirm-switch')
  }

  function signOut() {
    closeModal('confirm-signout')
  }

  function handleKeys(e) {
    if (e.key === 'Escape' && state.ui.modal) closeModal(state.ui.modal)
  }

  function applyTheme() {
    document.documentElement.style.setProperty('--primary', state.ui.theme.accent)
    document.documentElement.style.setProperty('--bg', state.ui.theme.bg)
  }

  function getActiveNote() {
    return state.notes.find(n => n.id === state.activeNote)
  }

  return { init }
})()

document.addEventListener('DOMContentLoaded', App.init)
