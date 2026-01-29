// =========================================
// 1. КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ
// =========================================
// ВАЖНО: Замени эти данные на свои из Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

// Проверка инициализации, чтобы не было ошибок при перезагрузке
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Глобальное состояние
let state = {
    user: null,
    notes: [],
    folders: [],
    currentView: 'notes', // 'notes', 'archive', 'folder'
    activeFolderId: null,
    searchQuery: '',
    // Временное состояние для новой заметки
    draft: {
        priority: 0,
        pinned: false,
        archived: false
    },
    config: {
        lang: 'ru',
        accentColor: '#00ffcc',
        bgColor: '#0a0a0a'
    }
};

// Текущий редактируемый ID
let currentNoteId = null;

// =========================================
// 2. АВТОРИЗАЦИЯ
// =========================================

async function login() {
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Login failed:", error);
        alert("Ошибка входа: " + error.message);
    }
}

function requestLogout() {
    openConfirmModal(
        getText("logoutConfirmTitle"),
        getText("logoutConfirmText"),
        async () => {
            await auth.signOut();
            window.location.reload();
        }
    );
}

function requestSwitchAccount() {
    openConfirmModal(
        getText("switchConfirmTitle"),
        getText("switchConfirmText"),
        async () => {
            await auth.signOut();
            login();
        }
    );
}

auth.onAuthStateChanged(user => {
    if (user) {
        state.user = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        
        // UI профиля
        document.getElementById('user-avatar').src = user.photoURL || 'https://via.placeholder.com/36';
        document.getElementById('user-name').textContent = user.displayName;
        document.getElementById('user-email').textContent = user.email;
        
        initAppData();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
        state.user = null;
    }
});

function toggleProfileMenu() {
    document.getElementById('profile-menu').classList.toggle('hidden');
}

// =========================================
// 3. УПРАВЛЕНИЕ ПАПКАМИ
// =========================================

async function initAppData() {
    await loadFolders(); // Сначала папки
    loadNotes();         // Потом заметки
}

function openFolderModal() {
    document.getElementById('folder-modal').classList.remove('hidden');
}

function closeFolderModal() {
    document.getElementById('folder-modal').classList.add('hidden');
    document.getElementById('new-folder-name').value = '';
}

async function confirmCreateFolder() {
    const nameInput = document.getElementById('new-folder-name');
    const colorInput = document.getElementById('new-folder-color');
    const name = nameInput.value.trim();

    if (!name) return;

    try {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name: name,
            color: colorInput.value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeFolderModal();
        loadFolders();
    } catch (e) {
        console.error("Folder create error:", e);
    }
}

async function loadFolders() {
    if (!state.user) return;
    const snapshot = await db.collection('users').doc(state.user.uid).collection('folders')
        .orderBy('createdAt', 'asc').get();
    
    state.folders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderFolders();
}

function renderFolders() {
    const container = document.getElementById('folder-list');
    container.innerHTML = '';

    state.folders.forEach(folder => {
        const div = document.createElement('div');
        div.className = `folder-item ${state.currentView === 'folder' && state.activeFolderId === folder.id ? 'active' : ''}`;
        
        div.innerHTML = `
            <div class="folder-info" onclick="switchView('folder', '${folder.id}')">
                <div class="folder-dot" style="background: ${folder.color}"></div>
                <span class="folder-name-text">${folder.name}</span>
            </div>
            <button class="icon-btn-small" onclick="deleteFolder('${folder.id}', event)">
                <span class="material-icons-round" style="font-size: 16px">close</span>
            </button>
        `;
        container.appendChild(div);
    });
}

function deleteFolder(folderId, event) {
    if(event) event.stopPropagation(); // Чтобы не сработало переключение папки
    
    openConfirmModal(
        getText("delFolderTitle"),
        getText("delFolderText"),
        async () => {
            // Удаляем папку
            await db.collection('users').doc(state.user.uid).collection('folders').doc(folderId).delete();
            
            // Если мы были в этой папке, переходим во "Все заметки"
            if (state.activeFolderId === folderId) {
                switchView('notes');
            }
            // Сбрасываем folderId у заметок, которые были в этой папке (делаем их без папки)
            // Примечание: Это требует отдельного batch update, но для простоты пока просто перерисуем список
            loadFolders();
        }
    );
}

// =========================================
// 4. НАВИГАЦИЯ И ОТРИСОВКА
// =========================================

