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
            // Close sidebar on click outside (PC)
            if (this.sidebar && this.sidebar.classList.contains('active')) {
                const isMenuBtn = e.target.closest('#menu-toggle');
                const isSidebar = this.sidebar.contains(e.target);
                if (!isSidebar && !isMenuBtn) {
                    this.toggleSidebar(false);
                }
            }
            // Close user dropdown
            if (this.userDropdown && this.userDropdown.classList.contains('active')) {
                if (!e.target.closest('.user-avatar-wrapper')) {
                    this.toggleUserMenu(false);
                }
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

    openSettings() { this.openModal('settings-modal'); },
    closeSettings() { this.closeModal('settings-modal'); },

    loadSettingsToUI() {
        setTimeout(() => {
            const root = getComputedStyle(document.documentElement);
            const t = document.getElementById('cp-text');
            const p = document.getElementById('cp-primary');
            const b = document.getElementById('cp-bg');
            if(t) t.value = root.getPropertyValue('--text').trim();
            if(p) p.value = root.getPropertyValue('--primary').trim();
            if(b) b.value = root.getPropertyValue('--bg').trim();
        }, 500);
    },

    saveSettings() {
        const text = document.getElementById('cp-text').value;
        const primary = document.getElementById('cp-primary').value;
        const bg = document.getElementById('cp-bg').value;

        document.documentElement.style.setProperty('--text', text);
        document.documentElement.style.setProperty('--primary', primary);
        document.documentElement.style.setProperty('--bg', bg);
        
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primary);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
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
                stars.forEach(s => s.classList.toggle('active', parseInt(s.getAttribute('data-val')) <= val));
                stars.forEach(s => s.textContent = parseInt(s.getAttribute('data-val')) <= val ? 'star' : 'star_border');
            };
        });
    },

    async submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        if (!state.tempRating) return this.showToast('Поставьте оценку');
        
        try {
            await db.collection('feedback').add({
                uid: state.user.uid,
                userName: state.user.displayName,
                rating: state.tempRating,
                text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showToast('Отзыв отправлен');
            this.closeModal('rate-modal');
        } catch(e) { this.showToast('Ошибка'); }
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
            
            let iconsHtml = '<div class="card-icons">';
            if (note.isPinned) iconsHtml += '<i class="material-icons-round pin-icon">push_pin</i>';
            if (note.isImportant) iconsHtml += '<i class="material-icons-round important-icon">priority_high</i>';
            iconsHtml += '</div>';

            const tagsHtml = (note.tags || []).map(t => `<span class="tag-chip">#${t}</span>`).join('');

            card.innerHTML = `
                ${iconsHtml}
                <h3>${note.title || 'Без названия'}</h3>
                <p>${note.content || 'Нет текста'}</p>
                <div class="tags-list">${tagsHtml}</div>
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
        
        document.getElementById('confirm-ok').onclick = () => { onOk(); modal.classList.remove('active'); };
        document.getElementById('confirm-cancel').onclick = () => modal.classList.remove('active');
    },

    showToast(msg) {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast show';
        t.textContent = msg;
        container.appendChild(t);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());

window.switchView = (view, folderId = null) => {
    state.view = view;
    state.activeFolderId = folderId;
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Highlight correct item
    if (folderId) {
        // Logic handled in renderFolders, simpler here re-render usually called
    } else {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if(btn) btn.classList.add('active');
    }
    
    const titles = { 'notes': 'Все записи', 'favorites': 'Избранное', 'archive': 'Архив', 'folder': 'Папка' };
    document.getElementById('current-view-title').textContent = titles[view] || 'Заметки';
    
    UI.toggleSidebar(false);
    if (window.filterAndRender) filterAndRender(document.getElementById('search-input').value);
    UI.renderFolders(state.folders); // Re-render to update active class
};
