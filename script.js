// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// --- ЛОКАЛИЗАЦИЯ (i18n) ---
const i18n = {
    ru: {
        app_title: "Smart Notes",
        settings_title: "Настройки",
        tab_general: "Общие",
        tab_appearance: "Стиль",
        lang_label: "Язык интерфейса",
        target_label: "Что красим?",
        target_accent: "Акцент",
        target_bg: "Фон",
        target_text: "Текст",
        spectrum_label: "Выбери цвет",
        btn_reset: "Сброс",
        btn_apply: "ОК",
        search_ph: "Поиск заметок...",
        sort_newest: "Сначала новые",
        sort_priority: "По важности",
        sort_title: "По названию",
        view_active: "Заметки",
        view_archive: "Архив",
        save_btn: "СОХРАНИТЬ",
        update_btn: "ОБНОВИТЬ",
        editor_title_ph: "Заголовок",
        editor_text_ph: "Начните писать...",
        tag_ph: "теги через пробел",
        label_time: "Время",
        p_low: "Низкий",
        p_norm: "Средний",
        p_high: "Высокий 🔥",
        confirm_del: "Удалить заметку?",
        stat_notes: "записей",
        login: "ВОЙТИ ЧЕРЕЗ GOOGLE"
    },
    en: {
        app_title: "Smart Notes",
        settings_title: "Settings",
        tab_general: "General",
        tab_appearance: "Style",
        lang_label: "Language",
        target_label: "Target Element",
        target_accent: "Accent",
        target_bg: "Background",
        target_text: "Text",
        spectrum_label: "Pick Color",
        btn_reset: "Reset",
        btn_apply: "OK",
        search_ph: "Search notes...",
        sort_newest: "Newest first",
        sort_priority: "By Priority",
        sort_title: "By Title",
        view_active: "Notes",
        view_archive: "Archive",
        save_btn: "SAVE",
        update_btn: "UPDATE",
        editor_title_ph: "Title",
        editor_text_ph: "Start writing...",
        tag_ph: "tags by space",
        label_time: "Time",
        p_low: "Low",
        p_norm: "Medium",
        p_high: "High 🔥",
        confirm_del: "Delete note?",
        stat_notes: "records",
        login: "LOGIN WITH GOOGLE"
    }
};

// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let state = {
    user: null,
    notes: [],
    view: 'active',
    editingId: null,
    editorPinned: false,
    colorTarget: 'accent',
    tempConfig: {},
    config: {
        lang: localStorage.getItem('sn_lang') || 'ru',
        accent: localStorage.getItem('sn_accent') || '#00ffcc',
        bg: localStorage.getItem('sn_bg') || '#000000',
        text: localStorage.getItem('sn_text') || '#ffffff'
    }
};

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
    state.tempConfig = { ...state.config };
    applyTheme(state.config);
    updateInterfaceText();

    auth.onAuthStateChanged(user => {
        state.user = user;
        const loginScreen = document.getElementById('login-screen');
        const appContent = document.getElementById('app-content');

        if (user) {
            if (loginScreen) loginScreen.style.display = 'none';
            if (appContent) appContent.classList.remove('hidden');
            subscribeNotes(user.uid);
            updateProfileUI(user);
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appContent) appContent.classList.add('hidden');
            state.notes = [];
            renderNotes();
        }
    });
});

// --- АВТОРИЗАЦИЯ ---
const login = async () => {
    try { await auth.signInWithPopup(provider); } 
    catch (e) { await auth.signInWithRedirect(provider); }
};
const logout = () => auth.signOut();

function updateProfileUI(user) {
    const pic = document.getElementById('user-pic');
    const name = document.getElementById('user-name');
    if (pic) pic.src = user.photoURL || '';
    if (name) name.textContent = user.displayName || 'User';
}

// --- ДАННЫЕ ---
function subscribeNotes(uid) {
    db.collection("notes")
      .where("uid", "==", uid)
      .onSnapshot(snap => {
          state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderNotes();
          updateStats();
      });
}

function updateStats() {
    const countEl = document.getElementById('note-count');
    if (countEl) countEl.textContent = state.notes.length;
}

