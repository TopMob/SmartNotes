function initApp() {
    syncFolders();
    syncNotes();
}

function syncFolders() {
    db.collection('users').doc(state.user.uid).collection('folders')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
          state.folders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          UI.renderFolders(state.folders);
      });
}

function syncNotes() {
    db.collection('users').doc(state.user.uid).collection('notes')
      .onSnapshot(snap => {
          state.notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          filterAndRender(document.getElementById('search-input')?.value || '');
      });
}

window.filterAndRender = (query) => {
    const q = (query || '').toLowerCase();
    
    let filtered = state.notes.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const tagsMatch = (n.tags || []).some(t => t.toLowerCase().includes(q));
        return titleMatch || contentMatch || tagsMatch;
    });

    if (state.view === 'notes') {
        filtered = filtered.filter(n => !n.isArchived);
    } else if (state.view === 'favorites') {
        filtered = filtered.filter(n => !n.isArchived && n.isPinned);
    } else if (state.view === 'archive') {
        filtered = filtered.filter(n => n.isArchived);
    } else if (state.view === 'folder' && state.activeFolderId) {
        filtered = filtered.filter(n => !n.isArchived && n.folderId === state.activeFolderId);
    }

    filtered.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
    });

    UI.renderNotes(filtered);
};

async function createNewFolder() {
    if (state.folders.length >= 10) return UI.showToast("Лимит папок (10)");
    
    const name = prompt("Название папки:");
    if (!name) return;
    
    try {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {
        UI.showToast("Ошибка создания папки");
    }
}

async function deleteFolder(folderId) {
    UI.showConfirm(
        "Удалить папку", 
        "Заметки внутри останутся без папки.", 
        async () => {
            await db.collection('users').doc(state.user.uid).collection('folders').doc(folderId).delete();
            if (state.view === 'folder' && state.activeFolderId === folderId) {
                switchView('notes');
            }
        }
    );
}
