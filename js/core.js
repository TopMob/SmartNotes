/**
 * SmartNotes - Core Architecture
 * Production-Ready Implementation
 */

/* ==========================================================================
   1. Utility Helpers (Must be defined first)
   ========================================================================== */
const Utils = {
    generateId: () => Math.random().toString(36).slice(2, 11),
    
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
    config: { lang: 'ru' },
    
    // Tools State
    driveToken: null,
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    
    // Editor State
    editorDirty: false,
    lastSaved: null
};

// Expose state globally
window.state = state;

/* ==========================================================================
   4. Localization Dictionary
   ========================================================================== */
const LANG = {
    ru: {
        slogan: "Ваши мысли. В порядке.", login_google: "Войти через Google", all_notes: "Все записи",
        favorites: "Важное", archive: "Архив", folders: "ПАПКИ", about: "О нас", rate: "Оценить",
        settings: "Настройки", switch_acc: "Сменить", logout: "Выйти", empty: "Здесь пока пусто",
        general: "Общие", language: "Язык", appearance: "Внешний вид", presets: "Пресеты",
        manual: "Ручная настройка", c_text: "Текст", c_accent: "Акцент", c_bg: "Фон",
        reset: "Сбросить", close: "Закрыть", save: "Сохранить", team: "Команда",
        contact_us: "Связаться с нами:", send: "Отправить", cancel: "Отмена", yes: "Да",
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
        slogan: "Your thoughts. Organized.", login_google: "Sign in with Google", all_notes: "All Notes",
        favorites: "Important", archive: "Archive", folders: "FOLDERS", about: "About", rate: "Rate Us",
        settings: "Settings", switch_acc: "Switch", logout: "Logout", empty: "Nothing here yet",
        general: "General", language: "Language", appearance: "Appearance", presets: "Presets",
        manual: "Manual Config", c_text: "Text", c_accent: "Accent", c_bg: "Background",
        reset: "Reset", close: "Close", save: "Save", team: "Team",
        contact_us: "Contact us:", send: "Send", cancel: "Cancel", yes: "Yes",
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
        light: { p: '#2563eb', bg: '#f8fafc', t: '#0f172a', surface: '#ffffff', surfaceLight: '#f1f5f9', border: 'rgba(15, 23, 42, 0.1)', radius: 14, fontBase: 16, hitSize: 44, shadow: '0 10px 30px rgba(15, 23, 42, 0.1)' },
        dark: { p: '#00f2ff', bg: '#050505', t: '#ffffff', surface: '#0f0f11', surfaceLight: '#18181b', border: 'rgba(255, 255, 255, 0.08)', radius: 12, fontBase: 16, hitSize: 40, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' },
        system: { p: '#6366f1', bg: '#050505', t: '#ffffff', surface: '#0f0f11', surfaceLight: '#18181b', border: 'rgba(255, 255, 255, 0.08)', radius: 12, fontBase: 16, hitSize: 40, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' },
        high_contrast: { p: '#ffffff', bg: '#000000', t: '#ffffff', surface: '#000000', surfaceLight: '#141414', border: 'rgba(255, 255, 255, 0.5)', radius: 12, fontBase: 18, hitSize: 48, shadow: 'none' },
        oled: { p: '#22c55e', bg: '#000000', t: '#ffffff', surface: '#050505', surfaceLight: '#0f0f0f', border: 'rgba(255, 255, 255, 0.15)', radius: 12, fontBase: 16, hitSize: 40, shadow: 'none' },
        monochrome: { p: '#6b7280', bg: '#0b0b0b', t: '#f5f5f5', surface: '#111111', surfaceLight: '#1a1a1a', border: 'rgba(255, 255, 255, 0.15)', radius: 10, fontBase: 16, hitSize: 40, shadow: '0 16px 30px rgba(0, 0, 0, 0.45)' },
        pastel: { p: '#8b5cf6', bg: '#f8f5ff', t: '#2e1065', surface: '#ffffff', surfaceLight: '#f1ecff', border: 'rgba(46, 16, 101, 0.15)', radius: 16, fontBase: 16, hitSize: 44, shadow: '0 12px 24px rgba(76, 29, 149, 0.12)' },
        warm: { p: '#f97316', bg: '#fff7ed', t: '#7c2d12', surface: '#ffffff', surfaceLight: '#ffedd5', border: 'rgba(124, 45, 18, 0.15)', radius: 16, fontBase: 16, hitSize: 44, shadow: '0 12px 24px rgba(124, 45, 18, 0.15)' },
        cool: { p: '#06b6d4', bg: '#ecfeff', t: '#0e7490', surface: '#ffffff', surfaceLight: '#cffafe', border: 'rgba(14, 116, 144, 0.15)', radius: 16, fontBase: 16, hitSize: 44, shadow: '0 12px 24px rgba(14, 116, 144, 0.15)' },
        minimal: { p: '#0f172a', bg: '#f8fafc', t: '#0f172a', surface: '#ffffff', surfaceLight: '#f1f5f9', border: 'rgba(15, 23, 42, 0.08)', radius: 8, fontBase: 15, hitSize: 40, shadow: 'none' },
        compact: { p: '#3b82f6', bg: '#0b1220', t: '#e2e8f0', surface: '#111827', surfaceLight: '#1f2937', border: 'rgba(226, 232, 240, 0.1)', radius: 10, fontBase: 14, hitSize: 36, shadow: '0 12px 24px rgba(0, 0, 0, 0.4)' },
        spacious: { p: '#22c55e', bg: '#0f172a', t: '#f8fafc', surface: '#111827', surfaceLight: '#1f2937', border: 'rgba(248, 250, 252, 0.1)', radius: 18, fontBase: 17, hitSize: 48, shadow: '0 24px 40px rgba(0, 0, 0, 0.5)' },
        low_vision: { p: '#facc15', bg: '#0a0a0a', t: '#ffffff', surface: '#111111', surfaceLight: '#1f1f1f', border: 'rgba(255, 255, 255, 0.35)', radius: 16, fontBase: 20, hitSize: 52, shadow: 'none' },
        glass: { p: '#00f2ff', bg: '#06080f', t: '#ffffff', surface: 'rgba(15, 23, 42, 0.65)', surfaceLight: 'rgba(30, 41, 59, 0.7)', border: 'rgba(255, 255, 255, 0.15)', radius: 16, fontBase: 16, hitSize: 44, shadow: '0 25px 50px rgba(0, 0, 0, 0.5)' },
        matte: { p: '#4ade80', bg: '#111827', t: '#f1f5f9', surface: '#1f2937', surfaceLight: '#374151', border: 'rgba(241, 245, 249, 0.12)', radius: 14, fontBase: 16, hitSize: 42, shadow: '0 16px 26px rgba(0, 0, 0, 0.4)' },
        neon: { p: '#00f2ff', bg: '#050505', t: '#ffffff', surface: '#0f0f11', surfaceLight: '#18181b', border: 'rgba(255, 255, 255, 0.08)', radius: 12, fontBase: 16, hitSize: 40, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' },
        paper: { p: '#2563eb', bg: '#f8f1e7', t: '#1f2937', surface: '#fffaf3', surfaceLight: '#f3e8d6', border: 'rgba(31, 41, 55, 0.15)', radius: 10, fontBase: 16, hitSize: 42, shadow: '0 12px 20px rgba(31, 41, 55, 0.1)' },
        sunrise: { p: '#ef4444', bg: '#1f0a0a', t: '#fee2e2', surface: '#2a0f0f', surfaceLight: '#3a1515', border: 'rgba(254, 226, 226, 0.15)', radius: 12, fontBase: 16, hitSize: 40, shadow: '0 20px 30px rgba(0, 0, 0, 0.5)' },
        ocean: { p: '#38bdf8', bg: '#04121f', t: '#e2f2ff', surface: '#0b1d2a', surfaceLight: '#12283a', border: 'rgba(226, 242, 255, 0.15)', radius: 12, fontBase: 16, hitSize: 40, shadow: '0 20px 30px rgba(0, 0, 0, 0.5)' }
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
        
        Object.keys(this.themes).forEach(key => {
            const t = this.themes[key];
            const wrapper = document.createElement('div');
            wrapper.className = 'theme-item-wrapper';
            
            const dot = document.createElement('div');
            dot.className = 'theme-dot';
            dot.style.background = t.p;
            
            const current = localStorage.getItem('app-theme-settings');
            const parsed = current ? JSON.parse(current) : null;
            const isActive = parsed ? (parsed.preset ? parsed.preset === key : parsed.p === t.p) : key === 'dark';
            if (isActive) dot.classList.add('active');

            const label = document.createElement('span');
            label.className = 'theme-label';
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1);

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
        this.applyCSS(primary, bg, text);
        this.syncInputs(primary, bg, text);
        localStorage.setItem('app-theme-settings', JSON.stringify({ p: primary, bg: bg, t: text }));
    },

    getSavedTheme() {
        return JSON.parse(localStorage.getItem('app-theme-settings')) || this.themes.neon;
    },

    revertToLastSaved() {
        const saved = this.getSavedTheme();
        this.setManual(saved.p, saved.bg, saved.t);
        this.renderPicker();
    },

    applyCSS(p, bg, t) {
        const root = document.documentElement;
        root.style.setProperty('--primary', p);
        root.style.setProperty('--bg', bg);
        // Calculate surface variations based on background
        root.style.setProperty('--surface', Utils.adjustColor(bg, 10)); 
        root.style.setProperty('--surface-light', Utils.adjustColor(bg, 20));
        root.style.setProperty('--text', t);
        
        // Convert Hex to RGB for opacity usage in CSS
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(p);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
        root.style.setProperty('--primary-rgb', rgb);
    },

    reset() {
        const def = this.themes.neon;
        this.setManual(def.p, def.bg, def.t);
        this.renderPicker();
    },

    revertToLastSaved() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings')) || this.themes.neon;
        this.applyCSS(saved.p, saved.bg, saved.t);
        this.syncInputs(saved.p, saved.bg, saved.t);
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
