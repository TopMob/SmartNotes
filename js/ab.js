function initApp() {
    syncFolders();
    syncNotes();
    const savedLang = localStorage.getItem('app-lang') || 'ru';
    UI.setLang(savedLang);
}

function syncFolders() {
    db.collection('users').doc(state.user.uid).collection('folders')
      .orderBy('createdAt', 'asc').onSnapshot(snap => {
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
    const q = (query || '').toLowerCase().trim();
    let filtered = state.notes.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const tagsMatch = (n.tags || []).some(t => ('#'+t.toLowerCase()).includes(q) || t.toLowerCase().includes(q));
        return titleMatch || contentMatch || tagsMatch;
    });

    if (state.view === 'notes') filtered = filtered.filter(n => !n.isArchived);
    else if (state.view === 'favorites') filtered = filtered.filter(n => !n.isArchived && n.isImportant);
    else if (state.view === 'archive') filtered = filtered.filter(n => n.isArchived);
    else if (state.view === 'folder' && state.activeFolderId) filtered = filtered.filter(n => !n.isArchived && n.folderId === state.activeFolderId);

    filtered.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
    });
    UI.renderNotes(filtered);
};

window.toggleNotePin = async (id, val) => {
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({ isPinned: val });
};
window.toggleNoteImportant = async (id, val) => {
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({ isImportant: val });
};
window.toggleNoteArchive = async (id, val) => {
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({ isArchived: val, isPinned: false });
    UI.showToast(val ? "В архиве" : "Восстановлено");
};

async function createNewFolder() {
    if (state.folders.length >= 10) return UI.showToast("Лимит папок (10)");
    const name = prompt("Название:");
    if (!name) return;
    try { await db.collection('users').doc(state.user.uid).collection('folders').add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } catch(e){}
}

async function deleteFolder(id) {
    UI.showConfirm("delete_f", async () => {
        await db.collection('users').doc(state.user.uid).collection('folders').doc(id).delete();
        if (state.view === 'folder' && state.activeFolderId === id) switchView('notes');
    });
}
