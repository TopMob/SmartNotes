const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

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

document.addEventListener('DOMContentLoaded', () => {
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
    registerGlobals();
});
const login = () => auth.signInWithPopup(provider).catch(() => auth.signInWithRedirect(provider));
const logout = () => auth.signOut();
const switchAccount = () => auth.signOut().then(login);

function updateProfileUI(user) {
    const p = document.getElementById('user-pic'), n = document.getElementById('user-name');
    if (p) p.src = user.photoURL || '';
    if (n) n.textContent = user.displayName || 'User';
}

function subscribeNotes(uid) {
    db.collection("notes").where("uid", "==", uid).onSnapshot(snap => {
        state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNotes();
        const c = document.getElementById('note-count');
        if (c) c.textContent = state.notes.length;
    });
}

const renderNotes = () => {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    const s = (document.getElementById('search-input')?.value || '').toLowerCase();
    const sort = document.getElementById('sort-select')?.value || 'newest';

    let filtered = state.notes.filter(n => {
        const v = state.view === 'archive' ? n.isArchived : !n.isArchived;
        return v && (n.title?.toLowerCase().includes(s) || n.text?.toLowerCase().includes(s));
    });

    filtered.sort((a, b) => {
        if (state.view === 'active') {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
        }
        if (sort === 'priority') {
            const w = { high: 3, normal: 2, low: 1 };
            return (w[b.priority] || 2) - (w[a.priority] || 2);
        }
        if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    grid.innerHTML = '';
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = `note-card ${n.isPinned ? 'pinned' : ''}`;
        card.style.borderColor = n.priority === 'high' ? '#ff4444' : (n.priority === 'low' ? '#888' : 'transparent');
        card.onclick = () => openEditor(n.id);
        card.innerHTML = `<div class="note-content">
            ${n.isPinned ? '<div class="pin-icon">📌</div>' : ''}
            <h3>${escapeHtml(n.title || '')}</h3>
            <p>${escapeHtml(n.text || '')}</p>
            <div class="note-card-tags">${(n.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
            ${n.showTimestamp ? `<div class="date">${new Date(n.createdAt).toLocaleDateString()}</div>` : ''}
        </div>`;
        grid.appendChild(card);
    });
};

const openEditor = (id = null) => {
    state.editingId = id;
    const n = id ? state.notes.find(x => x.id === id) : null;
    const m = document.getElementById('editor-modal'), ab = document.getElementById('archive-btn'), dbn = document.getElementById('delete-btn');
    const sb = document.getElementById('save-btn-text');

    if (n) {
        document.getElementById('note-title').value = n.title || '';
        document.getElementById('note-text').value = n.text || '';
        document.getElementById('note-tags').value = (n.tags || []).join(' ');
        document.getElementById('show-time').checked = n.showTimestamp !== false;
        state.editorPinned = !!n.isPinned;
        updatePriorityUI(n.priority || 'normal');
        if (ab) { ab.style.display = 'block'; ab.textContent = n.isArchived ? '📤' : '📦'; }
        if (dbn) dbn.style.display = 'block';
        if (sb) sb.textContent = i18n[state.config.lang].update_btn;
    } else {
        document.getElementById('note-title').value = '';
        document.getElementById('note-text').value = '';
        document.getElementById('note-tags').value = '';
        document.getElementById('show-time').checked = true;
        state.editorPinned = false;
        updatePriorityUI('normal');
        if (ab) ab.style.display = 'none';
        if (dbn) dbn.style.display = 'none';
        if (sb) sb.textContent = i18n[state.config.lang].save_btn;
    }
    updatePinBtnUI();
    m?.classList.add('active');
};
const closeEditor = () => {
    const m = document.getElementById('editor-modal');
    if (m) m.classList.remove('active');
    state.editingId = null;
};

