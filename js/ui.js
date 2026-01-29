const UI = {
    init() {
        this.appContainer = document.getElementById('app');
        this.sidebar = document.getElementById('sidebar');
        this.searchBar = document.getElementById('search-input');
        this.userDropdown = document.getElementById('user-dropdown');
        this.notesGrid = document.getElementById('notes-grid');
        this.viewTitle = document.getElementById('view-title');
        
        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.initSidebarState();
    },

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.searchBar.focus();
            }
            if (e.key === 'Escape') this.closeAllOverlays();
        });

        const viewport = document.querySelector('.content-viewport');
        viewport.addEventListener('scroll', () => {
            const nav = document.querySelector('.main-navigator');
            if (viewport.scrollTop > 30) {
                nav.classList.add('floating');
            } else {
                nav.classList.remove('floating');
            }
        });

        this.searchBar.addEventListener('focus', () => {
            this.searchBar.parentElement.classList.add('active-glow');
        });

        this.searchBar.addEventListener('blur', () => {
            this.searchBar.parentElement.classList.remove('active-glow');
        });
    },

    initSidebarState() {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            this.appContainer.classList.add('sidebar-collapsed');
        } else {
            this.appContainer.classList.remove('sidebar-collapsed');
        }
    },

    toggleSidebar() {
        const isNowCollapsed = this.appContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', isNowCollapsed);
        
        const icon = document.querySelector('.menu-toggle-v2 span');
        icon.style.transform = 'scale(0.5) rotate(180deg)';
        setTimeout(() => {
            icon.textContent = isNowCollapsed ? 'menu' : 'menu_open';
            icon.style.transform = 'scale(1) rotate(0deg)';
        }, 200);
    },

    toggleUserMenu() {
        this.userDropdown.classList.toggle('active');
    },

    closeAllOverlays() {
        this.userDropdown.classList.remove('active');
        document.querySelectorAll('.editor-overlay, .system-alert-overlay').forEach(el => {
            el.classList.remove('active');
        });
    },

    updateHeader(title) {
        if (!this.viewTitle) return;
        this.viewTitle.classList.add('title-change');
        setTimeout(() => {
            this.viewTitle.textContent = title;
            this.viewTitle.classList.remove('title-change');
        }, 300);
    },

    renderNotes(notes) {
        if (!this.notesGrid) return;
        
        this.notesGrid.style.opacity = '0';
        
        setTimeout(() => {
            this.notesGrid.innerHTML = '';
            
            if (notes.length === 0) {
                this.renderEmptyState();
                this.notesGrid.style.opacity = '1';
                return;
            }

            notes.forEach((note, index) => {
                const noteElement = this.createNoteCard(note, index);
                this.notesGrid.appendChild(noteElement);
            });

            this.notesGrid.style.opacity = '1';
        }, 200);
    },

    createNoteCard(note, index) {
        const card = document.createElement('div');
        card.className = `note-card-v3 priority-${note.priority || 'low'}`;
        card.style.animationDelay = `${index * 0.05}s`;
        
        const cleanContent = note.content ? note.content.replace(/<[^>]*>?/gm, '') : '';
        const date = this.getRelativeTime(note.updatedAt || note.createdAt);

        card.innerHTML = `
            <div class="card-glass-base" onclick="openEditor(${JSON.stringify(note).replace(/"/g, '&quot;')})">
                <div class="card-energy-line"></div>
                <div class="card-body">
                    <div class="card-meta">
                        <span class="meta-date">${date}</span>
                        ${note.priority === 'high' ? '<span class="priority-badge">STORM</span>' : ''}
                    </div>
                    <h3 class="card-title">${note.title || 'Untitled'}</h3>
                    <p class="card-preview">${cleanContent.substring(0, 120)}${cleanContent.length > 120 ? '...' : ''}</p>
                    <div class="card-tags">
                        ${(note.tags || []).map(t => `<span class="mini-tag">#${t}</span>`).join('')}
                    </div>
                </div>
                <div class="card-hover-actions">
                    <button class="icon-action-btn" onclick="event.stopPropagation(); toggleArchive('${note.id}', ${!note.isArchived})">
                        <span class="material-icons-round">${note.isArchived ? 'unarchive' : 'inventory_2'}</span>
                    </button>
                    <button class="icon-action-btn delete-trigger" onclick="event.stopPropagation(); permanentDelete('${note.id}')">
                        <span class="material-icons-round">delete_outline</span>
                    </button>
                </div>
            </div>
        `;
        
        return card;
    },

    renderFolders() {
        const container = document.getElementById('folders-list-container');
        if (!container) return;

        container.innerHTML = '';
        state.folders.forEach((folder, index) => {
            const folderItem = document.createElement('div');
            folderItem.className = `nav-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
            folderItem.style.transitionDelay = `${index * 0.03}s`;
            
            folderItem.innerHTML = `
                <span class="material-icons-round" style="color: ${folder.color || 'var(--primary-neon)'}">folder</span>
                <span class="item-label">${folder.name}</span>
            `;

            folderItem.onclick = () => {
                state.currentView = 'folder';
                state.activeFolderId = folder.id;
                this.updateHeader(folder.name);
                filterAndRender();
            };

            container.appendChild(folderItem);
        });
    },

    renderEmptyState() {
        this.notesGrid.innerHTML = `
            <div class="void-state">
                <div class="void-animation">
                    <div class="circle"></div>
                    <div class="circle"></div>
                    <div class="circle"></div>
                </div>
                <h3>Пространство пусто</h3>
                <p>Заполни этот вакуум своими идеями</p>
                <button class="void-btn" onclick="openEditor()">
                    <span>Начать поток</span>
                    <span class="material-icons-round">auto_awesome</span>
                </button>
            </div>
        `;
    },

    getRelativeTime(timestamp) {
        if (!timestamp) return 'Сейчас';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Только что';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}м назад`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}ч назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    },

    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        this.revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    this.revealObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);
    },

    showToast(message, type = 'default') {
        const toast = document.createElement('div');
        toast.className = `smart-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="material-icons-round">${type === 'success' ? 'verified' : 'info'}</span>
                <span>${message}</span>
            </div>
            <div class="toast-progress"></div>
        `;
        
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('visible'));
        
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
};

