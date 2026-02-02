(() => {
  if (window.DriveService) return

  let tokenClient = null
  let accessToken = null

  const init = () => {
    if (!window.google || !google.accounts?.oauth2) return false
    if (!window.DRIVE_CLIENT_ID) return false

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.DRIVE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp) => {
        accessToken = resp?.access_token || null
      }
    })
    return true
  }

  const ensureToken = async () => {
    if (accessToken) return accessToken

    if (!tokenClient) {
      const ok = init()
      if (!ok) return null
    }

    return await new Promise((resolve) => {
      try {
        tokenClient.callback = (resp) => {
          accessToken = resp?.access_token || null
          resolve(accessToken)
        }
        tokenClient.requestAccessToken({ prompt: "" })
      } catch {
        resolve(null)
      }
    })
  }

  const safeName = (name) => {
    const base = String(name || "note").trim() || "note"
    const cleaned = base.replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim()
    return (cleaned || "note").slice(0, 64)
  }

  const upload = async (note) => {
    try {
      const token = await ensureToken()
      if (!token) {
        if (window.UIToast) UIToast.show("Drive недоступен", "error")
        return
      }

      const metadata = {
        name: `${safeName(note?.title)}.txt`,
        mimeType: "text/plain"
      }

      const body = Utils.stripHtml(note?.content || "")
      const form = new FormData()
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
      form.append("file", new Blob([body], { type: "text/plain;charset=utf-8" }))

      const resp = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      })

      if (!resp.ok) {
        if (window.UIToast) UIToast.show("Ошибка загрузки в Drive", "error")
        return
      }

      if (window.UIToast) UIToast.show("Загружено в Drive", "success")
    } catch {
      if (window.UIToast) UIToast.show("Ошибка загрузки в Drive", "error")
    }
  }

  window.DriveService = { init, upload }
})()
