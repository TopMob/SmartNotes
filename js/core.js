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
        const lang = (window.state && window.state.config && window.state.config.lang) || "ru"
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
    sanitizeHtml: (html) => {
        if (!html) return ""
        const parser = new DOMParser()
        const doc = parser.parseFromString(`<div>${html}</div>`, "text/html")
        const allowedTags = new Set(["b","strong","i","em","u","br","p","div","ul","ol","li","span","img","a","input"])
        const safeClasses = new Set(["task-item","task-text","task-checkbox","completed","media-wrapper","media-resize-handle","media-left","media-right"])
        const walk = (node) => {
            Array.from(node.childNodes).forEach(child => {
                if (child.nodeType === 8) {
                    child.remove()
                    return
                }
                if (child.nodeType !== 1) return
                const tag = child.tagName.toLowerCase()
                if (!allowedTags.has(tag)) {
                    const text = doc.createTextNode(child.textContent || "")
                    child.replaceWith(text)
                    return
                }
                Array.from(child.attributes).forEach(attr => {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith("on") || name === "style") {
                        child.removeAttribute(attr.name)
                        return
                    }
                    if (name === "class") {
                        const filtered = String(attr.value || "")
                            .split(/\s+/)
                            .map(x => x.trim())
                            .filter(x => safeClasses.has(x))
                        if (filtered.length) child.setAttribute("class", filtered.join(" "))
                        else child.removeAttribute("class")
                        return
                    }
                    const allowedForTag = {
                        a: ["href"],
                        img: ["src","alt"],
                        div: ["data-width","data-height","data-scale"],
                        span: [],
                        p: [],
                        ul: [],
                        ol: [],
                        li: [],
                        input: ["type","checked"]
                    }
                    const allowed = allowedForTag[tag] || []
                    if (!allowed.includes(name)) child.removeAttribute(attr.name)
                })
                if (tag === "a") {
                    const href = child.getAttribute("href")
                    if (!href || !/^(https?:|mailto:)/i.test(href)) {
                        child.removeAttribute("href")
                    } else if (/^https?:/i.test(href)) {
                        child.setAttribute("target", "_blank")
                        child.setAttribute("rel", "noopener noreferrer")
                    }
                }
                if (tag === "img") {
                    const src = child.getAttribute("src") || ""
                    if (!/^https:\/\//i.test(src) && !/^data:image\//i.test(src)) {
                        child.remove()
                        return
                    }
                }
                if (tag === "input") {
                    const type = String(child.getAttribute("type") || "").toLowerCase()
                    const cls = child.getAttribute("class") || ""
                    if (type !== "checkbox" || !cls.split(/\s+/).includes("task-checkbox")) {
                        child.remove()
                        return
                    }
                }
                walk(child)
            })
        }
        walk(doc.body)
        return doc.body.innerHTML
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

const state = {
    user: null,
    notes: [],
    folders: [],
    view: "notes",
    activeFolderId: null,
    searchQuery: "",
    currentNote: null,
    tempRating: 0,
    config: { lang: "ru", folderViewMode: "compact", reduceMotion: false, editorTools: {} },
    driveToken: null,
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    editorDirty: false,
    lastSaved: null,
    orderHistory: [],
    pendingShare: null
}

