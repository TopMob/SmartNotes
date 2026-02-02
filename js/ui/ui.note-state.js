;(() => {
  if (window.UINoteState) return

  const apply = (el, note) => {
    el.classList.toggle("pinned", !!note.pinned)
    el.classList.toggle("favorite", !!note.favorite)
    el.classList.toggle("archived", !!note.archived)
  }

  window.UINoteState = { apply }
})()
