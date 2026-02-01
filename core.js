/**
 * SmartNotes - Core Architecture
 * 
 * Clean Code, SOLID principles, No-Placeholder Implementation
 * Modern ES6+ Standards
 */

/* ==========================================================================
   Configuration & Initialization
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

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence().catch(err => {
    if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
    }
});

/* ==========================================================================
   State Management
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
    
    // Tools & Integrations
    driveToken: null,
    recording: false,
    mediaRecorder: null,
    audioChunks: [],
    
    // Editor State
    editorDirty: false,
    lastSaved: null
};

// Language Dictionary
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
        t_bold: "Bold", t_italic: "Italic", t_list: "List", t_check: "Checklist",
        t_code: "Code", t_quote: "Quote", t_image: "Image", t_mic: "Voice",
        t_sketch: "Sketch", t_clear: "Clear Formatting"
    }
};

/* ==========================================================================
   Theme Management
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
        
        // Setup observer to render picker when modal opens
        const observer = new MutationObserver(() => {
            const root = document.getElementById('theme-picker-root');
            if (root && root.innerHTML === '') {
                this.renderPicker();
            }
            this.setupColorInputs();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    setupColorInputs() {
        const pInput = document.getElementById('cp-primary');
        const bgInput = document.getElementById('cp-bg');
        const tInput = document.getElementById('cp-text');
        
        if(pInput) pInput.oninput = (e) => this.updateManual('p', e.target.value);
        if(bgInput) bgInput.oninput = (e) => this.updateManual('bg', e.target.value);
        if(tInput) tInput.oninput = (e) => this.updateManual('t', e.target.value);
    },

    updateManual(type, val) {
        const current = JSON.parse(localStorage.getItem('app-theme-settings')) || this.themes.neon;
        if(type === 'p') current.p = val;
        if(type === 'bg') current.bg = val;
        if(type === 't') current.t = val;
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
            
            const label = document.createElement('span');
            label.className = 'theme-label';
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            
            // Check active state
            const current = localStorage.getItem('app-theme-settings');
            if(current && JSON.parse(current).p === t.p) dot.classList.add('active');
            else if(!current && key === 'neon') dot.classList.add('active');

            dot.onclick = () => {
                this.applyCSS(t.p, t.bg, t.t);
                this.syncInputs(t.p, t.bg, t.t);
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                localStorage.setItem('app-theme-settings', JSON.stringify(t));
            };
            
            wrapper.appendChild(dot);
            wrapper.appendChild(label);
            root.appendChild(wrapper);
        });
    },

    syncInputs(p, bg, t) {
        const pIn = document.getElementById('cp-primary');
        const bgIn = document.getElementById('cp-bg');
        const tIn = document.getElementById('cp-text');
        if(pIn) pIn.value = p;
        if(bgIn) bgIn.value = bg;
        if(tIn) tIn.value = t;
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
        root.style.setProperty('--surface', this.lighten(bg, 5));
        root.style.setProperty('--surface-light', this.lighten(bg, 10));
        root.style.setProperty('--text', t);
        
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(p);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
        root.style.setProperty('--primary-rgb', rgb);
    },

    reset() {
        const def = this.themes.neon;
        this.setManual(def.p, def.bg, def.t);
        this.renderPicker();
    },

    lighten(col, amt) {
        let usePound = false;
        if (col[0] == "#") { 
            col = col.slice(1); 
            usePound = true;
        }
        let num = parseInt(col,16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt; 
        if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
    }
};

/* ==========================================================================
   Auth Service
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
            UI.showToast("Ошибка при выходе");
        }
    },

    async switchAccount() {
        try {
            await auth.signOut();
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await auth.signInWithPopup(provider);
        } catch (e) {
            // If user cancels or error occurs, reload to ensure clean state or restore previous session
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
        UI.showToast(messages[e.code] || `Ошибка входа: ${e.code}`);
    }
};

/* ==========================================================================
   Main App Initialization
   ========================================================================== */

auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;
        
        // Update User UI
        if (userPhoto) {
            userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random&color=fff`;
        }
        if (userName) {
            userName.textContent = user.displayName || user.email.split('@')[0];
        }

        // Transition Screens
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

        // Initialize Core Logic
        if (typeof initApp === 'function') initApp();

    } else {
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

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    
    // Prevent zoom on double tap
    document.addEventListener('dblclick', function(event) {
        event.preventDefault();
    }, { passive: false });
});

/* ==========================================================================
   Utility Helpers
   ========================================================================== */
const Utils = {
    generateId: () => Math.random().toString(36).substr(2, 9),
    
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    formatDate: (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat(state.config.lang, {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(date);
    },

    stripHtml: (html) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }
};

// Google Drive API Configuration
const DRIVE_CLIENT_ID = "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com";
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file";
