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
        login: "ВОЙТИ ЧЕРЕЗ GOOGLE",
        menu_settings: "Настройки",
        menu_language: "Язык",
        menu_folders: "Папки",
        menu_create_folder: "Создать",
        menu_all_notes: "Все заметки",
        perm_error: "Не хватает прав для этой операции. Проверьте правила безопасности Firestore."
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
        login: "LOGIN WITH GOOGLE",
        menu_settings: "Settings",
        menu_language: "Language",
        menu_folders: "Folders",
        menu_create_folder: "Create",
        menu_all_notes: "All notes",
        perm_error: "Missing or insufficient permissions. Check Firestore security rules."
    }
};

// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let state = {
    user: null,
    notes: [],
    folders: [],
    view: 'active',
    selectedFolderId: null,
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

    try {
        // если использовался redirect, заберём результат (без этого popup может сломаться)
        await auth.getRedirectResult();
    } catch (e) {
        console.warn("Redirect result error:", e);
    }

    auth.onAuthStateChanged(user => {
        state.user = user;
        const loginScreen = document.getElementById('login-screen');
        const appContent = document.getElementById('app-content');

        if (user) {
            if (loginScreen) loginScreen.style.display = 'none';
            if (appContent) appContent.classList.remove('hidden');
            subscribeNotes(user.uid);
            subscribeFolders(user.uid);
            updateProfileUI(user);
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appContent) appContent.classList.add('hidden');
            state.notes = [];
            state.folders = [];
            renderNotes();
            renderFolders();
        }
    });

    registerGlobals();
});

// --- АВТОРИЗАЦИЯ И АККАУНТ ---
const login = async () => {
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        // если всплывашка заблокирована — попробуем redirect
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
            await auth.signInWithRedirect(provider);
        } else {
            console.error("Login error:", e);
            alert(e.message || "Login failed");
        }
    }
};

const logout = () => auth.signOut();

const switchAccount = async () => {
    await auth.signOut();
    login();
};

function updateProfileUI(user) {
    const pic = document.getElementById('user-pic');
    const modalPic = document.getElementById('modal-user-pic');
    const name = document.getElementById('user-name');
    if (pic) pic.src = user.photoURL || '';
    if (modalPic) modalPic.src = user.photoURL || '';
    if (name) name.textContent = user.displayName || 'User';
}

// --- Firestore подписки ---
function subscribeNotes(uid) {
    db.collection("notes")
      .where("uid", "==", uid)
      .onSnapshot(snap => {
          state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderNotes();
          updateStats();
      }, err => {
          console.error("Ошибка Firestore (notes):", err);
      });
}

function subscribeFolders(uid) {
    db.collection("folders")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
          state.folders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderFolders();
          populateEditorFolderSelect();
      }, err => {
          console.error("Ошибка Firestore (folders):", err);
      });
}

// --- СОЗДАНИЕ/УДАЛЕНИЕ ПАПКИ ---
async function createFolder() {
    const input = document.getElementById('new-folder-name');
    const colorInput = document.getElementById('new-folder-color');
    const name = (input?.value || '').trim();
    const color = (colorInput?.value || '#00ffcc').trim();

    if (!name) {
        alert("Введите название папки.");
        return;
    }
    if (!state.user) {
        alert("Требуется авторизация для создания папки.");
        return;
    }

    try {
        await db.collection("folders").add({
            uid: state.user.uid,
            name,
            color,
            createdAt: Date.now()
        });
        input.value = '';
    } catch (e) {
        console.error("Ошибка создания папки:", e);
        const msg = (e && e.message && e.message.includes('Missing or insufficient permissions')) ?
            i18n[state.config.lang].perm_error :
            (e.message || String(e));
        alert("Ошибка создания папки: " + msg);
    }
}

async function deleteFolder(folderId) {
    if (!folderId) return;
    if (!confirm("Удалить папку? Заметки останутся без папки.")) return;
    try {
        // удаляем папку
        await db.collection("folders").doc(folderId).delete();
        // очищаем folderId у заметок (batch)
        const notesSnapshot = await db.collection("notes")
            .where("uid", "==", state.user.uid)
            .where("folderId", "==", folderId)
            .get();
        const batch = db.batch();
        notesSnapshot.forEach(d => batch.update(d.ref, { folderId: null }));
        await batch.commit();
    } catch (e) {
        console.error("Ошибка удаления папки:", e);
        const msg = (e && e.message && e.message.includes('Missing or insufficient permissions')) ?
            i18n[state.config.lang].perm_error :
            (e.message || String(e));
        alert("Ошибка удаления папки: " + msg);
    }
}

