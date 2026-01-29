const Editor = {
    currentNote: null,
    priorityLevels: ['low', 'medium', 'high'],
    currentPriorityIndex: 0,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const modal = document.getElementById('editor-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.close();
            });
        }
    },

    open(note = null) {
        this.currentNote = note;
        const modal = document.getElementById('editor-modal');
        const title = document.getElementById('note-title');
        const content = document.getElementById('note-content');
        const tagsInput = document.getElementById('note-tags-input');

        title.value = note ? note.title : '';
        content.value = note ? note.content : '';
        tagsInput.value = note ? (note.tags || []).join(', ') : '';
        
        this.currentPriorityIndex = note ? this.priorityLevels.indexOf(note.priority || 'low') : 0;
        this.updatePriorityUI();

        modal.classList.add('active');
        this.animateEntrance();
        
        setTimeout(() => content.focus(), 400);
    },

    animateEntrance() {
        const box = document.querySelector('.editor-glass-container');
        box.style.transform = 'scale(0.8) translateY(100px) rotateX(-15deg)';
        box.style.opacity = '0';
        
        requestAnimationFrame(() => {
            box.style.transition = 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
            box.style.transform = 'scale(1) translateY(0) rotateX(0deg)';
            box.style.opacity = '1';
        });
    },

    async save() {
        const title = document.getElementById('note-title').value.trim();
        const content = document.getElementById('note-content').value.trim();
        const tags = document.getElementById('note-tags-input').value
            .split(',')
            .map(t => t.trim().replace('#', ''))
            .filter(t => t !== '');

        if (!title && !content) {
            this.close();
            return;
        }

        const noteData = {
            title: title || 'Untitled Concept',
            content: content || '',
            tags: tags,
            priority: this.priorityLevels[this.currentPriorityIndex],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: auth.currentUser.uid,
            isArchived: this.currentNote ? (this.currentNote.isArchived || false) : false
        };

        try {
            this.showSaveLoading(true);
            
            if (this.currentNote && this.currentNote.id) {
                await db.collection('notes').doc(this.currentNote.id).update(noteData);
                UI.showNotification('Data synchronized', 'success');
            } else {
                noteData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('notes').add(noteData);
                UI.showNotification('New node created', 'success');
            }
            
            this.close();
        } catch (error) {
            UI.showNotification('Sync failed', 'error');
            console.error(error);
        } finally {
            this.showSaveLoading(false);
        }
    },

    cyclePriority() {
        this.currentPriorityIndex = (this.currentPriorityIndex + 1) % this.priorityLevels.length;
        this.updatePriorityUI();
        
        const btn = document.getElementById('priority-btn');
        btn.style.transform = 'scale(1.3) rotate(15deg)';
        setTimeout(() => btn.style.transform = 'scale(1) rotate(0deg)', 200);
    },

    updatePriorityUI() {
        const btn = document.getElementById('priority-btn');
        const colors = { low: '#00d4ff', medium: '#7000ff', high: '#ff0055' };
        const activeColor = colors[this.priorityLevels[this.currentPriorityIndex]];
        
        btn.style.color = activeColor;
        btn.style.boxShadow = `0 0 15px ${activeColor}44`;
    },

    insertCurrentTime() {
        const content = document.getElementById('note-content');
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const start = content.selectionStart;
        const end = content.selectionEnd;
        
        content.value = content.value.substring(0, start) + `[${time}] ` + content.value.substring(end);
        content.focus();
    },

    showSaveLoading(isLoading) {
        const btn = document.querySelector('.editor-save-btn');
        if (isLoading) {
            btn.classList.add('loading');
            btn.innerHTML = '<span class="material-icons-round loading-spin">sync</span>';
        } else {
            btn.classList.remove('loading');
            btn.innerHTML = '<span class="material-icons-round">check</span><span>Done</span>';
        }
    },

    close() {
        const modal = document.getElementById('editor-modal');
        const box = document.querySelector('.editor-glass-container');
        
        box.style.transform = 'scale(0.9) translateY(40px)';
        box.style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('active');
            this.currentNote = null;
        }, 300);
    }
};



window.openEditor = (note) => Editor.open(note);
window.closeEditor = () => Editor.save();
window.cyclePriority = () => Editor.cyclePriority();
window.insertCurrentTime = () => Editor.insertCurrentTime();

Editor.init();
