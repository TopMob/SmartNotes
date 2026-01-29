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
        lang_label: "Язык / Language",
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
    view: 'active', // 'active' или 'archive'
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

    // Обработка входа (для мобильных браузеров)
    try {
        await auth.getRedirectResult();
    } catch (error) {
        console.error("Ошибка редиректа:", error);
    }

    // Слушатель авторизации
    auth.onAuthStateChanged(user => {
        state.user = user;
        if (user) {
            document.getElementById('login-btn').style.display = 'none';
            document.getElementById('app-content').classList.remove('hidden');
            subscribeNotes(user.uid);
            updateProfileUI(user);
        } else {
            document.getElementById('login-btn').style.display = 'block';
            document.getElementById('app-content').classList.add('hidden');
            state.notes = [];
            renderNotes();
        }
    });
});

// --- АВТОРИЗАЦИЯ ---
window.login = async () => {
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
            await auth.signInWithRedirect(provider);
        }
    }
};

window.logout = () => auth.signOut();

function updateProfileUI(user) {
    const pic = document.getElementById('user-pic');
    const modalPic = document.getElementById('modal-user-pic');
    const name = document.getElementById('user-name');
    if (pic) pic.src = user.photoURL || '';
    if (modalPic) modalPic.src = user.photoURL || '';
    if (name) name.textContent = user.displayName || 'User';
}

// --- РАБОТА С ДАННЫМИ (FIRESTORE) ---
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

