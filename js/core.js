const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    debounce: (func, wait) => {
        let timeout = null
        return function (...args) {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => func.apply(this, args), wait)
        }
    },
    formatDate: (timestamp) => {
        if (!timestamp) return ""
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
        const lang = (window.StateStore && StateStore.read().config && StateStore.read().config.lang) || "ru"
        try {
            return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
        } catch {
            return date.toLocaleDateString()
        }
    },
    stripHtml: (html) => {
        if (!html) return ""
        const tmp = document.createElement("div")
        tmp.innerHTML = html
        return tmp.textContent || tmp.innerText || ""
    },
    escapeHtml: (value) => {
        if (value === null || value === undefined) return ""
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    },
    adjustColor: (col, amt) => {
        if (!col) return "#000000"
        let c = String(col).trim()
        let usePound = false
        if (c[0] === "#") {
            c = c.slice(1)
            usePound = true
        }
        if (c.length === 3) c = c.split("").map(x => x + x).join("")
        if (!/^[0-9a-fA-F]{6}$/.test(c)) return (usePound ? "#" : "") + "000000"
        const num = parseInt(c, 16)
        let r = (num >> 16) + amt
        let g = ((num >> 8) & 0x00ff) + amt
        let b = (num & 0x0000ff) + amt
        r = Math.min(255, Math.max(0, r))
        g = Math.min(255, Math.max(0, g))
        b = Math.min(255, Math.max(0, b))
        return (usePound ? "#" : "") + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")
    },
    hexToRgb: (hex) => {
        if (!hex) return null
        let c = String(hex).trim()
        if (c[0] === "#") c = c.slice(1)
        if (c.length === 3) c = c.split("").map(x => x + x).join("")
        if (!/^[0-9a-fA-F]{6}$/.test(c)) return null
        const num = parseInt(c, 16)
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
    },
    serverTimestamp: () => {
        if (typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue) {
            return firebase.firestore.FieldValue.serverTimestamp()
        }
        return Date.now()
    },
    sanitizeHtml: (html) => {
        const allowedTags = new Set(["b","strong","i","em","u","br","p","div","ul","ol","li","span","img","a","input"])
        const allowedClasses = new Set(["task-item","task-checkbox","task-text","completed","media-wrapper","media-resize-handle","align-left","align-right"])
        const allowAttrs = {
            a: new Set(["href"]),
            img: new Set(["src","alt"]),
            input: new Set(["type","checked"])
        }
        const wrapper = document.createElement("div")
        wrapper.innerHTML = String(html || "")

        const isSafeUrl = (value) => {
            const v = String(value || "").trim()
            if (!v) return false
            if (v.startsWith("data:image")) return true
            if (v.startsWith("https://")) return true
            if (v.startsWith("http://")) return true
            if (v.startsWith("mailto:")) return true
            return false
        }

        const walk = (node) => {
            const children = Array.from(node.childNodes)
            children.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName.toLowerCase()
                    if (!allowedTags.has(tag)) {
                        const textNode = document.createTextNode(child.textContent || "")
                        child.replaceWith(textNode)
                        return
                    }

                    Array.from(child.attributes).forEach(attr => {
                        const name = attr.name.toLowerCase()
                        if (name.startsWith("on") || name === "style") {
                            child.removeAttribute(attr.name)
                            return
                        }
                        if (name === "class") {
                            const safe = String(attr.value || "")
                                .split(/\s+/)
                                .filter(cls => allowedClasses.has(cls))
                            if (safe.length) child.setAttribute("class", safe.join(" "))
                            else child.removeAttribute("class")
                            return
                        }
                        const allowed = allowAttrs[tag]
                        if (!allowed || !allowed.has(name)) {
                            child.removeAttribute(attr.name)
                        }
                    })

                    if (tag === "a") {
                        const href = child.getAttribute("href")
                        if (!isSafeUrl(href) || href.startsWith("data:")) {
                            child.removeAttribute("href")
                        } else if (href.startsWith("http")) {
                            child.setAttribute("rel", "noopener noreferrer")
                            child.setAttribute("target", "_blank")
                        }
                    }

                    if (tag === "img") {
                        const src = child.getAttribute("src")
                        if (!isSafeUrl(src) || (src.startsWith("data:") && !src.startsWith("data:image")) || src.startsWith("http:")) {
                            child.removeAttribute("src")
                        }
                    }

                    if (tag === "input") {
                        const type = child.getAttribute("type")
                        if (String(type || "").toLowerCase() !== "checkbox") {
                            child.removeAttribute("type")
                        }
                        if (child.hasAttribute("checked")) {
                            child.setAttribute("checked", "")
                        }
                    }

                    walk(child)
                }
            })
        }

        walk(wrapper)
        return wrapper.innerHTML
    }
}

const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
}

const DRIVE_CLIENT_ID = "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file"

let auth = null
let db = null

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    auth = firebase.auth()
    db = firebase.firestore()
    db.enablePersistence({ synchronizeTabs: true }).catch(() => null)
}

