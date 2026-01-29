const themes = {
    neon: {
        primary: '#00ffcc',
        secondary: '#7c4dff',
        glow: 'rgba(0, 255, 204, 0.35)'
    },
    cyber: {
        primary: '#ff0055',
        secondary: '#00d4ff',
        glow: 'rgba(255, 0, 85, 0.35)'
    },
    gold: {
        primary: '#ffcc00',
        secondary: '#ff6600',
        glow: 'rgba(255, 204, 0, 0.35)'
    },
    forest: {
        primary: '#2ecc71',
        secondary: '#27ae60',
        glow: 'rgba(46, 204, 113, 0.35)'
    },
    ocean: {
        primary: '#00d2ff',
        secondary: '#3a7bd5',
        glow: 'rgba(0, 210, 255, 0.35)'
    }
};

function applyTheme(themeName) {
    const selectedTheme = themes[themeName] || themes.neon;
    const root = document.documentElement;

    root.style.setProperty('--primary', selectedTheme.primary);
    root.style.setProperty('--secondary', selectedTheme.secondary);
    root.style.setProperty('--primary-glow', selectedTheme.glow);

    localStorage.setItem('smart-notes-theme', themeName);
    
    updateThemeSelectorUI(themeName);
    playThemeTransitionEffect();
}

function updateThemeSelectorUI(activeTheme) {
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.remove('active');
        if (dot.dataset.theme === activeTheme) {
            dot.classList.add('active');
        }
    });
}

function playThemeTransitionEffect() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'var(--primary)';
    overlay.style.opacity = '0.15';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    overlay.style.transition = 'opacity 0.8s ease';
    
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 800);
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('smart-notes-theme') || 'neon';
    applyTheme(savedTheme);
}

function createThemePicker() {
    const container = document.createElement('div');
    container.className = 'theme-picker-container';
    container.style.display = 'flex';
    container.style.gap = '12px';
    container.style.padding = '15px';
    container.style.justifyContent = 'center';

    Object.keys(themes).forEach(name => {
        const dot = document.createElement('div');
        dot.className = 'theme-dot';
        dot.dataset.theme = name;
        dot.style.width = '24px';
        dot.style.height = '24px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = themes[name].primary;
        dot.style.cursor = 'pointer';
        dot.style.border = '2px solid transparent';
        dot.style.transition = 'var(--transition)';
        
        dot.onclick = () => applyTheme(name);
        
        container.appendChild(dot);
    });

    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter) {
        sidebarFooter.prepend(container);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    createThemePicker();
});

window.addEventListener('storage', (e) => {
    if (e.key === 'smart-notes-theme') {
        applyTheme(e.newValue);
    }
});