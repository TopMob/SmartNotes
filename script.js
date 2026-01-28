// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
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

// --- 2. LOCALIZATION DATA ---
const translations = {
    ru: {
        app_title: "Smart Notes",
        settings_title: "Настройки",
        lang_label: "Язык",
        color_label: "Акцент",
        close: "Закрыть",
        switch_acc: "Сменить аккаунт",
        logout: "Выйти",
        new_note: "Новая заметка",
        search_ph: "Поиск...",
        editor_ph: "Что запишем?",
        tags_ph: "#теги"
    },
    en: {
        app_title: "Smart Notes",
        settings_title: "Settings",
        lang_label: "Language",
        color_label: "Accent Color",
        close: "Close",
        switch_acc: "Switch Account",
        logout: "Logout",
        new_note: "New Note",
        search_ph: "Search...",
        editor_ph: "Type something...",
        tags_ph: "#tags"
    }
};

let currentLang = localStorage.getItem('sn_lang') || 'ru';
let currentColor = localStorage.getItem('sn_color') || '#00ffcc';

// --- 3. APP LOGIC ---

// Init App
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentColor);
    setLang(currentLang);
    
    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById('login-btn').classList.add('hidden');
            document.getElementById('user-ui').classList.remove('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            document.getElementById('user-pic').src = user.photoURL;
            document.getElementById('modal-user-pic').src = user.photoURL;
            document.getElementById('user-name').textContent = user.displayName;
            loadNotes(user.uid);
        } else {
            document.getElementById('login-btn').classList.remove('hidden');
            document.getElementById('user-ui').classList.add('hidden');
            document.getElementById('app-content').classList.add('hidden');
        }
    });
});

// Auth
window.login = () => auth.signInWithPopup(provider);
window.logout = () => { auth.signOut(); closeAllModals(); };
window.switchAccount = () => { auth.signOut().then(login); closeAllModals(); };

// Notes System
let notesCache = [];

function loadNotes(uid) {
    db.collection("notes").where("uid", "==", uid).onSnapshot(snap => {
        notesCache = snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
                        .sort((a,b) => b.createdAt - a.createdAt);
        renderNotes();
    });
}

window.renderNotes = () => {
    const list = document.getElementById('notesList');
    const q = document.getElementById('search').value.toLowerCase();
    list.innerHTML = '';
    
    const filtered = notesCache.filter(n => 
        n.text.toLowerCase().includes(q) || (n.tags || []).some(t => t.includes(q))
    );

    filtered.forEach(n => {
        const div = document.createElement('div');
        div.className = 'note';
        const tagsHtml = (n.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
        div.innerHTML = `
            <p>${n.text}</p>
            <div class="tags">${tagsHtml}</div>
            <button class="note-del" onclick="deleteNote('${n.id}')">✕</button>
        `;
        list.appendChild(div);
    });
};

window.addNote = async () => {
    const text = document.getElementById('noteText').value.trim();
    if (!text) return;
    
    await db.collection("notes").add({
        uid: auth.currentUser.uid,
        text,
        tags: document.getElementById('noteTags').value.split(' ').filter(t => t),
        createdAt: Date.now()
    });
    toggleEditor(false);
};

window.deleteNote = (id) => {
    if(confirm('Delete?')) db.collection("notes").doc(id).delete();
};

// --- 4. UI & SETTINGS FUNCTIONS ---

window.toggleModal = (id, show) => {
    const modal = document.getElementById(id);
    if(show) modal.classList.add('active');
    else modal.classList.remove('active');
};

window.toggleEditor = (show) => {
    toggleModal('editor-modal', show);
    if(!show) {
        document.getElementById('noteText').value = '';
        document.getElementById('noteTags').value = '';
    } else {
        setTimeout(() => document.getElementById('noteText').focus(), 100);
    }
};

window.closeAll = (e) => {
    if (e.target.classList.contains('modal')) closeAllModals();
};

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// Theme & Language Logic
window.setTheme = (color) => {
    currentColor = color;
    localStorage.setItem('sn_color', color);
    applyTheme(color);
};

function applyTheme(color) {
    document.documentElement.style.setProperty('--accent', color);
    // Glow effect variable
    document.documentElement.style.setProperty('--accent-glow', `${color}33`);
}

window.setLang = (lang) => {
    currentLang = lang;
    localStorage.setItem('sn_lang', lang);
    
    // Update Buttons
    document.getElementById('btn-ru').classList.toggle('active', lang === 'ru');
    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    
    // Update Text
    const t = translations[lang];
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(t[key]) el.textContent = t[key];
    });
    
    // Update Placeholders
    document.getElementById('search').placeholder = t.search_ph;
    document.getElementById('noteText').placeholder = t.editor_ph;
    document.getElementById('noteTags').placeholder = t.tags_ph;
};