function switchView(view, folderId = null) {
    state.currentView = view;
    state.activeFolderId = folderId;
    
    // UI меню
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));

    if (view === 'notes') document.getElementById('nav-notes').classList.add('active');
    if (view === 'archive') document.getElementById('nav-archive').classList.add('active');
    
    renderFolders(); // Обновляем подсветку папок
    renderNotes();
    
    // Закрываем меню на мобильном
    if (window.innerWidth <= 768) {
        document.getElementById('left-menu').classList.remove('active');
    }
}

function toggleLeftMenu() {
    document.getElementById('left-menu').classList.toggle('active');
}

function loadNotes() {
    if (!state.user) return;
    
    db.collection('users').doc(state.user.uid).collection('notes')
        .orderBy('updatedAt', 'desc')
        .onSnapshot(snapshot => {
            state.notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderNotes();
        });
}

function renderNotes() {
    const container = document.getElementById('notes-container');
    container.innerHTML = '';

    // Фильтрация
    let filtered = state.notes.filter(note => {
        // Поиск
        const q = state.searchQuery;
        const inTitle = (note.title || '').toLowerCase().includes(q);
        const inContent = (note.content || '').toLowerCase().includes(q);
        const inTags = (note.tags || []).some(t => t.toLowerCase().includes(q.replace('#', '')));
        const matchSearch = !q || inTitle || inContent || inTags;
        
        // Логика отображения по разделам
        if (state.currentView === 'archive') {
            return note.archived && matchSearch;
        } else if (state.currentView === 'folder') {
            return !note.archived && note.folderId === state.activeFolderId && matchSearch;
        } else {
            // 'notes' (Все активные)
            return !note.archived && matchSearch;
        }
    });

    // Сортировка: Сначала закрепленные
    filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Если оба закреплены или оба нет — по дате (уже отсортировано Firestore, но на всякий случай)
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px; width:100%">
            ${state.searchQuery ? getText('noResults') : getText('emptyList')}
        </div>`;
        return;
    }

    filtered.forEach(note => {
        const card = document.createElement('div');
        card.className = `note-card ${note.pinned ? 'pinned' : ''}`;
        card.onclick = () => openEditor(note.id);
        
        // Приоритет цветом (если нужно визуально на карточке)
        // const priorityColors = ['transparent', 'var(--warning)', 'var(--danger)'];
        // const borderStyle = note.priority > 0 ? `border-left: 4px solid ${priorityColors[note.priority]}` : '';

        card.innerHTML = `
            ${note.pinned ? '<span class="material-icons-round pin-icon">push_pin</span>' : ''}
            <div class="note-title">${note.title || getText('untitled')}</div>
            <div class="note-preview">${(note.content || '').substring(0, 150)}...</div>
            <div class="note-footer">
                <div class="note-tags">
                    ${(note.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join('')}
                </div>
                <div class="note-date">${formatDate(note.updatedAt)}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// =========================================
// 5. РЕДАКТОР ЗАМЕТОК
// =========================================

function openEditor(noteId = null) {
    currentNoteId = noteId;
    
    // Сброс драфта
    state.draft = { priority: 0, pinned: false, archived: false };

    if (noteId) {
        // Редактирование существующей
        const note = state.notes.find(n => n.id === noteId);
        if (note) {
            document.getElementById('note-title').value = note.title || '';
            document.getElementById('note-content').value = note.content || '';
            document.getElementById('note-tags').value = (note.tags || []).join(' ');
            document.getElementById('last-edited').textContent = getText('edited') + ' ' + formatDate(note.updatedAt);
            
            // Загружаем состояние в драфт
            state.draft.priority = note.priority || 0;
            state.draft.pinned = note.pinned || false;
            state.draft.archived = note.archived || false;
        }
    } else {
        // Новая заметка
        document.getElementById('note-title').value = '';
        document.getElementById('note-content').value = '';
        document.getElementById('note-tags').value = '';
        document.getElementById('last-edited').textContent = getText('newNote');
    }

    // Обновляем иконки в тулбаре редактора
    updateEditorToolbarUI();
    
    document.getElementById('editor-modal').classList.remove('hidden');
    document.getElementById('left-menu').classList.remove('active');
}

function updateEditorToolbarUI() {
    const pBtn = document.getElementById('priority-btn');
    const pinBtn = document.getElementById('pin-btn');
    const archBtn = document.querySelector('.tool-btn.warning'); // кнопка архива

    // Цвета приоритета
    const colors = ['var(--text-muted)', 'var(--warning)', 'var(--danger)'];
    pBtn.style.color = colors[state.draft.priority];

    // Активность пина
    pinBtn.style.color = state.draft.pinned ? 'var(--primary)' : 'var(--text-muted)';
    
    // Текст/Иконка архивации (меняется в зависимости от состояния)
    if (state.draft.archived) {
        archBtn.innerHTML = '<span class="material-icons-round">unarchive</span>';
        archBtn.title = getText('unarchive');
    } else {
        archBtn.innerHTML = '<span class="material-icons-round">archive</span>';
        archBtn.title = getText('archive');
    }
}

async function closeEditor() {
    await saveNote();
    document.getElementById('editor-modal').classList.add('hidden');
    currentNoteId = null;
}

// Сохранение заметки
async function saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const tagsStr = document.getElementById('note-tags').value;
    const tags = tagsStr ? tagsStr.split(' ').filter(t => t !== '') : [];

    // Не сохраняем пустые новые заметки
    if (!currentNoteId && !title && !content) return;

    const noteData = {
        title, 
        content, 
        tags,
        priority: state.draft.priority,
        pinned: state.draft.pinned,
        archived: state.draft.archived,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Если создаем новую, привязываем к текущей папке (если открыта папка)
    if (!currentNoteId && state.currentView === 'folder' && state.activeFolderId) {
        noteData.folderId = state.activeFolderId;
    }

    try {
        if (currentNoteId) {
            await db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).update(noteData);
        } else {
            const docRef = await db.collection('users').doc(state.user.uid).collection('notes').add(noteData);
            currentNoteId = docRef.id; // Запоминаем ID, чтобы повторные сейвы не плодили дубли
        }
    } catch (e) {
        console.error("Save error:", e);
    }
}

// --- Действия внутри редактора ---

// 1. Приоритет
function cyclePriority() {
    state.draft.priority = (state.draft.priority + 1) % 3;
    updateEditorToolbarUI();
    // Если заметка уже существует, сохраняем сразу для надежности
    if (currentNoteId) {
        db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).update({ 
            priority: state.draft.priority 
        });
    }
}

