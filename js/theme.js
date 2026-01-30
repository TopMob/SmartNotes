const ThemeManager = {
    themes: {
        neon: { p: '#00f2ff', name: 'Неон' },
        cyber: { p: '#ff007a', name: 'Киберпанк' },
        gold: { p: '#ffcc00', name: 'Золото' },
        emerald: { p: '#00ff88', name: 'Изумруд' },
        lava: { p: '#ff4d00', name: 'Лава' },
        midnight: { p: '#4e54c8', name: 'Полночь' },
        tokyo: { p: '#bb9af7', name: 'Токио' },
        forest: { p: '#a3e635', name: 'Лес' },
        sakura: { p: '#f472b6', name: 'Сакура' },
        space: { p: '#e879f9', name: 'Космос' }
    },

    init() {
        const saved = localStorage.getItem('app-theme-choice') || 'neon';
        this.apply(saved);
        
        const observer = new MutationObserver(() => {
            if (document.getElementById('theme-picker-root')) {
                this.renderPicker();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    renderPicker() {
        const root = document.getElementById('theme-picker-root');
        if (!root) return;
        root.innerHTML = '';
        const current = localStorage.getItem('app-theme-choice') || 'neon';

        Object.keys(this.themes).forEach(key => {
            const t = this.themes[key];
            const wrapper = document.createElement('div');
            wrapper.className = 'theme-item-wrapper';
            const dot = document.createElement('div');
            dot.className = `theme-dot ${current === key ? 'active' : ''}`;
            dot.style.background = t.p;
            dot.onclick = () => {
                this.apply(key);
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            };
            const label = document.createElement('span');
            label.className = 'theme-label';
            label.innerText = t.name;
            wrapper.appendChild(dot);
            wrapper.appendChild(label);
            root.appendChild(wrapper);
        });
    },

    apply(key) {
        const theme = this.themes[key] || this.themes.neon;
        const root = document.documentElement;
        root.style.setProperty('--primary', theme.p);
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(theme.p);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
        root.style.setProperty('--primary-rgb', rgb);
        localStorage.setItem('app-theme-choice', key);
    }
};

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
