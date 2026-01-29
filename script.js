// =========================================
// 1. КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ
// =========================================
const firebaseConfig = {
    apiKey: "AIzaSy...", // Используй свои ключи из консоли Firebase
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc..."
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Глобальное состояние приложения
let state = {
    user: null,
    notes: [],
    folders: [],
    currentView: 'notes', // 'notes', 'archive', 'folder'
    activeFolderId: null,
    searchQuery: '',
    config: {
        lang: 'ru',
        accentColor: '#00ffcc',
        bgColor: '#0a0a0a'
    }
};

// =========================================
// 2. АВТОРИЗАЦИЯ И ПРОФИЛЬ
// =========================================

// Вход через Google
async function login() {
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Ошибка входа:", error);
    }
}

// Запрос на выход (Модалка подтверждения)
function requestLogout() {
    openConfirmModal(
        "Выйти из аккаунта?",
        "Все несохраненные изменения могут быть потеряны.",
        async () => {
            await auth.signOut();
            window.location.reload();
        }
    );
}

// Запрос на смену аккаунта
function requestSwitchAccount() {
    openConfirmModal(
        "Сменить аккаунт?",
        "Вы будете перенаправлены на страницу выбора Google-аккаунта.",
        async () => {
            await auth.signOut();
            await login();
        }
    );
}

