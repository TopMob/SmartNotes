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
                this.pushHistory();
                this.handleAutoSave();
            }
        };
    },

    open(note = null) {
        state.currentNote = note ?
            JSON.parse(JSON.stringify(note)) : {
                id: Math.random().toString(36).substr(2, 9),
                title: '',
                content: '',
                tags: [],
                isPinned: false,
                isArchived: false,
                isImportant: false,
                folderId: state.view === 'folder' ? state.activeFolderId : null,
                authorId: state.user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
        this.history = [];
        this.future = [];
        this.renderEditorState();
        document.getElementById('note-editor').classList.add('active');
        setTimeout(() => this.contentInp.focus(), 100);
    },

    renderEditorState() {
        const n = state.currentNote;
        this.titleInp.value = n.title;
        this.contentInp.value = n.content;
        this.renderTags();
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
        this.pushHistory();
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

    deleteCurrent() {
        UI.showConfirm("delete", async () => {
            if (state.currentNote.id && (state.currentNote.title || state.currentNote.content)) {
                await db.collection('users').doc(state.user.uid).collection('notes').doc(state.currentNote.id).delete();
            }
            this.close(true);
        });
    },

    pushHistory() {
        const data = {
            t: this.titleInp.value,
            c: this.contentInp.value,
            tags: [...(state.currentNote.tags || [])]
        };
        const last = this.history[this.history.length - 1];
        if (last && last.t === data.t && last.c === data.c && JSON.stringify(last.tags) === JSON.stringify(data.tags)) return;
        this.history.push(data);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.future = [];
    },

    undo() {
        if (this.history.length === 0) return;
        const current = {
            t: this.titleInp.value,
            c: this.contentInp.value,
            tags: [...state.currentNote.tags]
        };
        this.future.push(current);
        const prev = this.history.pop();
        this.applyState(prev);
    },

    redo() {
        if (this.future.length === 0) return;
        const current = {
            t: this.titleInp.value,
            c: this.contentInp.value,
            tags: [...state.currentNote.tags]
        };
        this.history.push(current);
        const next = this.future.pop();
        this.applyState(next);
    },

    applyState(data) {
        if (!data) return;
        this.titleInp.value = data.t;
        this.contentInp.value = data.c;
        state.currentNote.tags = [...data.tags];
        this.renderTags();
        this.handleAutoSave();
    },

    handleAutoSave() {
        clearTimeout(this.saveTimeout);
        document.getElementById('last-edited').innerText = '...';
        this.saveTimeout = setTimeout(() => this.save(), 800);
    },

    async manualSave() {
        await this.save();
        this.close(true);
    },

    async save() {
        if (!state.user || !state.currentNote) return;
        if (!this.titleInp.value.trim() && !this.contentInp.value.trim()) return;

        state.currentNote.title = this.titleInp.value;
        state.currentNote.content = this.contentInp.value;
        state.currentNote.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        try {
            await db.collection('users').doc(state.user.uid)
                .collection('notes').doc(state.currentNote.id)
                .set(state.currentNote, {
                    merge: true
                });
            document.getElementById('last-edited').innerText = 'Сохранено';
        } catch (e) {
            console.error(e);
        }
    },

    async close(skipSave = false) {
        if (!skipSave) await this.save();
        document.getElementById('note-editor').classList.remove('active');
        state.currentNote = null;
    }
};

document.addEventListener('DOMContentLoaded', () => Editor.init());

const UI = {
    init() {
        this.sidebar = document.getElementById('sidebar');
        this.userDropdown = document.getElementById('user-dropdown');
        this.notesGrid = document.getElementById('notes-container');
        this.emptyState = document.getElementById('empty-state');
        this.setupEventListeners();
        this.initStarRating();
        this.loadSettingsToUI();
        this.updateLangUI();
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (this.sidebar && this.sidebar.classList.contains('active')) {
                const isMenuBtn = e.target.closest('#menu-toggle');
                const isSidebar = this.sidebar.contains(e.target);
                if (!isSidebar && !isMenuBtn) this.toggleSidebar(false);

            }
            if (this.userDropdown && this.userDropdown.classList.contains('active')) {
                if (!e.target.closest('.user-avatar-wrapper')) this.toggleUserMenu(false);
            }
        });
    },

    toggleSidebar(force) {
        const val = force !== undefined ? force : !this.sidebar.classList.contains('active');
        this.sidebar.classList.toggle('active', val);
    },

    toggleUserMenu(force) {
        const val = force !== undefined ? force : !this.userDropdown.classList.contains('active');
        this.userDropdown.classList.toggle('active', val);
    },

    openModal(id) {
        document.getElementById(id)?.classList.add('active');
        this.toggleSidebar(false);
    },
    closeModal(id) {
        document.getElementById(id)?.classList.remove('active');
    },
    openSettings() {
        this.openModal('settings-modal');
        this.loadSettingsToUI();
    },
    closeSettings() {
        this.closeModal('settings-modal');
        ThemeManager.revertToLastSaved();
    },

    loadSettingsToUI() {
        const root = getComputedStyle(document.documentElement);
        const t = document.getElementById('cp-text');
        const p = document.getElementById('cp-primary');
        const b = document.getElementById('cp-bg');
        if (t) t.value = root.getPropertyValue('--text').trim();
        if (p) p.value = root.getPropertyValue('--primary').trim();
        if (b) b.value = root.getPropertyValue('--bg').trim();
    },

    saveSettings() {
        const text = document.getElementById('cp-text').value;
        const primary = document.getElementById('cp-primary').value;
        const bg = document.getElementById('cp-bg').value;

        ThemeManager.setManual(primary, bg, text);
        this.showToast('Настройки сохранены');
        this.closeModal('settings-modal');
    },

    setLang(lang) {
        state.config.lang = lang;
        localStorage.setItem('app-lang', lang);
        this.updateLangUI();
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.lang-btn[onclick*="${lang}"]`).classList.add('active');
    },

    updateLangUI() {
        const lang = state.config.lang;
        const dict = LANG[lang];
        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            if (dict[key]) el.textContent = dict[key];
        });
    },

    initStarRating() {
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            star.onclick = () => {
                const val = parseInt(star.getAttribute('data-val'));
                state.tempRating = val;
                stars.forEach(s => s.classList.toggle('active', parseInt(s.getAttribute('data-val')) <= val));
                stars.forEach(s => s.textContent = parseInt(s.getAttribute('data-val')) <= val ? 'star' : 'star_border');
            };
        });
    },

    async submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        if (!state.tempRating) return this.showToast('Поставьте оценку');
        db.collection('feedback').add({
            uid: state.user.uid,
            userName: state.user.displayName,
            rating: state.tempRating,
            text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.error("Офлайн-ошибка (это норм):", e));
        this.showToast('Сохранено локально!');
        this.closeModal('rate-modal');
    },

    renderFolders(folders) {
        const root = document.getElementById('folder-list-root');
        if (!root) return;
        root.innerHTML = '';
        folders.forEach(f => {
            const el = document.createElement('button');
            el.className = `nav-item ${state.activeFolderId === f.id ? 'active' : ''}`;
            el.innerHTML = `<i class="material-icons-round">folder</i><span>${f.name}</span>`;
            const delBtn = document.createElement('i');
            delBtn.className = "material-icons-round";
            delBtn.style.marginLeft = "auto";
            delBtn.style.fontSize = "16px";
            delBtn.style.opacity = "0.5";
            delBtn.textContent = "close";

            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteFolder(f.id);
            };
            el.onclick = () => switchView('folder', f.id);
            el.appendChild(delBtn);
            root.appendChild(el);
        });
    },

    renderNotes(notes) {
        this.notesGrid.innerHTML = '';
        if (notes.length === 0) return this.emptyState.classList.remove('hidden');
        this.emptyState.classList.add('hidden');

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';

            const pinnedClass = note.isPinned ? 'active' : '';
            const impClass = note.isImportant ? 'active' : '';

            card.innerHTML = `
                <div class="card-actions">
                    <button class="action-btn ${pinnedClass}" onclick="event.stopPropagation(); toggleNotePin('${note.id}', ${!note.isPinned})">
                        <i class="material-icons-round">push_pin</i>
                    </button>
                    <button class="action-btn ${impClass}" onclick="event.stopPropagation(); toggleNoteImportant('${note.id}', ${!note.isImportant})">
                        <i class="material-icons-round">star</i>
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); toggleNoteArchive('${note.id}', ${!note.isArchived})">
                        <i class="material-icons-round">${note.isArchived ? 'unarchive' : 'archive'}</i>
                    </button>
                </div>
                <h3>${note.title || 'Без названия'}</h3>
                <p>${note.content || ''}</p>
                <div class="tags-list">
                    ${(note.tags || []).map(t => `<span class="tag-chip">#${t}</span>`).join('')}
                </div>
            `;
            card.onclick = () => Editor.open(note);
            this.notesGrid.appendChild(card);
        });
    },

    showConfirm(type, onOk) {
        const modal = document.getElementById('confirm-modal');
        const titles = {
            account: "Смена аккаунта",
            exit: "Выход",
            delete: "Удалить?",
            delete_f: "Удалить папку?"
        };
        document.getElementById('confirm-title').textContent = titles[type] || "Подтвердите";
        modal.classList.add('active');
        document.getElementById('confirm-ok').onclick = () => {
            onOk();
            modal.classList.remove('active');
        };
        document.getElementById('confirm-cancel').onclick = () => modal.classList.remove('active');
    },

    showToast(msg) {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast show';
        t.textContent = msg;
        container.appendChild(t);
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 300);
        }, 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());

window.switchView = (view, folderId = null) => {
    state.view = view;
    state.activeFolderId = folderId;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (!folderId) {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) btn.classList.add('active');
    }
    const titles = {
        'notes': 'Все записи',
        'favorites': 'Важное',
        'archive': 'Архив',
        'folder': 'Папка'
    };
    document.getElementById('current-view-title').textContent = titles[view] || 'SmartNotes';
    UI.toggleSidebar(false);
    if (window.filterAndRender) filterAndRender(document.getElementById('search-input').value);
    UI.renderFolders(state.folders);
};

let eggStep = 0;
document.addEventListener('click', (e) => {
    const target = e.target;

    if (target.classList.contains('name-kopaev')) {
        eggStep = 1;
    } else if (target.classList.contains('name-minyaev') && eggStep === 1) {
        activateVanyaEgg();
        eggStep = 0;
    } else {
        eggStep = 0;
    }
});

function activateVanyaEgg() {
    const list = document.querySelector('.team-list');
    if (!list) return;
    list.style.transition = 'all 0.5s ease';
    list.style.opacity = '0';
    list.style.transform = 'scale(0.8)';
    setTimeout(() => {
        list.innerHTML = `
            <li class="team-member name-vanya-super" style="color: #00f2ff; text-shadow: 0 0 20px #00f2ff; font-size: 1.5rem;">
                Тайлер²
            </li>
        `;
        list.style.opacity = '1';
        list.style.transform = 'scale(1)';

        UI.showToast("Пасхалка активирована!");
    }, 500);
}

function initApp() {
    syncFolders();
    syncNotes();
    const savedLang = localStorage.getItem('app-lang') || 'ru';
    UI.setLang(savedLang);
}

function syncFolders() {
    db.collection('users').doc(state.user.uid).collection('folders')
        .orderBy('createdAt', 'asc').onSnapshot(snap => {
            state.folders = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            UI.renderFolders(state.folders);
        });
}

function syncNotes() {
    db.collection('users').doc(state.user.uid).collection('notes')
        .onSnapshot(snap => {
            state.notes = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            filterAndRender(document.getElementById('search-input')?.value || '');
        });
}

window.filterAndRender = (query) => {
    const q = (query || '').toLowerCase().trim();
    let filtered = state.notes.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const tagsMatch = (n.tags || []).some(t => ('#' + t.toLowerCase()).includes(q) || t.toLowerCase().includes(q));
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
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({
        isPinned: val
    });
};

window.toggleNoteImportant = async (id, val) => {
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({
        isImportant: val
    });
};

window.toggleNoteArchive = async (id, val) => {
    await db.collection('users').doc(state.user.uid).collection('notes').doc(id).update({
        isArchived: val,
        isPinned: false
    });
    UI.showToast(val ? "В архиве" : "Восстановлено");
};

async function createNewFolder() {
    if (state.folders.length >= 10) return UI.showToast("Лимит папок (10)");
    const name = prompt("Название:");
    if (!name) return;
    try {
        await db.collection('users').doc(state.user.uid).collection('folders').add({
            name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {}
}

async function deleteFolder(id) {
    UI.showConfirm("delete_f", async () => {
        await db.collection('users').doc(state.user.uid).collection('folders').doc(id).delete();
        if (state.view === 'folder' && state.activeFolderId === id) switchView('notes');
    });
}