// 2. Закрепление (Pin)
function togglePin() {
    state.draft.pinned = !state.draft.pinned;
    updateEditorToolbarUI();
    if (currentNoteId) {
        db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).update({ 
            pinned: state.draft.pinned 
        });
    }
}

// 3. Архивация
function toggleArchive() {
    state.draft.archived = !state.draft.archived;
    updateEditorToolbarUI();
    
    // Если заметка существует, сохраняем и закрываем (так принято в UX архивации)
    if (currentNoteId) {
        saveNote().then(() => {
            document.getElementById('editor-modal').classList.add('hidden');
            // Если мы были в списке заметок, она исчезнет визуально
        });
    }
}

// 4. Вставка времени
function insertCurrentTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString(state.config.lang === 'ru' ? 'ru-RU' : 'en-US', {
        hour: '2-digit', minute: '2-digit'
    });
    const contentArea = document.getElementById('note-content');
    contentArea.value += ` [${timeStr}] `;
    contentArea.focus();
}

// 5. Удаление
function deleteNoteWrapper() {
    if (!currentNoteId) {
        // Если заметка новая и не сохранена - просто закрываем
        document.getElementById('editor-modal').classList.add('hidden');
        return;
    }
    
    openConfirmModal(
        getText('delNoteTitle'),
        getText('delNoteText'),
        async () => {
            await db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).delete();
            document.getElementById('editor-modal').classList.add('hidden');
            currentNoteId = null;
        }
    );
}

// =========================================
// 6. НАСТРОЙКИ, ПОИСК И ЛОКАЛИЗАЦИЯ
// =========================================

// Словарь
const translations = {
    ru: {
        untitled: "Без названия",
        newNote: "Новая заметка",
        edited: "Ред.",
        emptyList: "Здесь пока пусто",
        noResults: "Ничего не найдено",
        logoutConfirmTitle: "Выйти из аккаунта?",
        logoutConfirmText: "Несохраненные данные могут быть потеряны.",
        switchConfirmTitle: "Сменить аккаунт?",
        switchConfirmText: "Вы перейдете на страницу входа.",
        delFolderTitle: "Удалить папку?",
        delFolderText: "Заметки останутся, но перестанут относиться к этой папке.",
        delNoteTitle: "Удалить заметку?",
        delNoteText: "Это действие необратимо.",
        archive: "В архив",
        unarchive: "Вернуть из архива"
    },
    en: {
        untitled: "Untitled",
        newNote: "New Note",
        edited: "Edited",
        emptyList: "It's empty here",
        noResults: "No results found",
        logoutConfirmTitle: "Log out?",
        logoutConfirmText: "Unsaved changes may be lost.",
        switchConfirmTitle: "Switch account?",
        switchConfirmText: "You will be redirected to login.",
        delFolderTitle: "Delete folder?",
        delFolderText: "Notes will remain but won't be in this folder.",
        delNoteTitle: "Delete note?",
        delNoteText: "This action cannot be undone.",
        archive: "Archive",
        unarchive: "Unarchive"
    }
};

