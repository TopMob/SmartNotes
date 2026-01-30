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

    openModal(id) { document.getElementById(id)?.classList.add('active'); this.toggleSidebar(false); },
    closeModal(id) { document.getElementById(id)?.classList.remove('active'); },
    openSettings() { this.openModal('settings-modal'); this.loadSettingsToUI(); },
    closeSettings() { this.closeModal('settings-modal'); ThemeManager.revertToLastSaved(); },

    loadSettingsToUI() {
        const root = getComputedStyle(document.documentElement);
        const t = document.getElementById('cp-text');
        const p = document.getElementById('cp-primary');
        const b = document.getElementById('cp-bg');
        if(t) t.value = root.getPropertyValue('--text').trim();
        if(p) p.value = root.getPropertyValue('--primary').trim();
        if(b) b.value = root.getPropertyValue('--bg').trim();
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
            if(dict[key]) el.textContent = dict[key];
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
        try {
            await db.collection('feedback').add({
                uid: state.user.uid,
                userName: state.user.displayName,
                rating: state.tempRating,
                text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showToast('Спасибо!');
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
            delBtn.className = "material-icons-round"; delBtn.style.marginLeft="auto"; delBtn.style.fontSize="16px"; delBtn.style.opacity="0.5"; delBtn.textContent="close";
            delBtn.onclick = (e) => { e.stopPropagation(); deleteFolder(f.id); };
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
            
            // Action buttons directly on card
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
        const titles = { account: "Смена аккаунта", exit: "Выход", delete: "Удалить?", delete_f: "Удалить папку?" };
        document.getElementById('confirm-title').textContent = titles[type] || "Подтвердите";
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
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());

window.switchView = (view, folderId = null) => {
    state.view = view;
    state.activeFolderId = folderId;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (!folderId) {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if(btn) btn.classList.add('active');
    }
    const titles = { 'notes': 'Все записи', 'favorites': 'Важное', 'archive': 'Архив', 'folder': 'Папка' };
    document.getElementById('current-view-title').textContent = titles[view] || 'SmartNotes';
    UI.toggleSidebar(false);
    if (window.filterAndRender) filterAndRender(document.getElementById('search-input').value);
    UI.renderFolders(state.folders);
};

// Пасхалка: Копаев + Миняев = Ваня в квадрате
let eggStep = 0;

document.addEventListener('click', (e) => {
    const target = e.target;
    
    if (target.classList.contains('name-kopaev')) {
        eggStep = 1; // Первый шаг пройден
    } 
    else if (target.classList.contains('name-minyaev') && eggStep === 1) {
        // Условие выполнено!
        activateVanyaEgg();
        eggStep = 0; // Сброс
    } 
    else {
        eggStep = 0; // Нажали куда-то не туда — сброс прогресса
    }
});

function activateVanyaEgg() {
    const list = document.querySelector('.team-list');
    if (!list) return;

    // 1. Красиво скрываем всех
    list.style.transition = 'all 0.5s ease';
    list.style.opacity = '0';
    list.style.transform = 'scale(0.8)';

    setTimeout(() => {
        // 2. Очищаем список и добавляем одного Ваню
        list.innerHTML = `
            <li class="team-member name-vanya-super" style="color: #00f2ff; text-shadow: 0 0 20px #00f2ff; font-size: 1.5rem;">
                Тайлер²
            </li>
        `;
        
        // 3. Возвращаем видимость
        list.style.opacity = '1';
        list.style.transform = 'scale(1)';
        
        UI.showToast("Пасхалка активирована!");
    }, 500);
}

