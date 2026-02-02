;(() => {
  if (window.NoteShare) return

  const createLink = (note) => {
    const payload = {
      id: note.id,
      owner: state.user?.uid,
      t: Date.now()
    }
    return `${location.origin}${location.pathname}?share=${btoa(JSON.stringify(payload))}`
  }

  const readLink = () => {
    const q = new URLSearchParams(location.search)
    if (!q.has("share")) return null
    try {
      return JSON.parse(atob(q.get("share")))
    } catch {
      return null
    }
  }

  window.NoteShare = { createLink, readLink }
})()
