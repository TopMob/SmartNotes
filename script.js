/**
 * SMART NOTES PRO v2 - CORE LOGIC
 */

// --- 1. CONFIG & FIREBASE ---
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

// --- 2. STATE MANAGEMENT ---

// Основное состояние приложения
let state = {
    notes: [],
    user: null,
    // Настройки сохраняем и загружаем
    config: {
        lang: localStorage.getItem('sn_lang') || 'ru',
        accent: localStorage.getItem('sn_accent') || '#00ffcc',
        bg: localStorage.getItem('sn_bg') || '#000000',
        text: localStorage.getItem('sn_text') || '#ffffff'
    },
    // Временное состояние для настроек (до нажатия "Применить")
    draftConfig: {}, 
    filter: 'all', // all, pinned, high, archived
    editor: {
        isPinned: false
    }
};

// Словарь переводов
const i18n = {
    ru: {
        app_title: "Smart Notes",
        login_btn: "Войти",
        new_note: "Заметка создана",
        del_note: "Удалено",
        confirm_del: "Удалить эту заметку навсегда?",
        settings_title: "Настройки",
        tab_general: "Общие",
        tab_appearance: "Вид",
        lang_label: "Язык интерфейса",
        color_spectrum: "Основной оттенок",
        color_presets: "Детальные цвета",
        bg_color: "Фон",
        text_color: "Текст",
        accent_color: "Акцент",
        reset: "Сброс",
        cancel: "Отмена",
        apply: "Применить",
        placeholder_title: "Заголовок...",
        placeholder_text: "Начните писать...",
        placeholder_tags: "теги через пробел",
        label_time: "Время",
        label_archive: "В архив",
        save_btn: "Сохранить",
        filter_all: "Все заметки",
        filter_pinned: "📌 Закрепленные",
        filter_high: "🔥 Важные",
        filter_archived: "📦 Архив",
        empty_list: "Здесь пока пусто",
        auth_req: "Войдите, чтобы видеть заметки",
        creators_label: "Разработчики",
        feedback_text: "Есть идея или нашли баг?",
        contact_us: "Связаться с нами",
        switch_acc: "Сменить аккаунт",
        logout: "Выйти",
        close: "Закрыть",
        notes_stat: "Заметок"
    },
    en: {
        app_title: "Smart Notes",
        login_btn: "Login",
        new_note: "Note created",
        del_note: "Deleted",
        confirm_del: "Delete this note permanently?",
        settings_title: "Settings",
        tab_general: "General",
        tab_appearance: "Appearance",
        lang_label: "Interface Language",
        color_spectrum: "Main Hue",
        color_presets: "Detail Colors",
        bg_color: "Background",
        text_color: "Text",
        accent_color: "Accent",
        reset: "Reset",
        cancel: "Cancel",
        apply: "Apply",
        placeholder_title: "Title...",
        placeholder_text: "Start typing...",
        placeholder_tags: "space separated tags",
        label_time: "Time",
        label_archive: "Archive",
        save_btn: "Save",
        filter_all: "All Notes",
        filter_pinned: "📌 Pinned",
        filter_high: "🔥 Priority",
        filter_archived: "📦 Archive",
        empty_list: "Nothing here yet",
        auth_req: "Login to view notes",
        creators_label: "Developers",
        feedback_text: "Have an idea or found a bug?",
        contact_us: "Contact Us",
        switch_acc: "Switch Account",
        logout: "Logout",
        close: "Close",
        notes_stat: "Notes"
    }
};

// --- 3. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Применяем сохраненные настройки сразу
    applyThemeDirectly(state.config);
    updateTexts(); // Локализация

    // Слушатель авторизации
    auth.onAuthStateChanged(user => {
        state.user = user;
        updateAuthUI(user);
        if (user) {
            subscribeToNotes(user.uid);
        } else {
            renderPlaceholder(i18n[state.config.lang].auth_req);
        }
    });

    // Инициализация контейнера уведомлений
    initToastContainer();
});

// --- 4. AUTHENTICATION ---

window.login = async () => {
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        showToast("Login Error", "error");
    }
};

window.logout = () => {
    auth.signOut();
    state.notes = [];
    document.getElementById('notesList').innerHTML = '';
    closeAllModals();
};

