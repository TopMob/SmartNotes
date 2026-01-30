const Editor = {
    history: [],
    future: [],
    saveTimeout: null,
    maxHistory: 30,

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
                let val = e.target.value.trim().replace('#', '');
                this.addTag(val);
                e.target.value = '';
                this.handleAutoSave();
            }
        };
    },

    open(note = null) {
        const defFolder = state.view === 'folder' ? state.activeFolderId : null;
        
        state.currentNote = note ? JSON.parse(JSON.stringify(note)) : {
            id: Math.random().toString(36).substr(2, 9),
            title: '', content: '', tags: [],
            isPinned: false, isArchived: false, isImportant: false,
            folderId: defFolder,
            authorId: state.user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        this.history = [];
        this.future = [];
        this.renderEditorState();
        document.getElementById('note-editor').classList.add('active');
        // Delay focus to prevent mobile keyboard glitches on open
        setTimeout(() => this.contentInp.focus(), 100);
    },

    renderEditorState() {
        const n = state.currentNote;
        this.titleInp.value = n.title;
        this.contentInp.value = n.content;
        this.renderTags();
        this.updateButtons();
    },

    addTag(tag) {
        if (!state.currentNote.tags) state.currentNote.tags = [];
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
        container.innerHTML = (state.currentNote.tags || []).map(t => `
            <span class="tag-chip">
                #${t}
                <i class="material-icons-round" onclick="Editor.removeTag('${t}')">close</i>
            </span>
        `).join('');
    },

    togglePin() {
        state.currentNote.isPinned = !state.currentNote.isPinned;
        this.updateButtons();
        this.handleAutoSave();
        UI.showToast(state.currentNote.isPinned ? 'Закреплено' : 'Откреплено');
    },

    toggleImportant() {
        state.currentNote.isImportant = !state.currentNote.isImportant;
        this.updateButtons();
        this.handleAutoSave();
        UI.showToast(state.currentNote.isImportant ? 'Помечено важным' : 'Снята важность');
    },

    toggleArchive() {
        state.currentNote.isArchived = !state.currentNote.isArchived;
        if(state.currentNote.isArchived) {
            this.save();
            this.close(true);
            UI.showToast('В архив');
        } else {
            this.updateButtons();
            this.handleAutoSave();
        }
    },

    updateButtons() {
        document.getElementById('pin-btn').classList.toggle('active', state.currentNote.isPinned);
        document.getElementById('archive-btn').classList.toggle('active', state.currentNote.isArchived);
        document.getElementById('important-btn').classList.toggle('active', state.currentNote.isImportant);
        document.getElementById('important-btn').style.color = state.currentNote.isImportant ? '#ff9100' : 'var(--text)';
    },

    deleteCurrent() {
        UI.showConfirm("Удалить?", "Необратимо.", async () => {
            if (state.currentNote.id) {
                await db.collection('users').doc(state.user.uid).collection('notes').doc(state.currentNote.id).delete();
            }
            this.close(true);
        });
    },

    pushHistory() {
        const data = { t: this.titleInp.value, c: this.contentInp.value };
        const last = this.history[this.history.length - 1];
        if (last && last.t === data.t && last.c === data.c) return;
        
        this.history.push(data);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.future = [];
    },

    undo() {
        if (this.history.length === 0) return;
        const current = { t: this.titleInp.value, c: this.contentInp.value };
        this.future.push(current);
        const prev = this.history.pop();
        this.applyState(prev);
    },

    redo() {
        if (this.future.length === 0) return;
        const current = { t: this.titleInp.value, c: this.contentInp.value };
        this.history.push(current);
        const next = this.future.pop();
        this.applyState(next);
    },

    applyState(data) {
        if(!data) return;
        this.titleInp.value = data.t;
        this.contentInp.value = data.c;
        this.handleAutoSave();
    },

    handleAutoSave() {
        clearTimeout(this.saveTimeout);
        document.getElementById('last-edited').innerText = 'Сохранение...';
        this.saveTimeout = setTimeout(() => this.save(), 800);
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
        } catch (e) { console.error(e); }
    },

    async close(skipSave = false) {
        if (!skipSave) await this.save();
        document.getElementById('note-editor').classList.remove('active');
        state.currentNote = null;
    }
};

document.addEventListener('DOMContentLoaded', () => Editor.init());
