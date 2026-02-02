;(() => {
  if (window.NoteLock) return

  let unlocked = false

  const hasLock = (note) => !!note?.locked

  const canShow = (note) => {
    if (!hasLock(note)) return true
    return unlocked
  }

  const unlock = (password) => {
    const saved = localStorage.getItem("master-lock")
    if (!saved) return false
    if (saved === password) {
      unlocked = true
      return true
    }
    return false
  }

  const setPassword = (password) => {
    localStorage.setItem("master-lock", password)
  }

  const lockNote = (note) => {
    note.locked = true
  }

  const unlockSession = () => {
    unlocked = true
  }

  window.NoteLock = {
    canShow,
    unlock,
    setPassword,
    lockNote,
    unlockSession
  }
})()