window.switchAccount = async () => {
    await auth.signOut();
    window.login();
    closeAllModals();
};

function updateAuthUI(user) {
    const userUi = document.getElementById('user-ui');
    const loginBtn = document.getElementById('login-btn');
    const appContent = document.getElementById('app-content');

    if (user) {
        userUi.classList.remove('hidden');
        loginBtn.classList.add('hidden');
        appContent.classList.remove('hidden');
        
        // Обновляем аватарки
        document.querySelectorAll('.avatar').forEach(img => img.src = user.photoURL);
        document.getElementById('user-name').textContent = user.displayName;
    } else {
        userUi.classList.add('hidden');
        loginBtn.classList.remove('hidden');
        appContent.classList.add('hidden');
    }
}

// --- 5. CORE NOTES LOGIC ---

function subscribeToNotes(uid) {
    db.collection("notes")
      .where("uid", "==", uid)
      .onSnapshot(snap => {
          state.notes = snap.docs.map(doc => ({
              id: doc.id, 
              ...doc.data()
          })).sort((a,b) => b.createdAt - a.createdAt); // Сначала новые
          
          // Обновляем счетчик в профиле
          document.getElementById('note-count').textContent = state.notes.length;
          
          renderNotes();
      }, err => {
          console.error(err);
          showToast("Sync Error", "error");
      });
}

// Рендеринг с учетом поиска и фильтров
window.renderNotes = () => {
    const list = document.getElementById('notesList');
    const searchQ = document.getElementById('search').value.toLowerCase();
    const filterType = document.getElementById('category-filter').value;
    
    list.innerHTML = '';

    // 1. Фильтрация
    let filtered = state.notes.filter(n => {
        // Поиск по тексту, заголовку или тегам
        const matchesSearch = (n.text || "").toLowerCase().includes(searchQ) || 
                              (n.title || "").toLowerCase().includes(searchQ) ||
                              (n.tags || []).some(t => t.toLowerCase().includes(searchQ));
        
        if (!matchesSearch) return false;

        // Фильтр категорий
        if (filterType === 'pinned') return n.isPinned && !n.isArchived;
        if (filterType === 'high') return n.priority === 'high' && !n.isArchived;
        if (filterType === 'archived') return n.isArchived;
        
        // По умолчанию (All) показываем всё, КРОМЕ архива
        return !n.isArchived;
    });

    // 2. Сортировка (Закрепленные всегда выше, если мы не в архиве)
    if (filterType !== 'archived') {
        filtered.sort((a, b) => (b.isPinned === true) - (a.isPinned === true));
    }

    if (filtered.length === 0) {
        renderPlaceholder(i18n[state.config.lang].empty_list);
        return;
    }

    // 3. Отрисовка
    filtered.forEach(n => {
        const dateStr = n.showTimestamp ? new Intl.DateTimeFormat(state.config.lang, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }).format(new Date(n.createdAt)) : '';

        const card = document.createElement('div');
        card.className = 'note';
        card.setAttribute('data-priority', n.priority || 'normal');
        
        // Формируем HTML карточки
        let html = '';
        
        // Заголовок
        if (n.title) html += `<div class="note-title">${escapeHtml(n.title)}</div>`;
        
        // Текст
        html += `<div class="note-text">${escapeHtml(n.text)}</div>`;
        
        // Теги и мета
        html += `<div class="note-meta" style="margin-top:12px;">`;
        html += `<div class="tags">
                    ${(n.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
                 </div>`;
        if(n.showTimestamp) html += `<small>${dateStr}</small>`;
        html += `</div>`;

        // Иконки (удаление и пин)
        if(n.isPinned) html += `<span class="note-pin">📌</span>`;
        html += `<button class="note-del" onclick="deleteNote('${n.id}')">✕</button>`;

        card.innerHTML = html;
        list.appendChild(card);
    });
};

function renderPlaceholder(text) {
    document.getElementById('notesList').innerHTML = `
        <div style="text-align:center; grid-column:1/-1; margin-top:50px; opacity:0.3;">
            <div style="font-size:48px; margin-bottom:15px;">📝</div>
            <h3>${text}</h3>
        </div>`;
}

// --- 6. EDITOR ACTIONS ---