const saveNote = async () => {
    const t = document.getElementById('note-title').value.trim();
    const txt = document.getElementById('note-text').value.trim();
    if (!t && !txt) return closeEditor();

    const d = {
        title: t,
        text: txt,
        tags: document.getElementById('note-tags').value.split(' ').filter(x => x.trim()),
        priority: document.getElementById('priority-label').dataset.priority || 'normal',
        showTimestamp: document.getElementById('show-time').checked,
        isPinned: state.editorPinned,
        updatedAt: Date.now()
    };

    try {
        if (state.editingId) {
            await db.collection("notes").doc(state.editingId).update(d);
        } else {
            d.uid = state.user.uid;
            d.createdAt = Date.now();
            d.isArchived = false;
            await db.collection("notes").add(d);
        }
        closeEditor();
    } catch (e) { alert("Ошибка: " + e.message); }
};

const toggleArchive = async () => {
    if (!state.editingId) return;
    const n = state.notes.find(x => x.id === state.editingId);
    if (!n) return;
    try {
        await db.collection("notes").doc(state.editingId).update({ isArchived: !n.isArchived });
        closeEditor();
    } catch (e) { console.error(e); }
};

const deleteNoteWrapper = async () => {
    if (state.editingId && confirm(i18n[state.config.lang].confirm_del)) {
        await db.collection("notes").doc(state.editingId).delete();
        closeEditor();
    }
};

const togglePin = () => {
    state.editorPinned = !state.editorPinned;
    updatePinBtnUI();
};

function updatePinBtnUI() {
    const b = document.getElementById('pin-btn');
    if (b) b.classList.toggle('active', state.editorPinned);
}

const updatePriorityUI = (p) => {
    const l = document.getElementById('priority-label'), i = document.getElementById('priority-indicator');
    const d = i18n[state.config.lang];
    if (!l) return;
    l.dataset.priority = p;
    l.textContent = p === 'low' ? d.p_low : (p === 'high' ? d.p_high : d.p_norm);
    if (i) i.style.background = p === 'low' ? '#888' : (p === 'high' ? '#ff4444' : 'var(--accent)');
};

const cyclePriority = () => {
    const l = document.getElementById('priority-label'), curr = l.dataset.priority || 'normal';
    const seq = ['low', 'normal', 'high'], next = seq[(seq.indexOf(curr) + 1) % seq.length];
    updatePriorityUI(next);
};

// --- НАСТРОЙКИ И ЦВЕТА ---
const openSettings = () => {
    state.tempConfig = { ...state.config };
    document.getElementById('settings-modal')?.classList.add('active');
    loadSettingsUI();
};

const closeSettings = () => {
    applyTheme(state.config);
    document.getElementById('settings-modal')?.classList.remove('active');
};