const LANG = {
    ru: {
        app_name: "SmartNotes",
        slogan: "Ваши мысли. В порядке.",
        login: "Вход в систему",
        login_google: "Войти через Google",
        all_notes: "Все записи",
        favorites: "Важное",
        archive: "Архив",
        folders: "ПАПКИ",
        folders_overview: "Папки",
        about: "О нас",
        rate: "Оценить",
        settings: "Настройки",
        switch_acc: "Сменить",
        logout: "Выйти",
        empty: "Здесь пока пусто",
        general: "Общие",
        language: "Язык",
        appearance: "Внешний вид",
        presets: "Пресеты",
        manual: "Ручная настройка",
        c_text: "Текст",
        c_accent: "Акцент",
        c_bg: "Фон",
        reset: "Сбросить",
        close: "Закрыть",
        save: "Сохранить",
        team: "Команда",
        contact_us: "Связаться с нами:",
        send: "Отправить",
        cancel: "Отмена",
        yes: "Да",
        search: "Поиск...",
        note_title: "Заголовок",
        note_tags: "#тег (Enter)",
        feedback_placeholder: "Поделитесь впечатлениями...",
        note_actions: "Действия",
        download_note: "Скачать файл",
        upload_note: "Отправить в облако",
        photo_editor: "Редактор фото",
        folders_settings: "Папки",
        folder_view_mode: "Отображение",
        folder_view_compact: "В боковой панели",
        folder_view_full: "Полный экран",
        reduce_motion: "Уменьшить анимации",
        visual_effects: "Визуальные эффекты",
        editor_settings: "Настройки редактора",
        view_notes: "Все записи",
        view_favorites: "Важное",
        view_archive: "Архив",
        view_folder: "Папка",
        view_folders: "Папки",
        note_single: "заметка",
        note_plural: "заметок",
        folders_empty: "Нет папок",
        pin_note: "Закрепить",
        favorite_note: "Важное",
        archive_note: "Архивировать",
        untitled_note: "Без названия",
        empty_note: "Нет содержимого",
        locked_note: "Защищено",
        new_folder: "Новая папка",
        folder_placeholder: "Название...",
        folder_empty: "Введите название папки",
        folder_exists: "Папка уже существует",
        folder_limit: "Лимит папок достигнут",
        archived: "В архиве",
        restored: "Восстановлено",
        saving: "Сохранение...",
        saved: "Сохранено",
        rate_required: "Поставьте оценку",
        feedback_thanks: "Спасибо!",
        order_updated: "Порядок обновлен",
        undo: "Отменить",
        import_file: "Импортировать файл",
        import_invalid: "Неверный формат файла",
        import_empty: "Файлы не содержат заметок",
        import_success: "Импортировано",
        import_failed: "Ошибка импорта",
        download_success: "Файл сохранен",
        drive_connected: "Google Drive подключен",
        drive_unavailable: "Сервис Drive недоступен",
        drive_saved: "Загружено в Drive",
        drive_error: "Ошибка синхронизации",
        share_invalid: "Ссылка недействительна",
        share_missing: "Заметка не найдена",
        share_title: "Ссылка",
        mic_unsupported: "Микрофон не поддерживается",
        mic_denied: "Нет доступа к микрофону",
        recording: "Запись...",
        reminder_set: "Напоминание",
        confirm_delete: "Удалить?",
        confirm_exit: "Выйти?",
        confirm_account: "Сменить аккаунт?",
        confirm_delete_folder: "Удалить папку?",
        confirm_default: "Подтвердите",
        auth_unavailable: "Авторизация недоступна",
        move_toolbar: "Переместить панель",
        toolbar_show: "Показать панель инструментов",
        toolbar_hide: "Скрыть панель инструментов",
        tool_bold: "Жирный",
        tool_italic: "Курсив",
        tool_underline: "Подчеркнуть",
        tool_bullets: "Маркированный список",
        tool_numbered: "Нумерованный список",
        tool_task: "Задача",
        tool_image: "Изображение",
        tool_clear: "Очистить формат",
        task_item: "Задача",
        system_override: "System Override",
        close_menu: "Закрыть меню",
        add_folder: "Создать папку",
        open_menu: "Открыть меню",
        search_aria: "Поиск заметок",
        create_note: "Создать заметку",
        create_folder: "Создать папку",
        editor: "Редактор",
        back: "Назад",
        redo: "Повторить",
        delete_note: "Удалить заметку",
        note_title_aria: "Заголовок заметки",
        note_body_aria: "Текст заметки",
        note_tags_aria: "Добавить тег",
        save_note: "Сохранить",
        prompt_title: "Ввод",
        prompt_input: "Поле ввода",
        ok: "ОК",
        insert: "Вставить",
        sketch_title: "Холст",
        sketch_color: "Цвет кисти",
        sketch_width: "Толщина кисти",
        sketch_undo: "Отменить штрих",
        sketch_clear: "Очистить",
        align_left: "По левому краю",
        align_center: "По центру",
        align_right: "По правому краю",
        reset_media: "Сбросить размер",
        draw_photo: "Рисовать на фото",
        delete: "Удалить",
        photo_color: "Цвет кисти",
        photo_width: "Толщина кисти",
        clear: "Очистить",
        folder_view_aria: "Режим отображения папок",
        color_text: "Цвет текста",
        color_accent: "Акцентный цвет",
        color_bg: "Цвет фона",
        feedback_aria: "Ваш отзыв",
        theme_light: "Светлая",
        theme_dark: "Темная",
        theme_system: "Системная",
        theme_high_contrast: "Высокий контраст",
        theme_oled: "OLED",
        theme_monochrome: "Монохром",
        theme_pastel: "Пастель",
        theme_warm: "Теплая",
        theme_cold: "Холодная",
        theme_minimal: "Минимал",
        theme_compact: "Компактная",
        theme_spacious: "Просторная",
        theme_accessibility: "Доступность",
        theme_glass: "Стекло",
        theme_matte: "Матовая",
        theme_neon: "Неон",
        theme_paper: "Бумага",
        theme_sunrise: "Рассвет",
        theme_ocean: "Океан",
        settings_menu_title: "Настройки",
        settings_general: "Общие",
        settings_appearance: "Внешний вид",
        settings_editor_tools: "Инструменты редактора",
        settings_back: "Назад",
        settings_category_general_desc: "Язык, папки и анимация",
        settings_category_appearance_desc: "Темы и цвета интерфейса",
        settings_category_editor_tools_desc: "Панель инструментов",
        smart_features: "УМНЫЕ ФУНКЦИИ",
        lock_center: "Защита заметок",
        lock_center_desc: "Тут будут фильтры скрытых заметок и быстрые действия",
        share_desc: "Ссылка будет сгенерирована и появится здесь",
        share_modal_title: "Поделиться",
        collab_title: "Совместное редактирование",
        collab_desc: "Одноразовая ссылка будет сгенерирована и появится здесь",
        copy: "Копировать",
        apply: "Применить",
        lock_title: "Блокировка",
        lock_password: "Пароль",
        lock_password_empty: "Пароль пустой",
        lock_invalid_password: "Неверный пароль",
        lock_hidden: "Заметка скрыта",
        note_deleted: "Удалено",
        folder_deleted: "Папка удалена",
        feedback_failed: "Не удалось отправить отзыв",
        reorder_search_disabled: "Сортировка недоступна при поиске",
        reorder_pinned_blocked: "Закрепленные заметки сортируются отдельно",
        collab_enabled: "Совместный режим включен",
        share_note: "Поделиться заметкой",
        collab_note: "Совместное редактирование",
        lock_note: "Заблокировать заметку",
        nav_aria: "Навигация",
        sections_aria: "Разделы",
        notes_list_aria: "Список заметок",
        user_menu: "Пользователь",
        editor_actions: "Действия редактора",
        editor_toolbar: "Инструменты редактора",
        tags_aria: "Теги",
        media_menu: "Меню изображения",
        rating_aria: "Оценка",
        login_aria: "Авторизация",
        theme_dark_default: "Темная",
        theme_graphite: "Графит",
        theme_neon_cyan: "Неоновый циан",
        theme_emerald_calm: "Изумрудный покой",
        theme_violet_pulse: "Фиолетовый импульс",
        theme_ocean_deep: "Глубокий океан",
        theme_oled_pure: "OLED черный",
        theme_manual: "Вручную",
        auth_popup_closed: "Вход отменен",
        auth_network_failed: "Нет соединения с интернетом",
        auth_cancelled: "Запрос отменен",
        logout_failed: "Ошибка при выходе",
        login_failed: "Ошибка входа",
        draw_photo_hint: "Откройте редактор фото",
        password_title: "Пароль",
        password_prompt: "Введите пароль"
    },
    en: {
        app_name: "SmartNotes",
        slogan: "Your thoughts. Organized.",
        login: "Sign in",
        login_google: "Sign in with Google",
        all_notes: "All Notes",
        favorites: "Important",
        archive: "Archive",
        folders: "FOLDERS",
        folders_overview: "Folders",
        about: "About",
        rate: "Rate Us",
        settings: "Settings",
        switch_acc: "Switch",
        logout: "Logout",
        empty: "Nothing here yet",
        general: "General",
        language: "Language",
        appearance: "Appearance",
        presets: "Presets",
        manual: "Manual Config",
        c_text: "Text",
        c_accent: "Accent",
        c_bg: "Background",
        reset: "Reset",
        close: "Close",
        save: "Save",
        team: "Team",
        contact_us: "Contact us:",
        send: "Send",
        cancel: "Cancel",
        yes: "Yes",
        search: "Search...",
        note_title: "Title",
        note_tags: "#tag (Enter)",
        feedback_placeholder: "Share your feedback...",
        note_actions: "Actions",
        download_note: "Download file",
        upload_note: "Upload to cloud",
        photo_editor: "Photo Editor",
        folders_settings: "Folders",
        folder_view_mode: "Display",
        folder_view_compact: "Sidebar list",
        folder_view_full: "Full view",
        reduce_motion: "Reduce motion",
        visual_effects: "Visual effects",
        editor_settings: "Editor settings",
        view_notes: "All Notes",
        view_favorites: "Important",
        view_archive: "Archive",
        view_folder: "Folder",
        view_folders: "Folders",
        note_single: "note",
        note_plural: "notes",
        folders_empty: "No folders yet",
        pin_note: "Pin",
        favorite_note: "Favorite",
        archive_note: "Archive",
        untitled_note: "Untitled",
        empty_note: "No content",
        locked_note: "Locked",
        new_folder: "New folder",
        folder_placeholder: "Folder name",
        folder_empty: "Enter a folder name",
        folder_exists: "Folder already exists",
        folder_limit: "Folder limit reached",
        archived: "Archived",
        restored: "Restored",
        saving: "Saving...",
        saved: "Saved",
        rate_required: "Please rate the app",
        feedback_thanks: "Thanks!",
        order_updated: "Order updated",
        undo: "Undo",
        import_file: "Import file",
        import_invalid: "Unsupported file",
        import_empty: "No notes found",
        import_success: "Imported",
        import_failed: "Import failed",
        download_success: "File saved",
        drive_connected: "Drive connected",
        drive_unavailable: "Drive unavailable",
        drive_saved: "Uploaded to Drive",
        drive_error: "Drive upload failed",
        share_invalid: "Invalid link",
        share_missing: "Note not found",
        share_title: "Link",
        mic_unsupported: "Microphone not supported",
        mic_denied: "Microphone access denied",
        recording: "Recording...",
        reminder_set: "Reminder set",
        confirm_delete: "Delete?",
        confirm_exit: "Sign out?",
        confirm_account: "Switch account?",
        confirm_delete_folder: "Delete folder?",
        confirm_default: "Confirm",
        auth_unavailable: "Authentication unavailable",
        move_toolbar: "Move toolbar",
        toolbar_show: "Show toolbar",
        toolbar_hide: "Hide toolbar",
        tool_bold: "Bold",
        tool_italic: "Italic",
        tool_underline: "Underline",
        tool_bullets: "Bulleted list",
        tool_numbered: "Numbered list",
        tool_task: "Task",
        tool_image: "Image",
        tool_clear: "Clear formatting",
        task_item: "Task",
        system_override: "System Override",
        close_menu: "Close menu",
        add_folder: "Create folder",
        open_menu: "Open menu",
        search_aria: "Search notes",
        create_note: "Create note",
        create_folder: "Create folder",
        editor: "Editor",
        back: "Back",
        redo: "Redo",
        delete_note: "Delete note",
        note_title_aria: "Note title",
        note_body_aria: "Note body",
        note_tags_aria: "Add tag",
        save_note: "Save",
        prompt_title: "Input",
        prompt_input: "Input field",
        ok: "OK",
        insert: "Insert",
        sketch_title: "Canvas",
        sketch_color: "Brush color",
        sketch_width: "Brush width",
        sketch_undo: "Undo stroke",
        sketch_clear: "Clear",
        align_left: "Align left",
        align_center: "Align center",
        align_right: "Align right",
        reset_media: "Reset size",
        draw_photo: "Draw on photo",
        delete: "Delete",
        photo_color: "Brush color",
        photo_width: "Brush width",
        clear: "Clear",
        folder_view_aria: "Folder view mode",
        color_text: "Text color",
        color_accent: "Accent color",
        color_bg: "Background color",
        feedback_aria: "Your feedback",
        theme_light: "Light",
        theme_dark: "Dark",
        theme_system: "System",
        theme_high_contrast: "High Contrast",
        theme_oled: "OLED",
        theme_monochrome: "Monochrome",
        theme_pastel: "Pastel",
        theme_warm: "Warm",
        theme_cold: "Cold",
        theme_minimal: "Minimal",
        theme_compact: "Compact",
        theme_spacious: "Spacious",
        theme_accessibility: "Accessibility",
        theme_glass: "Glass",
        theme_matte: "Matte",
        theme_neon: "Neon",
        theme_paper: "Paper",
        theme_sunrise: "Sunrise",
        theme_ocean: "Ocean",
        settings_menu_title: "Settings",
        settings_general: "General",
        settings_appearance: "Appearance",
        settings_editor_tools: "Editor Tools",
        settings_back: "Back",
        settings_category_general_desc: "Language, folders, motion",
        settings_category_appearance_desc: "Themes and interface colors",
        settings_category_editor_tools_desc: "Toolbar tools",
        smart_features: "SMART FEATURES",
        lock_center: "Note Protection",
        lock_center_desc: "Hidden notes filters and quick actions will appear here",
        share_desc: "A link will be generated and appear here",
        share_modal_title: "Share",
        collab_title: "Collaboration",
        collab_desc: "A one-time link will be generated and appear here",
        copy: "Copy",
        apply: "Apply",
        lock_title: "Lock",
        lock_password: "Password",
        lock_password_empty: "Password is empty",
        lock_invalid_password: "Invalid password",
        lock_hidden: "Note hidden",
        note_deleted: "Deleted",
        folder_deleted: "Folder deleted",
        feedback_failed: "Unable to send feedback",
        reorder_search_disabled: "Reordering is disabled while searching",
        reorder_pinned_blocked: "Pinned notes reorder separately",
        collab_enabled: "Collaboration enabled",
        share_note: "Share note",
        collab_note: "Collaborate",
        lock_note: "Lock note",
        nav_aria: "Navigation",
        sections_aria: "Sections",
        notes_list_aria: "Notes list",
        user_menu: "User menu",
        editor_actions: "Editor actions",
        editor_toolbar: "Editor toolbar",
        tags_aria: "Tags",
        media_menu: "Image menu",
        rating_aria: "Rating",
        login_aria: "Authentication",
        theme_dark_default: "Dark Default",
        theme_graphite: "Graphite",
        theme_neon_cyan: "Neon Cyan",
        theme_emerald_calm: "Emerald Calm",
        theme_violet_pulse: "Violet Pulse",
        theme_ocean_deep: "Ocean Deep",
        theme_oled_pure: "OLED Pure",
        theme_manual: "Manual",
        auth_popup_closed: "Sign-in canceled",
        auth_network_failed: "No internet connection",
        auth_cancelled: "Request canceled",
        logout_failed: "Sign out failed",
        login_failed: "Sign-in failed",
        draw_photo_hint: "Open the photo editor",
        password_title: "Password",
        password_prompt: "Enter password"
    }
}

