const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56",
    clientId: "523799066979-e75bl0vvthlr5193qee8niocvkoqaknq.apps.googleusercontent.com"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

const state = {
    user: null,
    notes: [],
    folders: [],
    view: 'notes',
    activeFolderId: null,
    searchQuery: '',
    currentNote: null,
    tempRating: 0,
    config: { lang: 'ru' },
    driveToken: null,
    recording: false,
    editorDirty: false
};

const LANG = {
    ru: {
        all_notes: "Все записи", favorites: "Важное", archive: "Архив", folders: "ПАПКИ",
        about: "О нас", rate: "Оценить", settings: "Настройки", switch_acc: "Сменить",
        logout: "Выйти", empty: "Здесь пока пусто", general: "Общие", language: "Язык",
        appearance: "Внешний вид", presets: "Пресеты", manual: "Ручная настройка",
        c_text: "Текст", c_accent: "Акцент", c_bg: "Фон", reset: "Сбросить",
        close: "Закрыть", save: "Сохранить", team: "Команда", contact_us: "Связаться с нами:",
        send: "Отправить", cancel: "Отмена", yes: "Да", tools: "Инструменты редактора"
    },
    en: {
        all_notes: "All Notes", favorites: "Important", archive: "Archive", folders: "FOLDERS",
        about: "About", rate: "Rate Us", settings: "Settings", switch_acc: "Switch",
        logout: "Logout", empty: "Nothing here yet", general: "General", language: "Language",
        appearance: "Appearance", presets: "Presets", manual: "Manual Config",
        c_text: "Text", c_accent: "Accent", c_bg: "Background", reset: "Reset",
        close: "Close", save: "Save", team: "Team", contact_us: "Contact us:",
        send: "Send", cancel: "Cancel", yes: "Yes", tools: "Editor Tools"
    }
};

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
        saved ? this.setManual(saved.p, saved.bg, saved.t) : this.reset();
        
        new MutationObserver(() => {
            const root = document.getElementById('theme-picker-root');
            if (root && !root.hasChildNodes()) this.renderPicker();
            this.bindInputs();
        }).observe(document.body, { childList: true, subtree: true });
    },

    bindInputs() {
        ['cp-primary', 'cp-bg', 'cp-text'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = (e) => this.updateManual(id === 'cp-primary' ? 'p' : id === 'cp-bg' ? 'bg' : 't', e.target.value);
        });
    },

    updateManual(key, val) {
        const current = JSON.parse(localStorage.getItem('app-theme-settings')) || this.themes.neon;
        current[key] = val;
        this.setManual(current.p, current.bg, current.t);
    },

    renderPicker() {
        const root = document.getElementById('theme-picker-root');
        if (!root) return;
        root.innerHTML = '';
        
        Object.entries(this.themes).forEach(([key, t]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'theme-item-wrapper';
            
            const dot = document.createElement('div');
            dot.className = 'theme-dot';
            dot.style.background = t.p;
            
            const current = JSON.parse(localStorage.getItem('app-theme-settings'));
            if ((current && current.p === t.p) || (!current && key === 'neon')) dot.classList.add('active');

            dot.onclick = () => {
                this.setManual(t.p, t.bg, t.t);
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            };
            
            const label = document.createElement('span');
            label.className = 'theme-label';
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            
            wrapper.append(dot, label);
            root.appendChild(wrapper);
        });
    },

    setManual(p, bg, t) {
        const root = document.documentElement.style;
        root.setProperty('--primary', p);
        root.setProperty('--bg', bg);
        root.setProperty('--surface', this.lighten(bg, 5));
        root.setProperty('--surface-light', this.lighten(bg, 10));
        root.setProperty('--text', t);
        
        const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(p);
        root.setProperty('--primary-rgb', rgb ? `${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}` : '0, 242, 255');
        
        ['cp-primary', 'cp-bg', 'cp-text'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.value = [p, bg, t][i];
        });

        localStorage.setItem('app-theme-settings', JSON.stringify({ p, bg, t }));
    },

    reset() {
        const def = this.themes.neon;
        this.setManual(def.p, def.bg, def.t);
        this.renderPicker();
    },

    lighten(col, amt) {
        const num = parseInt(col.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amt));
        const b = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
        const g = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
        return `#${(g | (b << 8) | (r << 16)).toString(16).padStart(6, '0')}`;
    }
};

const Auth = {
    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try { await auth.signInWithPopup(provider); } catch (e) { this.handleError(e); }
    },

    async logout() {
        try { await auth.signOut(); window.location.reload(); } catch (e) { console.error(e); }
    },

    async switchAccount() {
        try {
            await auth.signOut();
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await auth.signInWithPopup(provider);
        } catch (e) { window.location.reload(); }
    },

    handleError(e) {
        const map = {
            'auth/popup-closed-by-user': "Вход отменен",
            'auth/network-request-failed': "Нет сети"
        };
        if (typeof UI !== 'undefined') UI.showToast(map[e.code] || `Ошибка: ${e.code}`);
    }
};

const Utils = {
    generateId: () => Math.random().toString(36).substr(2, 9),
    stripHtml: (html) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }
};

auth.onAuthStateChanged(user => {
    const els = {
        login: document.getElementById('login-screen'),
        app: document.getElementById('app'),
        photo: document.getElementById('user-photo'),
        name: document.getElementById('user-name')
    };

    if (user) {
        state.user = user;
        if (els.photo) els.photo.src = user.photoURL;
        if (els.name) els.name.textContent = user.displayName;

        els.login?.classList.remove('active');
        setTimeout(() => els.login && (els.login.style.display = 'none'), 500);
        
        if (els.app) {
            els.app.style.display = 'flex';
            setTimeout(() => els.app.classList.add('active'), 50);
        }
        if (typeof initApp === 'function') initApp();
    } else {
        state.user = null;
        els.app?.classList.remove('active');
        setTimeout(() => els.app && (els.app.style.display = 'none'), 500);
        
        if (els.login) {
            els.login.style.display = 'flex';
            setTimeout(() => els.login.classList.add('active'), 50);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