// --- РЕНДЕРИНГ ---
const renderNotes = () => {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase();
    const sortBy = document.getElementById('sort-select')?.value || 'newest';

    let filtered = state.notes.filter(n => {
        const isCorrectView = state.view === 'archive' ? n.isArchived : !n.isArchived;
        const matchesSearch = (n.title || '').toLowerCase().includes(searchTerm) || 
                             (n.text || '').toLowerCase().includes(searchTerm);
        return isCorrectView && matchesSearch;
    });

    filtered.sort((a, b) => {
        if (state.view === 'active') {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
        }
        if (sortBy === 'priority') {
            const weights = { high: 3, normal: 2, low: 1 };
            return (weights[b.priority] || 2) - (weights[a.priority] || 2);
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    grid.innerHTML = '';
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = `note-card ${n.isPinned ? 'pinned' : ''}`;
        card.style.borderColor = getPriorityColor(n.priority);
        card.onclick = () => openEditor(n.id);
        card.innerHTML = `
            <div class="note-content">
                ${n.isPinned ? '<div class="pin-icon">📌</div>' : ''}
                <h3 class="note-card-title">${escapeHtml(n.title || '')}</h3>
                <p class="note-card-text">${escapeHtml(n.text || '')}</p>
                <div class="note-card-tags">
                    ${(n.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
                </div>
                ${n.showTimestamp ? `<div class="date">${new Date(n.createdAt).toLocaleDateString()}</div>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
};
// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI ---
const switchView = (v) => {
    state.view = v;
    document.querySelectorAll('.view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.id.includes(v));
    });
    renderNotes();
};

function getPriorityColor(p) {
    if (p === 'high') return '#ff4444';
    if (p === 'low') return '#888888';
    return 'transparent';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applyTheme(cfg) {
    const r = document.documentElement;
    r.style.setProperty('--accent', cfg.accent);
    r.style.setProperty('--bg', cfg.bg);
    r.style.setProperty('--text', cfg.text);
    r.style.setProperty('--accent-glow', cfg.accent + '40');
}

// --- ЛОГИКА РЕДАКТОРА ---
const openEditor = (id = null) => {
    state.editingId = id;
    const modal = document.getElementById('editor-modal');
    const deleteBtn = document.getElementById('delete-btn');
    const archiveBtn = document.getElementById('archive-btn');
    const saveBtnText = document.getElementById('save-btn-text');

    if (id) {
        const note = state.notes.find(n => n.id === id);
        if (note) {
            if (archiveBtn) {
                archiveBtn.style.display = 'block';
                archiveBtn.textContent = note.isArchived ? '📤' : '📦';
            }
            document.getElementById('note-title').value = note.title || '';
            document.getElementById('note-text').value = note.text || '';
            document.getElementById('note-tags').value = (note.tags || []).join(' ');
            document.getElementById('show-time').checked = note.showTimestamp !== false;
            state.editorPinned = !!note.isPinned;
            updatePriorityUI(note.priority || 'normal');
            if (deleteBtn) deleteBtn.style.display = 'block';
            if (saveBtnText) saveBtnText.textContent = i18n[state.config.lang].update_btn;
        }
    } else {
        if (archiveBtn) archiveBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        document.getElementById('note-title').value = '';
        document.getElementById('note-text').value = '';
        document.getElementById('note-tags').value = '';
        document.getElementById('show-time').checked = true;
        state.editorPinned = false;
        updatePriorityUI('normal');
        if (saveBtnText) saveBtnText.textContent = i18n[state.config.lang].save_btn;
    }

    updatePinBtnUI();
    if (modal) modal.classList.add('active');
};

const closeEditor = () => {
    const modal = document.getElementById('editor-modal');
    if (modal) modal.classList.remove('active');
    state.editingId = null;
};

const togglePin = () => {
    state.editorPinned = !state.editorPinned;
    updatePinBtnUI();
};

const toggleArchive = async () => {
    if (!state.editingId) return;
    const note = state.notes.find(n => n.id === state.editingId);
    if (!note) return;
    try {
        await db.collection("notes").doc(state.editingId).update({
            isArchived: !note.isArchived
        });
        closeEditor();
    } catch (e) { console.error(e); }
};

function updatePinBtnUI() {
    const btn = document.getElementById('pin-btn');
    if (btn) btn.classList.toggle('active', state.editorPinned);
}

const cyclePriority = () => {
    const label = document.getElementById('priority-label');
    const current = label.dataset.priority || 'normal';
    const sequence = ['low', 'normal', 'high'];
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    updatePriorityUI(next);
};

function updatePriorityUI(p) {
    const label = document.getElementById('priority-label');
    const indicator = document.getElementById('priority-indicator');
    const dict = i18n[state.config.lang];
    if (!label) return;
    label.dataset.priority = p;
    label.textContent = p === 'low' ? dict.p_low : (p === 'high' ? dict.p_high : dict.p_norm);
    if (indicator) indicator.style.background = p === 'low' ? '#888' : (p === 'high' ? '#ff4444' : 'var(--accent)');
}
// --- СОХРАНЕНИЕ И УДАЛЕНИЕ ---
const saveNote = async () => {
    const title = document.getElementById('note-title').value.trim();
    const text = document.getElementById('note-text').value.trim();
    if (!title && !text) return closeEditor();

    const data = {
        title, text,
        tags: document.getElementById('note-tags').value.split(' ').filter(t => t.trim()),
        priority: document.getElementById('priority-label').dataset.priority || 'normal',
        showTimestamp: document.getElementById('show-time').checked,
        isPinned: state.editorPinned,
        updatedAt: Date.now()
    };

    try {
        if (state.editingId) {
            await db.collection("notes").doc(state.editingId).update(data);
        } else {
            data.uid = state.user.uid;
            data.createdAt = Date.now();
            data.isArchived = false;
            await db.collection("notes").add(data);
        }
        closeEditor();
    } catch (e) { alert("Ошибка: " + e.message); }
};

const deleteNoteWrapper = async () => {
    if (!state.editingId) return;
    if (confirm(i18n[state.config.lang].confirm_del)) {
        await db.collection("notes").doc(state.editingId).delete();
        closeEditor();
    }
};

// --- НАСТРОЙКИ ---
const openSettings = () => {
    state.tempConfig = { ...state.config };
    document.getElementById('settings-modal')?.classList.add('active');
    loadSettingsUI();
};

const closeSettings = () => {
    document.getElementById('settings-modal')?.classList.remove('active');
    applyTheme(state.config);
};

const applySettings = () => {
    state.config = { ...state.tempConfig };
    localStorage.setItem('sn_lang', state.config.lang);
    localStorage.setItem('sn_accent', state.config.accent);
    localStorage.setItem('sn_bg', state.config.bg);
    localStorage.setItem('sn_text', state.config.text);
    updateInterfaceText();
    closeSettings();
};

const resetSettings = () => {
    if (confirm("Сбросить всё?")) {
        state.tempConfig = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
        applyTheme(state.tempConfig);
        loadSettingsUI();
    }
};

function loadSettingsUI() {
    document.getElementById('lang-ru')?.classList.toggle('active', state.tempConfig.lang === 'ru');
    document.getElementById('lang-en')?.classList.toggle('active', state.tempConfig.lang === 'en');
}

const setLanguage = (lang) => {
    state.tempConfig.lang = lang;
    updateInterfaceText(lang);
    loadSettingsUI();
};

function updateInterfaceText(previewLang = null) {
    const lang = previewLang || state.config.lang;
    const dict = i18n[lang];
    const map = {
        '#lang-view-active': dict.view_active,
        '#lang-view-archive': dict.view_archive,
        '#lang-save-btn-text': state.editingId ? dict.update_btn : dict.save_btn,
        '#lang-app-title': dict.app_title
    };
    for (let [id, text] of Object.entries(map)) {
        const el = document.querySelector(id);
        if (el) el.textContent = text;
    }
}

// --- ГЛОБАЛЬНАЯ РЕГИСТРАЦИЯ ---
window.login = login;
window.logout = logout;
window.switchView = switchView;
window.openEditor = openEditor;
window.closeEditor = closeEditor;
window.saveNote = saveNote;
window.deleteNoteWrapper = deleteNoteWrapper;
window.togglePin = togglePin;
window.toggleArchive = toggleArchive;
window.cyclePriority = cyclePriority;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.applySettings = applySettings;
window.resetSettings = resetSettings;
window.setLanguage = setLanguage;

console.log("✅ Smart Notes полностью загружен.");
