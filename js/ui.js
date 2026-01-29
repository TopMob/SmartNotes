const UI = {
    init() {
        this.dom = {
            search: document.getElementById('search-input'),
            sidebar: document.getElementById('sidebar'),
            notesGrid: document.getElementById('notes-grid'),
            userDrop: document.getElementById('user-dropdown'),
            viewTitle: document.getElementById('view-title'),
            editor: document.getElementById('editor-modal')
        };
        
        this.bindEvents();
        this.initVisuals();
    },

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.dom.search.focus();
                }
            }
            if (e.key === 'Escape') this.closeAllOverlays();
        });

        this.dom.search?.addEventListener('focus', () => {
            this.dom.search.parentElement.classList.add('focused');
        });

        this.dom.search?.addEventListener('blur', () => {
            this.dom.search.parentElement.classList.remove('focused');
        });

        window.addEventListener('scroll', () => {
            const header = document.querySelector('.glass-header');
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    },

    initVisuals() {
        this.revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) scale(1)';
                }
            });
        }, { threshold: 0.1 });
    },

    updateViewHeader(title) {
        if (!this.dom.viewTitle) return;
        this.dom.viewTitle.style.opacity = '0';
        this.dom.viewTitle.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            this.dom.viewTitle.textContent = title;
            this.dom.viewTitle.style.opacity = '1';
            this.dom.viewTitle.style.transform = 'translateX(0)';
        }, 300);
    },

    renderNotes(notes) {
        if (!this.dom.notesGrid) return;
        this.dom.notesGrid.innerHTML = '';

        if (notes.length === 0) {
            this.renderEmptyState();
            return;
        }

        notes.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = `note-card-v2 priority-${note.priority || 'low'}`;
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px) scale(0.9)';
            card.style.transition = `all 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${index * 0.05}s`;

            const date = this.formatSmartDate(note.updatedAt || note.createdAt);

            card.innerHTML = `
                <div class="card-inner" onclick="openEditor(${JSON.stringify(note).replace(/"/g, '&quot;')})">
                    <div class="card-glow"></div>
                    <div class="card-header">
                        <span class="card-date">${date}</span>
                        ${note.priority === 'high' ? '<span class="hot-badge">HOT</span>' : ''}
                    </div>
                    <h3 class="card-title">${note.title || 'Untitled Space'}</h3>
                    <p class="card-text">${note.content || 'No thoughts, head empty...'}</p>
                    <div class="card-footer">
                        <div class="card-tags">
                            ${(note.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="mini-action" onclick="toggleArchive('${note.id}', ${!note.isArchived})">
                        <span class="material-icons-round">${note.isArchived ? 'unarchive' : 'archive'}</span>
                    </button>
                    <button class="mini-action delete" onclick="permanentDelete('${note.id}')">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            `;

            this.dom.notesGrid.appendChild(card);
            requestAnimationFrame(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) scale(1)';
            });
        });
    },

    renderFolders() {
        const container = document.getElementById('folders-list-container');
        if (!container) return;

        container.innerHTML = '';
        state.folders.forEach((folder, index) => {
            const el = document.createElement('div');
            el.className = `nav-link ${state.activeFolderId === folder.id ? 'active' : ''}`;
            el.style.animation = `slideIn 0.4s ease forwards ${index * 0.1}s`;
            el.style.opacity = '0';
            
            el.innerHTML = `
                <span class="material-icons-round" style="color: ${folder.color || 'var(--accent-blue)'}">folder</span>
                <span class="folder-label">${folder.name}</span>
                <div class="active-blob"></div>
            `;

            el.onclick = () => {
                state.currentView = 'folder';
                state.activeFolderId = folder.id;
                this.updateViewHeader(folder.name);
                filterAndRender();
            };

            container.appendChild(el);
        });
    },

    renderEmptyState() {
        this.dom.notesGrid.innerHTML = `
            <div class="empty-hero">
                <div class="hero-icon">
                    <span class="material-icons-round">cloud_off</span>
                </div>
                <h3>Чистый лист — новые возможности</h3>
                <p>Создай свою первую заметку, чтобы начать историю</p>
                <button class="btn-create-magic" onclick="openEditor()">
                    <span>Создать шедевр</span>
                </button>
            </div>
        `;
    },

    toggleUserMenu() {
        this.dom.userDrop?.classList.toggle('active');
    },

    closeAllOverlays() {
        this.dom.userDrop?.classList.remove('active');
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    },

    formatSmartDate(timestamp) {
        if (!timestamp) return 'Just now';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = (now - d) / 1000;

        if (diff < 60) return 'Только что';
        if (diff < 3600) return Math.floor(diff / 60) + 'м назад';
        if (diff < 86400) return Math.floor(diff / 3600) + 'ч назад';
        
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    },

    notify(text, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="material-icons-round">${type === 'success' ? 'done_all' : 'info'}</span>
            <span>${text}</span>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('visible'), 100);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
};

function openEditor(note = null) {
    const modal = document.getElementById('editor-modal');
    const titleInp = document.getElementById('note-title');
    const contentInp = document.getElementById('note-content');
    
    currentEditorNote = note;
    
    if (note) {
        titleInp.value = note.title || '';
        contentInp.value = note.content || '';
        currentPriority = note.priority || 'low';
    } else {
        titleInp.value = '';
        contentInp.value = '';
        currentPriority = 'low';
    }

    updatePriorityUI();
    modal.classList.add('active');
    
    setTimeout(() => {
        titleInp.focus();
    }, 400);
}

async function closeEditor() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();

    if (title || content) {
        const success = await saveNote(title, content);
        if (success) UI.notify('Сохранено!', 'success');
    }

    document.getElementById('editor-modal').classList.remove('active');
    currentEditorNote = null;
}

function togglePriority() {
    const levels = ['low', 'medium', 'high'];
    let idx = levels.indexOf(currentPriority);
    currentPriority = levels[(idx + 1) % levels.length];
    updatePriorityUI();
}

function updatePriorityUI() {
    const btn = document.getElementById('priority-btn');
    const label = document.getElementById('priority-label');
    if (!btn) return;

    btn.className = `priority-selector p-${currentPriority}`;
    label.textContent = currentPriority.charAt(0).toUpperCase() + currentPriority.slice(1);
}

document.addEventListener('DOMContentLoaded', () => UI.init());
