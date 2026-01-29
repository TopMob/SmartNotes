const UI = {
    state: {
        isSidebarOpen: false,
        activeTheme: 'cyan'
    },

    init() {
        this.domReady();
        this.mountEventListeners();
        this.initParallaxCards();
        this.setupKeyboardShortcuts();
    },

    domReady() {
        document.body.classList.add('app-loaded');
        this.notify('System Booted', 'success');
    },

    mountEventListeners() {
        const menuBtn = document.querySelector('.menu-toggle-btn');
        const sidebar = document.querySelector('.sidebar');
        const closeBtn = document.querySelector('.close-sidebar');

        menuBtn?.addEventListener('click', () => this.toggleSidebar(true));
        closeBtn?.addEventListener('click', () => this.toggleSidebar(false));

        document.addEventListener('mousedown', (e) => {
            if (this.state.isSidebarOpen && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                this.toggleSidebar(false);
            }
        });

        const avatar = document.querySelector('.user-profile');
        const dropdown = document.querySelector('.user-dropdown');
        avatar?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown?.classList.toggle('active');
        });

        const searchInput = document.querySelector('.search-container input');
        searchInput?.addEventListener('focus', () => {
            searchInput.parentElement.style.transform = 'scale(1.02)';
        });
        searchInput?.addEventListener('blur', () => {
            searchInput.parentElement.style.transform = 'scale(1)';
        });
    },

    toggleSidebar(open) {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.app-layout');
        
        this.state.isSidebarOpen = open;
        
        if (open) {
            sidebar.classList.add('active');
            main.style.filter = 'blur(10px) brightness(0.7)';
            main.style.pointerEvents = 'none';
        } else {
            sidebar.classList.remove('active');
            main.style.filter = 'none';
            main.style.pointerEvents = 'all';
        }
    },

    initParallaxCards() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) scale(1)';
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.note-card').forEach(card => {
            observer.observe(card);
            
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / 15;
                const rotateY = (centerX - x) / 15;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
            });
        });
    },

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                window.openEditor();
            }
            if (e.key === 'Escape' && this.state.isSidebarOpen) {
                this.toggleSidebar(false);
            }
            if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                document.querySelector('.search-container input')?.focus();
            }
        });
    },

    notify(text, type = 'default') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${text}</span>`;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('visible'));
        
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    switchTheme(themeName) {
        const root = document.documentElement;
        const themes = {
            cyan: { primary: '#00d4ff', secondary: '#a200ff' },
            rose: { primary: '#ff0055', secondary: '#ff8c00' },
            emerald: { primary: '#00ff88', secondary: '#00d4ff' }
        };

        const selected = themes[themeName] || themes.cyan;
        root.style.setProperty('--accent-primary', selected.primary);
        root.style.setProperty('--accent-secondary', selected.secondary);
        
        this.notify(`Aura updated: ${themeName}`);
    }
};



document.addEventListener('DOMContentLoaded', () => UI.init());

window.setAppTheme = (t) => UI.switchTheme(t);
window.triggerToast = (m, t) => UI.notify(m, t);
