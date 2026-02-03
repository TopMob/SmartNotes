;(() => {
  if (window.NoteLock) return

  let unlocked = false

  const hasLock = (note) => !!note?.locked

  const canShow = (note) => {
    if (!hasLock(note)) return true
    return unlocked
  }

  const hashPassword = async (password, method) => {
    const base = String(password || "")
    if (!base) return ""
    if (method === "plain") return `plain:${btoa(unescape(encodeURIComponent(base)))}`
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(base)
      const hash = await crypto.subtle.digest("SHA-256", data)
      const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("")
      return `sha256:${hex}`
    }
    return `plain:${btoa(unescape(encodeURIComponent(base)))}`
  }

  const unlock = async (password) => {
    const saved = localStorage.getItem("master-lock")
    if (!saved) return false
    const method = saved.startsWith("sha256:") ? "sha256" : "plain"
    const candidate = await hashPassword(password, method)
    if (candidate === saved) {
      unlocked = true
      return true
    }
    return false
  }

  const setPassword = async (password) => {
    const hashed = await hashPassword(password)
    if (!hashed) return
    localStorage.setItem("master-lock", hashed)
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
