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

// 2. Загрузка темы и настроек при старте
window.onload = () => {
    const savedAccent = localStorage.getItem('accent') || '#00ffcc';
    const savedBg = localStorage.getItem('bg') || '#050505';
    const savedLang = localStorage.getItem('lang') || 'RU';
    
    window.setAccent(savedAccent);
    window.setBg(savedBg);
    window.setLang(savedLang);
};

// 3. Авторизация
window.handleLogin = async () => {
    try {
        await auth.signInWithRedirect(provider);
    } catch (e) {
        console.error("Login Error:", e);
    }
};

auth.onAuthStateChanged(user => {
    const loginBtn = document.getElementById('login-btn');
    const userUi = document.getElementById('user-ui');
    const inputPanel = document.getElementById('input-panel');
    const floatAdd = document.getElementById('float-add');

    if (user) {
        loginBtn.classList.add('hidden');
        userUi.classList.remove('hidden');
        if (floatAdd) floatAdd.classList.remove('hidden');
        document.getElementById('user-pic').src = user.photoURL;
        loadNotes(user.uid);
    } else {
        loginBtn.classList.remove('hidden');
        userUi.classList.add('hidden');
        if (floatAdd) floatAdd.classList.add('hidden');
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
        window.toggleInput(false); // Скрываем панель после сохранения
    } catch (e) {
        console.error("Save Error:", e);
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

// 5. Интерфейс и переключатели
window.toggleSidebar = (show) => {
    document.getElementById('sidebar').classList.toggle('active', show);
};

window.toggleSettings = (show) => {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
    if (show) window.toggleSidebar(false);
};

window.toggleInput = (show) => {
    const panel = document.getElementById('input-panel');
    const btn = document.getElementById('float-add');
    if (panel) {
        panel.classList.toggle('active', show);
        panel.style.display = show ? 'flex' : 'none';
    }
    if (btn) btn.classList.toggle('hidden', show);
    if (show) document.getElementById('noteInput').focus();
};

// 6. Настройки (Цвета и Язык)
window.setAccent = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--sidebar-bg', color);
    const circle = document.getElementById('circle-el');
    if (circle) circle.style.background = color;
    localStorage.setItem('accent', color);
};

window.setBg = (color) => {
    document.documentElement.style.setProperty('--bg-color', color);
    const circle = document.getElementById('circle-bg');
    if (circle) circle.style.background = color;
    localStorage.setItem('bg', color);
};

window.setLang = (lang) => {
    const i18n = {
        RU: {
            notes: "Заметки", archive: "Архив", settings: "Настройки",
            placeholder: "Напишите что-нибудь...", login: "ВХОД",
            l_lang: "Язык", l_el: "Цвет элементов", l_bg: "Фон", ok: "ОК"
        },
        EN: {
            notes: "Notes", archive: "Archive", settings: "Settings",
            placeholder: "Write something...", login: "LOGIN",
            l_lang: "Language", l_el: "Elements Color", l_bg: "Background", ok: "OK"
        }
    };
    
    const t = i18n[lang];
    localStorage.setItem('lang', lang);

    document.getElementById('m-notes').innerText = t.notes;
    document.getElementById('m-archive').innerText = t.archive;
    document.getElementById('m-settings').innerText = t.settings;
    document.getElementById('noteInput').placeholder = t.placeholder;
    document.getElementById('login-btn').innerText = t.login;
    document.getElementById('l-lang').innerText = t.l_lang;
    document.getElementById('l-el').innerText = t.l_el;
    document.getElementById('l-bg').innerText = t.l_bg;
    document.getElementById('btn-close').innerText = t.ok;
};

// Закрытие по клику вне сайдбара
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        window.toggleSidebar(false);
    }
});