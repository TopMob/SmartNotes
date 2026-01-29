const UI = {
    init() {
        this.appInitSequence();
        this.attachGlobalListeners();
        this.setupMagneticButtons();
    },

    appInitSequence() {
        const app = document.getElementById('app');
        if (app) {
            app.style.display = 'flex';
            setTimeout(() => {
                app.style.opacity = '1';
                app.style.filter = 'blur(0px)';
                this.showNotification('Система готова к работе', 'success');
            }, 100);
        }
    },

    attachGlobalListeners() {
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
            if (e.key === 'Escape') {
                this.toggleSidebar(false);
                if (typeof Editor !== 'undefined') Editor.close();
            }
        });

        const trigger = document.getElementById('user-menu-trigger');
        const dropdown = document.getElementById('user-dropdown');
        
        if (trigger) {
            trigger.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            };
        }

        window.onclick = () => {
            if (dropdown) dropdown.classList.remove('active');
        };
    },

    toggleSidebar(open) {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (open) {
            sidebar.classList.add('active');
            mainContent.style.filter = 'blur(10px) brightness(0.7)';
            mainContent.style.transform = 'scale(0.98)';
            this.staggerSidebarItems();
        } else {
            sidebar.classList.remove('active');
            mainContent.style.filter = 'none';
            mainContent.style.transform = 'scale(1)';
        }
    },

    staggerSidebarItems() {
        const items = document.querySelectorAll('.nav-pill, .group-label, .theme-dot');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 40);
        });
    },

    setupMagneticButtons() {
        const buttons = document.querySelectorAll('.menu-trigger-btn, .main-fab, .editor-btn');
        buttons.forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = `translate(0, 0)`;
            });
        });
    },

    renderNotes(notes) {
        const grid = document.getElementById('notes-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        if (!notes || notes.length === 0) {
            this.renderEmptyState(grid);
            return;
        }

        notes.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.animationDelay = `${index * 0.05}s`;
            
            card.innerHTML = `
                <div class="note-priority-bar ${note.priority || 'low'}"></div>
                <h3>${note.title || 'Без названия'}</h3>
                <p>${note.content || 'Пустая заметка...'}</p>
                <div class="note-card-footer">
                    <span class="note-date">${this.formatRelativeTime(note.updatedAt)}</span>
                    <div class="note-tags">
                        ${(note.tags || []).slice(0, 2).map(t => `<span class="tag-pill">#${t}</span>`).join('')}
                    </div>
                </div>
            `;
            
            card.onclick = () => openEditor(note);
            grid.appendChild(card);
        });
    },

    renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons-round">cloud_off</span>
                <h2>Пока ничего нет</h2>
                <p>Нажми на плюс, чтобы зафиксировать первую мысль</p>
            </div>
        `;
    },

    showNotification(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'done_all' : 'warning';
        
        toast.innerHTML = `
            <span class="material-icons-round">${icon}</span>
            <span class="toast-text">${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    confirmBotTransition() {
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';
        overlay.innerHTML = `
            <div class="custom-confirm-card">
                <div class="confirm-icon">
                    <span class="material-icons-round">bolt</span>
                </div>
                <h2>Connect Bot?</h2>
                <p>Это перенесет тебя в Telegram для настройки уведомлений и быстрой синхронизации.</p>
                <div class="confirm-actions">
                    <button class="confirm-no" onclick="this.closest('.custom-confirm-overlay').remove()">Отмена</button>
                    <button class="confirm-yes" onclick="UI.handleBotRedirect(this)">Погнали</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    handleBotRedirect(btn) {
        btn.innerHTML = '<span class="material-icons-round loading-spin">sync</span>';
        setTimeout(() => {
            window.open('https://t.me/your_bot', '_blank');
            btn.closest('.custom-confirm-overlay').remove();
            this.showNotification('Бот подключен', 'success');
        }, 1500);
    },

    formatRelativeTime(timestamp) {
        if (!timestamp) return 'Только что';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'Только что';
        if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
};

window.toggleSidebar = (state) => UI.toggleSidebar(state);
window.openFeedbackModal = () => UI.showNotification('Скоро будет доступно!', 'error');
window.setTheme = (theme) => {
    document.documentElement.style.setProperty('--accent-primary', `var(--accent-${theme})`);
    UI.showNotification(`Тема ${theme} активирована`);
};



UI.init();
