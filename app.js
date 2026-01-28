// 1. Конфигурация Firebase (ТВОИ ДАННЫЕ)
const firebaseConfig = {
    apiKey: "AIzaSyCOAAF9hCoEcp0WW5Px34OVWpqae029VkY",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.appspot.com",
    messagingSenderId: "772658814715",
    appId: "1:772658814715:web:8655c65a7e6b7720743b95"
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// 2. ЛОГИКА АВТОРИЗАЦИИ (Исправлено для iOS/ПК)
async function handleLogin() {
    console.log("Запуск переадресации...");
    try {
        await auth.signInWithRedirect(provider);
    } catch (e) {
        alert("Ошибка входа: " + e.message);
    }
}

// Проверка результата редиректа при загрузке страницы
auth.getRedirectResult().catch((e) => {
    if (e.code !== 'auth/configuration-not-found') {
        console.error("Ошибка редиректа:", e.message);
    }
});

// Следим за состоянием пользователя
auth.onAuthStateChanged(user => {
    const loginBtn = document.getElementById('login-btn');
    const userUi = document.getElementById('user-ui');
    const inputPanel = document.getElementById('input-panel');

    if (user) {
        loginBtn.classList.add('hidden');
        userUi.classList.remove('hidden');
        inputPanel.style.display = 'flex';
        document.getElementById('user-pic').src = user.photoURL;
        loadNotes(user.uid);
    } else {
        loginBtn.classList.remove('hidden');
        userUi.classList.add('hidden');
        inputPanel.style.display = 'none';
    }
});

// 3. РАБОТА С ЗАМЕТКАМИ
async function quickSave() {
    const input = document.getElementById('noteInput');
    const text = input.value.trim();
    if (!text || !auth.currentUser) return;

    try {
        await db.collection("notes").add({
            uid: auth.currentUser.uid,
            text: text,
            createdAt: Date.now(),
            tags: extractTags(text) // Функция для поиска #тегов
        });
        input.value = '';
    } catch (e) {
        console.error("Ошибка сохранения:", e);
    }
}

function extractTags(text) {
    const tags = text.match(/#\w+/g);
    return tags ? tags : [];
}

function loadNotes(uid) {
    db.collection("notes")
        .where("uid", "==", uid)
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            const list = document.getElementById('notesList');
            list.innerHTML = '';
            snapshot.forEach(doc => {
                const note = doc.data();
                list.innerHTML += `
                    <div class="note-card">
                        <p>${note.text}</p>
                        <div class="tags-row">
                            ${note.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                        </div>
                    </div>
                `;
            });
        });
}

// 4. ИНТЕРФЕЙС (Sidebar и Настройки)
function toggleSidebar(show) {
    const sb = document.getElementById('sidebar');
    if (show) sb.classList.add('active');
    else sb.classList.remove('active');
}

function toggleSettings(show) {
    document.getElementById('settings-modal').style.display = show ? 'flex' : 'none';
    if (show) toggleSidebar(false);
}

function setAccent(color) {
    document.documentElement.style.setProperty('--accent-color', color);
}

// Делаем функции доступными для HTML
window.handleLogin = handleLogin;
window.toggleSidebar = toggleSidebar;
window.toggleSettings = toggleSettings;
window.quickSave = quickSave;
window.setAccent = setAccent;
