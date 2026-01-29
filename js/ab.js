const state = {
    notes: [],
    folders: [],
    activeFolderId: null,
    currentView: 'all',
    searchQuery: ''
};

const DataEngine = {
    async init() {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.syncCore();
                this.injectUserMeta(user);
            } else {
                location.reload();
            }
        });
    },

    injectUserMeta(user) {
        const photo = document.getElementById('user-photo');
        const name = document.getElementById('user-name');
        if (photo) photo.src = user.photoURL || 'https://via.placeholder.com/150';
        if (name) name.innerText = user.displayName || 'Explorer';
    },

    syncCore() {
        const uid = firebase.auth().currentUser.uid;
        
        db.collection('notes')
            .where('userId', '==', uid)
            .orderBy('updatedAt', 'desc')
            .onSnapshot(snapshot => {
                state.notes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.processAndRender();
            }, error => {
                console.error("Sync Error:", error);
                UI.showNotification('Ошибка синхронизации', 'error');
            });

        db.collection('folders')
            .where('userId', '==', uid)
            .onSnapshot(snapshot => {
                state.folders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                if (window.renderFolders) renderFolders();
            });
    },

    processAndRender() {
        let filtered = [...state.notes];

        if (state.currentView === 'archive') {
            filtered = filtered.filter(n => n.isArchived);
        } else if (state.currentView === 'folder') {
            filtered = filtered.filter(n => n.folderId === state.activeFolderId);
        } else {
            filtered = filtered.filter(n => !n.isArchived);
        }

        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filtered = filtered.filter(n => 
                n.title.toLowerCase().includes(query) || 
                n.content.toLowerCase().includes(query) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
            );
        }

        UI.renderNotes(filtered);
    },

    async createFolder(name, color = '#00d4ff') {
        const uid = firebase.auth().currentUser.uid;
        try {
            await db.collection('folders').add({
                name,
                color,
                userId: uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            UI.showNotification('Коллекция создана');
        } catch (e) {
            UI.showNotification('Ошибка папки', 'error');
        }
    }
};

const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        DataEngine.processAndRender();
    });
}

document.querySelectorAll('.nav-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        const type = pill.innerText.toLowerCase();
        document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        if (type.includes('инборд')) state.currentView = 'all';
        if (type.includes('архив')) state.currentView = 'archive';
        
        DataEngine.processAndRender();
        if (window.innerWidth < 1024) UI.toggleSidebar(false);
    });
});



window.fetchNotes = () => DataEngine.processAndRender();
DataEngine.init();
