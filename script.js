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
        btn_contact: "Связаться с нами"
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
        btn_contact: "Contact us"
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

// --- ОТЗЫВЫ (FEEDBACK) ---
window.openFeedback = () => document.getElementById('feedback-modal').classList.add('active');
window.closeFeedback = () => document.getElementById('feedback-modal').classList.remove('active');

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
document.addEventListener('DOMContentLoaded', () => {
    state.tempConfig = { ...state.config };
    applyTheme(state.config);
    updateInterfaceText();

    // Единый слушатель состояния авторизации
    auth.onAuthStateChanged(user => {
        state.user = user;
        updateAuthUI(user);
        if (user) {
            subscribeNotes(user.uid);
            updateProfile(user);
            document.body.classList.add('logged-in');
        } else {
            state.notes = [];
            renderNotes();
            document.body.classList.remove('logged-in');
        }
    });

    // Обработка результата редиректа для авторизации
    auth.getRedirectResult().then((result) => {
        if (result.user) console.log("Успешный вход");
    }).catch((error) => console.error("Ошибка редиректа:", error.message));

    // Слушатель для рейтинга в отзывах
    document.getElementById('feedback-rating')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('rating-value');
        if (valEl) valEl.innerText = e.target.value;
    });
});

// --- FIREBASE ОПЕРАЦИИ ---
function subscribeNotes(uid) {
    db.collection("notes").where("uid", "==", uid).onSnapshot(snap => {
        state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNotes();
        updateStats();
    });
}

window.login = () => auth.signInWithRedirect(provider);
window.logout = () => auth.signOut();
window.switchAccount = () => auth.signOut().then(window.login);

window.sendFeedback = async () => {
    const rating = document.getElementById('feedback-rating').value;
    const text = document.getElementById('feedback-text').value;
    const user = state.user;

    if (!text.trim()) return alert("Напишите хоть что-нибудь");

    try {
        await db.collection("feedback").add({
            rating: parseInt(rating),
            comment: text,
            userId: user ? user.uid : "anonymous",
            userName: user ? user.displayName : "Аноним",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Спасибо за отзыв!");
        window.closeFeedback();
        document.getElementById('feedback-text').value = "";
    } catch (e) {
        console.error("Ошибка фидбека:", e);
    }
};

// --- ИНТЕРФЕЙС АВТОРИЗАЦИИ ---
function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const userUi = document.getElementById('user-ui');
    const appContent = document.getElementById('app-content');

    if (loginBtn) loginBtn.classList.toggle('hidden', !!user);
    if (userUi) userUi.classList.toggle('hidden', !user);
    if (appContent) appContent.classList.toggle('hidden', !user);
    
    if (user && document.getElementById('user-pic')) {
        document.getElementById('user-pic').src = user.photoURL;
    }
}

function updateProfile(user) {
    const pic = document.getElementById('modal-user-pic');
    const name = document.getElementById('user-name');
    if (pic) pic.src = user.photoURL;
    if (name) name.textContent = user.displayName;
}

function updateStats() {
    const statEl = document.getElementById('note-count');
    if (statEl) {
        statEl.innerHTML = `${state.notes.length} <small>${i18n[state.config.lang].stat_notes}</small>`;
    }
}

// --- ОТРИСОВКА ЗАМЕТОК ---
window.renderNotes = () => {
    const list = document.getElementById('notesList');
    if (!list) return;
    
    const searchEl = document.getElementById('search');
    const q = searchEl ? searchEl.value.toLowerCase() : '';
    const sortEl = document.getElementById('sort-select');
    const sort = sortEl ? sortEl.value : 'newest';
    
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
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    filtered.forEach(n => {
        const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '';
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
                <button onclick="event.stopPropagation(); toggleArchive('${n.id}', ${!n.isArchived})">${n.isArchived ? '⏪' : '📦'}</button>
                <button onclick="event.stopPropagation(); deleteNote('${n.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(div);
    });
};

window.setView = (v) => {
    state.view = v;
    const btnAct = document.getElementById('view-active');
    const btnArc = document.getElementById('view-archive');
    if (btnAct) btnAct.classList.toggle('active', v === 'active');
    if (btnArc) btnArc.classList.toggle('active', v === 'archive');
    window.renderNotes();
};

window.openEditor = (id = null) => {
    state.editingId = id;
    const t = i18n[state.config.lang];
    const btn = document.getElementById('save-note-btn');
    const modal = document.getElementById('editor-modal');

    if (id) {
        const n = state.notes.find(x => x.id === id);
        if (n) {
            document.getElementById('noteTitle').value = n.title || '';
            document.getElementById('noteText').value = n.text || '';
            document.getElementById('noteTags').value = (n.tags || []).join(' ');
            document.getElementById('notePriority').value = n.priority || 'normal';
            document.getElementById('noteTimestamp').checked = n.showTimestamp !== false;
            document.getElementById('noteArchive').checked = !!n.isArchived;
            state.editorPinned = !!n.isPinned;
        }
        if (btn) btn.querySelector('span').textContent = t.update_btn;
    } else {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteText').value = '';
        document.getElementById('noteTags').value = '';
        document.getElementById('notePriority').value = 'normal';
        document.getElementById('noteTimestamp').checked = true;
        document.getElementById('noteArchive').checked = false;
        state.editorPinned = false;
        if (btn) btn.querySelector('span').textContent = t.save_btn;
    }
    
    updatePinBtn();
    if (modal) modal.classList.add('active');
};

window.editNote = (id) => window.openEditor(id);

window.handleSaveNote = async () => {
    const title = document.getElementById('noteTitle').value.trim();
    const text = document.getElementById('noteText').value.trim();
    
    if (!title && !text) {
        window.toggleEditor(false);
        return;
    }

    const data = {
        title, text,
        tags: document.getElementById('noteTags').value.split(' ').filter(x => x.trim()),
        priority: document.getElementById('notePriority').value,
        showTimestamp: document.getElementById('noteTimestamp').checked,
        isArchived: document.getElementById('noteArchive').checked,
        isPinned: state.editorPinned,
        updatedAt: Date.now()
    };

    try {
        if (state.editingId) {
            await db.collection("notes").doc(state.editingId).update(data);
        } else {
            data.uid = state.user.uid;
            data.createdAt = Date.now();
            await db.collection("notes").add(data);
        }
        window.toggleEditor(false);
    } catch (e) {
        console.error("Save error:", e);
    }
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
    const pinBtn = document.getElementById('btn-pin');
    if (pinBtn) pinBtn.classList.toggle('active', state.editorPinned);
}

window.toggleModal = (id, show) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) {
        if (id === 'settings-modal') loadSettingsUI();
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
};

