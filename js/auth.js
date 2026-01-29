// =========================================
// 1. СЛУШАТЕЛЬ СОСТОЯНИЯ (AUTH STATE)
// =========================================
auth.onAuthStateChanged(user => {
    if (user) {
        state.user = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'grid';
        
        // Обновляем UI данными пользователя
        document.getElementById('user-photo').src = user.photoURL || '';
        document.getElementById('user-name').innerText = user.displayName;
        
        log("Пользователь вошел:", user.displayName);
        
        // Инициализируем загрузку данных из db.js (напишем в следующем файле)
        if (window.initApp) initApp(); 
    } else {
        state.user = null;
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        log("Пользователь не авторизован");
    }
});

// =========================================
// 2. ФУНКЦИИ ВХОДА И ВЫХОДА
// =========================================
async function login() {
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Ошибка входа:", error);
    }
}

// Универсальная функция подтверждения (для смены аккаунта и выхода)
function confirmAction(type) {
    const modal = document.getElementById('confirm-modal');
    const title = document.getElementById('confirm-title');
    const btn = document.getElementById('confirm-action-btn');
    
    modal.classList.add('active');
    
    if (type === 'logout') {
        title.innerText = "Выйти из аккаунта?";
        btn.onclick = async () => {
            await auth.signOut();
            closeConfirm();
        };
    } else if (type === 'switch') {
        title.innerText = "Сменить аккаунт?";
        btn.onclick = async () => {
            // Принудительный выбор аккаунта через провайдер
            await auth.signInWithPopup(provider);
            closeConfirm();
        };
    }
}

function closeConfirm() {
    document.getElementById('confirm-modal').classList.remove('active');
}

// Переключение выпадающего меню пользователя
document.getElementById('user-menu-trigger').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('active');
};

// Закрытие меню при клике в любом месте
window.onclick = () => {
    document.getElementById('user-dropdown').classList.remove('active');
};