window.state = state

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
        lang_ru: "Русский",
        lang_en: "English",
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
        rate_required: "Сначала поставьте оценку",
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
        share_modal_title: "Поделиться",
        share_modal_hint: "Ссылка будет сгенерирована и появится здесь",
        collab_modal_title: "Совместное редактирование",
        collab_modal_hint: "Одноразовая ссылка будет сгенерирована и появится здесь",
        copy: "Копировать",
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
        auth_popup_closed: "Вход отменен",
        auth_network_failed: "Нет соединения с интернетом",
        auth_popup_cancelled: "Запрос отменен",
        auth_error: "Ошибка входа",
        auth_signout_error: "Ошибка при выходе",
        auth_switch_error: "Ошибка входа",
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
        login_aria: "Авторизация",
        nav_aria: "Навигация",
        sections_aria: "Разделы",
        user_menu: "Пользователь",
        user_avatar: "Пользователь",
        search_aria: "Поиск заметок",
        create_note: "Создать заметку",
        create_folder: "Создать папку",
        editor: "Редактор",
        back: "Назад",
        redo: "Повторить",
        delete_note: "Удалить заметку",
        note_title_aria: "Заголовок заметки",
        note_body_aria: "Текст заметки",
        notes_list_aria: "Список заметок",
        editor_actions_aria: "Действия редактора",
        editor_tools_aria: "Инструменты редактора",
        tags_aria: "Теги",
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
        smart_features: "УМНЫЕ ФУНКЦИИ",
        lock_center: "Защита заметок",
        lock_center_title: "Защита заметок",
        lock_center_hint: "Тут будут фильтры скрытых заметок и быстрые действия",
        lock_modal_title: "Блокировка",
        lock_password: "Пароль",
        lock_apply: "Применить",
        lock_empty: "Пароль пустой",
        lock_saved: "Заметка скрыта",
        lock_invalid: "Неверный пароль",
        note_deleted: "Удалено",
        folder_deleted: "Папка удалена",
        media_menu: "Меню изображения",
        share: "Поделиться",
        collab: "Совместное редактирование",
        lock_note: "Заблокировать заметку",
        rating_aria: "Оценка",
        feedback_error: "Не удалось отправить отзыв",
        collab_enabled: "Совместный режим включен",
        reorder_disabled_search: "Перетаскивание отключено во время поиска",
        photo_editor_hint: "Откройте редактор фото из панели",
        settings_menu_title: "Настройки",
        settings_general: "Общие",
        settings_appearance: "Внешний вид",
        settings_editor_tools: "Инструменты редактора",
        settings_back: "Назад",
        settings_category_general_desc: "Язык, вид папок и анимации",
        settings_category_appearance_desc: "Пресеты и цвета интерфейса",
        settings_category_editor_tools_desc: "Показать или скрыть инструменты",
        folder_view_aria: "Режим отображения папок",
        color_text: "Цвет текста",
        color_accent: "Акцентный цвет",
        color_bg: "Цвет фона",
        feedback_aria: "Ваш отзыв",
        theme_dark_default: "Тёмная по умолчанию",
        theme_system: "Системная",
        theme_light: "Светлая",
        theme_graphite: "Графит",
        theme_neon_cyan: "Неоновый циан",
        theme_emerald_calm: "Изумрудный покой",
        theme_violet_pulse: "Фиолетовый импульс",
        theme_ocean_deep: "Глубокий океан",
        theme_oled_pure: "OLED чистый",
        theme_manual: "Ручная"
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
        lang_ru: "Russian",
        lang_en: "English",
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
        rate_required: "Please rate first",
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
        share_modal_title: "Share",
        share_modal_hint: "A link will be generated and appear here",
        collab_modal_title: "Collaborative editing",
        collab_modal_hint: "A one-time link will be generated and appear here",
        copy: "Copy",
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
        auth_popup_closed: "Sign-in canceled",
        auth_network_failed: "No internet connection",
        auth_popup_cancelled: "Request canceled",
        auth_error: "Sign-in error",
        auth_signout_error: "Sign-out failed",
        auth_switch_error: "Sign-in failed",
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
        login_aria: "Sign in",
        nav_aria: "Navigation",
        sections_aria: "Sections",
        user_menu: "User",
        user_avatar: "User",
        search_aria: "Search notes",
        create_note: "Create note",
        create_folder: "Create folder",
        editor: "Editor",
        back: "Back",
        redo: "Redo",
        delete_note: "Delete note",
        note_title_aria: "Note title",
        note_body_aria: "Note body",
        notes_list_aria: "Notes list",
        editor_actions_aria: "Editor actions",
        editor_tools_aria: "Editor tools",
        tags_aria: "Tags",
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
        smart_features: "SMART FEATURES",
        lock_center: "Note security",
        lock_center_title: "Note security",
        lock_center_hint: "Hidden note filters and quick actions will appear here",
        lock_modal_title: "Lock",
        lock_password: "Password",
        lock_apply: "Apply",
        lock_empty: "Password is empty",
        lock_saved: "Note hidden",
        lock_invalid: "Wrong password",
        note_deleted: "Deleted",
        folder_deleted: "Folder deleted",
        media_menu: "Image menu",
        share: "Share",
        collab: "Collaborative editing",
        lock_note: "Lock note",
        rating_aria: "Rating",
        feedback_error: "Could not send feedback",
        collab_enabled: "Collaboration enabled",
        reorder_disabled_search: "Reorder disabled while searching",
        photo_editor_hint: "Open the photo editor from the toolbar",
        settings_menu_title: "Settings",
        settings_general: "General",
        settings_appearance: "Appearance",
        settings_editor_tools: "Editor tools",
        settings_back: "Back",
        settings_category_general_desc: "Language, folder view, and motion",
        settings_category_appearance_desc: "Presets and interface colors",
        settings_category_editor_tools_desc: "Show or hide toolbar tools",
        folder_view_aria: "Folder view mode",
        color_text: "Text color",
        color_accent: "Accent color",
        color_bg: "Background color",
        feedback_aria: "Your feedback",
        theme_dark_default: "Dark default",
        theme_system: "System",
        theme_light: "Light",
        theme_graphite: "Graphite",
        theme_neon_cyan: "Neon cyan",
        theme_emerald_calm: "Emerald calm",
        theme_violet_pulse: "Violet pulse",
        theme_ocean_deep: "Ocean deep",
        theme_oled_pure: "OLED pure",
        theme_manual: "Manual"
    }
}

