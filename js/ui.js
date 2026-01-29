const UI = {
    nodes: {},
    state: {
        sidebarOpen: localStorage.getItem('sn_sidebar') !== 'false',
        lastScroll: 0,
        isMobile: window.innerWidth <= 768
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.setupObservers();
        this.restoreState();
        this.initEffects();
        this.greetUser();
    },

    cacheDOM() {
        this.nodes = {
            app: document.getElementById('app'),
            sidebar: document.getElementById('sidebar'),
            header: document.querySelector('.main-navigator'),
            grid: document.getElementById('notes-grid'),
            search: document.getElementById('search-input'),
            fab: document.querySelector('.floating-action-button'),
            userMenu: document.getElementById('user-dropdown'),
            folderList: document.getElementById('folders-list-container'),
            editor: document.getElementById('editor-modal'),
            editorPanel: document.querySelector('.editor-glass-panel')
        };
    },

    bindEvents() {
        window.addEventListener('resize', () => {
            this.state.isMobile = window.innerWidth <= 768;
            if (this.state.isMobile) this.toggleSidebar(false);
        });

        document.addEventListener('keydown', e => this.handleHotkeys(e));
        
        this.nodes.search.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            this.animateSearch(e.target);
            filterAndRender();
        });

        const viewport = document.querySelector('.content-viewport');
        if (viewport) {
            viewport.addEventListener('scroll', () => this.handleScroll(viewport));
        }

        document.addEventListener('click', (e) => this.handleOutsideClick(e));

        if (this.state.isMobile) this.initSwipeGestures();
    },

    restoreState() {
        if (!this.state.sidebarOpen) {
            this.nodes.app.classList.add('sidebar-collapsed');
        } else {
            this.nodes.app.classList.remove('sidebar-collapsed');
        }
        
        setTimeout(() => {
            document.body.style.opacity = '1'; 
            this.nodes.app.classList.add('loaded');
        }, 100);
    },

    toggleSidebar(forceState = null) {
        const newState = forceState !== null ? forceState : !this.state.sidebarOpen;
        this.state.sidebarOpen = newState;
        localStorage.setItem('sn_sidebar', newState);

        if (newState) {
            this.nodes.app.classList.remove('sidebar-collapsed');
        } else {
            this.nodes.app.classList.add('sidebar-collapsed');
        }

        this.triggerHaptic();
    },

    handleScroll(viewport) {
        const current = viewport.scrollTop;
        const delta = current - this.state.lastScroll;
        
        if (current > 20) {
            this.nodes.header.classList.add('scrolled');
        } else {
            this.nodes.header.classList.remove('scrolled');
        }

        if (delta > 0 && current > 100 && !this.state.isMobile) {
            this.nodes.fab.classList.add('fab-hidden');
        } else {
            this.nodes.fab.classList.remove('fab-hidden');
        }

        this.state.lastScroll = current;
    },

    renderNotes(notes) {
        const grid = this.nodes.grid;
        if (!grid) return;

        const oldCards = Array.from(grid.children);
        oldCards.forEach(c => {
            c.style.transform = 'scale(0.9) translateY(20px)';
            c.style.opacity = '0';
        });

        setTimeout(() => {
            grid.innerHTML = '';
            
            if (!notes || notes.length === 0) {
                this.renderEmptyState();
                return;
            }

            notes.forEach((note, i) => {
                const card = this.createCardElement(note, i);
                grid.appendChild(card);
                this.applyTiltEffect(card);
            });
        }, 200);
    },

    createCardElement(note, index) {
        const el = document.createElement('div');
        el.className = `note-card-v3 p-${note.priority || 'low'}`;
        el.style.animationDelay = `${index * 0.05}s`;
        
        const rawContent = note.content || '';
        const preview = rawContent.replace(/<[^>]*>?/gm, '').substring(0, 140);
        const dateStr = this.formatTime(note.updatedAt || note.createdAt);

        el.innerHTML = `
            <div class="card-inner" onclick="openEditor(${JSON.stringify(note).replace(/"/g, '&quot;')})">
                <div class="card-glow"></div>
                <div class="card-header">
                    <span class="card-date">${dateStr}</span>
                    <div class="status-dot"></div>
                </div>
                <h3 class="card-title">${note.title || 'Без названия'}</h3>
                <p class="card-body-text">${preview || 'Пустота...'}</p>
                <div class="card-footer">
                    <div class="tags-row">
                        ${(note.tags || []).slice(0, 3).map(t => `<span class="mini-tag">#${t}</span>`).join('')}
                    </div>
                    <div class="card-actions-hover">
                        <button class="icon-btn-glass" onclick="event.stopPropagation(); toggleArchive('${note.id}', ${!note.isArchived})">
                            <span class="material-icons-round">${note.isArchived ? 'unarchive' : 'inventory_2'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return el;
    },

    renderEmptyState() {
        this.nodes.grid.innerHTML = `
            <div class="empty-zone">
                <div class="hologram-container">
                    <div class="hologram-ring"></div>
                    <span class="material-icons-round hologram-icon">auto_stories</span>
                </div>
                <h3>Здесь пока тихо</h3>
                <p>Создай новую реальность прямо сейчас</p>
            </div>
        `;
    },

    renderFolders() {
        if (!this.nodes.folderList) return;
        this.nodes.folderList.innerHTML = '';
        
        state.folders.forEach((folder, i) => {
            const item = document.createElement('div');
            item.className = `nav-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
            item.style.transitionDelay = `${i * 0.03}s`;
            item.onclick = () => {
                state.currentView = 'folder';
                state.activeFolderId = folder.id;
                this.updateHeaderTitle(folder.name);
                filterAndRender();
                if (this.state.isMobile) this.toggleSidebar(false);
            };

            item.innerHTML = `
                <span class="material-icons-round" style="color: ${folder.color || '#fff'}">folder</span>
                <span class="item-label">${folder.name}</span>
                ${state.activeFolderId === folder.id ? '<div class="active-glow-dot"></div>' : ''}
            `;
            this.nodes.folderList.appendChild(item);
        });
    },

    updateHeaderTitle(text) {
        const titleEl = document.getElementById('view-title');
        titleEl.style.transform = 'translateY(-10px) skewX(-10deg)';
        titleEl.style.opacity = '0';
        titleEl.style.filter = 'blur(10px)';

        setTimeout(() => {
            titleEl.textContent = text;
            titleEl.style.transform = 'translateY(0) skewX(0)';
            titleEl.style.opacity = '1';
            titleEl.style.filter = 'blur(0)';
        }, 300);
    },

    openEditorModal(note) {
        this.nodes.editor.classList.add('active');
        this.nodes.app.classList.add('blur-bg');
        
        setTimeout(() => {
            this.nodes.editorPanel.classList.add('born');
        }, 50);

        this.triggerHaptic();
    },

    closeEditorModal() {
        this.nodes.editorPanel.classList.remove('born');
        this.nodes.app.classList.remove('blur-bg');
        
        setTimeout(() => {
            this.nodes.editor.classList.remove('active');
        }, 300);
    },

    showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `cyber-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon-box">
                <span class="material-icons-round">${type === 'success' ? 'done_all' : 'priority_high'}</span>
            </div>
            <div class="toast-text">${msg}</div>
            <div class="toast-timer"></div>
        `;

        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0) scale(1)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateY(20px) scale(0.9)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);

        this.triggerHaptic();
    },

    applyTiltEffect(card) {
        if (this.state.isMobile) return;
        
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const xPct = x / rect.width;
            const yPct = y / rect.height;
            
            const xRot = (0.5 - yPct) * 10;
            const yRot = (xPct - 0.5) * 10;
            
            card.style.transform = `perspective(1000px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale(1.02)`;
            
            const glow = card.querySelector('.card-glow');
            if(glow) {
                glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.1), transparent 100px)`;
                glow.style.opacity = '1';
            }
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
            const glow = card.querySelector('.card-glow');
            if(glow) glow.style.opacity = '0';
        });
    },

    initEffects() {
        document.addEventListener('click', (e) => {
            this.createClickRipple(e.clientX, e.clientY);
        });

        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => this.triggerHaptic());
        });
    },

    createClickRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'system-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    },

    animateSearch(input) {
        input.parentElement.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(0.98)' },
            { transform: 'scale(1)' }
        ], { duration: 200 });
    },

    handleHotkeys(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            this.nodes.search.focus();
        }
        if (e.key === 'Escape') this.closeEditorModal();
    },

    handleOutsideClick(e) {
        if (this.nodes.userMenu.classList.contains('active')) {
            if (!e.target.closest('.profile-capsule') && !e.target.closest('#user-dropdown')) {
                this.nodes.userMenu.classList.remove('active');
            }
        }
    },

    initSwipeGestures() {
        let startX = 0;
        document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
        document.addEventListener('touchend', e => {
            const endX = e.changedTouches[0].clientX;
            if (startX < 30 && endX > 100) this.toggleSidebar(true);
            if (startX > 200 && startX - endX > 100) this.toggleSidebar(false);
        });
    },

    greetUser() {
        const h = new Date().getHours();
        let text = 'Welcome Back';
        if (h >= 5 && h < 12) text = 'Good Morning';
        else if (h >= 12 && h < 18) text = 'Good Afternoon';
        else if (h >= 18) text = 'Good Evening';
        else text = 'Late Night Flow';
        
        console.log(`%c ${text} `, 'background: #222; color: #00ffcc; padding: 5px; border-radius: 4px;');
    },

    formatTime(ts) {
        if (!ts) return '';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const diff = (new Date() - date) / 1000;
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    },

    triggerHaptic() {
        if (navigator.vibrate) navigator.vibrate(10);
    },

    setupObservers() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === this.nodes.grid) {
                    
                }
            }
        });
        if(this.nodes.grid) resizeObserver.observe(this.nodes.grid);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());

async function sendToGoogleSheet(data) {
    if (!GOOGLE_SHEET_APP_URL || GOOGLE_SHEET_APP_URL.includes(".......")) return;

    try {
        // mode: 'no-cors' важен, чтобы браузер не блокировал запрос к Google
        await fetch(GOOGLE_SHEET_APP_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        console.log("Заметка отправлена в Google Таблицу");
    } catch (error) {
        console.error("Ошибка отправки в таблицу:", error);
    }
}
