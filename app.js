const firebaseConfig = {
    apiKey: "AIzaSyCOAAF9hCoEcp0WW5Px34OVWpqae029VkY",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
let editId = null;

// 1. ФУНКЦИЯ ВХОДА (Оптимизирована для iOS/Safari)
async function handleLogin() {
    // Удаляем проверку на мобилку и всегда делаем редирект
    console.log("Запуск переадресации (Redirect) для всех устройств");
    try {
        await auth.signInWithRedirect(provider);
    } catch (e) {
        alert("Ошибка входа: " + e.message);
    }
}

// 2. ОБРАБОТКА ВОЗВРАТА (Критично для iPhone)
// Эта функция подхватывает пользователя, когда он вернулся от Google
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log("Успешный вход после редиректа");
    }
}).catch((e) => {
    if (e.code !== 'auth/redirect-cancelled-by-user') {
        console.error("Ошибка после редиректа:", e.message);
    }
});

// 3. СЛУШАТЕЛЬ СОСТОЯНИЯ
auth.onAuthStateChanged(user => {
    const loginBtn = document.getElementById('login-btn');
    const userUi = document.getElementById('user-ui');
    const appContent = document.getElementById('app-content');

    if (user) {
        loginBtn.classList.add('hidden');
        userUi.classList.remove('hidden');
        appContent.classList.remove('hidden');
        document.getElementById('user-pic').src = user.photoURL;
        document.getElementById('modal-user-pic').src = user.photoURL;
        document.getElementById('user-name').textContent = user.displayName;
        loadNotes(user.uid);
    } else {
        loginBtn.classList.remove('hidden');
        userUi.classList.add('hidden');
        appContent.classList.add('hidden');
    }
});

// --- ОСТАЛЬНАЯ ЛОГИКА (Заметки) ---

function loadNotes(uid) {
    db.collection("notes").where("uid", "==", uid).onSnapshot(snap => {
        const list = document.getElementById('notesList');
        const q = document.getElementById('search').value.toLowerCase();
        list.innerHTML = '';
        snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
            .filter(n => n.text.toLowerCase().includes(q))
            .sort((a,b) => b.createdAt - a.createdAt)
            .forEach(n => {
                const div = document.createElement('div');
                div.className = 'note';
                div.onclick = () => openEdit(n);
                div.innerHTML = `<p>${n.text}</p><div>${(n.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
                <button onclick="event.stopPropagation(); del('${n.id}')" style="position:absolute;top:15px;right:15px;background:none;border:none;color:#444;cursor:pointer">✕</button>`;
                list.appendChild(div);
            });
    });
}

async function saveNote() {
    const text = document.getElementById('noteText').value.trim();
    const tags = document.getElementById('noteTags').value.split(' ').filter(t => t).map(t => t.replace('#',''));
    if (!text) return;
    try {
        if (editId) {
            await db.collection("notes").doc(editId).update({ text, tags });
        } else {
            await db.collection("notes").add({ uid: auth.currentUser.uid, text, tags, createdAt: Date.now() });
        }
        toggleEditor(false);
    } catch (e) { alert("Ошибка сохранения: " + e.message); }
}

function openEdit(note) {
    editId = note.id;
    document.getElementById('noteText').value = note.text;
    document.getElementById('noteTags').value = (note.tags || []).map(t => '#' + t).join(' ');
    toggleModal('editor-modal', true);
}

function toggleModal(id, show) { document.getElementById(id).classList.toggle('active', show); }
function closeAll(e) { if(e.target.classList.contains('modal')) closeModals(); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function toggleEditor(s) { 
    if(!s) editId = null;
    toggleModal('editor-modal', s); 
    if(!s) { document.getElementById('noteText').value=''; document.getElementById('noteTags').value=''; } 
}

function switchAccount() { auth.signOut().then(() => handleLogin()); closeModals(); }
function confirmLogout() { if(confirm("Выйти?")) { auth.signOut(); closeModals(); } }
window.del = (id) => confirm('Удалить?') && db.collection("notes").doc(id).delete();
window.render = () => loadNotes(auth.currentUser.uid);

// Глобальные ссылки для HTML
window.handleLogin = handleLogin;