function openEditor(note = null) {
    const editor = document.getElementById('editor-modal');
    const titleInp = document.getElementById('note-title');
    const contentInp = document.getElementById('note-content');
    
    currentEditorNote = note;
    editorTags = note && note.tags ? [...note.tags] : [];
    currentPriority = note && note.priority ? note.priority : 'low';

    titleInp.value = note ? (note.title || '') : '';
    contentInp.value = note ? (note.content || '') : '';

    updatePriorityUI();
    renderEditorTags();
    
    editor.classList.add('active');
    
    setTimeout(() => {
        titleInp.focus();
        document.querySelector('.editor-glass-panel').classList.add('born');
    }, 100);
}

async function closeEditor() {
    const editor = document.getElementById('editor-modal');
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();

    document.querySelector('.editor-glass-panel').classList.remove('born');

    if (title || content) {
        const success = await saveNote(title, content);
        if (success) UI.showToast('Мысль сохранена', 'success');
    }

    setTimeout(() => {
        editor.classList.remove('active');
        currentEditorNote = null;
    }, 300);
}

function updatePriorityUI() {
    const btn = document.getElementById('priority-btn');
    const label = document.getElementById('priority-label');
    if (!btn) return;

    btn.className = `priority-chip p-${currentPriority}`;
    label.textContent = currentPriority.charAt(0).toUpperCase() + currentPriority.slice(1) + ' Priority';
}

function togglePriority() {
    const steps = ['low', 'medium', 'high'];
    let currentIdx = steps.indexOf(currentPriority);
    currentPriority = steps[(currentIdx + 1) % steps.length];
    updatePriorityUI();
}

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    
    window.onclick = (event) => {
        if (!event.target.closest('.profile-capsule') && !event.target.closest('.glass-dropdown')) {
            UI.userDropdown.classList.remove('active');
        }
    };
});
