/**
 * SMART NOTES - FINAL STABLE CORE
 */

const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const i18n = {
    ru: {
        app_title: "Smart Notes",
        settings_title: "Настройки",
        tab_general: "Общие",
        tab_appearance: "Внешний вид",
        lang_label: "Язык / Language",
        target_label: "Что настраиваем?",
        target_accent: "Акцент",
        target_bg: "Фон",
        target_text: "Текст",
        spectrum_label: "Основной оттенок",
        advanced_label: "Расширенные настройки (HEX)",
        btn_reset: "Сброс",
        btn_cancel: "Отмена",
        btn_apply: "Применить",
        search_ph: "Поиск...",
        sort_newest: "Сначала новые",
        sort_priority: "По важности",
        sort_title: "По названию",
        view_active: "Заметки",
        view_archive: "Архив 📦",
        save_btn: "Сохранить",
        update_btn: "Обновить",
        editor_title_ph: "Заголовок...",
        editor_text_ph: "Текст заметки...",
        tag_ph: "теги через пробел",
        label_time: "Время",
        label_archive: "В архив",
        p_low: "Низкий",
        p_norm: "Средний",
        p_high: "Высокий 🔥",
        confirm_del: "Удалить заметку?",
        stat_notes: "заметок",
        login: "LOGIN",
        contact_us: "Связаться с нами"
    },
    en: {
        app_title: "Smart Notes",
        settings_title: "Settings",
        tab_general: "General",
        tab_appearance: "Appearance",
        lang_label: "Language",
        target_label: "Target Element",
        target_accent: "Accent",
        target_bg: "Background",
        target_text: "Text",
        spectrum_label: "Main Hue",
        advanced_label: "Advanced (HEX)",
        btn_reset: "Reset",
        btn_cancel: "Cancel",
        btn_apply: "Apply",
        search_ph: "Search...",
        sort_newest: "Newest first",
        sort_priority: "By Priority",
        sort_title: "By Title",
        view_active: "Active",
        view_archive: "Archive 📦",
        save_btn: "Save",
        update_btn: "Update",
        editor_title_ph: "Title...",
        editor_text_ph: "Note content...",
        tag_ph: "tags separated by space",
        label_time: "Date",
        label_archive: "Archive",
        p_low: "Low",
        p_norm: "Normal",
        p_high: "High 🔥",
        confirm_del: "Delete note?",
        stat_notes: "notes",
        login: "LOGIN",
        contact_us: "Contact Us"
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

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    state.tempConfig = { ...state.config };
    applyTheme(state.config);
    updateInterfaceText();
    document.getElementById('universal-color-picker').value = state.config.accent;

    auth.onAuthStateChanged(user => {
        state.user = user;
        updateAuthUI(user);
        if (user) {
            subscribeNotes(user.uid);
            updateProfile(user);
        } else {
            state.notes = [];
            renderNotes();
        }
    });
});

function subscribeNotes(uid) {
    db.collection("notes").where("uid", "==", uid).onSnapshot(snap => {
        state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNotes();
        updateStats();
    });
}

// --- AUTH ---
window.login = () => auth.signInWithPopup(provider);
window.logout = () => auth.signOut();
window.switchAccount = () => auth.signOut().then(login);

function updateAuthUI(user) {
    document.getElementById('login-btn').classList.toggle('hidden', !!user);
    document.getElementById('user-ui').classList.toggle('hidden', !user);
    document.getElementById('app-content').classList.toggle('hidden', !user);
    if (user) document.getElementById('user-pic').src = user.photoURL;
}

function updateProfile(user) {
    document.getElementById('modal-user-pic').src = user.photoURL;
    document.getElementById('user-name').textContent = user.displayName;
}

function updateStats() {
    document.getElementById('note-count').innerHTML = `${state.notes.length} <small>${i18n[state.config.lang].stat_notes}</small>`;
}

