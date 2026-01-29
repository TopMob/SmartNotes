const UI = {
    init() {
        this.bindEvents();
        this.setupIntersections();
    },

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
            if (e.ctrlKey && e.key === 'n') openEditor();
        });

        const searchInp = document.getElementById('search-input');
        if (searchInp) {
            searchInp.addEventListener('focus', () => {
                searchInp.parentElement.classList.add('searching');
            });
            searchInp.addEventListener('blur', () => {
                searchInp.parentElement.classList.remove('searching');
            });
        }
    },

    setupIntersections() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        document.getElementById('user-dropdown')?.classList.remove('active');
    }
};

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (open) {
        sidebar.classList.add('active');
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = () => toggleSidebar(false);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));
    } else {
        sidebar.classList.remove('active');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 400);
        }
    }
}

function renderFolders() {
    const container = document.getElementById('folders-list-container');
    if (!container) return;

    container.innerHTML = '';
    
    state.folders.forEach((folder, index) => {
        const item = document.createElement('div');
        item.className = `nav-item folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
        item.style.animationDelay = `${index * 0.05}s`;
        
        item.innerHTML = `
            <span class="material-icons-round" style="color: ${folder.color || 'var(--primary)'}">folder</span>
            <span class="nav-label">${folder.name}</span>
            <div class="folder-dot" style="background: ${folder.color}"></div>
        `;

        item.onclick = () => {
            state.currentView = 'folder';
            state.activeFolderId = folder.id;
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            filterAndRender();
        };

        container.appendChild(item);
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

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        results = results.filter(n => 
            n.title.toLowerCase().includes(q) || 
            n.content.toLowerCase().includes(q) ||
            (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    renderNotes(results);
}

function renderNotes(notes) {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="material-icons-round">wb_cloudy</span>
                <p>Тут пока пусто, заполни пространство мыслями</p>
            </div>
        `;
        return;
    }

    notes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = `note-card priority-${note.priority || 'low'}`;
        card.style.animationDelay = `${index * 0.08}s`;
        
        const dateStr = formatDate(note.updatedAt || note.createdAt);

        card.innerHTML = `
            <div class="note-card-content" onclick="openEditor(${JSON.stringify(note).replace(/"/g, '&quot;')})">
                <div class="note-card-header">
                    <h3 class="note-title">${note.title || 'Без названия'}</h3>
                    <span class="note-date">${dateStr}</span>
                </div>
                <p class="note-snippet">${note.content || 'Нет текста...'}</p>
                <div class="note-tags">
                    ${(note.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
                </div>
            </div>
            <div class="note-actions">
                <button onclick="toggleArchive('${note.id}', ${!note.isArchived})" class="action-btn">
                    <span class="material-icons-round">${note.isArchived ? 'unarchive' : 'archive'}</span>
                </button>
                <button onclick="permanentDelete('${note.id}')" class="action-btn delete">
                    <span class="material-icons-round">delete_outline</span>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
        UI.observer.observe(card);
    });
}

function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('active');
    
    if (dropdown.classList.contains('active')) {
        const rect = document.querySelector('.user-profile-compact').getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    }
}

function openSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('active');
    
    const themeRoot = document.getElementById('theme-picker-root');
    if (themeRoot && !themeRoot.innerHTML) {
        Object.keys(themes).forEach(t => {
            const btn = document.createElement('div');
            btn.className = 'theme-option';
            btn.style.background = themes[t].primary;
            btn.onclick = () => applyTheme(t);
            themeRoot.appendChild(btn);
        });
    }
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

function openFolderModal() {
    showConfirm({
        title: 'Новая папка',
        text: 'Введите название для вашего пространства:',
        input: true,
        confirmText: 'Создать',
        onConfirm: async (val) => {
            if (val) await createFolder(val);
        }
    });
}

function showConfirm({ title, text, input, confirmText, onConfirm }) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const textEl = document.getElementById('confirm-text');
    const actionBtn = document.getElementById('confirm-action-btn');
    
    titleEl.textContent = title;
    textEl.innerHTML = text;
    
    if (input) {
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'confirm-input';
        inputEl.id = 'confirm-dynamic-input';
        textEl.appendChild(inputEl);
        setTimeout(() => inputEl.focus(), 400);
    }

    actionBtn.textContent = confirmText || 'Ок';
    actionBtn.onclick = () => {
        const val = document.getElementById('confirm-dynamic-input')?.value;
        onConfirm(input ? val : true);
        closeConfirm();
    };

    modal.classList.add('active');
}

function closeConfirm() {
    document.getElementById('confirm-modal').classList.remove('active');
}

function formatDate(timestamp) {
    if (!timestamp) return 'Недавно';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'Только что';
    if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
    
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
    });
}

function openTeamModal() {
    showConfirm({
        title: 'Наша Команда',
        text: '<div class="team-list"><b>Dev & Design:</b> AI Assistant & You<br><b>Vibe:</b> Maximum Modern</div>',
        confirmText: 'Круто!'
    });
}

function openFeedbackModal() {
    window.location.href = 'mailto:support@smartnotes.dev?subject=Feedback';
}

UI.init();
