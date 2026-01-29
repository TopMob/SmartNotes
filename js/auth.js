// =========================================
// ЛОГИКА АВТОРИЗАЦИИ (AUTH SYSTEM)
// =========================================

/**
 * Вход через Google Popup
 * Использует провайдер, настроенный в config.js
 */
async function login() {
    try {
        console.log("🔐 Попытка входа...");
        await auth.signInWithPopup(provider);
        // После успешного входа сработает onAuthStateChanged
    } catch (error) {
        console.error("❌ Ошибка входа:", error);
        alert("Не удалось войти. Проверьте консоль для деталей.");
    }
}

/**
 * Полный выход из системы
 */
async function logout() {
    try {
        await auth.signOut();
        // Перезагрузка страницы для очистки состояния JS
        window.location.reload();
    } catch (error) {
        console.error("Ошибка выхода:", error);
    }
}

/**
 * Слушатель изменений состояния авторизации
 * Это "сердце", которое решает, что показывать: вход или приложение
 */
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    
    // Элементы профиля в шапке
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        // === ПОЛЬЗОВАТЕЛЬ АВТОРИЗОВАН ===
        console.log("✅ Пользователь:", user.displayName);
        
        // 1. Сохраняем пользователя в глобальный стейт
        state.user = user;

        // 2. Обновляем UI профиля
        if (userPhoto) userPhoto.src = user.photoURL || 'https://via.placeholder.com/150';
        if (userName) userName.textContent = user.displayName || 'Пользователь';

        // 3. Анимация скрытия логина и появления приложения
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => {
                loginScreen.style.display = 'none';
                loginScreen.classList.remove('active');
            }, 500);
        }

        if (appScreen) {
            appScreen.style.display = 'grid'; // Возвращаем grid-раскладку
            // Небольшая задержка для плавного fade-in
            setTimeout(() => {
                appScreen.style.opacity = '1';
                appScreen.classList.add('active');
            }, 100);
        }

        // 4. Запускаем "движок" приложения (функция из ab.js/main.js)
        if (typeof initApp === 'function') {
            initApp(); 
        } else {
            console.warn("⚠️ Функция initApp() не найдена. Проверьте подключение ab.js");
            // Если initApp еще не загрузилась, попробуем запустить загрузку напрямую
            if (typeof syncFolders === 'function') syncFolders();
            if (typeof syncNotes === 'function') syncNotes();
        }

    } else {
        // === ПОЛЬЗОВАТЕЛЬ НЕ АВТОРИЗОВАН ===
        console.log("🔒 Ожидание входа...");
        
        state.user = null;

        if (appScreen) {
            appScreen.style.opacity = '0';
            appScreen.style.display = 'none';
        }

        if (loginScreen) {
            loginScreen.style.display = 'flex';
            setTimeout(() => {
                loginScreen.style.opacity = '1';
                loginScreen.classList.add('active');
            }, 100);
        }
    }
});

/**
 * Вспомогательная функция для смены аккаунта
 * Используется в выпадающем меню профиля
 */
async function switchAccount() {
    try {
        await auth.signOut();
        // Сразу вызываем окно входа с параметром выбора аккаунта
        provider.setCustomParameters({ prompt: 'select_account' });
        await login();
    } catch (error) {
        console.error("Ошибка смены аккаунта:", error);
    }
}
