const ThemeManager = {
    // Preset definitions: primary, bg, text
    themes: {
        neon: { p: '#00f2ff', bg: '#050505', t: '#ffffff' },
        cyber: { p: '#ff007a', bg: '#0a0005', t: '#ffccdd' },
        gold: { p: '#ffcc00', bg: '#0a0a00', t: '#ffffcc' },
        emerald: { p: '#00ff88', bg: '#001a0a', t: '#ccffdd' },
        lava: { p: '#ff4d00', bg: '#1a0500', t: '#ffcccc' },
        midnight: { p: '#4e54c8', bg: '#050510', t: '#ccccff' },
        forest: { p: '#a3e635', bg: '#0a1500', t: '#eeffcc' },
        space: { p: '#e879f9', bg: '#100015', t: '#ffccff' }
    },

    init() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings'));
        if (saved) {
            this.setManual(saved.p, saved.bg, saved.t);
        } else {
            this.reset();
        }
        
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

        Object.keys(this.themes).forEach(key => {
            const t = this.themes[key];
            const wrapper = document.createElement('div');
            wrapper.className = 'theme-item-wrapper';
            const dot = document.createElement('div');
            dot.className = 'theme-dot';
            dot.style.background = t.p;
            
            // Preview interaction
            dot.onclick = () => {
                // Apply immediately to show preview
                this.applyCSS(t.p, t.bg, t.t);
                // Update inputs
                document.getElementById('cp-primary').value = t.p;
                document.getElementById('cp-bg').value = t.bg;
                document.getElementById('cp-text').value = t.t;
                
                document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
            };
            wrapper.appendChild(dot);
            root.appendChild(wrapper);
        });
    },

    setManual(primary, bg, text) {
        this.applyCSS(primary, bg, text);
        localStorage.setItem('app-theme-settings', JSON.stringify({ p: primary, bg: bg, t: text }));
    },

    applyCSS(p, bg, t) {
        const root = document.documentElement;
        root.style.setProperty('--primary', p);
        root.style.setProperty('--bg', bg);
        root.style.setProperty('--surface', this.lighten(bg, 5)); // slightly lighter than bg
        root.style.setProperty('--text', t);
        
        const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(p);
        const rgb = res ? `${parseInt(res[1], 16)}, ${parseInt(res[2], 16)}, ${parseInt(res[3], 16)}` : '0, 242, 255';
        root.style.setProperty('--primary-rgb', rgb);
    },

    reset() {
        const def = this.themes.neon;
        this.setManual(def.p, def.bg, def.t);
        if(document.getElementById('cp-primary')) {
            document.getElementById('cp-primary').value = def.p;
            document.getElementById('cp-bg').value = def.bg;
            document.getElementById('cp-text').value = def.t;
        }
    },

    revertToLastSaved() {
        const saved = JSON.parse(localStorage.getItem('app-theme-settings'));
        if (saved) this.applyCSS(saved.p, saved.bg, saved.t);
        else this.reset();
    },

    lighten(col, amt) {
        let usePound = false;
        if (col[0] == "#") { col = col.slice(1); usePound = true; }
        let num = parseInt(col,16);
        let r = (num >> 16) + amt; if (r > 255) r = 255; else if  (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt; if (b > 255) b = 255; else if  (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt; if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
    }
};

document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
