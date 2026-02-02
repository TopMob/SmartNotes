;(() => {
  if (window.EditorTasks) return

  const toggle = () => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    let node = sel.getRangeAt(0).startContainer
    while (node && node.nodeType !== 1) node = node.parentElement
    if (!node) return

    const active = node.dataset.task === "true"
    if (active) {
      delete node.dataset.task
      node.classList.remove("task-item")
    } else {
      node.dataset.task = "true"
      node.classList.add("task-item")
    }

    if (window.Editor) Editor.queueSnapshot()
  }

  window.EditorTasks = { toggle }
})()
