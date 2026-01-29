// =========================================
// 1. КОНФИГУРАЦИЯ ТЕМ
// =========================================
const PRESETS = [
    { name: 'Киберпанк', primary: '#00ffcc', bg: '#0a0a0a' },
    { name: 'Полночь', primary: '#7c4dff', bg: '#050505' },
    { name: 'Закат', primary: '#ff5252', bg: '#0f0a0a' },
    { name: 'Лес', primary: '#69f0ae', bg: '#0a0f0d' },
    { name: 'Океан', primary: '#40c4ff', bg: '#0a0d0f' }
];

// =========================================
// 2. ФУНКЦИИ ПРИМЕНЕНИЯ ЦВЕТА
// =========================================

// Основная функция смены темы
function applyTheme(primaryColor, bgColor = null) {
    const root = document.documentElement;
    
    // Меняем переменную акцента
    root.style.setProperty('--primary', primaryColor);
    
    // Генерируем свечение (glow) с прозрачностью 30%
    root.style.setProperty('--primary-glow', primaryColor + '4d');
    
    if (bgColor) {
        root.style.setProperty('--bg', bgColor);
    }

    // Сохраняем в локальное хранилище, чтобы тема не слетала после перезагрузки
    localStorage.setItem('sn-accent', primaryColor);
    if (bgColor) localStorage.setItem('sn-bg', bgColor);

    log(`Тема обновлена: ${primaryColor}`);
}

// Выбор из палитры
function applyCustomColor(color) {
    applyTheme(color);
}

// =========================================
// 3. ИНИЦИАЛИЗАЦИЯ НАСТРОЕК
// =========================================
function initThemeSettings() {
    const presetsGrid = document.getElementById('presets-grid');
    if (!presetsGrid) return;

    presetsGrid.innerHTML = '';
    
    PRESETS.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'preset-card';
        btn.style.backgroundColor = preset.bg;
        btn.style.border = `2px solid ${preset.primary}`;
        btn.innerHTML = `<span style="color: ${preset.primary}">${preset.name}</span>`;
        
        btn.onclick = () => applyTheme(preset.primary, preset.bg);
        presetsGrid.appendChild(btn);
    });

    // Загружаем сохраненную тему
    const savedAccent = localStorage.getItem('sn-accent');
    const savedBg = localStorage.getItem('sn-bg');
    if (savedAccent) applyTheme(savedAccent, savedBg);
}

// Функции модалки настроек
function openSettings() {
    document.getElementById('settings-modal').classList.add('active');
    initThemeSettings();
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
    initThemeSettings();
});