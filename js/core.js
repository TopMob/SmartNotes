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
        const root = doc.body.firstElementChild
        if (!root) return ""

        const allowedTags = new Set(["b", "strong", "i", "em", "u", "br", "p", "div", "ul", "ol", "li", "span", "img", "a", "input"])
        const allowedClasses = new Set(["task-item", "task-checkbox", "task-text", "completed", "media-wrapper", "media-resize-handle"])
        const allowedData = new Set(["data-width", "data-height", "data-scale"])

        const sanitizeNode = (node) => {
            if (node.nodeType === 3) return
            if (node.nodeType !== 1) {
                node.remove()
                return
            }
            const tag = node.tagName.toLowerCase()
            if (!allowedTags.has(tag)) {
                const text = doc.createTextNode(node.textContent || "")
                node.replaceWith(text)
                return
            }

            Array.from(node.attributes).forEach(attr => {
                const name = attr.name.toLowerCase()
                const value = attr.value
                if (name.startsWith("on") || name === "style") {
                    node.removeAttribute(attr.name)
                    return
                }

                if (name === "class") {
                    const safe = value.split(/\s+/).filter(c => allowedClasses.has(c)).join(" ")
                    if (safe) node.setAttribute("class", safe)
                    else node.removeAttribute("class")
                    return
                }

                if (tag === "img") {
                    if (name === "src") {
                        const src = String(value || "")
                        if (!/^data:image|^https:\/\//i.test(src)) {
                            node.remove()
                            return
                        }
                        return
                    }
                    if (name === "alt") return
                    node.removeAttribute(attr.name)
                    return
                }

                if (tag === "a") {
                    if (name === "href") {
                        const href = String(value || "")
                        if (!/^(https?:|mailto:)/i.test(href)) {
                            node.removeAttribute("href")
                            return
                        }
                        if (/^https?:/i.test(href)) {
                            node.setAttribute("rel", "noopener noreferrer")
                            node.setAttribute("target", "_blank")
                        }
                        return
                    }
                    node.removeAttribute(attr.name)
                    return
                }

                if (tag === "input") {
                    if (name === "type") {
                        if (value !== "checkbox") node.setAttribute("type", "checkbox")
                        return
                    }
                    if (name === "checked") return
                }

                if (name === "contenteditable") {
                    if (node.classList.contains("task-text") && value === "true") return
                    if (value !== "false") node.setAttribute("contenteditable", "false")
                    return
                }

                if (allowedData.has(name)) return

                node.removeAttribute(attr.name)
            })

            Array.from(node.childNodes).forEach(child => sanitizeNode(child))
        }

        Array.from(root.childNodes).forEach(child => sanitizeNode(child))
        return root.innerHTML
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
        login_title: "Авторизация",
        nav_label: "Навигация",
        sections_label: "Разделы",
        user_menu: "Пользователь",
        notes_list: "Список заметок",
        editor_actions: "Действия редактора",
        editor_toolbar: "Инструменты редактора",
        tags_label: "Теги",
        media_menu: "Меню изображения",
        rate_label: "Оценка",
        all_notes: "Все записи",
        favorites: "Важное",
        archive: "Архив",
        folders: "ПАПКИ",
        folders_overview: "Папки",
        about: "О нас",
        rate: "Оценить",
        settings: "Настройки",
        settings_menu_title: "Настройки",
        settings_general: "Общие",
        settings_appearance: "Внешний вид",
        settings_editor_tools: "Инструменты редактора",
        settings_back: "Назад",
        settings_category_general_desc: "Язык, папки, анимации",
        settings_category_appearance_desc: "Темы и ручные цвета",
        settings_category_editor_tools_desc: "Кнопки панели редактора",
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
        smart_features: "УМНЫЕ ФУНКЦИИ",
        lock_center: "Защита заметок",
        lock_center_hint: "Тут будут фильтры скрытых заметок и быстрые действия",
        lock_title: "Блокировка",
        lock_placeholder: "Пароль",
        lock_empty: "Пароль пустой",
        lock_applied: "Заметка скрыта",
        lock_prompt_title: "Пароль",
        lock_prompt_placeholder: "Введите пароль",
        lock_invalid: "Неверный пароль",
        share_note: "Поделиться заметкой",
        collab_note: "Совместное редактирование",
        lock_note: "Заблокировать заметку",
        share_hint: "Ссылка будет сгенерирована в приложении",
        collab_title: "Совместное редактирование",
        collab_hint: "Одноразовая ссылка будет сгенерирована в приложении",
        copy_link: "Копировать",
        copied: "Скопировано",
        copy_failed: "Не удалось скопировать",
        apply: "Применить",
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
        feedback_aria: "Ваш отзыв",
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
        folder_deleted: "Папка удалена",
        archived: "В архиве",
        restored: "Восстановлено",
        deleted: "Удалено",
        saving: "Сохранение...",
        saved: "Сохранено",
        rate_required: "Поставьте оценку",
        feedback_thanks: "Спасибо!",
        feedback_failed: "Не удалось отправить отзыв",
        auth_required: "Сначала войдите",
        order_updated: "Порядок обновлен",
        reorder_disabled_search: "Нельзя менять порядок во время поиска",
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
        collab_enabled: "Совместный режим включен",
        mic_unsupported: "Микрофон не поддерживается",
        mic_denied: "Нет доступа к микрофону",
        recording: "Запись...",
        reminder_set: "Напоминание",
        confirm_delete: "Удалить?",
        confirm_exit: "Выйти?",
        confirm_account: "Сменить аккаунт?",
        confirm_delete_folder: "Удалить папку?",
        confirm_default: "Подтвердите",
        photo_editor_hint: "Открой редактор фото из кнопки в модалке",
        auth_unavailable: "Авторизация недоступна",
        login_failed: "Ошибка входа",
        logout_failed: "Ошибка при выходе",
        auth_popup_closed: "Вход отменен",
        auth_network_failed: "Нет соединения с интернетом",
        auth_popup_cancelled: "Запрос отменен",
        auth_unknown: "Ошибка входа",
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
        theme_graphite: "Графит",
        theme_neon_cyan: "Неон циан",
        theme_emerald_calm: "Изумрудный",
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
        login_title: "Authentication",
        nav_label: "Navigation",
        sections_label: "Sections",
        user_menu: "User menu",
        notes_list: "Notes list",
        editor_actions: "Editor actions",
        editor_toolbar: "Editor tools",
        tags_label: "Tags",
        media_menu: "Media menu",
        rate_label: "Rating",
        all_notes: "All Notes",
        favorites: "Important",
        archive: "Archive",
        folders: "FOLDERS",
        folders_overview: "Folders",
        about: "About",
        rate: "Rate Us",
        settings: "Settings",
        settings_menu_title: "Settings",
        settings_general: "General",
        settings_appearance: "Appearance",
        settings_editor_tools: "Editor tools",
        settings_back: "Back",
        settings_category_general_desc: "Language, folders, motion",
        settings_category_appearance_desc: "Themes and manual colors",
        settings_category_editor_tools_desc: "Editor toolbar buttons",
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
        smart_features: "SMART FEATURES",
        lock_center: "Note protection",
        lock_center_hint: "Filters and quick actions will appear here",
        lock_title: "Lock",
        lock_placeholder: "Password",
        lock_empty: "Password is empty",
        lock_applied: "Note locked",
        lock_prompt_title: "Password",
        lock_prompt_placeholder: "Enter password",
        lock_invalid: "Invalid password",
        share_note: "Share note",
        collab_note: "Collaborate on note",
        lock_note: "Lock note",
        share_hint: "The link will be generated in the app",
        collab_title: "Collaboration",
        collab_hint: "A one-time link will be generated in the app",
        copy_link: "Copy",
        copied: "Copied",
        copy_failed: "Copy failed",
        apply: "Apply",
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
        feedback_aria: "Your feedback",
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
        folder_deleted: "Folder deleted",
        archived: "Archived",
        restored: "Restored",
        deleted: "Deleted",
        saving: "Saving...",
        saved: "Saved",
        rate_required: "Please rate the app",
        feedback_thanks: "Thanks!",
        feedback_failed: "Failed to send feedback",
        auth_required: "Sign in first",
        order_updated: "Order updated",
        reorder_disabled_search: "Reorder disabled while searching",
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
        collab_enabled: "Collaborative mode enabled",
        mic_unsupported: "Microphone not supported",
        mic_denied: "Microphone access denied",
        recording: "Recording...",
        reminder_set: "Reminder set",
        confirm_delete: "Delete?",
        confirm_exit: "Sign out?",
        confirm_account: "Switch account?",
        confirm_delete_folder: "Delete folder?",
        confirm_default: "Confirm",
        photo_editor_hint: "Open the photo editor from the modal button",
        auth_unavailable: "Authentication unavailable",
        login_failed: "Sign in failed",
        logout_failed: "Sign out failed",
        auth_popup_closed: "Sign-in cancelled",
        auth_network_failed: "Network error",
        auth_popup_cancelled: "Request cancelled",
        auth_unknown: "Sign-in error",
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
        theme_graphite: "Graphite",
        theme_neon_cyan: "Neon Cyan",
        theme_emerald_calm: "Emerald Calm",
        theme_violet_pulse: "Violet Pulse",
        theme_ocean_deep: "Ocean Deep",
        theme_oled_pure: "OLED Pure",
        theme_manual: "Manual"
    }
}

