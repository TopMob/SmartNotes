;(() => {
  if (window.UINoteVisibility) return

  const filter = (notes) => {
    if (!window.NoteLock) return notes
    return notes.filter(n => NoteLock.canShow(n))
  }

  window.UINoteVisibility = { filter }
})()