const ThemeManager = {
    themes: {
        dark: {
            p: "#00f2ff",
            bg: "#050508",
            t: "#fefeff",
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
            editorLineHeight: 1.72,
            editorLetterSpacing: "0px",
            shadow: "0 22px 44px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.45)",
            toolbarBg: "rgba(255, 255, 255, 0.04)",
            toolbarBorder: "rgba(255, 255, 255, 0.08)",
            toolbarShadow: "0 18px 32px rgba(0, 0, 0, 0.6)"
        },
        system: { preset: "system" },
        light: {
            p: "#2563eb",
            bg: "#f8fafc",
            t: "#0b1220",
            border: "rgba(2, 6, 23, 0.12)",
            blur: 10,
            motion: 0.95,
            density: 1,
            radius: 12,
            radiusScale: 1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 12,
            editorPadding: 28,
            editorLineHeight: 1.68,
            editorLetterSpacing: "0px",
            shadow: "0 20px 35px rgba(2, 6, 23, 0.16)",
            shadowSmall: "0 10px 18px rgba(2, 6, 23, 0.12)",
            toolbarBg: "rgba(2, 6, 23, 0.05)",
            toolbarBorder: "rgba(2, 6, 23, 0.12)",
            toolbarShadow: "0 18px 28px rgba(2, 6, 23, 0.12)"
        },
        graphite: {
            p: "#9aa3b2",
            bg: "#0b0d12",
            t: "#e6e9ef",
            border: "rgba(230, 233, 239, 0.08)",
            blur: 12,
            motion: 0.9,
            density: 0.95,
            radius: 10,
            radiusScale: 0.95,
            fontBase: 16,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 26,
            editorLineHeight: 1.65,
            editorLetterSpacing: "0px",
            shadow: "0 16px 30px rgba(0, 0, 0, 0.5)",
            shadowSmall: "0 8px 16px rgba(0, 0, 0, 0.4)",
            toolbarBg: "rgba(255, 255, 255, 0.02)",
            toolbarBorder: "rgba(255, 255, 255, 0.06)",
            toolbarShadow: "0 14px 26px rgba(0, 0, 0, 0.5)"
        },
        neon: {
            p: "#00f2ff",
            bg: "#03050c",
            t: "#f7fbff",
            border: "rgba(221, 244, 255, 0.16)",
            blur: 26,
            motion: 1.08,
            density: 1,
            radius: 14,
            radiusScale: 1.1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.04,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.78,
            editorLetterSpacing: "0.2px",
            shadow: "0 30px 60px rgba(0, 0, 0, 0.7)",
            shadowSmall: "0 14px 26px rgba(0, 0, 0, 0.55)",
            toolbarBg: "rgba(0, 242, 255, 0.12)",
            toolbarBorder: "rgba(199, 244, 255, 0.22)",
            toolbarShadow: "0 20px 36px rgba(0, 0, 0, 0.7)"
        },
        emerald: {
            p: "#22c55e",
            bg: "#040a08",
            t: "#f2fff7",
            border: "rgba(242, 255, 247, 0.12)",
            blur: 18,
            motion: 1.0,
            density: 1,
            radius: 12,
            radiusScale: 1.03,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.01,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.72,
            editorLetterSpacing: "0px",
            shadow: "0 24px 44px rgba(0, 0, 0, 0.62)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.45)",
            toolbarBg: "rgba(34, 197, 94, 0.08)",
            toolbarBorder: "rgba(226, 255, 238, 0.16)",
            toolbarShadow: "0 18px 30px rgba(0, 0, 0, 0.6)"
        },
        violet: {
            p: "#a855f7",
            bg: "#07050d",
            t: "#f8f5ff",
            border: "rgba(248, 245, 255, 0.14)",
            blur: 22,
            motion: 1.05,
            density: 1,
            radius: 14,
            radiusScale: 1.12,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.03,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.76,
            editorLetterSpacing: "0.15px",
            shadow: "0 28px 52px rgba(0, 0, 0, 0.68)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.5)",
            toolbarBg: "rgba(168, 85, 247, 0.12)",
            toolbarBorder: "rgba(248, 245, 255, 0.18)",
            toolbarShadow: "0 20px 34px rgba(0, 0, 0, 0.68)"
        },
        ocean: {
            p: "#3b82f6",
            bg: "#030816",
            t: "#f0f6ff",
            border: "rgba(227, 240, 255, 0.12)",
            blur: 20,
            motion: 1.03,
            density: 1,
            radius: 12,
            radiusScale: 1.06,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.02,
            spaceUnit: 13,
            editorPadding: 32,
            editorLineHeight: 1.75,
            editorLetterSpacing: "0.12px",
            shadow: "0 26px 48px rgba(0, 0, 0, 0.65)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.45)",
            toolbarBg: "rgba(59, 130, 246, 0.1)",
            toolbarBorder: "rgba(227, 240, 255, 0.18)",
            toolbarShadow: "0 18px 30px rgba(0, 0, 0, 0.62)"
        },
        oled: {
            p: "#00f2ff",
            bg: "#000000",
            t: "#ffffff",
            border: "rgba(255, 255, 255, 0.16)",
            blur: 8,
            motion: 0.95,
            density: 1,
            radius: 10,
            radiusScale: 0.9,
            fontBase: 16,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 26,
            editorLineHeight: 1.64,
            editorLetterSpacing: "0px",
            shadow: "0 18px 36px rgba(0, 0, 0, 0.75)",
            shadowSmall: "0 10px 18px rgba(0, 0, 0, 0.6)",
            toolbarBg: "rgba(255, 255, 255, 0.02)",
            toolbarBorder: "rgba(255, 255, 255, 0.12)",
            toolbarShadow: "0 16px 28px rgba(0, 0, 0, 0.75)"
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

        const dict = LANG[state.config.lang] || LANG.ru
        const labels = {
            dark: dict.theme_dark_default || "Dark default",
            system: dict.theme_system || "System",
            light: dict.theme_light || "Light",
            graphite: dict.theme_graphite || "Graphite",
            neon: dict.theme_neon_cyan || "Neon cyan",
            emerald: dict.theme_emerald_calm || "Emerald calm",
            violet: dict.theme_violet_pulse || "Violet pulse",
            ocean: dict.theme_ocean_deep || "Ocean deep",
            oled: dict.theme_oled_pure || "OLED pure",
            manual: dict.theme_manual || "Manual"
        }

        const ordered = ["system", "dark", "graphite", "neon", "emerald", "violet", "ocean", "oled", "light", "manual"]

        const current = localStorage.getItem("app-theme-settings")
        const parsed = current ? JSON.parse(current) : null
        const activeKey = parsed?.preset ? parsed.preset : "manual"
        const manual = parsed?.preset ? null : {
            p: typeof parsed?.p === "string" ? parsed.p : this.themes.dark.p,
            bg: typeof parsed?.bg === "string" ? parsed.bg : this.themes.dark.bg,
            t: typeof parsed?.t === "string" ? parsed.t : this.themes.dark.t
        }

        ordered.forEach((key) => {
            const t = key === "manual" ? null : this.themes[key]
            if (key !== "manual" && !t) return

            const wrapper = document.createElement("div")
            wrapper.className = "theme-item-wrapper"

            const dot = document.createElement("div")
            dot.className = "theme-dot"

            const color = key === "manual" && manual ? manual.p : (t?.p || (key === "system" ? "#6366f1" : "#00f2ff"))
            dot.style.background = color

            const glow = Utils.hexToRgb(color)
            if (glow) dot.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.14), 0 10px 22px rgba(${glow.r},${glow.g},${glow.b},0.28)`

            const isActive = activeKey === key
            if (isActive) dot.classList.add("active")

            const label = document.createElement("span")
            label.className = "theme-label"
            label.textContent = labels[key] || key.charAt(0).toUpperCase() + key.slice(1)

            dot.addEventListener("click", () => {
                if (key === "manual") {
                    const base = manual || { p: this.themes.dark.p, bg: this.themes.dark.bg, t: this.themes.dark.t }
                    this.setManual(base.p, base.bg, base.t)
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
            this.applySignedInUI(state.user)
            if (typeof UI !== "undefined") UI.showToast(UI.getText("auth_signout_error", "Sign-out failed"))
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
            this.applySignedInUI(state.user)
            if (typeof UI !== "undefined") UI.showToast(UI.getText("auth_switch_error", "Sign-in failed"))
        }
    },

    handleAuthError(e) {
        const code = e && e.code ? e.code : "auth/unknown"
        const messages = {
            "auth/popup-closed-by-user": "auth_popup_closed",
            "auth/network-request-failed": "auth_network_failed",
            "auth/cancelled-popup-request": "auth_popup_cancelled"
        }
        const key = messages[code] || "auth_error"
        const msg = (typeof UI !== "undefined" && UI.getText) ? UI.getText(key, key) : key
        if (typeof UI !== "undefined") UI.showToast(code && !messages[code] ? `${msg}: ${code}` : msg)
        else alert(msg)
    },

    clearState() {
        state.user = null
        state.notes = []
        state.folders = []
        state.view = "notes"
        state.activeFolderId = null
        state.searchQuery = ""
        state.currentNote = null
        state.tempRating = 0
        state.driveToken = null
        state.recording = false
        state.mediaRecorder = null
        state.audioChunks = []
        state.editorDirty = false
        state.lastSaved = null
        state.orderHistory = []
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
        state.user = user || null

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
    if (!state.user) Auth.applySignedOutUI()

    document.addEventListener("dblclick", (event) => {
        event.preventDefault()
    }, { passive: false })
})