// Слушатель состояния пользователя
auth.onAuthStateChanged(user => {
    if (user) {
        state.user = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        
        // Заполнение данных профиля
        document.getElementById('user-avatar').src = user.photoURL || '';
        document.getElementById('user-name').textContent = user.displayName;
        document.getElementById('user-email').textContent = user.email;
        
        initAppData(); // Загрузка данных из БД
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
});

function toggleProfileMenu() {
    document.getElementById('profile-menu').classList.toggle('hidden');
}

// =========================================
// 3. УПРАВЛЕНИЕ ПАПКАМИ (КАТЕГОРИЯМИ)
// =========================================

function openFolderModal() {
    document.getElementById('folder-modal').classList.remove('hidden');
}

function closeFolderModal() {
    document.getElementById('folder-modal').classList.add('hidden');
    document.getElementById('new-folder-name').value = '';
}

async function confirmCreateFolder() {
    const name = document.getElementById('new-folder-name').value.trim();
    const color = document.getElementById('new-folder-color').value;

    if (!name) return;

    try {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name: name,
            color: color,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeFolderModal();
        loadFolders(); // Перерисовка списка
    } catch (e) {
        console.error("Ошибка создания папки:", e);
    }
}

async function loadFolders() {
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
        div.className = `folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
        div.onclick = () => switchView('folder', folder.id);
        
        div.innerHTML = `
            <div class="folder-info">
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

// =========================================
// 4. НАВИГАЦИЯ И ИНТЕРФЕЙС
// =========================================

function switchView(view, folderId = null) {
    state.currentView = view;
    state.activeFolderId = folderId;
    
    // Сброс активных классов в меню
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    if (view === 'notes') document.getElementById('nav-notes').classList.add('active');
    if (view === 'archive') document.getElementById('nav-archive').classList.add('active');
    
    renderNotes(); // Функция будет во 2-й части
    renderFolders();
    
    // Закрываем меню на мобилках после выбора
    if (window.innerWidth <= 768) {
        document.getElementById('left-menu').classList.remove('active');
    }
}

function toggleLeftMenu() {
    const menu = document.getElementById('left-menu');
    menu.classList.toggle('active');
}

// =========================================
// 5. МОДАЛЬНЫЕ ОКНА ПОДТВЕРЖДЕНИЯ
// =========================================

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

// =========================================
// 6. ОБРАТНАЯ СВЯЗЬ (РЕЙТИНГ)
// =========================================

let currentRating = 0;

function openFeedback() {
    document.getElementById('feedback-modal').classList.remove('hidden');
}

function closeFeedback() {
    document.getElementById('feedback-modal').classList.add('hidden');
}

// Обработка клика по звездам
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
// =========================================
// 7. ЛОГИКА ЗАМЕТОК (CRUD)
// =========================================

let currentNoteId = null;

async function initAppData() {
    await loadFolders();
    loadNotes();
}

function loadNotes() {
    db.collection('users').doc(state.user.uid).collection('notes')
        .orderBy('pinned', 'desc')
        .orderBy('updatedAt', 'desc')
        .onSnapshot(snapshot => {
            state.notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderNotes();
        });
}

function renderNotes() {
    const container = document.getElementById('notes-container');
    container.innerHTML = '';

    const filtered = state.notes.filter(note => {
        const matchesSearch = note.title.toLowerCase().includes(state.searchQuery) || 
                             note.content.toLowerCase().includes(state.searchQuery) ||
                             (note.tags && note.tags.some(t => t.toLowerCase().includes(state.searchQuery.replace('#', ''))));
        
        const matchesArchive = (state.currentView === 'archive') ? note.archived : !note.archived;
        const matchesFolder = (state.currentView === 'folder') ? note.folderId === state.activeFolderId : true;

        return matchesSearch && matchesArchive && matchesFolder;
    });

    filtered.forEach(note => {
        const card = document.createElement('div');
        card.className = `note-card ${note.pinned ? 'pinned' : ''}`;
        card.onclick = () => openEditor(note.id);
        
        card.innerHTML = `
            ${note.pinned ? '<span class="material-icons-round pin-icon">push_pin</span>' : ''}
            <div class="note-title">${note.title || 'Без названия'}</div>
            <div class="note-preview">${note.content || ''}</div>
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
// 8. РЕДАКТОР (С ИСПРАВЛЕНИЕМ БАГОВ)
// =========================================

function openEditor(noteId = null) {
    currentNoteId = noteId;
    const note = state.notes.find(n => n.id === noteId) || { title: '', content: '', tags: [], priority: 0 };
    
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
    document.getElementById('note-tags').value = (note.tags || []).join(' ');
    
    // Сбрасываем иконку приоритета
    updatePriorityUI(note.priority);
    
    document.getElementById('editor-modal').classList.remove('hidden');
    // Багфикс: закрываем боковое меню при открытии редактора
    document.getElementById('left-menu').classList.remove('active');
}

function closeEditor() {
    saveNote();
    document.getElementById('editor-modal').classList.add('hidden');
    currentNoteId = null;
}

async function saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const tags = document.getElementById('note-tags').value.split(' ').filter(t => t !== '');

    if (!title && !content) return;

    const data = {
        title, content, tags,
        folderId: state.activeFolderId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (currentNoteId) {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).update(data);
    } else {
        data.archived = false;
        data.pinned = false;
        data.priority = 0;
        await db.collection('users').doc(state.user.uid).collection('notes').add(data);
    }
}

// =========================================
// 9. ФУНКЦИИ ВНУТРИ РЕДАКТОРА
// =========================================

function insertCurrentTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString(state.config.lang === 'ru' ? 'ru-RU' : 'en-US', {
        hour: '2-digit', minute: '2-digit'
    });
    const dateStr = now.toLocaleDateString(state.config.lang === 'ru' ? 'ru-RU' : 'en-US');
    document.getElementById('note-content').value += ` [${dateStr} ${timeStr}] `;
}

function cyclePriority() {
    const note = state.notes.find(n => n.id === currentNoteId);
    if (!note) return;
    const newPriority = (note.priority + 1) % 3; // 0, 1, 2
    db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).update({ priority: newPriority });
    updatePriorityUI(newPriority);
}

function updatePriorityUI(level) {
    const btn = document.getElementById('priority-btn');
    const colors = ['var(--text-muted)', 'var(--warning)', 'var(--danger)'];
    btn.style.color = colors[level];
}

async function deleteNoteWrapper() {
    if (!currentNoteId) return;
    openConfirmModal("Удалить заметку?", "Это действие необратимо.", async () => {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(currentNoteId).delete();
        document.getElementById('editor-modal').classList.add('hidden');
    });
}

// =========================================
// 10. ПОИСК, НАСТРОЙКИ И ТЕМЫ
// =========================================

document.getElementById('search-input').oninput = (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderNotes();
};

function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }

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
    // Генерируем свечение (glow) программно
    document.documentElement.style.setProperty('--primary-glow', accent + '4d'); 
}

// =========================================
// 11. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =========================================

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString(state.config.lang === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}

async function submitFeedback() {
    const text = document.getElementById('feedback-text').value;
    if (!text && currentRating === 0) return;

    await db.collection('feedback').add({
        uid: state.user.uid,
        userName: state.user.displayName,
        rating: currentRating,
        message: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(state.config.lang === 'ru' ? "Спасибо за отзыв!" : "Thanks for your feedback!");
    closeFeedback();
}

// Глобальные привязки для HTML (чтобы onclick работал)
window.createNote = () => openEditor();
window.insertCurrentTime = insertCurrentTime;
window.cyclePriority = cyclePriority;
window.deleteNoteWrapper = deleteNoteWrapper;
window.submitFeedback = submitFeedback;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.applyPreset = applyPreset;
window.updateCustomTheme = updateCustomTheme;