window.toggleEditor = (show) => {
    if (show) window.openEditor();
    else {
        const modal = document.getElementById('editor-modal');
        if (modal) modal.classList.remove('active');
    }
};

window.closeAll = (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'settings-modal') window.cancelSettings();
        else e.target.classList.remove('active');
    }
};
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const targetBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
    const targetContent = document.getElementById(`tab-${tab}`);
    
    if (targetBtn) targetBtn.classList.add('active');
    if (targetContent) targetContent.classList.add('active');
};

window.setLangPreview = (lang) => {
    state.tempConfig.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.id === `btn-${lang}`);
    });
    updateInterfaceText(lang); 
};

window.setColorTarget = (t) => {
    state.colorTarget = t;
    document.querySelectorAll('.target-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === t);
    });
    const currentHex = state.tempConfig[t];
    const picker = document.getElementById('universal-color-picker');
    if (picker) picker.value = currentHex;
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
    const picker = document.getElementById('universal-color-picker');
    if (picker) picker.value = hex;
}

window.applySettings = () => {
    state.config = { ...state.tempConfig };
    localStorage.setItem('sn_lang', state.config.lang);
    localStorage.setItem('sn_accent', state.config.accent);
    localStorage.setItem('sn_bg', state.config.bg);
    localStorage.setItem('sn_text', state.config.text);
    
    updateInterfaceText();
    window.renderNotes();
    window.toggleModal('settings-modal', false);
};

window.cancelSettings = () => {
    state.tempConfig = { ...state.config };
    applyTheme(state.config);
    updateInterfaceText();
    window.toggleModal('settings-modal', false);
};

window.resetSettings = () => {
    const def = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
    state.tempConfig = { ...def };
    applyTheme(def);
    window.setLangPreview(def.lang);
    window.setColorTarget('accent');
};

function loadSettingsUI() {
    state.tempConfig = { ...state.config };
    window.setLangPreview(state.config.lang);
    window.setColorTarget('accent');
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
        '#save-note-btn span': dict.save_btn,
        '#notePriority option[value="low"]': dict.p_low,
        '#notePriority option[value="normal"]': dict.p_norm,
        '#notePriority option[value="high"]': dict.p_high,
        '.settings-footer .btn--text': dict.btn_reset,
        '.settings-footer .btn--secondary': dict.btn_cancel,
        '.settings-footer .btn--primary': dict.btn_apply,
        '.btn--feedback span': dict.btn_contact,
        '#login-btn': dict.login
    };

    for (const [sel, val] of Object.entries(map)) {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
            if (Array.isArray(val)) el[val[1]] = val[0];
            else el.textContent = val;
        });
    }
}

function esc(s) {
    if (!s) return '';
    return s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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