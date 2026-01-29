const UI = {
    init() {
        this.launchSequence();
        this.setupEventHub();
        this.initMotionEngine();
    },

    launchSequence() {
        const app = document.getElementById('app');
        const login = document.getElementById('login-screen');
        
        if (app) {
            document.body.style.opacity = '0';
            setTimeout(() => {
                document.body.style.transition = 'opacity 1s ease';
                document.body.style.opacity = '1';
            }, 100);
        }
    },

    setupEventHub() {
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuBtn = document.querySelector('.menu-trigger-btn');
            const dropdown = document.getElementById('user-dropdown');
            const trigger = document.getElementById('user-menu-trigger');

            if (sidebar && sidebar.classList.contains('active')) {
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                    this.toggleSidebar(false);
                }
            }

            if (trigger && trigger.contains(e.target)) {
                dropdown.classList.toggle('active');
            } else if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        window.addEventListener('scroll', () => {
            const header = document.querySelector('.main-header');
            if (window.scrollY > 20) {
                header.style.background = 'rgba(2, 2, 2, 0.95)';
                header.style.height = '65px';
            } else {
                header.style.background = 'rgba(2, 2, 2, 0.8)';
                header.style.height = '75px';
            }
        });
    },

    toggleSidebar(state) {
        const sidebar = document.getElementById('sidebar');
        const main = document.querySelector('.main-content');
        const trigger = document.querySelector('.menu-trigger-btn');

        if (state) {
            sidebar.classList.add('active');
            main.style.transform = 'scale(0.96) translateX(20px)';
            main.style.filter = 'blur(8px) brightness(0.6)';
            trigger.style.transform = 'rotate(180deg) scale(0.8)';
            this.staggerNav();
        } else {
            sidebar.classList.remove('active');
            main.style.transform = 'scale(1) translateX(0)';
            main.style.filter = 'none';
            trigger.style.transform = 'rotate(0deg) scale(1)';
        }
    },

    staggerNav() {
        const pills = document.querySelectorAll('.nav-pill, .group-label, .bot-action-pill');
        pills.forEach((pill, i) => {
            pill.style.opacity = '0';
            pill.style.transform = 'translateX(-30px)';
            setTimeout(() => {
                pill.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                pill.style.opacity = '1';
                pill.style.transform = 'translateX(0)';
            }, 100 + (i * 40));
        });
    },

    renderNotes(notes) {
        const grid = document.getElementById('notes-grid');
        if (!grid) return;

        grid.style.opacity = '0';
        
        setTimeout(() => {
            grid.innerHTML = '';
            
            if (!notes.length) {
                this.renderEmpty(grid);
                grid.style.opacity = '1';
                return;
            }

            notes.forEach((note, i) => {
                const card = document.createElement('div');
                card.className = 'note-card';
                card.style.animationDelay = `${i * 0.08}s`;
                
                card.innerHTML = `
                    <div class="note-priority-tag priority-${note.priority || 'low'}"></div>
                    <h3>${note.title || 'Untitled'}</h3>
                    <p>${note.content || 'No description provided...'}</p>
                    <div class="card-metadata">
                        <div class="tag-cloud">
                            ${(note.tags || []).map(t => `<span class="mini-tag">#${t}</span>`).join('')}
                        </div>
                        <span class="material-icons-round" style="font-size: 18px; opacity: 0.3">north_east</span>
                    </div>
                `;

                card.addEventListener('mousemove', (e) => this.tiltCard(e, card));
                card.addEventListener('mouseleave', () => this.resetTilt(card));
                card.onclick = () => openEditor(note);
                
                grid.appendChild(card);
            });
            
            grid.style.opacity = '1';
        }, 300);
    },

    renderEmpty(container) {
        container.innerHTML = `
            <div class="empty-state-visual">
                <span class="material-icons-round empty-icon">Tips_and_updates</span>
                <h2 style="font-weight: 800; color: #fff">Zero Gravity</h2>
                <p style="color: var(--text-dim)">Твои идеи где-то в космосе. Пора их заземлить.</p>
            </div>
        `;
    },

    tiltCard(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.02)`;
        card.style.setProperty('--x', `${x}px`);
        card.style.setProperty('--y', `${y}px`);
    },

    resetTilt(card) {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)`;
    },

    initMotionEngine() {
        const fab = document.querySelector('.main-fab');
        if (fab) {
            fab.addEventListener('mousedown', () => fab.style.transform = 'scale(0.9) rotate(45deg)');
            fab.addEventListener('mouseup', () => fab.style.transform = 'scale(1.1) rotate(90deg)');
        }
    },

    showNotification(text, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'check_circle' : 'bolt';
        
        toast.innerHTML = `
            <span class="material-icons-round toast-icon">${icon}</span>
            <div class="toast-content">
                <span style="display: block; font-weight: 800; font-size: 0.9rem">${type.toUpperCase()}</span>
                <span style="font-size: 0.85rem; opacity: 0.7">${text}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(150%)';
            setTimeout(() => toast.remove(), 600);
        }, 3500);
    },

    confirmBotTransition() {
        const modal = document.createElement('div');
        modal.className = 'confirm-backdrop';
        modal.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-icon-box" style="margin-bottom: 20px">
                    <span class="material-icons-round" style="font-size: 60px; color: var(--accent-primary)">smart_toy</span>
                </div>
                <h2>Neural Link</h2>
                <p>Подключить Telegram-бота для мгновенного доступа к твоим черновикам?</p>
                <div class="action-flex">
                    <button class="btn-secondary" onclick="this.closest('.confirm-backdrop').remove()">Позже</button>
                    <button class="btn-primary" onclick="UI.executeRedirect(this)">Подключить</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    executeRedirect(btn) {
        btn.innerHTML = '<span class="loading-circle" style="width: 20px; height: 20px; border-width: 2px"></span>';
        setTimeout(() => {
            window.open('https://t.me/your_bot', '_blank');
            btn.closest('.confirm-backdrop').remove();
            this.showNotification('Синхронизация запущена', 'success');
        }, 1200);
    }
};



window.toggleSidebar = (state) => UI.toggleSidebar(state);
window.renderNotes = (notes) => UI.renderNotes(notes);
window.showNotification = (msg, type) => UI.showNotification(msg, type);
window.confirmBotTransition = () => UI.confirmBotTransition();

UI.init();
