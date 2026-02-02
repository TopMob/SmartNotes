/**
 * SmartNotes - Core Architecture
 * Production-Ready Implementation
 */

/* ==========================================================================
   1. Utility Helpers (Must be defined first)
   ========================================================================== */
const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    snap: (value, step) => Math.round(value / step) * step,
    
    debounce: (func, wait) => {
        let timeout;
        return function(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    formatDate: (timestamp) => {
        if (!timestamp) return '';
        // Handle both Firestore Timestamp and JS Date objects
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const lang = (window.state && window.state.config.lang) || 'ru';
        
        try {
            return new Intl.DateTimeFormat(lang, {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }).format(date);
        } catch (e) {
            return date.toLocaleDateString();
        }
    },

    stripHtml: (html) => {
        if (!html) return "";
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    },

    escapeHtml: (value) => {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Color manipulation for theme generation
    adjustColor: (col, amt) => {
        let usePound = false;
        if (col[0] === "#") {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    }
};

/* ==========================================================================
   2. Configuration & Firebase Init
   ========================================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
};

// Google Drive API Constants
const DRIVE_CLIENT_ID = "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com";
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file";

let auth = null;
let db = null;

if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === 'failed-precondition') {
            console.warn('Persistence failed: Multiple tabs open.');
        } else if (err.code === 'unimplemented') {
            console.warn('Persistence failed: Browser not supported.');
        }
    });
} else {
    console.error("Firebase SDK not loaded. Check index.html order.");
}

/* ==========================================================================
   3. Global State
   ========================================================================== */
const state = {
    user: null,
    notes: [],
    folders: [],
    view: 'notes', // notes, favorites, archive, folder
    activeFolderId: null,
    searchQuery: '',
    currentNote: null,
    tempRating: 0,
    config: { lang: 'ru', folderViewMode: 'compact', reduceMotion: false },
    
    // Tools State
    driveToken: null,
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    
    // Editor State
    editorDirty: false,
    lastSaved: null,
    orderHistory: []
};

// Expose state globally
window.state = state;

/* ==========================================================================
   4. Localization Dictionary
   ========================================================================== */
const LANG = {
    ru: {
        app_name: "SmartNotes",
        slogan: "Ваши мысли. В порядке.", login: "Вход в систему", login_google: "Войти через Google", all_notes: "Все записи",
        favorites: "Важное", archive: "Архив", folders: "ПАПКИ", folders_overview: "Папки", about: "О нас", rate: "Оценить",
        settings: "Настройки", switch_acc: "Сменить", logout: "Выйти", empty: "Здесь пока пусто",
        general: "Общие", language: "Язык", appearance: "Внешний вид", presets: "Пресеты",
        manual: "Ручная настройка", c_text: "Текст", c_accent: "Акцент", c_bg: "Фон",
        reset: "Сбросить", close: "Закрыть", save: "Сохранить", team: "Команда",
        contact_us: "Связаться с нами:", send: "Отправить", cancel: "Отмена", yes: "Да",
        search: "Поиск...", note_title: "Заголовок", note_tags: "#тег (Enter)",
        feedback_placeholder: "Поделитесь впечатлениями...",
        note_actions: "Действия", download_note: "Скачать файл", upload_note: "Отправить в облако",
        photo_editor: "Редактор фото",
        folders_settings: "Папки", folder_view_mode: "Отображение", folder_view_compact: "В боковой панели", folder_view_full: "Полный экран",
        reduce_motion: "Уменьшить анимации",
        view_notes: "Все записи", view_favorites: "Важное", view_archive: "Архив", view_folder: "Папка", view_folders: "Папки",
        note_single: "заметка", note_plural: "заметок", folders_empty: "Нет папок",
        pin_note: "Закрепить", favorite_note: "Важное", archive_note: "Архивировать",
        untitled_note: "Без названия", empty_note: "Нет содержимого",
        new_folder: "Новая папка", folder_placeholder: "Название...", folder_limit: "Лимит папок достигнут",
        archived: "В архиве", restored: "Восстановлено",
        saving: "Сохранение...", saved: "Сохранено",
        rate_required: "Поставьте оценку", feedback_thanks: "Спасибо!",
        order_updated: "Порядок обновлен", undo: "Отменить",
        import_file: "Импортировать файл", import_invalid: "Неверный формат файла", import_empty: "Файлы не содержат заметок",
        import_success: "Импортировано", import_failed: "Ошибка импорта",
        download_success: "Файл сохранен",
        drive_connected: "Google Drive подключен", drive_unavailable: "Сервис Drive недоступен", drive_saved: "Загружено в Drive", drive_error: "Ошибка синхронизации",
        mic_unsupported: "Микрофон не поддерживается", mic_denied: "Нет доступа к микрофону", recording: "Запись...",
        reminder_set: "Напоминание",
        confirm_delete: "Удалить?", confirm_exit: "Выйти?", confirm_account: "Сменить аккаунт?", confirm_delete_folder: "Удалить папку?", confirm_default: "Подтвердите",
        move_toolbar: "Переместить панель",
        task_item: "Задача",
        system_override: "System Override",
        close_menu: "Закрыть меню", add_folder: "Создать папку", open_menu: "Открыть меню", search_aria: "Поиск заметок",
        create_note: "Создать заметку", create_folder: "Создать папку", editor: "Редактор", back: "Назад", undo: "Отменить", redo: "Повторить",
        delete_note: "Удалить заметку", note_title_aria: "Заголовок заметки", note_body_aria: "Текст заметки",
        note_tags_aria: "Добавить тег", save_note: "Сохранить", prompt_title: "Ввод", prompt_input: "Поле ввода",
        toggle_toolbar: "Показать панель", show_toolbar: "Показать панель", hide_toolbar: "Скрыть панель",
        ok: "ОК", insert: "Вставить", sketch_title: "Холст", sketch_color: "Цвет кисти", sketch_width: "Толщина кисти",
        sketch_undo: "Отменить штрих", sketch_clear: "Очистить", text_size: "Размер шрифта",
        align_left: "По левому краю", align_center: "По центру", align_right: "По правому краю",
        reset_media: "Сбросить размер", draw_photo: "Рисовать на фото", delete: "Удалить",
        photo_color: "Цвет кисти", photo_width: "Толщина кисти", clear: "Очистить",
        folder_view_aria: "Режим отображения папок", color_text: "Цвет текста", color_accent: "Акцентный цвет",
        color_bg: "Цвет фона", feedback_aria: "Ваш отзыв",
        theme_light: "Светлая", theme_dark: "Темная", theme_system: "Системная", theme_high_contrast: "Высокий контраст",
        theme_oled: "OLED", theme_monochrome: "Монохром", theme_pastel: "Пастель", theme_warm: "Теплая",
        theme_cold: "Холодная", theme_minimal: "Минимал", theme_compact: "Компактная", theme_spacious: "Просторная",
        theme_accessibility: "Доступность", theme_glass: "Стекло", theme_matte: "Матовая", theme_neon: "Неон",
        theme_paper: "Бумага", theme_sunrise: "Рассвет", theme_ocean: "Океан",
        tools: "Инструменты редактора",
        sections: "Разделы",
        appearance_settings: "Внешний вид",
        editor_settings: "Настройки редактора",
        tool_size: "Размер текста",
        tool_bold: "Жирный",
        tool_italic: "Курсив",
        tool_list_ul: "Список",
        tool_task: "Чек-лист",
        tool_color: "Цвет текста",
        tool_highlight: "Подсветка",
        tool_image: "Изображение",
        tool_voice: "Голос",
        tool_sketch: "Рисунок",
        tool_drive: "Google Drive",
        tool_clear: "Очистка форматирования",
        t_bold: "Жирный", t_italic: "Курсив", t_list: "Список", t_check: "Задачи",
        t_code: "Код", t_quote: "Цитата", t_image: "Изображение", t_mic: "Голос",
        t_sketch: "Рисунок", t_clear: "Очистить"
    },
    en: {
        app_name: "SmartNotes",
        slogan: "Your thoughts. Organized.", login: "Sign in", login_google: "Sign in with Google", all_notes: "All Notes",
        favorites: "Important", archive: "Archive", folders: "FOLDERS", folders_overview: "Folders", about: "About", rate: "Rate Us",
        settings: "Settings", switch_acc: "Switch", logout: "Logout", empty: "Nothing here yet",
        general: "General", language: "Language", appearance: "Appearance", presets: "Presets",
        manual: "Manual Config", c_text: "Text", c_accent: "Accent", c_bg: "Background",
        reset: "Reset", close: "Close", save: "Save", team: "Team",
        contact_us: "Contact us:", send: "Send", cancel: "Cancel", yes: "Yes",
        search: "Search...", note_title: "Title", note_tags: "#tag (Enter)",
        feedback_placeholder: "Share your feedback...",
        note_actions: "Actions", download_note: "Download file", upload_note: "Upload to cloud",
        photo_editor: "Photo Editor",
        folders_settings: "Folders", folder_view_mode: "Display", folder_view_compact: "Sidebar list", folder_view_full: "Full view",
        reduce_motion: "Reduce motion",
        view_notes: "All Notes", view_favorites: "Important", view_archive: "Archive", view_folder: "Folder", view_folders: "Folders",
        note_single: "note", note_plural: "notes", folders_empty: "No folders yet",
        pin_note: "Pin", favorite_note: "Favorite", archive_note: "Archive",
        untitled_note: "Untitled", empty_note: "No content",
        new_folder: "New folder", folder_placeholder: "Folder name", folder_limit: "Folder limit reached",
        archived: "Archived", restored: "Restored",
        saving: "Saving...", saved: "Saved",
        rate_required: "Please rate the app", feedback_thanks: "Thanks!",
        order_updated: "Order updated", undo: "Undo",
        import_file: "Import file", import_invalid: "Unsupported file", import_empty: "No notes found",
        import_success: "Imported", import_failed: "Import failed",
        download_success: "File saved",
        drive_connected: "Drive connected", drive_unavailable: "Drive unavailable", drive_saved: "Uploaded to Drive", drive_error: "Drive upload failed",
        mic_unsupported: "Microphone not supported", mic_denied: "Microphone access denied", recording: "Recording...",
        reminder_set: "Reminder set",
        confirm_delete: "Delete?", confirm_exit: "Sign out?", confirm_account: "Switch account?", confirm_delete_folder: "Delete folder?", confirm_default: "Confirm",
        move_toolbar: "Move toolbar",
        task_item: "Task",
        system_override: "System Override",
        close_menu: "Close menu", add_folder: "Create folder", open_menu: "Open menu", search_aria: "Search notes",
        create_note: "Create note", create_folder: "Create folder", editor: "Editor", back: "Back", undo: "Undo", redo: "Redo",
        delete_note: "Delete note", note_title_aria: "Note title", note_body_aria: "Note body",
        note_tags_aria: "Add tag", save_note: "Save", prompt_title: "Input", prompt_input: "Input field",
        toggle_toolbar: "Toggle toolbar", show_toolbar: "Show toolbar", hide_toolbar: "Hide toolbar",
        ok: "OK", insert: "Insert", sketch_title: "Canvas", sketch_color: "Brush color", sketch_width: "Brush width",
        sketch_undo: "Undo stroke", sketch_clear: "Clear", text_size: "Text size",
        align_left: "Align left", align_center: "Align center", align_right: "Align right",
        reset_media: "Reset size", draw_photo: "Draw on photo", delete: "Delete",
        photo_color: "Brush color", photo_width: "Brush width", clear: "Clear",
        folder_view_aria: "Folder display mode", color_text: "Text color", color_accent: "Accent color",
        color_bg: "Background color", feedback_aria: "Your feedback",
        theme_light: "Light", theme_dark: "Dark", theme_system: "System", theme_high_contrast: "High Contrast",
        theme_oled: "OLED", theme_monochrome: "Monochrome", theme_pastel: "Pastel", theme_warm: "Warm",
        theme_cold: "Cold", theme_minimal: "Minimal", theme_compact: "Compact", theme_spacious: "Spacious",
        theme_accessibility: "Accessibility", theme_glass: "Glass", theme_matte: "Matte", theme_neon: "Neon",
        theme_paper: "Paper", theme_sunrise: "Sunrise", theme_ocean: "Ocean",
        tools: "Editor Tools",
        sections: "Sections",
        appearance_settings: "Appearance",
        editor_settings: "Editor Settings",
        tool_size: "Text size",
        tool_bold: "Bold",
        tool_italic: "Italic",
        tool_list_ul: "List",
        tool_task: "Checklist",
        tool_color: "Text color",
        tool_highlight: "Highlight",
        tool_image: "Image",
        tool_voice: "Voice",
        tool_sketch: "Sketch",
        tool_drive: "Google Drive",
        tool_clear: "Clear formatting",
        t_bold: "Bold", t_italic: "Italic", t_list: "List", t_check: "Checklist",
        t_code: "Code", t_quote: "Quote", t_image: "Image", t_mic: "Voice",
        t_sketch: "Sketch", t_clear: "Clear Formatting"
    }
};

/* ==========================================================================
   5. Theme Manager
   ========================================================================== */
const ThemeManager = {
    themes: {
        light: { p: '#2563eb', bg: '#f8fafc', t: '#0f172a', surface: '#ffffff', surfaceLight: '#f1f5f9', border: 'rgba(15, 23, 42, 0.1)', radius: 14, fontBase: 16, hitSize: 44, shadow: '0 10px 30px rgba(15, 23, 42, 0.1)', density: 1, blur: 18, motion: 1, fontScale: 1, spacing: 1, lineHeight: 1.65, editorSurface: '#ffffff', editorToolbarBg: 'rgba(15, 23, 42, 0.04)', editorHeaderBg: 'rgba(248, 250, 252, 0.8)', editorShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' },
        dark: { p: '#00f2ff', bg: '#050505', t: '#ffffff', surface: '#0f0f11', surfaceLight: '#18181b', border: 'rgba(255, 255, 255, 0.08)', radius: 12, fontBase: 16, hitSize: 44, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', density: 1, blur: 20, motion: 1, fontScale: 1, spacing: 1, lineHeight: 1.7, editorSurface: '#0f0f11', editorToolbarBg: 'rgba(255, 255, 255, 0.03)', editorHeaderBg: 'rgba(5, 5, 5, 0.65)', editorShadow: '0 20px 32px rgba(0, 0, 0, 0.55)' },
        system: { preset: 'system' },
        high_contrast: { p: '#ffffff', bg: '#000000', t: '#ffffff', surface: '#000000', surfaceLight: '#141414', border: 'rgba(255, 255, 255, 0.6)', radius: 14, fontBase: 18, hitSize: 52, shadow: 'none', density: 1.1, blur: 0, motion: 0.8, fontScale: 1.08, spacing: 1.1, lineHeight: 1.6, editorSurface: '#000000', editorToolbarBg: 'rgba(255, 255, 255, 0.08)', editorHeaderBg: '#000000', editorShadow: 'none' },
        oled: { p: '#22c55e', bg: '#000000', t: '#ffffff', surface: '#050505', surfaceLight: '#0f0f0f', border: 'rgba(255, 255, 255, 0.15)', radius: 12, fontBase: 16, hitSize: 44, shadow: 'none', density: 1, blur: 8, motion: 1, fontScale: 1, spacing: 0.95, lineHeight: 1.7, editorSurface: '#050505', editorToolbarBg: 'rgba(255, 255, 255, 0.02)', editorHeaderBg: '#000000', editorShadow: 'none' },
        monochrome: { p: '#6b7280', bg: '#0b0b0b', t: '#f5f5f5', surface: '#111111', surfaceLight: '#1a1a1a', border: 'rgba(255, 255, 255, 0.15)', radius: 10, fontBase: 16, hitSize: 44, shadow: '0 16px 30px rgba(0, 0, 0, 0.45)', density: 0.95, blur: 8, motion: 1, fontScale: 0.98, spacing: 0.95, lineHeight: 1.65, editorSurface: '#111111', editorToolbarBg: 'rgba(255, 255, 255, 0.04)', editorHeaderBg: '#0b0b0b', editorShadow: '0 16px 30px rgba(0, 0, 0, 0.6)' },
        pastel: { p: '#8b5cf6', bg: '#f8f5ff', t: '#2e1065', surface: '#ffffff', surfaceLight: '#f1ecff', border: 'rgba(46, 16, 101, 0.15)', radius: 18, fontBase: 16, hitSize: 46, shadow: '0 12px 24px rgba(76, 29, 149, 0.12)', density: 1.05, blur: 18, motion: 1, fontScale: 1.05, spacing: 1.1, lineHeight: 1.75, editorSurface: '#ffffff', editorToolbarBg: 'rgba(139, 92, 246, 0.08)', editorHeaderBg: 'rgba(248, 245, 255, 0.85)', editorShadow: '0 14px 28px rgba(76, 29, 149, 0.2)' },
        warm: { p: '#f97316', bg: '#fff7ed', t: '#7c2d12', surface: '#ffffff', surfaceLight: '#ffedd5', border: 'rgba(124, 45, 18, 0.15)', radius: 18, fontBase: 16, hitSize: 46, shadow: '0 12px 24px rgba(124, 45, 18, 0.15)', density: 1.05, blur: 16, motion: 1, fontScale: 1.04, spacing: 1.1, lineHeight: 1.75, editorSurface: '#ffffff', editorToolbarBg: 'rgba(249, 115, 22, 0.1)', editorHeaderBg: 'rgba(255, 247, 237, 0.88)', editorShadow: '0 16px 28px rgba(124, 45, 18, 0.18)' },
        cold: { p: '#06b6d4', bg: '#ecfeff', t: '#0e7490', surface: '#ffffff', surfaceLight: '#cffafe', border: 'rgba(14, 116, 144, 0.15)', radius: 18, fontBase: 16, hitSize: 46, shadow: '0 12px 24px rgba(14, 116, 144, 0.15)', density: 1.05, blur: 16, motion: 1, fontScale: 1.04, spacing: 1.08, lineHeight: 1.75, editorSurface: '#ffffff', editorToolbarBg: 'rgba(6, 182, 212, 0.08)', editorHeaderBg: 'rgba(236, 254, 255, 0.88)', editorShadow: '0 16px 28px rgba(14, 116, 144, 0.18)' },
        minimal: { p: '#0f172a', bg: '#f8fafc', t: '#0f172a', surface: '#ffffff', surfaceLight: '#f1f5f9', border: 'rgba(15, 23, 42, 0.08)', radius: 8, fontBase: 15, hitSize: 42, shadow: 'none', density: 0.9, blur: 0, motion: 0.9, fontScale: 0.95, spacing: 0.85, lineHeight: 1.6, editorSurface: '#ffffff', editorToolbarBg: 'rgba(15, 23, 42, 0.03)', editorHeaderBg: '#ffffff', editorShadow: 'none' },
        compact: { p: '#3b82f6', bg: '#0b1220', t: '#e2e8f0', surface: '#111827', surfaceLight: '#1f2937', border: 'rgba(226, 232, 240, 0.1)', radius: 10, fontBase: 14, hitSize: 40, shadow: '0 12px 24px rgba(0, 0, 0, 0.4)', density: 0.85, blur: 12, motion: 1, fontScale: 0.9, spacing: 0.8, lineHeight: 1.55, editorSurface: '#111827', editorToolbarBg: 'rgba(59, 130, 246, 0.1)', editorHeaderBg: 'rgba(11, 18, 32, 0.75)', editorShadow: '0 12px 24px rgba(0, 0, 0, 0.6)' },
        spacious: { p: '#22c55e', bg: '#0f172a', t: '#f8fafc', surface: '#111827', surfaceLight: '#1f2937', border: 'rgba(248, 250, 252, 0.1)', radius: 20, fontBase: 17, hitSize: 52, shadow: '0 24px 40px rgba(0, 0, 0, 0.5)', density: 1.2, blur: 20, motion: 1, fontScale: 1.15, spacing: 1.3, lineHeight: 1.85, editorSurface: '#111827', editorToolbarBg: 'rgba(34, 197, 94, 0.08)', editorHeaderBg: 'rgba(15, 23, 42, 0.7)', editorShadow: '0 28px 48px rgba(0, 0, 0, 0.6)' },
        accessibility: { p: '#facc15', bg: '#0a0a0a', t: '#ffffff', surface: '#111111', surfaceLight: '#1f1f1f', border: 'rgba(255, 255, 255, 0.45)', radius: 18, fontBase: 20, hitSize: 56, shadow: 'none', density: 1.25, blur: 0, motion: 0.6, fontScale: 1.2, spacing: 1.35, lineHeight: 1.9, editorSurface: '#111111', editorToolbarBg: 'rgba(250, 204, 21, 0.14)', editorHeaderBg: '#0a0a0a', editorShadow: 'none' },
        glass: { p: '#00f2ff', bg: '#06080f', t: '#ffffff', surface: 'rgba(15, 23, 42, 0.65)', surfaceLight: 'rgba(30, 41, 59, 0.7)', surfaceTransparent: 'rgba(15, 23, 42, 0.55)', border: 'rgba(255, 255, 255, 0.2)', radius: 18, fontBase: 16, hitSize: 46, shadow: '0 25px 50px rgba(0, 0, 0, 0.5)', density: 1, blur: 24, motion: 1, fontScale: 1.05, spacing: 1.05, lineHeight: 1.75, editorSurface: 'rgba(8, 12, 20, 0.8)', editorToolbarBg: 'rgba(15, 23, 42, 0.6)', editorHeaderBg: 'rgba(15, 23, 42, 0.7)', editorShadow: '0 30px 60px rgba(0, 0, 0, 0.6)' },
        matte: { p: '#4ade80', bg: '#111827', t: '#f1f5f9', surface: '#1f2937', surfaceLight: '#374151', border: 'rgba(241, 245, 249, 0.12)', radius: 14, fontBase: 16, hitSize: 44, shadow: '0 16px 26px rgba(0, 0, 0, 0.35)', density: 1, blur: 0, motion: 1, fontScale: 1, spacing: 1, lineHeight: 1.7, editorSurface: '#1f2937', editorToolbarBg: 'rgba(74, 222, 128, 0.08)', editorHeaderBg: 'rgba(17, 24, 39, 0.8)', editorShadow: '0 18px 28px rgba(0, 0, 0, 0.55)' },
        neon: { p: '#00f2ff', bg: '#050505', t: '#ffffff', surface: '#0f0f11', surfaceLight: '#18181b', border: 'rgba(255, 255, 255, 0.08)', radius: 12, fontBase: 16, hitSize: 44, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', density: 1, blur: 18, motion: 1, fontScale: 1, spacing: 1, lineHeight: 1.7, editorSurface: '#0f0f11', editorToolbarBg: 'rgba(0, 242, 255, 0.08)', editorHeaderBg: 'rgba(5, 5, 5, 0.7)', editorShadow: '0 24px 38px rgba(0, 0, 0, 0.7)' },
        paper: { p: '#2563eb', bg: '#f8f1e7', t: '#1f2937', surface: '#fffaf3', surfaceLight: '#f3e8d6', border: 'rgba(31, 41, 55, 0.15)', radius: 10, fontBase: 16, hitSize: 44, shadow: '0 12px 20px rgba(31, 41, 55, 0.1)', density: 1, blur: 6, motion: 1, fontScale: 1.02, spacing: 1.15, lineHeight: 1.8, editorSurface: '#fffaf3', editorToolbarBg: 'rgba(37, 99, 235, 0.08)', editorHeaderBg: 'rgba(255, 250, 243, 0.9)', editorShadow: '0 16px 24px rgba(31, 41, 55, 0.12)' },
        sunrise: { p: '#ef4444', bg: '#1f0a0a', t: '#fee2e2', surface: '#2a0f0f', surfaceLight: '#3a1515', border: 'rgba(254, 226, 226, 0.15)', radius: 12, fontBase: 16, hitSize: 44, shadow: '0 20px 30px rgba(0, 0, 0, 0.5)', density: 1, blur: 14, motion: 1, fontScale: 1.05, spacing: 1.1, lineHeight: 1.75, editorSurface: '#2a0f0f', editorToolbarBg: 'rgba(239, 68, 68, 0.1)', editorHeaderBg: 'rgba(31, 10, 10, 0.75)', editorShadow: '0 24px 36px rgba(0, 0, 0, 0.6)' },
        ocean: { p: '#38bdf8', bg: '#04121f', t: '#e2f2ff', surface: '#0b1d2a', surfaceLight: '#12283a', border: 'rgba(226, 242, 255, 0.15)', radius: 12, fontBase: 16, hitSize: 44, shadow: '0 20px 30px rgba(0, 0, 0, 0.5)', density: 1, blur: 14, motion: 1, fontScale: 1.02, spacing: 1.05, lineHeight: 1.75, editorSurface: '#0b1d2a', editorToolbarBg: 'rgba(56, 189, 248, 0.1)', editorHeaderBg: 'rgba(4, 18, 31, 0.78)', editorShadow: '0 24px 36px rgba(0, 0, 0, 0.6)' }
    },

    init() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings'));
        if (saved) {
            const preset = saved.preset && this.themes[saved.preset] ? saved.preset : null;
            if (preset) {
                this.applyPreset(preset);
            } else {
                this.setManual(saved.p, saved.bg, saved.t);
            }
        } else {
            this.applyPreset('dark');
        }
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', () => {
            const current = JSON.parse(localStorage.getItem('app-theme-settings'));
            if (current?.preset === 'system') {
                this.applyPreset('system');
            }
        });
        
        // Observer for lazy-loaded DOM elements (Theme Picker)
        const observer = new MutationObserver(() => {
            const root = document.getElementById('theme-picker-root');
            if (root && root.innerHTML === '') {
                this.renderPicker();
                this.setupColorInputs();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    setupColorInputs() {
        const bind = (id, type) => {
            const el = document.getElementById(id);
            if (el) el.oninput = (e) => this.updateManual(type, e.target.value);
        };
        bind('cp-primary', 'p');
        bind('cp-bg', 'bg');
        bind('cp-text', 't');
    },

    updateManual(type, val) {
        const current = JSON.parse(localStorage.getItem('app-theme-settings')) || this.themes.dark;
        current[type] = val;
        this.setManual(current.p, current.bg, current.t);
    },

    renderPicker() {
        const root = document.getElementById('theme-picker-root');
        if (!root) return;
        root.innerHTML = '';
        const dict = LANG[state.config.lang] || LANG.ru;
        const labels = {
            light: dict.theme_light || 'Light',
            dark: dict.theme_dark || 'Dark',
            system: dict.theme_system || 'System',
            high_contrast: dict.theme_high_contrast || 'High Contrast',
            oled: dict.theme_oled || 'OLED',
            monochrome: dict.theme_monochrome || 'Monochrome',
            pastel: dict.theme_pastel || 'Pastel',
            warm: dict.theme_warm || 'Warm',
            cold: dict.theme_cold || 'Cold',
            minimal: dict.theme_minimal || 'Minimal',
            compact: dict.theme_compact || 'Compact',
            spacious: dict.theme_spacious || 'Spacious',
            accessibility: dict.theme_accessibility || 'Accessibility',
            glass: dict.theme_glass || 'Glass',
            matte: dict.theme_matte || 'Matte',
            neon: dict.theme_neon || 'Neon',
            paper: dict.theme_paper || 'Paper',
            sunrise: dict.theme_sunrise || 'Sunrise',
            ocean: dict.theme_ocean || 'Ocean'
        };

        Object.keys(this.themes).forEach(key => {
            const t = this.themes[key];
            const wrapper = document.createElement('div');
            wrapper.className = 'theme-item-wrapper';
            
            const dot = document.createElement('div');
            dot.className = 'theme-dot';
            const color = t.p || (key === 'system' ? '#6366f1' : '#00f2ff');
            dot.style.background = color;
            
            const current = localStorage.getItem('app-theme-settings');
            const parsed = current ? JSON.parse(current) : null;
            const isActive = parsed ? (parsed.preset ? parsed.preset === key : parsed.p === t.p) : key === 'dark';
            if (isActive) dot.classList.add('active');

            const label = document.createElement('span');
            label.className = 'theme-label';
            label.textContent = labels[key] || key.charAt(0).toUpperCase() + key.slice(1);

            dot.onclick = () => {
                this.applyPreset(key);
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            };
            
            wrapper.append(dot, label);
            root.appendChild(wrapper);
        });
    },

    syncInputs(p, bg, t) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('cp-primary', p);
        setVal('cp-bg', bg);
        setVal('cp-text', t);
    },

    setManual(primary, bg, text) {
        const base = this.themes.dark;
        this.applyThemeVars({ ...base, p: primary, bg, t: text, surface: Utils.adjustColor(bg, 10), surfaceLight: Utils.adjustColor(bg, 20) });
        this.syncInputs(primary, bg, text);
        localStorage.setItem('app-theme-settings', JSON.stringify({ p: primary, bg: bg, t: text }));
    },


    applyThemeVars(theme) {
        const root = document.documentElement;
        const bg = theme.bg;
        const surface = theme.surface || Utils.adjustColor(bg, 10);
        const surfaceLight = theme.surfaceLight || Utils.adjustColor(bg, 20);
        const border = theme.border || 'rgba(255, 255, 255, 0.1)';
        const motionScale = typeof theme.motion === 'number' ? theme.motion : 1;
        const motionAllowed = this.motionAllowed() && motionScale !== 0;
        const blurAllowed = this.blurAllowed() ? theme.blur : 0;
        const density = theme.density || 1;
        const spacing = theme.spacing || 1;
        const fontScale = theme.fontScale || 1;
        const lineHeight = theme.lineHeight || 1.7;
        const editorSurface = theme.editorSurface || surface;
        const editorBorder = theme.editorBorder || border;
        const editorToolbarBg = theme.editorToolbarBg || 'rgba(255, 255, 255, 0.03)';
        const editorHeaderBg = theme.editorHeaderBg || theme.surfaceTransparent || surface;
        const editorShadow = theme.editorShadow || theme.shadow;
        root.style.setProperty('--primary', theme.p);
        root.style.setProperty('--bg', bg);
        root.style.setProperty('--surface', surface);
        root.style.setProperty('--surface-light', surfaceLight);
        root.style.setProperty('--surface-transparent', theme.surfaceTransparent || surface);
        root.style.setProperty('--text', theme.t);
        root.style.setProperty('--border', border);
        root.style.setProperty('--radius-md', `${theme.radius}px`);
        root.style.setProperty('--radius-lg', `${theme.radius + 6}px`);
        root.style.setProperty('--radius-sm', `${Math.max(theme.radius - 4, 6)}px`);
        root.style.setProperty('--font-base', `${theme.fontBase}px`);
        root.style.setProperty('--hit-size', `${theme.hitSize}px`);
        root.style.setProperty('--shadow-lg', theme.shadow);
        root.style.setProperty('--shadow-sm', theme.shadowSmall || theme.shadow);
        root.style.setProperty('--density', density);
        root.style.setProperty('--blur-strength', `${blurAllowed}px`);
        root.style.setProperty('--motion-enabled', motionAllowed ? '1' : '0');
        root.style.setProperty('--animation-duration', motionAllowed ? `${0.3 * motionScale}s` : '0s');
        root.style.setProperty('--space-unit', spacing);
        root.style.setProperty('--font-scale', fontScale);
        root.style.setProperty('--line-height', lineHeight);
        root.style.setProperty('--editor-surface', editorSurface);
        root.style.setProperty('--editor-border', editorBorder);
        root.style.setProperty('--editor-toolbar-bg', editorToolbarBg);
        root.style.setProperty('--editor-header-bg', editorHeaderBg);
        root.style.setProperty('--editor-shadow', editorShadow);

        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(theme.p);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
        root.style.setProperty('--primary-rgb', rgb);
    },

    motionAllowed() {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return !prefersReduced && !state.config.reduceMotion;
    },

    blurAllowed() {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const lowPower = (connection && connection.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
        return !(prefersReduced || lowPower);
    },

    applyPreset(key) {
        const preset = this.themes[key];
        if (!preset) return;
        if (preset.preset === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const variant = isDark ? this.themes.dark : this.themes.light;
            this.applyThemeVars({ ...variant });
            localStorage.setItem('app-theme-settings', JSON.stringify({ preset: 'system' }));
            return;
        }
        this.applyThemeVars(preset);
        localStorage.setItem('app-theme-settings', JSON.stringify({ preset: key }));
        this.syncInputs(preset.p, preset.bg, preset.t);
    },

    reset() {
        this.applyPreset('dark');
        this.renderPicker();
    },

    revertToLastSaved() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings')) || { preset: 'dark' };
        if (saved.preset) {
            this.applyPreset(saved.preset);
            this.renderPicker();
            return;
        }
        this.setManual(saved.p, saved.bg, saved.t);
        this.renderPicker();
    }
};

/* ==========================================================================
   6. Auth Service
   ========================================================================== */
const Auth = {
    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async logout() {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (e) {
            console.error("Logout Error:", e);
            if (typeof UI !== 'undefined') UI.showToast("Ошибка при выходе");
        }
    },

    async switchAccount() {
        try {
            await auth.signOut();
            this.login();
        } catch (e) {
            window.location.reload();
        }
    },

    handleAuthError(e) {
        console.error("Auth System Error:", e.code);
        const messages = {
            'auth/popup-closed-by-user': "Вход отменен",
            'auth/network-request-failed': "Нет соединения с интернетом",
            'auth/cancelled-popup-request': "Запрос отменен"
        };
        const msg = messages[e.code] || `Ошибка входа: ${e.code}`;
        if (typeof UI !== 'undefined') UI.showToast(msg);
        else alert(msg);
    }
};

/* ==========================================================================
   7. Bootstrap & Auth Listener
   ========================================================================== */
if (auth) {
    auth.onAuthStateChanged(user => {
    // 1. Update State
    state.user = user;

    // 2. DOM Elements (Safe selection)
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        // --- User Logged In ---
        
        // Update Header UI
        if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random&color=fff`;
        if (userName) userName.textContent = user.displayName || user.email.split('@')[0];

        // Switch Screens
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => {
                loginScreen.style.display = 'none';
                loginScreen.classList.remove('active');
            }, 500);
        }

        if (appScreen) {
            appScreen.style.display = 'flex';
            setTimeout(() => {
                appScreen.style.opacity = '1';
                appScreen.classList.add('active');
            }, 50);
        }

        // Initialize App Logic (if app.js is loaded)
        if (typeof window.initApp === 'function') {
            window.initApp();
        }

    } else {
        // --- User Logged Out ---
        state.user = null;

        if (appScreen) {
            appScreen.style.opacity = '0';
            setTimeout(() => {
                appScreen.style.display = 'none';
                appScreen.classList.remove('active');
            }, 500);
        }

        if (loginScreen) {
            loginScreen.style.display = 'flex';
            setTimeout(() => {
                loginScreen.classList.add('active');
                loginScreen.style.opacity = '1';
            }, 50);
        }
    }
    });
}

// Initialize Theme Manager on Load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    
    // Prevent double-tap zoom on iOS
    document.addEventListener('dblclick', (event) => {
        event.preventDefault();
    }, { passive: false });
});