// --- RENDERING ---
window.renderNotes = () => {
    const list = document.getElementById('notesList');
    const q = document.getElementById('search').value.toLowerCase();
    const sort = document.getElementById('sort-select').value;
    list.innerHTML = '';

    let filtered = state.notes.filter(n => {
        const viewMatch = state.view === 'archive' ? n.isArchived : !n.isArchived;
        const textMatch = (n.title || '').toLowerCase().includes(q) || 
                          (n.text || '').toLowerCase().includes(q) ||
                          (n.tags || []).some(t => t.toLowerCase().includes(q));
        return viewMatch && textMatch;
    });

    filtered.sort((a, b) => {
        if (state.view === 'active') {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
        }
        if (sort === 'priority') {
            const map = { high: 3, normal: 2, low: 1 };
            return (map[b.priority] || 2) - (map[a.priority] || 2);
        }
        if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
        return b.createdAt - a.createdAt;
    });

    filtered.forEach(n => {
        const dateStr = new Date(n.createdAt).toLocaleDateString();
        const div = document.createElement('div');
        div.className = 'note';
        div.setAttribute('data-priority', n.priority || 'normal');
        div.innerHTML = `
            ${n.isPinned ? '<span class="pin-icon">📌</span>' : ''}
            <div class="note-content" onclick="editNote('${n.id}')">
                ${n.title ? `<div class="note-title">${esc(n.title)}</div>` : ''}
                <div class="note-text">${esc(n.text)}</div>
                <div class="note-meta">
                    <div class="tags">${(n.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
                    ${n.showTimestamp ? `<small>${dateStr}</small>` : ''}
                </div>
            </div>
            <div class="note-actions">
                <button onclick="toggleArchive('${n.id}', ${!n.isArchived})">${n.isArchived ? '⏪' : '📦'}</button>
                <button onclick="deleteNote('${n.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(div);
    });
};

window.setView = (v) => {
    state.view = v;
    document.getElementById('view-active').classList.toggle('active', v === 'active');
    document.getElementById('view-archive').classList.toggle('active', v === 'archive');
    renderNotes();
};

// --- EDITOR LOGIC ---
window.openEditor = (id = null) => {
    state.editingId = id;
    const t = i18n[state.config.lang];
    const btn = document.getElementById('save-note-btn');
    const modal = document.getElementById('editor-modal');
    
    if (id) {
        const n = state.notes.find(x => x.id === id);
        document.getElementById('noteTitle').value = n.title || '';
        document.getElementById('noteText').value = n.text || '';
        document.getElementById('noteTags').value = (n.tags || []).join(' ');
        document.getElementById('notePriority').value = n.priority || 'normal';
        document.getElementById('noteTimestamp').checked = n.showTimestamp;
        document.getElementById('noteArchive').checked = n.isArchived;
        state.editorPinned = n.isPinned || false;
        btn.querySelector('span').textContent = t.update_btn;
    } else {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteText').value = '';
        document.getElementById('noteTags').value = '';
        document.getElementById('notePriority').value = 'normal';
        document.getElementById('noteTimestamp').checked = true;
        document.getElementById('noteArchive').checked = false;
        state.editorPinned = false;
        btn.querySelector('span').textContent = t.save_btn;
    }

    updatePinBtn();
    modal.classList.add('active');
};

window.editNote = (id) => openEditor(id);

window.handleSaveNote = async () => {
    const title = document.getElementById('noteTitle').value.trim();
    const text = document.getElementById('noteText').value.trim();
    if (!title && !text) return;

    const data = {
        title, text,
        tags: document.getElementById('noteTags').value.split(' ').filter(x => x.trim()),
        priority: document.getElementById('notePriority').value,
        showTimestamp: document.getElementById('noteTimestamp').checked,
        isArchived: document.getElementById('noteArchive').checked,
        isPinned: state.editorPinned,
        updatedAt: Date.now()
    };

    if (state.editingId) {
        await db.collection("notes").doc(state.editingId).update(data);
    } else {
        data.uid = state.user.uid;
        data.createdAt = Date.now();
        await db.collection("notes").add(data);
    }
    toggleEditor(false);
};

window.deleteNote = async (id) => {
    if (confirm(i18n[state.config.lang].confirm_del)) {
        await db.collection("notes").doc(id).delete();
    }
};

window.toggleArchive = async (id, status) => {
    await db.collection("notes").doc(id).update({ isArchived: status });
};

window.togglePin = () => {
    state.editorPinned = !state.editorPinned;
    updatePinBtn();
};

function updatePinBtn() {
    document.getElementById('btn-pin').classList.toggle('active', state.editorPinned);
}

// --- MODALS & TABS ---
window.toggleModal = (id, show) => {
    const el = document.getElementById(id);
    if (show) {
        if (id === 'settings-modal') loadSettingsUI();
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
};

window.toggleEditor = (show) => {
    if (show) openEditor();
    else document.getElementById('editor-modal').classList.remove('active');
};

window.closeAll = (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'settings-modal') cancelSettings();
        else e.target.classList.remove('active');
    }
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
};

// --- THEME & SETTINGS ---
window.setLangPreview = (lang) => {
    state.tempConfig.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.id === `btn-${lang}`));
    updateInterfaceText(lang);
};

window.setColorTarget = (t) => {
    state.colorTarget = t;
    document.querySelectorAll('.target-btn').forEach(b => b.classList.toggle('active', b.dataset.target === t));
    const currentHex = state.tempConfig[t];
    document.getElementById('universal-color-picker').value = currentHex;
};

window.updateColorPreview = (hue) => {
    const hex = hslToHex(hue, 100, 50);
    applyColor(state.colorTarget, hex);
};

window.setQuickColor = (hex) => applyColor(state.colorTarget, hex);
window.updateManualColor = (hex) => applyColor(state.colorTarget, hex);

function applyColor(target, hex) {
    state.tempConfig[target] = hex;
    document.documentElement.style.setProperty(`--${target}`, hex);
    if (target === 'accent') {
        document.documentElement.style.setProperty('--accent-glow', hex + '40');
    }
    document.getElementById('universal-color-picker').value = hex;
}

window.applySettings = () => {
    state.config = { ...state.tempConfig };
    localStorage.setItem('sn_lang', state.config.lang);
    localStorage.setItem('sn_accent', state.config.accent);
    localStorage.setItem('sn_bg', state.config.bg);
    localStorage.setItem('sn_text', state.config.text);
    updateInterfaceText();
    renderNotes();
    toggleModal('settings-modal', false);
};

window.cancelSettings = () => {
    state.tempConfig = { ...state.config };
    applyTheme(state.config);
    updateInterfaceText();
    toggleModal('settings-modal', false);
};

window.resetSettings = () => {
    const def = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
    state.tempConfig = { ...def };
    applyTheme(def);
    setLangPreview(def.lang);
    setColorTarget('accent');
};

function loadSettingsUI() {
    state.tempConfig = { ...state.config };
    setLangPreview(state.config.lang);
    setColorTarget('accent');
}

function applyTheme(cfg) {
    const r = document.documentElement;
    r.style.setProperty('--accent', cfg.accent);
    r.style.setProperty('--accent-glow', cfg.accent + '40');
    r.style.setProperty('--bg', cfg.bg);
    r.style.setProperty('--text', cfg.text);
}

function updateInterfaceText(previewLang = null) {
    const lang = previewLang || state.config.lang;
    const dict = i18n[lang];
    const map = {
        '[data-lang="app_title"]': dict.app_title,
        '[data-lang="settings_title"]': dict.settings_title,
        'button[onclick="switchTab(\'general\')"]': dict.tab_general,
        'button[onclick="switchTab(\'appearance\')"]': dict.tab_appearance,
        '#tab-general label': dict.lang_label,
        '#tab-appearance label:nth-of-type(1)': dict.target_label,
        '[data-target="accent"]': dict.target_accent,
        '[data-target="bg"]': dict.target_bg,
        '[data-target="text"]': dict.target_text,
        '#tab-appearance label:nth-of-type(2)': dict.spectrum_label,
        '.advanced-colors summary': dict.advanced_label,
        '#search': [dict.search_ph, 'placeholder'],
        '#sort-select option[value="newest"]': dict.sort_newest,
        '#sort-select option[value="priority"]': dict.sort_priority,
        '#sort-select option[value="title"]': dict.sort_title,
        '#view-active': dict.view_active,
        '#view-archive': dict.view_archive,
        '#noteTitle': [dict.editor_title_ph, 'placeholder'],
        '#noteText': [dict.editor_text_ph, 'placeholder'],
        '#noteTags': [dict.tag_ph, 'placeholder'],
        '.toggle-switch input[id="noteTimestamp"] + span': dict.label_time,
        '.toggle-switch input[id="noteArchive"] + span': dict.label_archive,
        '#save-note-btn span': dict.editingId ? dict.update_btn : dict.save_btn,
        '#notePriority option[value="low"]': dict.p_low,
        '#notePriority option[value="normal"]': dict.p_norm,
        '#notePriority option[value="high"]': dict.p_high,
        '.settings-footer .btn--text': dict.btn_reset,
        '.settings-footer .btn--secondary': dict.btn_cancel,
        '.settings-footer .btn--primary': dict.btn_apply,
        '.btn--feedback span': dict.contact_us,
        '#login-btn': dict.login
    };

    for (const [sel, val] of Object.entries(map)) {
        const el = document.querySelector(sel);
        if (el) {
            if (Array.isArray(val)) el[val[1]] = val[0];
            else el.textContent = val;
        }
    }
}

// --- UTILS ---
function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}