function initApp() {
    if (!state.user) return;
    
    console.log("🚀 Smart Notes System Initialized");
    
    syncFolders();
    syncNotes();
    setupSearchEngine();
}

function syncFolders() {
    db.collection('users').doc(state.user.uid).collection('folders')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            state.folders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderFolders();
        }, error => {
            console.error("❌ Folder Sync Error:", error);
        });
}

function syncNotes() {
    db.collection('users').doc(state.user.uid).collection('notes')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            state.notes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            filterAndRender();
        }, error => {
            console.error("❌ Notes Sync Error:", error);
        });
}

function filterAndRender() {
    let results = [...state.notes];

    if (state.currentView === 'archive') {
        results = results.filter(n => n.isArchived);
    } else if (state.currentView === 'folder') {
        results = results.filter(n => n.folderId === state.activeFolderId && !n.isArchived);
    } else {
        results = results.filter(n => !n.isArchived);
    }

    const query = state.searchQuery.toLowerCase().trim();
    if (query) {
        results = results.filter(n => {
            const titleMatch = (n.title || "").toLowerCase().includes(query);
            const contentMatch = (n.content || "").toLowerCase().includes(query);
            const tagMatch = n.tags?.some(tag => tag.toLowerCase().includes(query.replace('#', '')));
            return titleMatch || contentMatch || tagMatch;
        });
    }

    renderNotes(results);
}

function setupSearchEngine() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            filterAndRender();
        });
    }
}

async function createFolder(name, color) {
    try {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name: name,
            color: color,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Folder creation failed:", e);
        return false;
    }
}

async function updateNoteStatus(noteId, status) {
    try {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(noteId).update({
            isArchived: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Status update failed:", e);
    }
}

async function permanentDelete(noteId) {
    const confirmed = confirm("Удалить заметку навсегда? Это действие нельзя отменить.");
    if (!confirmed) return;

    try {
        await db.collection('users').doc(state.user.uid).collection('notes').doc(noteId).delete();
    } catch (e) {
        console.error("Deletion failed:", e);
    }
}

async function addNoteFeedback(rating, comment) {
    try {
        await db.collection('feedback').add({
            uid: state.user.uid,
            userName: state.user.displayName,
            rating: rating,
            comment: comment,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Спасибо за ваш отзыв! Мы становимся лучше для вас.");
    } catch (e) {
        console.error("Feedback error:", e);
    }
}

function getNoteStats() {
    const total = state.notes.length;
    const archived = state.notes.filter(n => n.isArchived).length;
    const active = total - archived;
    return { total, archived, active };
}