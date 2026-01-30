const UI = {
    init() {
        this.sidebar = document.getElementById('sidebar');
        this.userDropdown = document.getElementById('user-dropdown');
        this.notesGrid = document.getElementById('notes-container');
        this.loader = document.getElementById('app-loader');
        this.emptyState = document.getElementById('empty-state');
        this.setupEventListeners();
        this.initStarRating();
        this.loadSettingsToUI();
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (this.sidebar && this.sidebar.classList.contains('active')) {
                if (!this.sidebar.contains(e.target) && !e.target.closest('#menu-toggle')) {
                    this.toggleSidebar(false);
                }
            }
            if (this.userDropdown && this.userDropdown.classList.contains('active')) {
                if (!e.target.closest('.user-avatar-wrapper')) {
                    this.toggleUserMenu(false);
                }
            }
        });
    },

    toggleSidebar(force) {
        if (force !== undefined) {
            this.sidebar.classList.toggle('active', force);
        } else {
            this.sidebar.classList.toggle('active');
        }
    },

    toggleUserMenu(force) {
        if (force !== undefined) {
            this.userDropdown.classList.toggle('active', force);
        } else {
            this.userDropdown.classList.toggle('active');
        }
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
        this.toggleSidebar(false);
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    },

    openSettings() {
        this.openModal('settings-modal');
    },

    closeSettings() {
        this.closeModal('settings-modal');
    },

    loadSettingsToUI() {
        setTimeout(() => {
            const root = getComputedStyle(document.documentElement);
            const textEl = document.getElementById('cp-text');
            const primEl = document.getElementById('cp-primary');
            const bgEl = document.getElementById('cp-bg');

            if (textEl) textEl.value = root.getPropertyValue('--text').trim() || '#ffffff';
            if (primEl) primEl.value = root.getPropertyValue('--primary').trim() || '#00f2ff';
            if (bgEl) bgEl.value = root.getPropertyValue('--bg').trim() || '#050505';
        }, 100);
    },

    saveSettings() {
        const text = document.getElementById('cp-text').value;
        const primary = document.getElementById('cp-primary').value;
        const bg = document.getElementById('cp-bg').value;

        document.documentElement.style.setProperty('--text', text);
        document.documentElement.style.setProperty('--primary', primary);
        document.documentElement.style.setProperty('--bg', bg);
        
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primary);
        const rgb = result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 242, 255';
        document.documentElement.style.setProperty('--primary-rgb', rgb);

        this.showToast('Настройки сохранены');
        this.closeSettings();
    },

    initStarRating() {
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            star.onclick = () => {
                const val = parseInt(star.getAttribute('data-val'));
                state.tempRating = val;
                stars.forEach(s => {
                    const sVal = parseInt(s.getAttribute('data-val'));
                    s.textContent = sVal <= val ? 'star' : 'star_border';
                    s.classList.toggle('active', sVal <= val);
                });
            };
        });
    },

    async submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        const rating = state.tempRating || 0;

        if (rating === 0) return this.showToast('Пожалуйста, выберите оценку');

        try {
            await db.collection('feedback').add({
                uid: state.user.uid,
                userName: state.user.displayName,
                rating,
                text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showToast('Спасибо за отзыв!');
            this.closeModal('rate-modal');
            document.getElementById('feedback-text').value = '';
        } catch (e) {
            this.showToast('Ошибка отправки');
        }
    },

    renderFolders(folders) {
        const root = document.getElementById('folder-list-root');
        if (!root) return;
        root.innerHTML = '';

        folders.slice(0, 10).forEach(folder => {
            const el = document.createElement('button');
            el.className = `nav-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
            el.innerHTML = `
                <i class="material-icons-round">folder</i>
                <span>${folder.name}</span>
                <i class="material-icons-round delete-folder-btn" style="margin-left:auto; font-size:16px; opacity:0.5; cursor:pointer;">close</i>
            `;
            el.onclick = (e) => {
                if (e.target.classList.contains('delete-folder-btn')) {
                    deleteFolder(folder.id);
                } else {
                    switchView('folder', folder.id);
                    this.toggleSidebar(false);
                }
            };
            root.appendChild(el);
        });
    },

    renderNotes(notes) {
        this.notesGrid.innerHTML = '';
        if (notes.length === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }
        this.emptyState.classList.add('hidden');

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            
            card.innerHTML = `
                ${note.isPinned ? '<i class="material-icons-round pin-icon">push_pin</i>' : ''}
                <h3>${note.title || 'Без названия'}</h3>
                <p>${note.content || 'Нет содержимого'}</p>
                <div class="tags-list">
                    ${(note.tags || []).map(t => `<span class="tag-chip">#${t}</span>`).join('')}
                </div>
            `;
            card.onclick = () => Editor.open(note);
            this.notesGrid.appendChild(card);
        });
    },

    showConfirm(title, msg, onOk) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = msg;
        modal.classList.add('active');

        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        okBtn.onclick = () => {
            onOk();
            modal.classList.remove('active');
        };
        cancelBtn.onclick = () => {
            modal.classList.remove('active');
        };
    },

    showToast(msg) {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast show';
        t.textContent = msg;
        container.appendChild(t);
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 400);
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());

window.switchView = (view, folderId = null) => {
    state.view = view;
    state.activeFolderId = folderId;
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        const dataView = el.getAttribute('data-view');
        if (dataView === view && !folderId) el.classList.add('active');
    });

    const titles = { 'notes': 'Все записи', 'favorites': 'Избранное', 'archive': 'Архив', 'folder': 'Папка' };
    const titleEl = document.getElementById('current-view-title');
    if (titleEl) titleEl.textContent = titles[view] || 'Заметки';
    
    UI.toggleSidebar(false); 
    if (window.filterAndRender) filterAndRender(document.getElementById('search-input').value);
};