window.openEditor = () => {
    // Сброс формы
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteText').value = '';
    document.getElementById('noteTags').value = '';
    document.getElementById('notePriority').value = 'normal';
    document.getElementById('noteTimestamp').checked = true;
    document.getElementById('noteArchive').checked = false;
    
    state.editor.isPinned = false;
    updatePinButton();
    
    toggleModal('editor-modal', true);
};

window.togglePin = () => {
    state.editor.isPinned = !state.editor.isPinned;
    updatePinButton();
};

function updatePinButton() {
    const btn = document.getElementById('btn-pin');
    if (state.editor.isPinned) btn.classList.add('active');
    else btn.classList.remove('active');
}

window.addNote = async () => {
    const title = document.getElementById('noteTitle').value.trim();
    const text = document.getElementById('noteText').value.trim();
    const tagsRaw = document.getElementById('noteTags').value;
    const priority = document.getElementById('notePriority').value;
    const showTimestamp = document.getElementById('noteTimestamp').checked;
    const isArchived = document.getElementById('noteArchive').checked;

    if (!text && !title) {
        showToast("Empty note!", "error");
        return;
    }

    const btn = document.querySelector('.btn-send-lg');
    btn.disabled = true;

    try {
        await db.collection("notes").add({
            uid: state.user.uid,
            title,
            text,
            tags: tagsRaw.split(' ').filter(t => t.trim().length > 0),
            priority,
            isPinned: state.editor.isPinned,
            isArchived,
            showTimestamp,
            createdAt: Date.now()
        });

        toggleEditor(false);
        showToast(i18n[state.config.lang].new_note, 'success');
    } catch (e) {
        console.error(e);
        showToast("Error saving", "error");
    } finally {
        btn.disabled = false;
    }
};

window.deleteNote = async (id) => {
    if (confirm(i18n[state.config.lang].confirm_del)) {
        try {
            await db.collection("notes").doc(id).delete();
            showToast(i18n[state.config.lang].del_note);
        } catch (e) {
            showToast("Error", "error");
        }
    }
};

// --- 7. SETTINGS & THEMING (UPDATED) ---

// Переключение вкладок в настройках
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Находим нужные элементы по тексту (простой способ) или по порядку
    if (tabName === 'general') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-general').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-appearance').classList.add('active');
    }
};

// Открытие настроек - создаем черновик конфига
window.toggleModal = (id, show) => {
    const modal = document.getElementById(id);
    if (show) {
        if (id === 'settings-modal') {
            // Копируем текущие настройки в черновик
            state.draftConfig = { ...state.config };
            // Устанавливаем значения инпутов
            document.getElementById('bg-color-picker').value = state.config.bg;
            document.getElementById('text-color-picker').value = state.config.text;
            document.getElementById('accent-color-picker').value = state.config.accent;
            // Язык
            document.getElementById('btn-ru').classList.toggle('active', state.config.lang === 'ru');
            document.getElementById('btn-en').classList.toggle('active', state.config.lang === 'en');
        }
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
        // Если закрыли настройки крестиком или кликом вне зоны - отменяем изменения
        if (id === 'settings-modal') cancelSettings();
    }
};

// Предпросмотр языка
window.setLangPreview = (lang) => {
    state.draftConfig.lang = lang;
    document.getElementById('btn-ru').classList.toggle('active', lang === 'ru');
    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    // Обновляем тексты сразу для теста
    updateTexts(lang);
};

// Предпросмотр цветов (Слайдер)
window.updateColorPreview = (hue) => {
    const hexColor = hslToHex(hue, 100, 50); // Saturation 100%, Lightness 50%
    state.draftConfig.accent = hexColor;
    document.getElementById('accent-color-picker').value = hexColor;
    applyThemeDirectly(state.draftConfig); // Применяем визуально
};

// Применить настройки
window.applySettings = () => {
    // Сохраняем черновик в основной конфиг
    // Также берем значения из пикеров, если юзер крутил их вручную
    state.draftConfig.bg = document.getElementById('bg-color-picker').value;
    state.draftConfig.text = document.getElementById('text-color-picker').value;
    state.draftConfig.accent = document.getElementById('accent-color-picker').value;

    state.config = { ...state.draftConfig };
    
    // Сохраняем в LocalStorage
    localStorage.setItem('sn_lang', state.config.lang);
    localStorage.setItem('sn_accent', state.config.accent);
    localStorage.setItem('sn_bg', state.config.bg);
    localStorage.setItem('sn_text', state.config.text);
    
    showToast(i18n[state.config.lang].settings_title + " OK", "success");
    document.getElementById('settings-modal').classList.remove('active');
    renderNotes(); // Перерисовать (для дат и текстов)
};

