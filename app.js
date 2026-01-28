// 1. Конфигурация Firebase
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

// 2. Локализация (RU/EN)
const i18n = {
    RU: {
        notes: "Заметки", archive: "Архив", settings: "Настройки",
        placeholder: "Напишите что-нибудь...", login: "ВХОД",
        l_lang: "Язык", l_el: "Цвет элементов", l_bg: "Фон", btn_close: "ЗАКРЫТЬ"
    },
    EN: {
        notes: "Notes", archive: "Archive", settings: "Settings",
        placeholder: "Write something...", login: "LOGIN",
        l_lang: "Language", l_el: "Elements Color", l_bg: "Background", btn_close: "CLOSE"
    }
};

// 3. Авторизация
window.handleLogin = async () => {
    try {
        await auth.signInWithRedirect(provider);
    } catch (e) {
        alert("Ошибка: " + e.message);
    }
};

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

// 4. Работа с заметками
window.quickSave = async () => {
    const input = document.getElementById('noteInput');
    const text = input.value.trim();
    if (!text || !auth.currentUser) return;

    try {
        await db.collection("notes").add({
            uid: auth.currentUser.uid,
            text: text,
            createdAt: Date.now()
        });
        input.value = '';
    } catch (e) {
        console.error(e);
    }
};

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
                    </div>
                `;
            });
        });
}

// 5. Интерфейс и настройки
window.toggleSidebar = (show) => {
    document.getElementById('sidebar').classList.toggle('active', show);
};

window.toggleSettings = (show) => {
    document.getElementById('settings-modal').style.display = show ? 'flex' : 'none';
    if (show) window.toggleSidebar(false);
};

window.setLang = (lang) => {
    const t = i18n[lang];
    document.getElementById('m-notes').innerText = t.notes;
    document.getElementById('m-archive').innerText = t.archive;
    document.getElementById('m-settings').innerText = t.settings;
    document.getElementById('noteInput').placeholder = t.placeholder;
    document.getElementById('login-btn').innerText = t.login;
    document.getElementById('l-lang').innerText = t.l_lang;
    document.getElementById('l-el').innerText = t.l_el;
    document.getElementById('l-bg').innerText = t.l_bg;
    document.getElementById('btn-close').innerText = t.btn_close;
};

window.setAccent = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--sidebar-bg', color);
};

window.setBg = (color) => {
    document.documentElement.style.setProperty('--bg-color', color);
};

// При клике на пустую область закрываем сайдбар
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        window.toggleSidebar(false);
    }
});