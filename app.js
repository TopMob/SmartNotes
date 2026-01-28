const firebaseConfig = {
    apiKey: "AIzaSyCOAAF9hCoEcp0WW5Px34OVWpqae029VkY",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.appspot.com",
    messagingSenderId: "772658814715",
    appId: "1:772658814715:web:8655c65a7e6b7720743b95"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// Языковые пакеты
const i18n = {
    RU: { notes: "🚩 Заметки", archive: "📦 Архив", settings: "⚙️ Настройки", placeholder: "Напишите что-нибудь...", login: "ВХОД", lang: "ЯЗЫК", color_el: "Цвет элементов", color_bg: "Фон", close: "ЗАКРЫТЬ" },
    EN: { notes: "🚩 Notes", archive: "📦 Archive", settings: "⚙️ Settings", placeholder: "Write something...", login: "LOGIN", lang: "LANGUAGE", color_el: "Elements Color", color_bg: "Background", close: "CLOSE" }
};

let currentLang = 'RU';

async function handleLogin() {
    try { await auth.signInWithRedirect(provider); } 
    catch (e) { alert("Error: " + e.message); }
}

auth.onAuthStateChanged(user => {
    const loginBtn = document.getElementById('login-btn');
    const inputPanel = document.getElementById('input-panel');
    if (user) {
        loginBtn.classList.add('hidden');
        inputPanel.style.display = 'flex';
        document.getElementById('user-pic').src = user.photoURL;
        document.getElementById('user-ui').classList.remove('hidden');
        loadNotes(user.uid);
    } else {
        loginBtn.classList.remove('hidden');
        inputPanel.style.display = 'none';
    }
});

function setLang(lang) {
    currentLang = lang;
    document.querySelector('[onclick*="notes"]').innerText = i18n[lang].notes;
    document.querySelector('[onclick*="archive"]').innerText = i18n[lang].archive;
    document.querySelector('[onclick*="toggleSettings(true)"]').innerText = i18n[lang].settings;
    document.getElementById('noteInput').placeholder = i18n[lang].placeholder;
    document.getElementById('login-btn').innerText = i18n[lang].login;
    // Обновляем заголовки в модалке
    const labels = document.querySelectorAll('.settings-card h3');
    labels[0].innerText = i18n[lang].lang;
    labels[1].innerText = i18n[lang].color_el;
    labels[2].innerText = i18n[lang].color_bg;
    document.querySelector('.close-settings').innerText = i18n[lang].close;
}

async function quickSave() {
    const input = document.getElementById('noteInput');
    if (!input.value.trim() || !auth.currentUser) return;
    await db.collection("notes").add({
        uid: auth.currentUser.uid,
        text: input.value,
        createdAt: Date.now()
    });
    input.value = '';
}

function loadNotes(uid) {
    db.collection("notes").where("uid", "==", uid).orderBy("createdAt", "desc").onSnapshot(snap => {
        const list = document.getElementById('notesList');
        list.innerHTML = '';
        snap.forEach(doc => {
            list.innerHTML += `<div class="note-card"><p>${doc.data().text}</p></div>`;
        });
    });
}

// Функции интерфейса
window.toggleSidebar = (s) => document.getElementById('sidebar').classList.toggle('active', s);
window.toggleSettings = (s) => {
    document.getElementById('settings-modal').style.display = s ? 'flex' : 'none';
    if(s) window.toggleSidebar(false);
};
window.setAccent = (c) => document.documentElement.style.setProperty('--accent-color', c);
window.setBg = (c) => document.documentElement.style.setProperty('--bg-color', c);
window.setLang = setLang;
window.handleLogin = handleLogin;
window.quickSave = quickSave;
