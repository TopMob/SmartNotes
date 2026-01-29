const UI = {
    init() {
        this.bindEvents();
        this.setupObservers();
    },

    bindEvents() {
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuBtn = document.querySelector('.floating-menu-btn');
            const userTrigger = document.getElementById('user-menu-trigger');
            const dropdown = document.getElementById('user-dropdown');

            if (sidebar && sidebar.classList.contains('active')) {
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                    this.toggleSidebar(false);
                }
            }

            if (userTrigger && userTrigger.contains(e.target)) {
                dropdown.classList.toggle('active');
            } else if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    },

    toggleSidebar(open) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        if (open) {
            sidebar.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.animateNavItems();
        } else {
            sidebar.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    animateNavItems() {
        const items = document.querySelectorAll('.nav-item, .folder-item');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, 100 + index * 40);
        });
    },

    confirmBotTransition() {
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';
        overlay.innerHTML = `
            <div class="custom-confirm-card">
                <div class="confirm-icon">
                    <span class="material-icons-round">hub</span>
                </div>
                <h3>Deep Link</h3>
                <p>Инициализировать переход в Telegram-бота для синхронизации и обратной связи?</p>
                <div class="confirm-actions">
                    <button class="confirm-yes" onclick="UI.executeBotRedirect(this)">
                        <span>Коннект</span>
                        <span class="material-icons-round">east</span>
                    </button>
                    <button class="confirm-no" onclick="UI.closeConfirm(this)">Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    executeBotRedirect(btn) {
        btn.classList.add('loading');
        btn.innerHTML = '<span class="material-icons-round spin">sync</span>';
        
        setTimeout(() => {
            window.open('https://t.me/your_bot_link', '_blank');
            this.closeConfirm(btn);
        }, 1200);
    },

    closeConfirm(element) {
        const card = element.closest('.custom-confirm-card');
        const overlay = element.closest('.custom-confirm-overlay');
        card.style.transform = 'scale(0.9) translateY(20px)';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    },

    renderNotes(notes) {
        const grid = document.getElementById('notes-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        if (notes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round">wb_incandescent</span>
                    <p>Здесь пока пусто. Время создать что-то великое.</p>
                </div>
            `;
            return;
        }

        notes.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            card.innerHTML = `
                <div class="note-card-inner">
                    <div class="note-priority-bar ${note.priority || 'low'}"></div>
                    <h3>${note.title || 'Untitled'}</h3>
                    <p>${note.content || ''}</p>
                    <div class="note-card-footer">
                        <span class="note-date">${this.formatDate(note.updatedAt)}</span>
                        <div class="note-tags">
                            ${(note.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            card.onclick = () => openEditor(note);
            grid.appendChild(card);

            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 50);
        });
    },

    renderFolders() {
        const container = document.getElementById('folders-list');
        if (!container) return;

        container.innerHTML = '';
        state.folders.forEach(folder => {
            const item = document.createElement('div');
            item.className = `folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
            item.innerHTML = `
                <div class="folder-icon-wrapper" style="background: ${folder.color}20">
                    <span class="material-icons-round" style="color: ${folder.color}">folder</span>
                </div>
                <span class="folder-name">${folder.name}</span>
                <span class="folder-count">${folder.count || 0}</span>
            `;
            item.onclick = () => {
                state.currentView = 'folder';
                state.activeFolderId = folder.id;
                this.updateActiveNav(item);
                filterAndRender();
            };
            container.appendChild(item);
        });
    },

    updateActiveNav(activeElement) {
        document.querySelectorAll('.nav-item, .folder-item').forEach(el => {
            el.classList.remove('active');
        });
        activeElement.classList.add('active');
    },

    setupObservers() {
        const observerOptions = {
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.note-card').forEach(card => observer.observe(card));
    },

    formatDate(timestamp) {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    showNotification(text, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="material-icons-round">${type === 'success' ? 'check_circle' : 'error'}</span>
            <span>${text}</span>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('active'), 100);
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
};

window.toggleSidebar = (open) => UI.toggleSidebar(open);
window.confirmBotTransition = () => UI.confirmBotTransition();
window.renderNotes = (notes) => UI.renderNotes(notes);
window.renderFolders = () => UI.renderFolders();

UI.init();
