;(() => {
  if (window.EditorTasks) return

  const toggle = () => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return

    let node = sel.getRangeAt(0).startContainer
    while (node && node.nodeType !== 1) node = node.parentElement
    if (!node) return

    const taskItem = node.closest(".task-item")
    if (taskItem) {
      const checkbox = taskItem.querySelector(".task-checkbox")
      if (checkbox) {
        checkbox.checked = !checkbox.checked
        taskItem.classList.toggle("completed", checkbox.checked)
        if (window.Editor) Editor.queueSnapshot()
      }
      return
    }

    const html = `<div class="task-item" data-task="true"><input type="checkbox" class="task-checkbox"><span>Новая задача</span></div><br>`
    document.execCommand("insertHTML", false, html)
    if (window.Editor) Editor.queueSnapshot()
  }

  window.EditorTasks = { toggle }
})()
