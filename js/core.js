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

db.enablePersistence().catch((err) => {
    console.warn(err.code);
});

let state = {
    user: null,
    notes: [],
    folders: [],
    view: 'notes',
    activeFolderId: null,
    searchQuery: '',
    currentNote: null,
    tempRating: 0,
    config: { lang: 'ru' }
};

const LANG = {
    ru: {
        slogan: "Ваши мысли. В порядке.", login_google: "Войти через Google", all_notes: "Все записи",
        favorites: "Важное", archive: "Архив", folders: "ПАПКИ", about: "О нас", rate: "Оценить",
        settings: "Настройки", switch_acc: "Сменить", logout: "Выйти", empty: "Здесь пока пусто",
        general: "Общие", language: "Язык", appearance: "Внешний вид", presets: "Пресеты",
        manual: "Ручная настройка", c_text: "Текст", c_accent: "Акцент", c_bg: "Фон",
        reset: "Сбросить", close: "Закрыть", save: "Сохранить", team: "Команда",
        contact_us: "Связаться с нами:", send: "Отправить", cancel: "Отмена", yes: "Да"
    },
    en: {
        slogan: "Your thoughts. Organized.", login_google: "Sign in with Google", all_notes: "All Notes",
        favorites: "Important", archive: "Archive", folders: "FOLDERS", about: "About", rate: "Rate Us",
        settings: "Settings", switch_acc: "Switch", logout: "Logout", empty: "Nothing here yet",
        general: "General", language: "Language", appearance: "Appearance", presets: "Presets",
        manual: "Manual Config", c_text: "Text", c_accent: "Accent", c_bg: "Background",
        reset: "Reset", close: "Close", save: "Save", team: "Team",
        contact_us: "Contact us:", send: "Send", cancel: "Cancel", yes: "Yes"
    }
};

const ThemeManager = {
    themes: {
        neon: { p: '#00f2ff', bg: '#050505', t: '#ffffff' },
        cyber: { p: '#ff007a', bg: '#0a0005', t: '#ffccdd' },
        gold: { p: '#ffcc00', bg: '#0a0a00', t: '#ffffcc' },
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
        
        const observer = new MutationObserver(() => {
            if (document.getElementById('theme-picker-root')) {
                this.renderPicker();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
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
     
            dot.onclick = () => {
                this.applyCSS(t.p, t.bg, t.t);
                document.getElementById('cp-primary').value = t.p;
                document.getElementById('cp-bg').value = t.bg;
                document.getElementById('cp-text').value = t.t;
                
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            };
            wrapper.appendChild(dot);
            root.appendChild(wrapper);
        });
    },

    setManual(primary, bg, text) {
        this.applyCSS(primary, bg, text);
        localStorage.setItem('app-theme-settings', JSON.stringify({ p: primary, bg: bg, t: text }));
    },

    applyCSS(p, bg, t) {
        const root = document.documentElement;
        root.style.setProperty('--primary', p);
        root.style.setProperty('--bg', bg);
        root.style.setProperty('--surface', this.lighten(bg, 5));
        root.style.setProperty('--text', t);
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(p);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
        root.style.setProperty('--primary-rgb', rgb);
    },

    reset() {
        const def = this.themes.neon;
        this.setManual(def.p, def.bg, def.t);
        if(document.getElementById('cp-primary')) {
            document.getElementById('cp-primary').value = def.p;
            document.getElementById('cp-bg').value = def.bg;
            document.getElementById('cp-text').value = def.t;
        }
    },

    revertToLastSaved() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings'));
        if (saved) this.applyCSS(saved.p, saved.bg, saved.t);
        else this.reset();
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

    async loginGithub() {
        const provider = new firebase.auth.GithubAuthProvider();
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async loginEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const pass = document.getElementById('auth-pass')?.value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async registerEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const pass = document.getElementById('auth-pass')?.value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        if (pass.length < 6) return UI.showToast("Пароль от 6 символов");
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            UI.showToast("Регистрация успешна!");
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    handleAuthError(e) {
        console.error("Auth System Error:", e.code);
        const errorMessages = {
            'auth/account-exists-with-different-credential': "Этот Email уже привязан к другому способу входа",
            'auth/email-already-in-use': "Эта почта уже занята, попробуйте войти",
            'auth/wrong-password': "Неверный пароль",
            'auth/user-not-found': "Пользователь не найден",
            'auth/popup-closed-by-user': "Окно входа было закрыто",
            'auth/invalid-email': "Некорректный формат почты",
            'auth/network-request-failed': "Проблема с интернетом"
        };
        UI.showToast(errorMessages[e.code] || `Ошибка: ${e.code}`);
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
            window.location.reload();
        }
    },

    switchGoogleAccount() {
        this.switchAccount();
    }
};

auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;
        
        if (userPhoto) {
            userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random&color=fff`;
        }
        if (userName) {
           userName.textContent = user.displayName || user.email.split('@')[0];
        }

        if (loginScreen) {
            loginScreen.style.display = 'none';
            loginScreen.classList.remove('active');
        }
        if (appScreen) {
            appScreen.style.display = 'flex';
            appScreen.classList.add('active');
            appScreen.style.opacity = '1';
        }
        
        if (typeof initApp === 'function') initApp();
    } else {
        state.user = null;
        if (appScreen) {
            appScreen.style.display = 'none';
            appScreen.classList.remove('active');
        }
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.add('active');
            loginScreen.style.opacity = '1';
        }
    }
});

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());