// --- РЕНДЕР ПАПОК ---
function renderFolders() {
    const list = document.getElementById('folders-list');
    if (!list) return;
    list.innerHTML = '';

    // Сортировка: можно оставить уже упорядоченной из запросa
    state.folders.forEach(f => {
        const el = document.createElement('div');
        el.className = 'folder-item' + (state.selectedFolderId === f.id ? ' active' : '');
        const colorDot = `<span class="folder-color-dot" style="background:${escapeHtml(f.color || '#555')};"></span>`;
        el.innerHTML = `<div class="folder-name">${colorDot}<span class="folder-title">${escapeHtml(f.name)}</span></div>
            <div class="folder-actions">
                <button title="Выбрать" onclick="event.stopPropagation(); selectFolder('${f.id}')">📁</button>
                <button title="Удалить" onclick="event.stopPropagation(); deleteFolder('${f.id}')">🗑️</button>
            </div>`;
        el.onclick = () => selectFolder(f.id);
        list.appendChild(el);
    });
}

// --- ВЫБОР ПАПКИ ---
function selectFolder(id) {
    state.selectedFolderId = id;
    // обновим UI списка (файнд по data)
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
    if (id) {
        const target = Array.from(document.querySelectorAll('.folder-item'))
            .find(el => el.querySelector('.folder-actions button')?.getAttribute('onclick')?.includes(id));
        if (target) target.classList.add('active');
    }
    populateEditorFolderSelect();
    renderNotes();
}

// --- Заполнение select в редакторе ---
function populateEditorFolderSelect() {
    const sel = document.getElementById('note-folder-select');
    if (!sel) return;
    const prev = sel.value || '';
    sel.innerHTML = `<option value="">Без папки</option>`;
    state.folders.forEach(f => {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.name;
        sel.appendChild(o);
    });
    if (state.selectedFolderId) sel.value = state.selectedFolderId;
    else sel.value = prev;
}

