// =========================================
// 1. ИНИЦИАЛИЗАЦИЯ ДАННЫХ
// =========================================
function initApp() {
    loadFolders();
    loadNotes();
    setupSearch();
}

// =========================================
// 2. РАБОТА С ПАПКАМИ
// =========================================
function loadFolders() {
    db.collection('users').doc(state.user.uid).collection('folders')
        .onSnapshot(snapshot => {
            state.folders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderFolders(); // Функция из ui.js
        });
}

async function saveFolder() {
    const nameInput = document.getElementById('folder-name-input');
    const colorInput = document.getElementById('folder-color-input');
    
    if (!nameInput.value.trim()) return;

    await db.collection('users').doc(state.user.uid).collection('folders').add({
        name: nameInput.value.trim(),
        color: colorInput.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    nameInput.value = '';
    closeFolderModal();
}

// =========================================
// 3. РАБОТА С ЗАМЕТКАМИ
// =========================================
function loadNotes() {
    db.collection('users').doc(state.user.uid).collection('notes')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            state.notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filterAndRenderNotes(); 
        });
}

// Глобальный фильтр (Поиск + Теги + Папки + Архив)
function filterAndRenderNotes() {
    let filtered = state.notes;

    // 1. Фильтр по виду (Заметки / Архив)
    if (state.currentView === 'archive') {
        filtered = filtered.filter(n => n.isArchived);
    } else if (state.currentView === 'folder') {
        filtered = filtered.filter(n => n.folderId === state.activeFolderId && !n.isArchived);
    } else {
        filtered = filtered.filter(n => !n.isArchived);
    }

    // 2. Поиск (по заголовку, тексту или #тегам)
    const query = state.searchQuery.toLowerCase();
    if (query) {
        filtered = filtered.filter(n => {
            const inTitle = n.title?.toLowerCase().includes(query);
            const inContent = n.content?.toLowerCase().includes(query);
            const inTags = n.tags?.some(t => t.toLowerCase().includes(query.replace('#', '')));
            return inTitle || inContent || inTags;
        });
    }

    renderNotes(filtered); // Функция из ui.js
}

// =========================================
// 4. ПОИСК
// =========================================
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        filterAndRenderNotes();
    });
}

// Удаление заметки
async function deleteNote(id) {
    if (confirm("Удалить заметку безвозвратно?")) {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(id).delete();
        closeEditor();
    }
}