// Отмена настроек
window.cancelSettings = () => {
    // Возвращаем как было
    applyThemeDirectly(state.config);
    updateTexts(state.config.lang);
    document.getElementById('settings-modal').classList.remove('active');
};

// Сброс настроек
window.resetSettings = () => {
    const defaults = { lang: 'ru', accent: '#00ffcc', bg: '#000000', text: '#ffffff' };
    state.draftConfig = defaults;
    applyThemeDirectly(defaults);
    updateTexts('ru');
    // Обновляем инпуты
    document.getElementById('bg-color-picker').value = defaults.bg;
    document.getElementById('text-color-picker').value = defaults.text;
    document.getElementById('accent-color-picker').value = defaults.accent;
    document.getElementById('btn-ru').classList.add('active');
    document.getElementById('btn-en').classList.remove('active');
};

function applyThemeDirectly(cfg) {
    const root = document.documentElement;
    root.style.setProperty('--accent', cfg.accent);
    root.style.setProperty('--accent-glow', `${cfg.accent}40`);
    root.style.setProperty('--bg', cfg.bg);
    root.style.setProperty('--text', cfg.text);
    
    // Вычисляем цвет карточек чуть светлее фона
    // (Простой хак: если фон черный, карточки темно-серые)
    if(cfg.bg === '#000000' || cfg.bg === '#000') {
        root.style.setProperty('--card-bg', '#111111');
        root.style.setProperty('--input-bg', '#1a1a1a');
    } else {
        root.style.setProperty('--card-bg', adjustColor(cfg.bg, 10)); 
        root.style.setProperty('--input-bg', adjustColor(cfg.bg, -10));
    }
}

function updateTexts(forceLang) {
    const lg = forceLang || state.config.lang;
    const dict = i18n[lg];
    
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(dict[key]) {
            if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });
}

// --- 8. UTILS ---

window.closeAll = (e) => {
    if (e.target.classList.contains('modal')) {
        if(e.target.id === 'settings-modal') cancelSettings();
        else closeAllModals();
    }
};

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

window.toggleSortMenu = () => {
    // В данной версии просто фокусим селект для простоты, 
    // или можно сделать кастомное меню. Сейчас открываем селект.
    document.getElementById('category-filter').focus();
    // Эмуляция клика для открытия списка (работает не во всех браузерах)
    // showToast("Use the dropdown to filter", "default");
};

window.toggleEditor = (show) => {
    if(show) window.openEditor();
    else document.getElementById('editor-modal').classList.remove('active');
};

function escapeHtml(text) {
    if(!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Конвертер HSL в Hex для слайдера
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

// Утилита для затемнения/осветления цвета (для авто-тем)
function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// Toast System
function initToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.cssText = "position:fixed; bottom:30px; left:50%; transform:translateX(-50%); z-index:1000; display:flex; flex-direction:column; gap:10px; pointer-events:none;";
    document.body.appendChild(div);
}

function showToast(msg, type = 'default') {
    const toast = document.createElement('div');
    const color = type === 'error' ? '#ff4444' : (type === 'success' ? state.config.accent : '#333');
    
    toast.style.cssText = `
        background: rgba(20,20,20,0.9);
        border: 1px solid ${color};
        color: #fff; padding: 12px 24px; border-radius: 50px;
        font-size: 14px; box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        backdrop-filter: blur(10px); animation: slideUpFade 0.3s ease forwards;
    `;
    
    toast.innerHTML = type === 'success' || type === 'error' 
        ? `<span style="display:inline-block; width:8px; height:8px; background:${color}; border-radius:50%; margin-right:8px;"></span>${msg}`
        : msg;

    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// CSS Animation for Toasts
const styleSheet = document.createElement("style");
styleSheet.innerText = "@keyframes slideUpFade { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }";
document.head.appendChild(styleSheet);