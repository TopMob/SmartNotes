// Вставь сюда URL, который ты скопировал на Шаге 1
const GOOGLE_SHEET_APP_URL = "https://script.google.com/macros/s/AKfycbwlkUDV6h6R6uhnqlDoIu4losqPbntkeK_SUtHuNS0PhpTnNBy4vTxSr0B_AhZziH4/exec";

const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let state = {
    user: null,
    notes: [],
    folders: [],
    currentView: 'notes',
    activeFolderId: null,
    searchQuery: '',
    config: {
        lang: 'ru',
        accentColor: '#00ffcc',
        bgColor: '#0a0a0a'
    }

};