// --- РЕНДЕР ЗАМЕТОК ---
const renderNotes = () => {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase();
    const sortBy = document.getElementById('sort-select')?.value || 'newest';

    let filtered = state.notes.filter(n => {
        const isCorrectView = state.view === 'archive' ? n.isArchived : !n.isArchived;
        const matchesFolder = state.selectedFolderId ? (n.folderId === state.selectedFolderId) : true;
        const matchesSearch = (n.title || '').toLowerCase().includes(searchTerm) ||
                             (n.text || '').toLowerCase().includes(searchTerm);
        return isCorrectView && matchesFolder && matchesSearch;
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
        if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    grid.innerHTML = '';
    filtered.forEach(n => {
        const card = document.createElement('div');
        card.className = `note-card ${n.isPinned ? 'pinned' : ''}`;
        card.style.borderColor = getPriorityColor(n.priority);
        card.onclick = () => openEditor(n.id);

        const folderName = n.folderId ? (state.folders.find(f => f.id === n.folderId)?.name || '') : '';
        const folderColor = n.folderId ? (state.folders.find(f => f.id === n.folderId)?.color || '') : '';

        card.innerHTML = `
            ${n.isPinned ? '<div class="pin-tag">📌</div>' : ''}
            <div class="note-card__title">${escapeHtml(n.title || '')}</div>
            <div class="note-card__text">${escapeHtml(n.text || '')}</div>
            <div class="note-card__footer">
                <div class="tags">${(n.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
                ${n.showTimestamp ? `<div class="date">${new Date(n.createdAt).toLocaleDateString()}</div>` : ''}
            </div>
            ${folderName ? `<div class="note-folder">${folderColor ? `<span class="folder-color-dot" style="background:${escapeHtml(folderColor)}"></span>` : ''}📁 ${escapeHtml(folderName)}</div>` : ''}
        `;
        grid.appendChild(card);
    });
};

// --- UI HELPERS ---
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

// --- THEME & I/O ---
function applyTheme(cfg) {
    const r = document.documentElement;
    r.style.setProperty('--accent', cfg.accent);
    r.style.setProperty('--bg', cfg.bg);
    r.style.setProperty('--text', cfg.text);
    r.style.setProperty('--accent-glow', cfg.accent + '40');
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// --- РЕДАКТОР ---
const openEditor = (id = null) => {
    state.editingId = id;
    const modal = document.getElementById('editor-modal');
    const deleteBtn = document.getElementById('delete-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const archiveBtn = document.getElementById('archive-btn');

    if (id) {
        const note = state.notes.find(n => n.id === id);
        if (note) {
            document.getElementById('note-title').value = note.title || '';
            document.getElementById('note-text').value = note.text || '';
            document.getElementById('note-tags').value = (note.tags || []).join(' ');
            document.getElementById('show-time').checked = note.showTimestamp !== false;
            state.editorPinned = !!note.isPinned;
            updatePriorityUI(note.priority || 'normal');
            if (deleteBtn) deleteBtn.style.display = 'block';
            if (saveBtnText) saveBtnText.textContent = i18n[state.config.lang].update_btn;
            if (archiveBtn) archiveBtn.style.display = 'inline-block';
            if (document.getElementById('note-folder-select')) document.getElementById('note-folder-select').value = note.folderId || '';
            archiveBtn.textContent = note.isArchived ? '📤' : '📦';
        }
    } else {
        document.getElementById('note-title').value = '';
        document.getElementById('note-text').value = '';
        document.getElementById('note-tags').value = '';
        document.getElementById('show-time').checked = true;
        state.editorPinned = false;
        updatePriorityUI('normal');
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (saveBtnText) saveBtnText.textContent = i18n[state.config.lang].save_btn;
        if (archiveBtn) archiveBtn.style.display = 'none';
        if (document.getElementById('note-folder-select')) document.getElementById('note-folder-select').value = state.selectedFolderId || '';
    }

    updatePinBtnUI();
    if (modal) modal.classList.add('active');
};

const closeEditor = () => {
    const modal = document.getElementById('editor-modal');
    if (modal) modal.classList.remove('active');
    state.editingId = null;
};

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

    const folderSelect = document.getElementById('note-folder-select');
    data.folderId = (folderSelect && folderSelect.value) ? folderSelect.value : null;

    try {
        if (state.editingId) {
            await db.collection("notes").doc(state.editingId).update(data);
        } else {
            if (!state.user) { alert("Требуется авторизация"); return; }
            data.uid = state.user.uid;
            data.createdAt = Date.now();
            data.isArchived = false;
            await db.collection("notes").add(data);
        }
        closeEditor();
    } catch (e) {
        console.error("Ошибка сохранения заметки:", e);
        const msg = (e && e.message && e.message.includes('Missing or insufficient permissions')) ?
            i18n[state.config.lang].perm_error :
            (e.message || String(e));
        alert("Ошибка: " + msg);
    }
};

const deleteNoteWrapper = async () => {
    if (!state.editingId) return;
    if (confirm(i18n[state.config.lang].confirm_del)) {
        try {
            await db.collection("notes").doc(state.editingId).delete();
            closeEditor();
        } catch (e) {
            console.error("Ошибка удаления заметки:", e);
            alert(e.message || "Ошибка удаления");
        }
    }
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
        await db.collection("notes").doc(state.editingId).update({ isArchived: !note.isArchived });
        closeEditor();
    } catch (e) {
        console.error("Ошибка архивации:", e);
        alert(e.message || "Ошибка архивации");
    }
};

function updatePinBtnUI() {
    const btn = document.getElementById('pin-btn');
    if (btn) btn.classList.toggle('active', state.editorPinned);
}

const cyclePriority = () => {
    const label = document.getElementById('priority-label');
    const current = label?.dataset?.priority || 'normal';
    const sequence = ['low', 'normal', 'high'];
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    updatePriorityUI(next);
};

function updatePriorityUI(p) {
    const label = document.getElementById('priority-label');
    const indicator = document.getElementById('priority-indicator');
    const dict = i18n[state.config.lang] || i18n.ru;
    if (!label) return;
    label.dataset.priority = p;
    if (p === 'low') {
        label.textContent = dict.p_low;
        if (indicator) indicator.style.background = '#888';
    } else if (p === 'high') {
        label.textContent = dict.p_high;
        if (indicator) indicator.style.background = '#ff4444';
    } else {
        label.textContent = dict.p_norm;
        if (indicator) indicator.style.background = 'var(--accent)';
    }
}

// --- ОБРАТНАЯ СВЯЗЬ ---
const sendFeedback = async () => {
    const textEl = document.getElementById('feedback-text');
    if (!textEl?.value.trim()) return;
    try {
        await db.collection("feedback").add({
            uid: state.user?.uid || null,
            text: textEl.value,
            createdAt: Date.now()
        });
        alert("Спасибо за отзыв!");
        textEl.value = "";
        closeFeedback();
    } catch (e) {
        console.error("Ошибка отправки отзыва:", e);
        alert(e.message || "Ошибка отправки отзыва");
    }
};

const openFeedback = () => document.getElementById('feedback-modal')?.classList.add('active');
const closeFeedback = () => document.getElementById('feedback-modal')?.classList.remove('active');

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

const switchTab = (tab) => {
    document.querySelectorAll('.tab-trigger').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(c => c.classList.remove('active'));
    document.getElementById(`lang-tab-${tab}`)?.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
};

const setLanguage = (lang) => {
    state.tempConfig.lang = lang;
    state.config.lang = lang;
    localStorage.setItem('sn_lang', lang);
    updateInterfaceText(lang);
    loadSettingsUI();
    document.getElementById('menu-lang-ru')?.classList.toggle('active', lang === 'ru');
    document.getElementById('menu-lang-en')?.classList.toggle('active', lang === 'en');
};

const setColorTarget = (target) => {
    state.colorTarget = target;
    document.querySelectorAll('.target-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === target);
    });
};

const updateColorPreview = (hue) => {
    const hex = hslToHex(hue, 100, 50);
    applyColorPreview(state.colorTarget, hex);
};

const setQuickColor = (hex) => {
    applyColorPreview(state.colorTarget, hex);
};

function applyColorPreview(target, hex) {
    state.tempConfig[target] = hex;
    const root = document.documentElement;
    root.style.setProperty(`--${target}`, hex);
    if (target === 'accent') root.style.setProperty('--accent-glow', hex + '40');
}

const applySettings = () => {
    state.config = { ...state.tempConfig };
    localStorage.setItem('sn_lang', state.config.lang);
    localStorage.setItem('sn_accent', state.config.accent);
    localStorage.setItem('sn_bg', state.config.bg);
    localStorage.setItem('sn_text', state.config.text);
    updateInterfaceText();
    document.getElementById('settings-modal')?.classList.remove('active');
};

const resetSettings = () => {
    if (confirm("Сбросить все настройки?")) {
        state.tempConfig = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
        applyTheme(state.tempConfig);
        updateInterfaceText(state.tempConfig.lang);
        loadSettingsUI();
    }
};

function loadSettingsUI() {
    document.getElementById('lang-ru')?.classList.toggle('active', state.tempConfig.lang === 'ru');
    document.getElementById('lang-en')?.classList.toggle('active', state.tempConfig.lang === 'en');
    setColorTarget(state.colorTarget);
}

function updateInterfaceText(previewLang = null) {
    const lang = previewLang || state.config.lang;
    const dict = i18n[lang] || i18n.ru;
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
        '#lang-stat-notes': dict.stat_notes,
        '#lang-app-title': dict.app_title,
        '#menu-settings': dict.menu_settings,
        '#menu-language-label': dict.menu_language,
        '#menu-folders-label': dict.menu_folders,
        '#menu-all-notes': dict.menu_all_notes
    };

    for (let [sel, txt] of Object.entries(map)) {
        const el = document.querySelector(sel);
        if (el) el.textContent = txt;
    }

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

// --- ЛЕВОЕ ВЫДВИЖНОЕ МЕНЮ ---
function toggleLeftMenu() {
    const menu = document.getElementById('left-menu');
    if (!menu) return;
    const isOpen = menu.classList.toggle('open');
    menu.setAttribute('aria-hidden', (!isOpen).toString());
    // обновляем активные кнопки языка
    document.getElementById('menu-lang-ru')?.classList.toggle('active', state.config.lang === 'ru');
    document.getElementById('menu-lang-en')?.classList.toggle('active', state.config.lang === 'en');
}

// --- РЕГИСТРАЦИЯ ГЛОБАЛЬНЫХ ФУНКЦИЙ ---
function registerGlobals() {
    const w = window;
    w.login = login;
    w.logout = logout;
    w.switchAccount = switchAccount;
    w.switchView = switchView;
    w.renderNotes = renderNotes;
    w.openEditor = openEditor;
    w.closeEditor = closeEditor;
    w.saveNote = saveNote;
    w.deleteNoteWrapper = deleteNoteWrapper;
    w.togglePin = togglePin;
    w.toggleArchive = toggleArchive;
    w.cyclePriority = cyclePriority;
    w.openSettings = openSettings;
    w.closeSettings = closeSettings;
    w.switchTab = switchTab;
    w.setLanguage = setLanguage;
    w.setColorTarget = setColorTarget;
    w.updateColorPreview = updateColorPreview;
    w.setQuickColor = setQuickColor;
    w.applySettings = applySettings;
    w.resetSettings = resetSettings;
    w.openFeedback = openFeedback;
    w.closeFeedback = closeFeedback;
    w.sendFeedback = sendFeedback;
    w.toggleLeftMenu = toggleLeftMenu;
    w.createFolder = createFolder;
    w.selectFolder = selectFolder;
    w.deleteFolder = deleteFolder;
    console.log("🚀 Smart Notes ready");
}

// --- МАЛЫЕ ХЕЛПЕРЫ ---
function updateStats() {
    const countEl = document.getElementById('note-count');
    if (countEl) countEl.textContent = state.notes.length;
}