const switchTab = (t) => {
    document.querySelectorAll('.tab-trigger, .tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(`lang-tab-${t}`)?.classList.add('active');
    document.getElementById(`tab-${t}`)?.classList.add('active');
};

const setColorTarget = (t) => {
    state.colorTarget = t;
    document.querySelectorAll('.target-btn').forEach(b => b.classList.toggle('active', b.dataset.target === t));
};

const updateColorPreview = (h) => {
    const hex = hslToHex(h, 100, 50);
    state.tempConfig[state.colorTarget] = hex;
    document.documentElement.style.setProperty(`--${state.colorTarget}`, hex);
};

const setQuickColor = (c) => {
    state.tempConfig[state.colorTarget] = c;
    document.documentElement.style.setProperty(`--${state.colorTarget}`, c);
};

const applySettings = () => {
    state.config = { ...state.tempConfig };
    Object.entries(state.config).forEach(([k, v]) => localStorage.setItem(`sn_${k}`, v));
    updateInterfaceText();
    closeSettings();
};

function applyTheme(c) {
    const r = document.documentElement;
    r.style.setProperty('--accent', c.accent);
    r.style.setProperty('--bg', c.bg);
    r.style.setProperty('--text', c.text);
    r.style.setProperty('--accent-glow', c.accent + '40');
}

function hslToHex(h, s, l) {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function registerGlobals() {
    const w = window;
    w.login = login; w.logout = logout; w.switchView = (v) => { state.view = v; renderNotes(); };
    w.openEditor = openEditor; w.closeEditor = closeEditor; w.saveNote = saveNote;
    w.deleteNoteWrapper = deleteNoteWrapper; w.togglePin = togglePin; w.toggleArchive = toggleArchive;
    w.cyclePriority = cyclePriority; w.openSettings = openSettings; w.closeSettings = closeSettings;
    w.switchTab = switchTab; w.setColorTarget = setColorTarget; w.updateColorPreview = updateColorPreview;
    w.setQuickColor = setQuickColor; w.applySettings = applySettings; w.setLanguage = (l) => { state.tempConfig.lang = l; updateInterfaceText(l); };
}
function loadSettingsUI() {
    const l = state.tempConfig.lang;
    document.getElementById('lang-ru')?.classList.toggle('active', l === 'ru');
    document.getElementById('lang-en')?.classList.toggle('active', l === 'en');
    setColorTarget(state.colorTarget);
}

function updateInterfaceText(previewLang = null) {
    const lang = previewLang || state.config.lang;
    const dict = i18n[lang];
    if (!dict) return;

    const map = {
        '#lang-login': dict.login,
        '#lang-view-active': dict.view_active,
        '#lang-view-archive': dict.view_archive,
        '#lang-app-title': dict.app_title,
        '#lang-settings-title': dict.settings_title,
        '#lang-tab-general': dict.tab_general,
        '#lang-tab-appearance': dict.tab_appearance,
        '#lang-lang-label': dict.lang_label,
        '#lang-target-label': dict.target_label,
        '#lang-target-accent': dict.target_accent,
        '#lang-target-bg': dict.target_bg,
        '#lang-target-text': dict.target_text,
        '#lang-spectrum-label': dict.spectrum_label,
        '#lang-btn-reset': dict.btn_reset,
        '#lang-btn-apply': dict.btn_apply,
        '#lang-stat-notes': dict.stat_notes
    };

    Object.entries(map).forEach(([sel, txt]) => {
        const el = document.querySelector(sel);
        if (el) el.textContent = txt;
    });

    const inputs = {
        'search-input': dict.search_ph,
        'note-title': dict.editor_title_ph,
        'note-text': dict.editor_text_ph,
        'note-tags': dict.tag_ph
    };

    Object.entries(inputs).forEach(([id, ph]) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = ph;
    });
}

const sendFeedback = async () => {
    const el = document.getElementById('feedback-text');
    if (!el?.value.trim()) return;
    try {
        await db.collection("feedback").add({
            uid: state.user.uid,
            text: el.value,
            createdAt: Date.now()
        });
        alert("Спасибо за отзыв!");
        el.value = "";
        closeFeedback();
    } catch (e) { alert(e.message); }
};

const openFeedback = () => document.getElementById('feedback-modal')?.classList.add('active');
const closeFeedback = () => document.getElementById('feedback-modal')?.classList.remove('active');

const resetSettings = () => {
    if (confirm("Сбросить все настройки?")) {
        state.tempConfig = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
        applyTheme(state.tempConfig);
        loadSettingsUI();
    }
};

function registerGlobals() {
    const w = window;
    w.login = login; w.logout = logout; w.switchAccount = switchAccount;
    w.openEditor = openEditor; w.closeEditor = closeEditor; w.saveNote = saveNote;
    w.deleteNoteWrapper = deleteNoteWrapper; w.togglePin = togglePin; w.toggleArchive = toggleArchive;
    w.cyclePriority = cyclePriority; w.openSettings = openSettings; w.closeSettings = closeSettings;
    w.switchTab = switchTab; w.setColorTarget = setColorTarget; w.updateColorPreview = updateColorPreview;
    w.setQuickColor = setQuickColor; w.applySettings = applySettings; w.resetSettings = resetSettings;
    w.setLanguage = (l) => { state.tempConfig.lang = l; updateInterfaceText(l); loadSettingsUI(); };
    w.openFeedback = openFeedback; w.closeFeedback = closeFeedback; w.sendFeedback = sendFeedback;
}
