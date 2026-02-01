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
        neon: { p: '#00f2ff', bg: '#050505', t: '#ffffff' },
        cyber: { p: '#ff007a', bg: '#0a0005', t: '#ffccdd' },
        gold: { p: '#ffcc00', bg: '#0a0000', t: '#ffffcc' },
        emerald: { p: '#00ff88', bg: '#001a0a', t: '#ccffdd' },
        lava: { p: '#ff4d00', bg: '#1a0500', t: '#ffcccc' },
        midnight: { p: '#4e54c8', bg: '#050510', t: '#ccccff' },
        forest: { p: '#a3e635', bg: '#0a1500', t: '#eeffcc' },
        space: { p: '#e879f9', bg: '#100015', t: '#ffccff' }
    },

    init() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings'));
        if (saved) {
            this.setManual(saved.p, saved.bg, saved.t);
        } else {
            this.reset();
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
        const current = JSON.parse(localStorage.getItem('app-theme-settings')) || this.themes.neon;
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
            const isActive = current ? JSON.parse(current).p === t.p : key === 'neon';
            if (isActive) dot.classList.add('active');

            const label = document.createElement('span');
            label.className = 'theme-label';
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1);

            dot.onclick = () => {
                this.setManual(t.p, t.bg, t.t);
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
