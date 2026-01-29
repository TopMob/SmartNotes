/**
 * Smart Notes - Работа с базой данных Firestore
 */

// Инициализация загрузки при входе
function initApp() {
    if (!state.user) return;
    
    console.log("📥 Загрузка данных...");
    loadFolders();
    loadNotes();
    setupSearch();
}

// Загрузка папок
function loadFolders() {
    db.collection('users').doc(state.user.uid).collection('folders')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            state.folders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            if (typeof renderFolders === 'function') renderFolders();
        }, err => console.error("Ошибка загрузки папок:", err));
}

// Загрузка заметок
function loadNotes() {
    db.collection('users').doc(state.user.uid).collection('notes')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            state.notes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            filterAndRender();
        }, err => console.error("Ошибка загрузки заметок:", err));
}

// Фильтрация и запуск отрисовки
function filterAndRender() {
    let filtered = state.notes;

    // Сортировка по виду (Архив / Обычные)
    if (state.currentView === 'archive') {
        filtered = filtered.filter(n => n.isArchived);
    } else if (state.currentView === 'folder') {
        filtered = filtered.filter(n => n.folderId === state.activeFolderId && !n.isArchived);
    } else {
        filtered = filtered.filter(n => !n.isArchived);
    }

    // Поиск
    const q = state.searchQuery.toLowerCase().trim();
    if (q) {
        filtered = filtered.filter(n => {
            const inTitle = (n.title || "").toLowerCase().includes(q);
            const inText = (n.content || "").toLowerCase().includes(q);
            const inTags = n.tags?.some(t => t.toLowerCase().includes(q.replace('#','')));
            return inTitle || inText || inTags;
        });
    }

    if (typeof renderNotes === 'function') renderNotes(filtered);
}

// Поиск
function setupSearch() {
    const input = document.getElementById('search-input');
    if (input) {
        input.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            filterAndRender();
        });
    }
}

// Удаление
async function deleteNote(id) {
    try {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(id).delete();
    } catch (e) {
        alert("Ошибка при удалении");
    }
}