function getText(key) {
    return translations[state.config.lang][key] || key;
}

function setLanguage(lang) {
    state.config.lang = lang;
    
    // UI переключателя
    document.getElementById('lang-ru').classList.toggle('active', lang === 'ru');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    
    // Перерисовка интерфейса
    renderNotes();
}

// Поиск
document.getElementById('search-input').oninput = (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderNotes();
};

function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }

// Темы
function applyPreset(theme) {
    const presets = {
        dark: { accent: '#00ffcc', bg: '#0a0a0a' },
        midnight: { accent: '#38bdf8', bg: '#0f172a' },
        forest: { accent: '#4ade80', bg: '#051a10' }
    };
    const p = presets[theme];
    document.getElementById('color-accent').value = p.accent;
    document.getElementById('color-bg').value = p.bg;
    updateCustomTheme();
}

function updateCustomTheme() {
    const accent = document.getElementById('color-accent').value;
    const bg = document.getElementById('color-bg').value;
    
    document.documentElement.style.setProperty('--primary', accent);
    document.documentElement.style.setProperty('--bg', bg);
    document.documentElement.style.setProperty('--primary-glow', accent + '4d'); 
}

// =========================================
// 7. ОБРАТНАЯ СВЯЗЬ И УТИЛИТЫ
// =========================================

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString(state.config.lang === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}

// Модалка подтверждения
let confirmCallback = null;
function openConfirmModal(title, text, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    document.getElementById('confirm-modal').classList.remove('hidden');
    confirmCallback = callback;
}
function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmCallback = null;
}
document.getElementById('confirm-action-btn').onclick = () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
};

// Рейтинг и фидбек
let currentRating = 0;
function openFeedback() { document.getElementById('feedback-modal').classList.remove('hidden'); }
function closeFeedback() { document.getElementById('feedback-modal').classList.add('hidden'); }

document.querySelectorAll('#star-rating span').forEach(star => {
    star.onclick = (e) => {
        currentRating = e.target.dataset.value;
        updateStars();
    };
});
function updateStars() {
    document.querySelectorAll('#star-rating span').forEach(star => {
        star.classList.toggle('active', star.dataset.value <= currentRating);
    });
}

async function submitFeedback() {
    const text = document.getElementById('feedback-text').value;
    if (!text && currentRating === 0) return;

    try {
        await db.collection('feedback').add({
            uid: state.user.uid,
            userName: state.user.displayName,
            rating: currentRating,
            message: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(state.config.lang === 'ru' ? "Спасибо!" : "Thanks!");
        closeFeedback();
    } catch(e) {
        console.error(e);
    }
}

// Привязки для HTML (глобальная область видимости)
window.login = login;
window.requestLogout = requestLogout;
window.requestSwitchAccount = requestSwitchAccount;
window.toggleProfileMenu = toggleProfileMenu;
window.switchView = switchView;
window.toggleLeftMenu = toggleLeftMenu;
window.openFolderModal = openFolderModal;
window.closeFolderModal = closeFolderModal;
window.confirmCreateCreateFolder = confirmCreateFolder; // Обрати внимание на имя в HTML
window.confirmCreateFolder = confirmCreateFolder;       // Алиас для надежности
window.deleteFolder = deleteFolder;
window.createNote = () => openEditor(); // Кнопка FAB
window.openEditor = openEditor;
window.closeEditor = closeEditor;
window.insertCurrentTime = insertCurrentTime;
window.cyclePriority = cyclePriority;
window.togglePin = togglePin;
window.toggleArchive = toggleArchive;
window.deleteNoteWrapper = deleteNoteWrapper;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.setLanguage = setLanguage;
window.applyPreset = applyPreset;
window.updateCustomTheme = updateCustomTheme;
window.openFeedback = openFeedback;
window.closeFeedback = closeFeedback;
window.submitFeedback = submitFeedback;
window.closeConfirmModal = closeConfirmModal;

