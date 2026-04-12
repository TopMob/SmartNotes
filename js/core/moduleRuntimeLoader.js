(() => {
    const protocol = String(window.location?.protocol || "")
    if (protocol === "file:") return
    const moduleScripts = [
        "js/lang.js?v=2026-02-22-1e1b181",
        "js/theme.js?v=2026-02-22-1e1b181",
        "js/core.js?v=2026-02-22-1e1b181",
        "js/notes/text.js?v=2026-02-22-1e1b181",
        "js/editor/core.js?v=2026-02-22-1e1b181"
    ]
    moduleScripts.forEach((src) => {
        const script = document.createElement("script")
        script.type = "module"
        script.src = src
        document.head.appendChild(script)
    })
})()