const ThemeManager = {
    themes: {
        dark: {
            p: "#00f2ff",
            bg: "#050505",
            t: "#ffffff",
            surface: "#0d0d10",
            surfaceTransparent: "rgba(8, 8, 12, 0.72)",
            border: "rgba(255, 255, 255, 0.12)",
            blur: 18,
            motion: 1.0,
            density: 1,
            radius: 12,
            radiusScale: 1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.7,
            editorLetterSpacing: "0px",
            shadow: "0 20px 40px rgba(0, 0, 0, 0.55)",
            shadowSmall: "0 10px 18px rgba(0, 0, 0, 0.4)",
            toolbarBg: "rgba(255, 255, 255, 0.03)",
            toolbarBorder: "rgba(255, 255, 255, 0.08)",
            toolbarShadow: "0 16px 28px rgba(0, 0, 0, 0.55)"
        },
        system: { preset: "system" },
        light: {
            p: "#2563eb",
            bg: "#f8fafc",
            t: "#0b1220",
            surface: "#ffffff",
            surfaceTransparent: "rgba(255, 255, 255, 0.72)",
            border: "rgba(2, 6, 23, 0.12)",
            blur: 10,
            motion: 1.0,
            density: 1,
            radius: 12,
            radiusScale: 1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.68,
            editorLetterSpacing: "0px",
            shadow: "0 18px 30px rgba(2, 6, 23, 0.16)",
            shadowSmall: "0 10px 18px rgba(2, 6, 23, 0.12)",
            toolbarBg: "rgba(2, 6, 23, 0.04)",
            toolbarBorder: "rgba(2, 6, 23, 0.08)",
            toolbarShadow: "0 14px 24px rgba(2, 6, 23, 0.08)"
        },
        graphite: {
            p: "#9ca3af",
            bg: "#0a0b0d",
            t: "#f3f4f6",
            surface: "#111316",
            surfaceTransparent: "rgba(15, 17, 20, 0.78)",
            border: "rgba(148, 163, 184, 0.18)",
            blur: 8,
            motion: 0.9,
            density: 0.95,
            radius: 10,
            radiusScale: 0.95,
            fontBase: 15,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 28,
            editorLineHeight: 1.65,
            editorLetterSpacing: "0.2px",
            shadow: "0 16px 26px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 8px 14px rgba(0, 0, 0, 0.45)",
            toolbarBg: "rgba(156, 163, 175, 0.06)",
            toolbarBorder: "rgba(148, 163, 184, 0.18)",
            toolbarShadow: "0 12px 20px rgba(0, 0, 0, 0.55)"
        },
        neon_cyan: {
            p: "#00f2ff",
            bg: "#03040a",
            t: "#ffffff",
            surface: "#0b0e1c",
            surfaceTransparent: "rgba(4, 8, 18, 0.7)",
            border: "rgba(0, 242, 255, 0.22)",
            blur: 24,
            motion: 1.08,
            density: 1.02,
            radius: 14,
            radiusScale: 1.08,
            fontBase: 16,
            hitSize: 46,
            typeScale: 1.03,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.76,
            editorLetterSpacing: "0.2px",
            shadow: "0 30px 60px rgba(0, 0, 0, 0.72)",
            shadowSmall: "0 14px 24px rgba(0, 0, 0, 0.55)",
            toolbarBg: "rgba(0, 242, 255, 0.12)",
            toolbarBorder: "rgba(191, 255, 255, 0.24)",
            toolbarShadow: "0 20px 36px rgba(0, 0, 0, 0.72)"
        },
        emerald_calm: {
            p: "#22c55e",
            bg: "#040a06",
            t: "#f4fff8",
            surface: "#0a1410",
            surfaceTransparent: "rgba(6, 14, 10, 0.74)",
            border: "rgba(34, 197, 94, 0.18)",
            blur: 16,
            motion: 0.96,
            density: 1,
            radius: 12,
            radiusScale: 1.02,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.01,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.72,
            editorLetterSpacing: "0.05px",
            shadow: "0 22px 44px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.42)",
            toolbarBg: "rgba(34, 197, 94, 0.08)",
            toolbarBorder: "rgba(180, 255, 210, 0.16)",
            toolbarShadow: "0 16px 26px rgba(0, 0, 0, 0.58)"
        },
        violet_pulse: {
            p: "#a855f7",
            bg: "#07050b",
            t: "#f8f7ff",
            surface: "#120d1f",
            surfaceTransparent: "rgba(12, 8, 24, 0.7)",
            border: "rgba(168, 85, 247, 0.2)",
            blur: 22,
            motion: 1.05,
            density: 1.02,
            radius: 14,
            radiusScale: 1.12,
            fontBase: 16,
            hitSize: 46,
            typeScale: 1.02,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.75,
            editorLetterSpacing: "0.15px",
            shadow: "0 28px 54px rgba(0, 0, 0, 0.68)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.48)",
            toolbarBg: "rgba(168, 85, 247, 0.12)",
            toolbarBorder: "rgba(248, 247, 255, 0.18)",
            toolbarShadow: "0 20px 32px rgba(0, 0, 0, 0.62)"
        },
        ocean_deep: {
            p: "#3b82f6",
            bg: "#03060f",
            t: "#f0f6ff",
            surface: "#0b1222",
            surfaceTransparent: "rgba(5, 9, 20, 0.72)",
            border: "rgba(59, 130, 246, 0.2)",
            blur: 20,
            motion: 1.02,
            density: 1.01,
            radius: 12,
            radiusScale: 1.04,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.02,
            spaceUnit: 13,
            editorPadding: 32,
            editorLineHeight: 1.74,
            editorLetterSpacing: "0.12px",
            shadow: "0 26px 50px rgba(0, 0, 0, 0.7)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.5)",
            toolbarBg: "rgba(59, 130, 246, 0.1)",
            toolbarBorder: "rgba(208, 226, 255, 0.18)",
            toolbarShadow: "0 18px 32px rgba(0, 0, 0, 0.65)"
        },
        oled_pure: {
            p: "#00f2ff",
            bg: "#000000",
            t: "#ffffff",
            surface: "#050505",
            surfaceTransparent: "rgba(0, 0, 0, 0.82)",
            border: "rgba(255, 255, 255, 0.16)",
            blur: 12,
            motion: 0.9,
            density: 0.96,
            radius: 10,
            radiusScale: 0.95,
            fontBase: 15,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 28,
            editorLineHeight: 1.62,
            editorLetterSpacing: "0.3px",
            shadow: "0 18px 32px rgba(0, 0, 0, 0.82)",
            shadowSmall: "0 10px 18px rgba(0, 0, 0, 0.7)",
            toolbarBg: "rgba(255, 255, 255, 0.02)",
            toolbarBorder: "rgba(255, 255, 255, 0.12)",
            toolbarShadow: "0 16px 28px rgba(0, 0, 0, 0.82)"
        }
    },

    motionAllowed() {
        const reduce = !!state?.config?.reduceMotion
        return !reduce && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    },

    blurAllowed() {
        const reduce = !!state?.config?.reduceMotion
        return !reduce
    },

    buildGradients(primary, bg) {
        const rgb = Utils.hexToRgb(primary) || { r: 0, g: 242, b: 255 }
        const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`
        const glowSoft = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`
        const primaryGradient = `linear-gradient(135deg, ${primary}, ${Utils.adjustColor(primary, 30)})`
        const bgRadial = `radial-gradient(circle at 22% 18%, ${glowSoft}, transparent 45%), radial-gradient(circle at 78% 28%, rgba(255,255,255,0.06), transparent 40%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.04), transparent 42%)`
        const bgBlend = `linear-gradient(180deg, ${Utils.adjustColor(bg, 8)}, ${bg})`
        return { glow, glowSoft, primaryGradient, bgRadial, bgBlend, rgb }
    },

    applyThemeVars(theme) {
        const root = document.documentElement
        const bg = theme.bg
        const surface = theme.surface || Utils.adjustColor(bg, 10)
        const surfaceLight = theme.surfaceLight || Utils.adjustColor(bg, 20)
        const border = theme.border || "rgba(255, 255, 255, 0.1)"
        const density = typeof theme.density === "number" ? theme.density : 1
        const radiusBase = typeof theme.radius === "number" ? theme.radius : 12
        const radiusScale = typeof theme.radiusScale === "number" ? theme.radiusScale : 1
        const radiusMd = Math.round(radiusBase * radiusScale)
        const radiusSm = Math.max(4, Math.round(radiusMd * 0.6))
        const radiusLg = Math.round(radiusMd * 1.5)
        const radiusXl = Math.round(radiusMd * 2.2)
        const typeScale = typeof theme.typeScale === "number" ? theme.typeScale : 1
        const spaceUnit = typeof theme.spaceUnit === "number" ? theme.spaceUnit : 12
        const editorPadding = typeof theme.editorPadding === "number" ? theme.editorPadding : Math.round(spaceUnit * 2.5)
        const editorLineHeight = typeof theme.editorLineHeight === "number" ? theme.editorLineHeight : 1.7
        const editorLetterSpacing = theme.editorLetterSpacing || "0px"
        const motionScale = typeof theme.motion === "number" ? theme.motion : 1
        const motionEnabled = this.motionAllowed() && motionScale > 0
        const blurStrength = this.blurAllowed() ? (typeof theme.blur === "number" ? theme.blur : 0) : 0
        const fontBase = typeof theme.fontBase === "number" ? theme.fontBase : 16
        const hitSize = typeof theme.hitSize === "number" ? theme.hitSize : 44

        const g = this.buildGradients(theme.p, bg)

        root.style.setProperty("--primary", theme.p)
        root.style.setProperty("--primary-rgb", `${g.rgb.r}, ${g.rgb.g}, ${g.rgb.b}`)
        root.style.setProperty("--primary-gradient", g.primaryGradient)
        root.style.setProperty("--glow", g.glow)
        root.style.setProperty("--bg", bg)
        root.style.setProperty("--surface", surface)
        root.style.setProperty("--surface-light", surfaceLight)
        root.style.setProperty("--surface-transparent", theme.surfaceTransparent || surface)
        root.style.setProperty("--border", border)
        root.style.setProperty("--text", theme.t)

        root.style.setProperty("--radius-sm", `${radiusSm}px`)
        root.style.setProperty("--radius-md", `${radiusMd}px`)
        root.style.setProperty("--radius-lg", `${radiusLg}px`)
        root.style.setProperty("--radius-xl", `${radiusXl}px`)

        root.style.setProperty("--font-base", `${fontBase}px`)
        root.style.setProperty("--type-scale", `${typeScale}`)
        root.style.setProperty("--hit-size", `${hitSize}px`)
        root.style.setProperty("--density", `${density}`)
        root.style.setProperty("--blur-strength", `${blurStrength}px`)
        root.style.setProperty("--motion-enabled", motionEnabled ? `${motionScale}` : "0")
        root.style.setProperty("--animation-duration", motionEnabled ? "0.3s" : "0s")

        root.style.setProperty("--space-unit", `${spaceUnit}px`)
        root.style.setProperty("--editor-padding", `${editorPadding}px`)
        root.style.setProperty("--editor-line-height", `${editorLineHeight}`)
        root.style.setProperty("--editor-letter-spacing", `${editorLetterSpacing}`)

        if (theme.shadow) root.style.setProperty("--shadow-lg", theme.shadow)
        if (theme.shadowSmall) root.style.setProperty("--shadow-sm", theme.shadowSmall)
        if (theme.toolbarBg) root.style.setProperty("--editor-toolbar-bg", theme.toolbarBg)
        if (theme.toolbarBorder) root.style.setProperty("--editor-toolbar-border", theme.toolbarBorder)
        if (theme.toolbarShadow) root.style.setProperty("--editor-toolbar-shadow", theme.toolbarShadow)

        root.style.setProperty("--bg-aurora", `${g.bgRadial}, ${g.bgBlend}`)
    },

    syncInputs(p, bg, t) {
        const setVal = (id, val) => {
            const el = document.getElementById(id)
            if (el) el.value = val
        }
        setVal("cp-primary", p)
        setVal("cp-bg", bg)
        setVal("cp-text", t)
    },

    setManual(primary, bg, text) {
        const base = this.themes.dark
        const theme = {
            ...base,
            p: primary,
            bg,
            t: text,
            surface: Utils.adjustColor(bg, 10),
            surfaceLight: Utils.adjustColor(bg, 20)
        }
        this.applyThemeVars(theme)
        this.syncInputs(primary, bg, text)
        localStorage.setItem("app-theme-settings", JSON.stringify({ p: primary, bg: bg, t: text }))
    },

    applyPreset(key) {
        const preset = this.themes[key]
        if (!preset) return
        if (preset.preset === "system") {
            const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            const variant = isDark ? this.themes.dark : this.themes.light
            this.applyThemeVars({ ...variant })
            localStorage.setItem("app-theme-settings", JSON.stringify({ preset: "system" }))
            this.syncInputs(variant.p, variant.bg, variant.t)
            return
        }
        this.applyThemeVars({ ...preset })
        localStorage.setItem("app-theme-settings", JSON.stringify({ preset: key }))
        this.syncInputs(preset.p, preset.bg, preset.t)
    },

    updateManual(type, val) {
        const current = JSON.parse(localStorage.getItem("app-theme-settings")) || { preset: "dark" }
        const base = current.preset && this.themes[current.preset] ? { ...this.themes[current.preset] } : { ...this.themes.dark }
        const manual = {
            p: typeof current.p === "string" ? current.p : base.p,
            bg: typeof current.bg === "string" ? current.bg : base.bg,
            t: typeof current.t === "string" ? current.t : base.t
        }
        manual[type] = val
        this.setManual(manual.p, manual.bg, manual.t)
    },

    setupColorInputs() {
        const bind = (id, type) => {
            const el = document.getElementById(id)
            if (!el) return
            el.oninput = (e) => this.updateManual(type, e.target.value)
        }
        bind("cp-primary", "p")
        bind("cp-bg", "bg")
        bind("cp-text", "t")
    },

    renderPicker() {
        const root = document.getElementById("theme-picker-root")
        if (!root) return
        root.innerHTML = ""

        const dict = LANG[StateStore.read().config.lang] || LANG.ru
        const labels = {
            dark: dict.theme_dark_default || dict.theme_dark || "Dark",
            system: dict.theme_system || "System",
            light: dict.theme_light || "Light",
            graphite: dict.theme_graphite || "Graphite",
            neon_cyan: dict.theme_neon_cyan || "Neon Cyan",
            emerald_calm: dict.theme_emerald_calm || "Emerald Calm",
            violet_pulse: dict.theme_violet_pulse || "Violet Pulse",
            ocean_deep: dict.theme_ocean_deep || "Ocean Deep",
            oled_pure: dict.theme_oled_pure || "OLED",
            manual: dict.theme_manual || dict.manual || "Manual"
        }

        const ordered = ["system", "dark", "graphite", "neon_cyan", "emerald_calm", "violet_pulse", "ocean_deep", "oled_pure", "light", "manual"]

        const current = localStorage.getItem("app-theme-settings")
        const parsed = current ? JSON.parse(current) : null
        const activeKey = parsed?.preset ? parsed.preset : "manual"

        ordered.forEach((key) => {
            const t = this.themes[key]
            if (!t && key !== "manual") return

            const wrapper = document.createElement("div")
            wrapper.className = "theme-item-wrapper"

            const dot = document.createElement("div")
            dot.className = "theme-dot"

            const color = key === "manual" ? (parsed?.p || this.themes.dark.p) : (t.p || (key === "system" ? "#6366f1" : "#00f2ff"))
            dot.style.background = color

            const glow = Utils.hexToRgb(color)
            if (glow) dot.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.14), 0 10px 22px rgba(${glow.r},${glow.g},${glow.b},0.28)`

            const isActive = activeKey ? activeKey === key : key === "dark"
            if (isActive) dot.classList.add("active")

            const label = document.createElement("span")
            label.className = "theme-label"
            label.textContent = labels[key] || key.charAt(0).toUpperCase() + key.slice(1)

            dot.addEventListener("click", () => {
                if (key === "manual") {
                    const base = parsed || {}
                    const p = typeof base.p === "string" ? base.p : this.themes.dark.p
                    const bg = typeof base.bg === "string" ? base.bg : this.themes.dark.bg
                    const t = typeof base.t === "string" ? base.t : this.themes.dark.t
                    this.setManual(p, bg, t)
                } else {
                    this.applyPreset(key)
                }
                root.querySelectorAll(".theme-dot").forEach(d => d.classList.remove("active"))
                dot.classList.add("active")
            })

            wrapper.append(dot, label)
            root.appendChild(wrapper)
        })
    },

    reset() {
        this.applyPreset("dark")
        this.renderPicker()
    },

    revertToLastSaved() {
        const saved = JSON.parse(localStorage.getItem("app-theme-settings")) || { preset: "dark" }
        if (saved.preset) {
            this.applyPreset(saved.preset)
            this.renderPicker()
            return
        }
        const p = typeof saved.p === "string" ? saved.p : this.themes.dark.p
        const bg = typeof saved.bg === "string" ? saved.bg : this.themes.dark.bg
        const t = typeof saved.t === "string" ? saved.t : this.themes.dark.t
        this.setManual(p, bg, t)
        this.renderPicker()
    },

    init() {
        const saved = JSON.parse(localStorage.getItem("app-theme-settings"))
        if (saved) {
            const preset = saved.preset && this.themes[saved.preset] ? saved.preset : null
            if (preset) this.applyPreset(preset)
            else this.setManual(saved.p || this.themes.dark.p, saved.bg || this.themes.dark.bg, saved.t || this.themes.dark.t)
        } else {
            this.applyPreset("dark")
        }

        const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null
        if (media && media.addEventListener) {
            media.addEventListener("change", () => {
                const current = JSON.parse(localStorage.getItem("app-theme-settings"))
                if (current?.preset === "system") this.applyPreset("system")
            })
        }

        const observer = new MutationObserver(() => {
            const root = document.getElementById("theme-picker-root")
            if (root && root.innerHTML.trim() === "") {
                this.renderPicker()
                this.setupColorInputs()
            }
        })
        observer.observe(document.body, { childList: true, subtree: true })
    }
}

const Auth = {
    async login() {
        if (!auth || typeof firebase === "undefined") {
            const msg = (typeof UI !== "undefined" && UI.getText) ? UI.getText("auth_unavailable", "Authentication unavailable") : "Authentication unavailable"
            if (typeof UI !== "undefined" && UI.showToast) UI.showToast(msg)
            else alert(msg)
            return
        }
        const provider = new firebase.auth.GoogleAuthProvider()
        provider.setCustomParameters({ prompt: "select_account" })
        try {
            await auth.signInWithPopup(provider)
        } catch (e) {
            this.handleAuthError(e)
        }
    },

    async logout() {
        if (!auth) return
        try {
            this.applySignedOutUI()
            await auth.signOut()
            this.resetSession()
        } catch {
            this.applySignedInUI(StateStore.read().user)
            if (typeof UI !== "undefined") UI.showToast(UI.getText("logout_failed", "Sign out failed"))
        }
    },

    async switchAccount() {
        if (!auth) return
        try {
            this.applySignedOutUI()
            await auth.signOut()
            this.resetSession()
            await this.login()
        } catch {
            this.applySignedInUI(StateStore.read().user)
            if (typeof UI !== "undefined") UI.showToast(UI.getText("login_failed", "Sign-in failed"))
        }
    },

    handleAuthError(e) {
        const code = e && e.code ? e.code : "auth/unknown"
        const t = (typeof UI !== "undefined" && UI.getText) ? UI.getText.bind(UI) : (k, f) => f || k
        const messages = {
            "auth/popup-closed-by-user": t("auth_popup_closed", "Sign-in canceled"),
            "auth/network-request-failed": t("auth_network_failed", "No internet connection"),
            "auth/cancelled-popup-request": t("auth_cancelled", "Request canceled")
        }
        const msg = messages[code] || `${t("login_failed", "Sign-in failed")}: ${code}`
        if (typeof UI !== "undefined") UI.showToast(msg)
        else alert(msg)
    },

    clearState() {
        StateStore.resetSession()
        if (typeof UI !== "undefined") {
            UI.visibleNotes = []
            UI.currentNoteActionId = null
            UI.draggedNoteId = null
            UI.dragTargetId = null
            UI.dragPosition = null
            UI.closeAllModals()
            UI.renderFolders()
            UI.updateViewTitle()
            UI.updatePrimaryActionLabel()
        }
        const search = document.getElementById("search-input")
        if (search) search.value = ""
        if (typeof Editor !== "undefined") Editor.close()
    },

    applySignedInUI(user) {
        if (!user) return
        const loginScreen = document.getElementById("login-screen")
        const appScreen = document.getElementById("app")
        const userPhoto = document.getElementById("user-photo")
        const userName = document.getElementById("user-name")

        if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || "User")}&background=random&color=fff`
        if (userName) userName.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "User")

        if (loginScreen) {
            loginScreen.style.opacity = "0"
            setTimeout(() => {
                loginScreen.style.display = "none"
                loginScreen.classList.remove("active")
            }, 320)
        }

        if (appScreen) {
            appScreen.style.display = "flex"
            setTimeout(() => {
                appScreen.style.opacity = "1"
                appScreen.classList.add("active")
            }, 30)
        }
    },

    applySignedOutUI() {
        const loginScreen = document.getElementById("login-screen")
        const appScreen = document.getElementById("app")
        if (appScreen) {
            appScreen.style.opacity = "0"
            setTimeout(() => {
                appScreen.style.display = "none"
                appScreen.classList.remove("active")
            }, 220)
        }
        if (loginScreen) {
            loginScreen.style.display = "flex"
            setTimeout(() => {
                loginScreen.classList.add("active")
                loginScreen.style.opacity = "1"
            }, 30)
        }
    },

    resetSession() {
        this.clearState()
        this.applySignedOutUI()
    }
}

if (auth) {
    auth.onAuthStateChanged(user => {
        StateStore.update("user", user || null)

        if (user) {
            Auth.applySignedInUI(user)

            if (typeof window.initApp === "function") window.initApp()
        } else {
            Auth.resetSession()
        }
    })
}

document.addEventListener("DOMContentLoaded", () => {
    ThemeManager.init()
    if (typeof UI !== "undefined" && UI.captureShareFromHash) UI.captureShareFromHash()
    if (!StateStore.read().user) Auth.applySignedOutUI()

    document.addEventListener("dblclick", (event) => {
        event.preventDefault()
    }, { passive: false })
})
