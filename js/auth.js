/**
 * Smart Notes - Модуль авторизации
 */

// Слушатель состояния авторизации
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;
        
        // Скрываем вход, показываем приложение
        if (loginScreen) loginScreen.style.display = 'none';
        if (appScreen) appScreen.style.display = 'grid';
        
        // Обновляем данные профиля
        if (userPhoto) userPhoto.src = user.photoURL || '';
        if (userName) userName.innerText = user.displayName || 'Пользователь';
        
        console.log("Авторизован:", user.displayName);
        
        // Запускаем загрузку данных из db.js
        if (typeof initApp === 'function') {
            initApp();
        }
    } else {
        state.user = null;
        
        // Показываем вход, скрываем приложение
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appScreen) appScreen.style.display = 'none';
        
        console.log("Пользователь вышел");
    }
});

/**
 * Вход через Google
 */
async function login() {
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Ошибка при входе:", error);
        alert("Не удалось войти через Google");
    }
}

/**
 * Универсальное окно подтверждения
 * @param {string} type - 'logout' или 'switch'
 */
function confirmAction(type) {
    const modal = document.getElementById('confirm-modal');
    const title = document.getElementById('confirm-title');
    const btn = document.getElementById('confirm-action-btn');
    
    if (!modal) return;

    modal.classList.add('active');
    
    if (type === 'logout') {
        if (title) title.innerText = "Выйти из аккаунта?";
        btn.onclick = async () => {
            await auth.signOut();
            closeConfirm();
        };
    } else if (type === 'switch') {
        if (title) title.innerText = "Сменить аккаунт?";
        btn.onclick = async () => {
            // Принудительный вызов окна выбора аккаунта
            await auth.signInWithPopup(provider);
            closeConfirm();
        };
    }
}

/**
 * Закрытие окна подтверждения
 */
function closeConfirm() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('active');
}

// Логика выпадающего меню профиля
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const trigger = document.getElementById('user-menu-trigger');
    
    if (!dropdown) return;

    if (trigger && trigger.contains(e.target)) {
        dropdown.classList.toggle('active');
    } else {
        dropdown.classList.remove('active');
    }
});
