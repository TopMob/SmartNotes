(() => {
    if (String(window.location?.protocol || "") !== "file:") return
    const iconMap = {
        add: "+",
        close: "×",
        menu: "☰",
        description: "📝",
        star: "★",
        archive: "🗄",
        schedule: "⏰",
        delete: "🗑",
        folder: "📁",
        groups: "👥",
        create_new_folder: "📂",
        lock: "🔒",
        visibility_off: "🙈",
        admin_panel_settings: "🛡",
        forum: "💬",
        settings: "⚙",
        more_vert: "⋮",
        edit: "✎",
        arrow_back: "←",
        save: "💾",
        download: "⤓",
        share: "⤴",
        content_copy: "⎘",
        check: "✓",
        search: "⌕",
        tune: "⚙",
        filter_list: "☰",
        image: "🖼",
        link: "🔗",
        bold: "B",
        format_italic: "I",
        format_underlined: "U"
    }
    const applyIcons = () => {
        const nodes = document.querySelectorAll("i.material-icons-round")
        nodes.forEach((node) => {
            const key = String(node.textContent || "").trim()
            if (!key) return
            const glyph = iconMap[key] || key
            node.textContent = glyph
            node.classList.add("local-icon-fallback")
        })
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyIcons)
        return
    }
    applyIcons()
})()