// --- РЕНДЕРИНГ ЗАМЕТОК ---
window.renderNotes = () => {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const sortBy = document.getElementById('sort-select').value;

    let filtered = state.notes.filter(n => {
        const isCorrectView = state.view === 'archive' ? n.isArchived : !n.isArchived;
        const matchesSearch = (n.title || '').toLowerCase().includes(searchTerm) || 
                              (n.text || '').toLowerCase().includes(searchTerm);
        return isCorrectView && matchesSearch;
    });

    // Сортировка
    filtered.sort((a, b) => {
        // Сначала закрепленные (только для активных)
        if (state.view === 'active') {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
        }

        if (sortBy === 'priority') {
            const weights = { high: 3, normal: 2, low: 1 };
            return weights[b.priority || 'normal'] - weights[a.priority || 'normal'];
        }
        if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        return (b.createdAt || 0) - (a.createdAt || 0); // newest
    });

    grid.innerHTML = '';
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = `note-card ${n.isPinned ? 'pinned' : ''}`;
        card.style.borderColor = getPriorityColor(n.priority);
        card.onclick = () => openEditor(n.id);

        card.innerHTML = `
            ${n.isPinned ? '<div class="pin-tag">📌</div>' : ''}
            <div class="note-card__title">${escapeHtml(n.title || '')}</div>
            <div class="note-card__text">${escapeHtml(n.text || '')}</div>
            <div class="note-card__footer">
                <div class="tags">${(n.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
                ${n.showTimestamp ? `<div class="date">${new Date(n.createdAt).toLocaleDateString()}</div>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI ---
window.switchView = (v) => {
    state.view = v;
    document.getElementById('lang-view-active').classList.toggle('active', v === 'active');
    document.getElementById('lang-view-archive').classList.toggle('active', v === 'archive');
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

// Применение темы оформления
function applyTheme(cfg) {
    const r = document.documentElement;
    r.style.setProperty('--accent', cfg.accent);
    r.style.setProperty('--bg', cfg.bg);
    r.style.setProperty('--text', cfg.text);
    r.style.setProperty('--accent-glow', cfg.accent + '40');
}
// --- ЛОГИКА РЕДАКТОРА ---

window.openEditor = (id = null) => {
    state.editingId = id;
    const modal = document.getElementById('editor-modal');
    const deleteBtn = document.getElementById('delete-btn');
    
    // Элементы формы
    const elTitle = document.getElementById('note-title');
    const elText = document.getElementById('note-text');
    const elTags = document.getElementById('note-tags');
    const elTime = document.getElementById('show-time');
    const saveBtnText = document.getElementById('save-btn-text');

    if (id) {
        // Режим редактирования
        const note = state.notes.find(n => n.id === id);
        if (note) {
            elTitle.value = note.title || '';
            elText.value = note.text || '';
            elTags.value = (note.tags || []).join(' ');
            elTime.checked = note.showTimestamp !== false;
            state.editorPinned = !!note.isPinned;
            updatePriorityUI(note.priority || 'normal');
            if (deleteBtn) deleteBtn.style.display = 'flex';
            if (saveBtnText) saveBtnText.textContent = i18n[state.config.lang].update_btn;
        }
    } else {
        // Режим новой заметки
        elTitle.value = '';
        elText.value = '';
        elTags.value = '';
        elTime.checked = true;
        state.editorPinned = false;
        updatePriorityUI('normal');
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (saveBtnText) saveBtnText.textContent = i18n[state.config.lang].save_btn;
    }

    updatePinBtnUI();
    if (modal) modal.classList.add('active');
};

window.closeEditor = () => {
    const modal = document.getElementById('editor-modal');
    if (modal) modal.classList.remove('active');
    state.editingId = null;
};

window.togglePin = () => {
    state.editorPinned = !state.editorPinned;
    updatePinBtnUI();
};

function updatePinBtnUI() {
    const btn = document.getElementById('pin-btn');
    if (btn) btn.classList.toggle('active', state.editorPinned);
}

// Переключение приоритета по кругу
window.cyclePriority = () => {
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

    label.dataset.priority = p;
    if (p === 'low') {
        label.textContent = dict.p_low;
        indicator.style.background = '#888';
    } else if (p === 'high') {
        label.textContent = dict.p_high;
        indicator.style.background = '#ff4444';
    } else {
        label.textContent = dict.p_norm;
        indicator.style.background = 'var(--accent)';
    }
}

// --- СОХРАНЕНИЕ И УДАЛЕНИЕ ---

window.saveNote = async () => {
    const title = document.getElementById('note-title').value.trim();
    const text = document.getElementById('note-text').value.trim();
    
    if (!title && !text) return closeEditor();

    const data = {
        title,
        text,
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
    } catch (e) {
        alert("Ошибка сохранения: " + e.message);
    }
};

window.deleteNoteWrapper = async () => {
    if (!state.editingId) return;
    if (confirm(i18n[state.config.lang].confirm_del)) {
        await db.collection("notes").doc(state.editingId).delete();
        closeEditor();
    }
};

// --- НАСТРОЙКИ (SETTINGS) ---

window.openSettings = () => {
    state.tempConfig = { ...state.config };
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');
    loadSettingsUI();
};

window.closeSettings = () => {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
    // Отменяем временные изменения, если не нажали ОК
    applyTheme(state.config);
};

window.switchTab = (tab) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.getElementById(`lang-tab-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
};

window.setLanguage = (lang) => {
    state.tempConfig.lang = lang;
    updateInterfaceText(lang);
    loadSettingsUI(); // Обновляем активные кнопки
};

window.setColorTarget = (target) => {
    state.colorTarget = target;
    document.querySelectorAll('.target-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === target);
    });
};

window.updateColorPreview = (hue) => {
    const hex = hslToHex(hue, 100, 50);
    applyColorPreview(state.colorTarget, hex);
};

window.setQuickColor = (hex) => {
    applyColorPreview(state.colorTarget, hex);
};

function applyColorPreview(target, hex) {
    state.tempConfig[target] = hex;
    const root = document.documentElement;
    root.style.setProperty(`--${target}`, hex);
    if (target === 'accent') root.style.setProperty('--accent-glow', hex + '40');
}

window.applySettings = () => {
    state.config = { ...state.tempConfig };
    localStorage.setItem('sn_lang', state.config.lang);
    localStorage.setItem('sn_accent', state.config.accent);
    localStorage.setItem('sn_bg', state.config.bg);
    localStorage.setItem('sn_text', state.config.text);
    
    updateInterfaceText();
    closeSettings();
};

window.resetSettings = () => {
    if (confirm("Сбросить все настройки?")) {
        state.tempConfig = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
        applyTheme(state.tempConfig);
        updateInterfaceText(state.tempConfig.lang);
        loadSettingsUI();
    }
};

function loadSettingsUI() {
    // Подсветка кнопок языка
    document.getElementById('lang-ru').classList.toggle('active', state.tempConfig.lang === 'ru');
    document.getElementById('lang-en').classList.toggle('active', state.tempConfig.lang === 'en');
    
    // Подсветка целевого элемента цвета
    window.setColorTarget(state.colorTarget);
}

function updateInterfaceText(previewLang = null) {
    const lang = previewLang || state.config.lang;
    const dict = i18n[lang];
    if (!dict) return;

    const map = {
        '#lang-login': dict.login,
        '#lang-view-active': dict.view_active,
        '#lang-view-archive': dict.view_archive,
        '#lang-sort-newest': dict.sort_newest,
        '#lang-sort-priority': dict.sort_priority,
        '#lang-sort-title': dict.sort_title,
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
        '#lang-label-time': dict.label_time,
        '#lang-stat-notes': dict.stat_notes
    };

for (let [id, text] of Object.entries(map)) {
        const el = document.querySelector(id);
        if (el) el.textContent = text;
    }

    // Безопасное обновление плейсхолдеров
    const inputs = {
        'search-input': dict.search_ph,
        'note-title': dict.editor_title_ph,
        'note-text': dict.editor_text_ph,
        'note-tags': dict.tag_ph
    };

    for (let [id, ph] of Object.entries(inputs)) {
        const el = document.getElementById(id);
        if (el) el.placeholder = ph;
    }
}
window.renderNotes = () => {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    const searchEl = document.getElementById('search-input');
    const sortEl = document.getElementById('sort-select');
    
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    const sortBy = sortEl ? sortEl.value : 'newest';

    let filtered = state.notes.filter(n => {
        const isCorrectView = state.view === 'archive' ? n.isArchived : !n.isArchived;
        const matchesSearch = (n.title || '').toLowerCase().includes(searchTerm) || 
                              (n.text || '').toLowerCase().includes(searchTerm);
        return isCorrectView && matchesSearch;
    });

    // Сортировка (без изменений)
    filtered.sort((a, b) => {
        if (state.view === 'active') {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
        }
        if (sortBy === 'priority') {
            const weights = { high: 3, normal: 2, low: 1 };
            return (weights[b.priority] || 2) - (weights[a.priority] || 2);
        }
        if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    grid.innerHTML = '';
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = `note-card ${n.isPinned ? 'pinned' : ''}`;
        card.style.borderColor = getPriorityColor(n.priority);
        // Исправляем вызов редактора
        card.onclick = () => window.openEditor(n.id);

        card.innerHTML = `
            ${n.isPinned ? '<div class="pin-tag">📌</div>' : ''}
            <div class="note-card__title">${escapeHtml(n.title || '')}</div>
            <div class="note-card__text">${escapeHtml(n.text || '')}</div>
            <div class="note-card__footer">
                <div class="tags">${(n.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
            </div>
        `;
        grid.appendChild(card);
    });
};

// --- ФИНАЛЬНЫЙ МОСТ (ДОБАВЬ В САМЫЙ КОНЕЦ ФАЙЛА) ---
// Этот блок принудительно регистрирует функции, даже если скрипт модульный
document.addEventListener('DOMContentLoaded', () => {
    window.openSettings = openSettings;
    window.switchView = switchView;
    window.openEditor = openEditor;
    window.saveNote = saveNote;
    // Добавь сюда остальные функции, которые выдают ReferenceError
    console.log("Система команд SmartNotes готова.");
});