const ThemeManager = {
    themes: {
        light: {
            p: "#2563eb",
            bg: "#f7f9fc",
            t: "#111827",
            border: "rgba(15, 23, 42, 0.12)",
            blur: 8,
            motion: 0.9,
            density: 1,
            radius: 12,
            radiusScale: 1,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 12,
            editorPadding: 28,
            editorLineHeight: 1.7,
            editorLetterSpacing: "0px",
            shadow: "0 18px 32px rgba(15, 23, 42, 0.16)",
            shadowSmall: "0 8px 16px rgba(15, 23, 42, 0.1)",
            toolbarBg: "rgba(15, 23, 42, 0.04)",
            toolbarBorder: "rgba(15, 23, 42, 0.08)",
            toolbarShadow: "0 16px 24px rgba(15, 23, 42, 0.08)"
        },
        dark: {
            p: "#00f2ff",
            bg: "#05060c",
            t: "#f6f9ff",
            border: "rgba(255, 255, 255, 0.1)",
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
            shadow: "0 22px 44px rgba(0, 0, 0, 0.6)",
            shadowSmall: "0 10px 20px rgba(0, 0, 0, 0.45)",
            toolbarBg: "rgba(255, 255, 255, 0.04)",
            toolbarBorder: "rgba(255, 255, 255, 0.09)",
            toolbarShadow: "0 18px 30px rgba(0, 0, 0, 0.55)"
        },
        system: { preset: "system" },
        graphite: {
            p: "#9ca3af",
            bg: "#0b0d12",
            t: "#e6e7eb",
            border: "rgba(255, 255, 255, 0.08)",
            blur: 10,
            motion: 0.95,
            density: 1.05,
            radius: 10,
            radiusScale: 0.98,
            fontBase: 15.5,
            hitSize: 42,
            typeScale: 0.98,
            spaceUnit: 11,
            editorPadding: 26,
            editorLineHeight: 1.66,
            editorLetterSpacing: "0px",
            shadow: "0 18px 34px rgba(0, 0, 0, 0.5)",
            shadowSmall: "0 8px 16px rgba(0, 0, 0, 0.38)",
            toolbarBg: "rgba(255, 255, 255, 0.03)",
            toolbarBorder: "rgba(255, 255, 255, 0.06)",
            toolbarShadow: "0 14px 24px rgba(0, 0, 0, 0.55)"
        },
        neon_cyan: {
            p: "#22f5ff",
            bg: "#03040d",
            t: "#f5fdff",
            border: "rgba(226, 242, 255, 0.16)",
            blur: 26,
            motion: 1.08,
            density: 1,
            radius: 14,
            radiusScale: 1.08,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.04,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.74,
            editorLetterSpacing: "0.2px",
            shadow: "0 30px 60px rgba(0, 0, 0, 0.72)",
            shadowSmall: "0 14px 24px rgba(0, 0, 0, 0.55)",
            toolbarBg: "rgba(34, 245, 255, 0.12)",
            toolbarBorder: "rgba(226, 242, 255, 0.2)",
            toolbarShadow: "0 20px 34px rgba(0, 0, 0, 0.72)"
        },
        emerald_calm: {
            p: "#34d399",
            bg: "#050b09",
            t: "#edfff7",
            border: "rgba(237, 255, 247, 0.12)",
            blur: 16,
            motion: 1.02,
            density: 1,
            radius: 12,
            radiusScale: 1.02,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.01,
            spaceUnit: 12,
            editorPadding: 30,
            editorLineHeight: 1.7,
            editorLetterSpacing: "0px",
            shadow: "0 24px 48px rgba(0, 0, 0, 0.58)",
            shadowSmall: "0 12px 20px rgba(0, 0, 0, 0.42)",
            toolbarBg: "rgba(52, 211, 153, 0.09)",
            toolbarBorder: "rgba(237, 255, 247, 0.16)",
            toolbarShadow: "0 18px 30px rgba(0, 0, 0, 0.6)"
        },
        violet_pulse: {
            p: "#b26bff",
            bg: "#080612",
            t: "#f8f5ff",
            border: "rgba(248, 245, 255, 0.14)",
            blur: 22,
            motion: 1.06,
            density: 1,
            radius: 14,
            radiusScale: 1.12,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.03,
            spaceUnit: 13,
            editorPadding: 34,
            editorLineHeight: 1.75,
            editorLetterSpacing: "0.18px",
            shadow: "0 28px 54px rgba(0, 0, 0, 0.68)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.5)",
            toolbarBg: "rgba(178, 107, 255, 0.12)",
            toolbarBorder: "rgba(248, 245, 255, 0.2)",
            toolbarShadow: "0 20px 32px rgba(0, 0, 0, 0.65)"
        },
        ocean_deep: {
            p: "#4aa6ff",
            bg: "#030914",
            t: "#e8f3ff",
            border: "rgba(232, 243, 255, 0.12)",
            blur: 20,
            motion: 1.04,
            density: 1,
            radius: 12,
            radiusScale: 1.04,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.02,
            spaceUnit: 12,
            editorPadding: 32,
            editorLineHeight: 1.73,
            editorLetterSpacing: "0.12px",
            shadow: "0 26px 52px rgba(0, 0, 0, 0.66)",
            shadowSmall: "0 12px 22px rgba(0, 0, 0, 0.48)",
            toolbarBg: "rgba(74, 166, 255, 0.1)",
            toolbarBorder: "rgba(232, 243, 255, 0.18)",
            toolbarShadow: "0 18px 32px rgba(0, 0, 0, 0.65)"
        },
        oled_pure: {
            p: "#00e7ff",
            bg: "#000000",
            t: "#ffffff",
            border: "rgba(255, 255, 255, 0.16)",
            blur: 12,
            motion: 0.98,
            density: 1,
            radius: 10,
            radiusScale: 0.98,
            fontBase: 16,
            hitSize: 44,
            typeScale: 1.0,
            spaceUnit: 11,
            editorPadding: 28,
            editorLineHeight: 1.68,
            editorLetterSpacing: "0px",
            shadow: "0 20px 40px rgba(0, 0, 0, 0.75)",
            shadowSmall: "0 10px 20px rgba(0, 0, 0, 0.6)",
            toolbarBg: "rgba(255, 255, 255, 0.04)",
            toolbarBorder: "rgba(255, 255, 255, 0.12)",
            toolbarShadow: "0 18px 32px rgba(0, 0, 0, 0.75)"
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
            light: dict.theme_light || "Light",
            dark: dict.theme_dark || "Dark",
            system: dict.theme_system || "System",
            graphite: dict.theme_graphite || "Graphite",
            neon_cyan: dict.theme_neon_cyan || "Neon Cyan",
            emerald_calm: dict.theme_emerald_calm || "Emerald Calm",
            violet_pulse: dict.theme_violet_pulse || "Violet Pulse",
            ocean_deep: dict.theme_ocean_deep || "Ocean Deep",
            oled_pure: dict.theme_oled_pure || "OLED Pure",
            manual: dict.theme_manual || "Manual"
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

            dot.onclick = () => {
                if (key === "manual") {
                    const saved = JSON.parse(localStorage.getItem("app-theme-settings")) || {}
                    const p = saved.p || this.themes.dark.p
                    const bg = saved.bg || this.themes.dark.bg
                    const t = saved.t || this.themes.dark.t
                    this.setManual(p, bg, t)
                } else {
                    this.applyPreset(key)
                }
                root.querySelectorAll(".theme-dot").forEach(d => d.classList.remove("active"))
                dot.classList.add("active")
            }

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
            this.applySignedInUI(state.user)
            if (typeof UI !== "undefined") UI.showToast(UI.getText("login_failed", "Sign in failed"))
        }
    },

    handleAuthError(e) {
        const code = e && e.code ? e.code : "auth/unknown"
        const getText = (typeof UI !== "undefined" && UI.getText) ? UI.getText.bind(UI) : ((_, fallback) => fallback || "")
        const messages = {
            "auth/popup-closed-by-user": getText("auth_popup_closed", "Sign-in cancelled"),
            "auth/network-request-failed": getText("auth_network_failed", "Network error"),
            "auth/cancelled-popup-request": getText("auth_popup_cancelled", "Request cancelled")
        }
        const msg = messages[code] || getText("auth_unknown", "Sign-in error")
        if (typeof UI !== "undefined") UI.showToast(msg)
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
