(() => {
  if (window.VoiceService) return

  let recorder = null
  let chunks = []
  let stream = null

  const start = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorder = new MediaRecorder(stream)
      chunks = []
      recorder.ondataavailable = (e) => {
        if (e?.data?.size) chunks.push(e.data)
      }
      recorder.start()
      return true
    } catch {
      stream = null
      recorder = null
      chunks = []
      return false
    }
  }

  const stop = () => {
    return new Promise((resolve) => {
      if (!recorder) {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          stream = null
        }
        return resolve(null)
      }

      const r = recorder
      recorder = null

      r.onstop = () => {
        const blob = chunks.length ? new Blob(chunks, { type: "audio/webm" }) : null
        chunks = []
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          stream = null
        }
        resolve(blob)
      }

      try {
        r.stop()
      } catch {
        chunks = []
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          stream = null
        }
        resolve(null)
      }
    })
  }

  window.VoiceService = { start, stop }
})()
