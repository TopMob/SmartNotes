const Editor = {
    history: [],
    future: [],
    saveTimeout: null,
    maxHistory: 50,

    init() {
        this.titleInp = document.getElementById('note-title');
        this.contentInp = document.getElementById('note-content');
        this.tagsInp = document.getElementById('note-tags-input');
        
        const inputHandler = () => {
            this.pushHistory();
            this.handleAutoSave();
        };

        this.titleInp.oninput = inputHandler;
        this.contentInp.oninput = inputHandler;
        
        this.tagsInp.onkeydown = (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.addTag(e.target.value.trim());
                e.target.value = '';
                this.handleAutoSave();
            }
        };

        window.addEventListener('keydown', (e) => {
            if (state.currentNote) {
                if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
                if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
            }
        });
    },

    open(note = null) {
        const defaultFolder = state.view === 'folder' ? state.activeFolderId : null;
        
        state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
            id: this.generateId(),
            title: '',
            content: '',
            tags: [],
            isPinned: false,
            isArchived: false,
            folderId: defaultFolder,
            authorId: state.user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        this.history = [];
        this.future = [];
        
        this.renderEditorState();
        document.getElementById('note-editor').classList.add('active');
        this.contentInp.focus();
    },

    generateId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    },

    renderEditorState() {
        const n = state.currentNote;
        this.titleInp.value = n.title;
        this.contentInp.value = n.content;
        this.renderTags();
        this.updateToggleButtons();
    },

    addTag(tag) {
        if (!state.currentNote.tags.includes(tag)) {
            state.currentNote.tags.push(tag);
            this.renderTags();
        }
    },

    removeTag(tag) {
        state.currentNote.tags = state.currentNote.tags.filter(t => t !== tag);
        this.renderTags();
        this.handleAutoSave();
    },

    renderTags() {
        const container = document.getElementById('note-tags-container');
        container.innerHTML = state.currentNote.tags.map(t => `
            <span class="tag-chip">
                #${t}
                <i class="material-icons-round" onclick="Editor.removeTag('${t}')">close</i>
            </span>
        `).join('');
    },

    togglePin() {
        state.currentNote.isPinned = !state.currentNote.isPinned;
        this.updateToggleButtons();
        this.handleAutoSave();
        UI.showToast(state.currentNote.isPinned ? 'Закреплено' : 'Откреплено');
    },

    toggleArchive() {
        state.currentNote.isArchived = !state.currentNote.isArchived;
        this.updateToggleButtons();
        this.handleAutoSave();
        if (state.currentNote.isArchived) {
            UI.showToast('В архиве');
            this.close();
        } else {
            UI.showToast('Восстановлено');
        }
    },

    updateToggleButtons() {
        const pinBtn = document.getElementById('pin-btn');
        const arcBtn = document.getElementById('archive-btn');
        if (pinBtn) pinBtn.classList.toggle('active', state.currentNote.isPinned);
        if (arcBtn) arcBtn.classList.toggle('active', state.currentNote.isArchived);
    },

    deleteCurrent() {
        UI.showConfirm("Удалить", "Заметка будет удалена безвозвратно.", async () => {
            if (state.currentNote.id) {
                await db.collection('users').doc(state.user.uid).collection('notes').doc(state.currentNote.id).delete();
            }
            this.close(true); 
        });
    },

    pushHistory() {
        const currentData = {
            title: this.titleInp.value,
            content: this.contentInp.value
        };
        if (this.history.length > 0) {
            const last = this.history[this.history.length - 1];
            if (last.title === currentData.title && last.content === currentData.content) return;
        }
        this.history.push(currentData);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.future = [];
    },

    undo() {
        if (this.history.length <= 1) return;
        this.future.push(this.history.pop());
        const prev = this.history[this.history.length - 1];
        this.applyHistoryState(prev);
    },

    redo() {
        if (this.future.length === 0) return;
        const next = this.future.pop();
        this.history.push(next);
        this.applyHistoryState(next);
    },

    applyHistoryState(data) {
        this.titleInp.value = data.title;
        this.contentInp.value = data.content;
        this.handleAutoSave();
    },

    handleAutoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.save(), 1000);
        document.getElementById('last-edited').innerText = 'Сохранение...';
    },

    async save() {
        if (!state.user || !state.currentNote) return;
        
        state.currentNote.title = this.titleInp.value;
        state.currentNote.content = this.contentInp.value;
        state.currentNote.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        try {
            await db.collection('users').doc(state.user.uid)
                    .collection('notes').doc(state.currentNote.id)
                    .set(state.currentNote, { merge: true });
            document.getElementById('last-edited').innerText = 'Сохранено';
        } catch (e) {
            console.error("Save error:", e);
        }
    },

    async close(skipSave = false) {
        if (!skipSave) await this.save();
        document.getElementById('note-editor').classList.remove('active');
        state.currentNote = null;
    }
};

document.addEventListener('DOMContentLoaded', () => Editor.init());
