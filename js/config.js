const firebaseConfig = {
    apiKey: "AIzaSyCtM3kS2F7P7m21Phx4QJenLIPbtgedRRw",
    authDomain: "smartnotes-f5733.firebaseapp.com",
    projectId: "smartnotes-f5733",
    storageBucket: "smartnotes-f5733.firebasestorage.app",
    messagingSenderId: "523799066979",
    appId: "1:523799066979:web:abc13814f34864230cbb56"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let state = {
    user: null,
    notes: [],
    folders: [],
    view: 'notes',
    activeFolderId: null,
    searchQuery: '',
    currentNote: null,
    tempRating: 0,
    config: { lang: 'ru' }
};

const LANG = {
    ru: {
        slogan: "Ваши мысли. В порядке.", login_google: "Войти через Google", all_notes: "Все записи",
        favorites: "Важное", archive: "Архив", folders: "ПАПКИ", about: "О нас", rate: "Оценить",
        settings: "Настройки", switch_acc: "Сменить", logout: "Выйти", empty: "Здесь пока пусто",
        general: "Общие", language: "Язык", appearance: "Внешний вид", presets: "Пресеты",
        manual: "Ручная настройка", c_text: "Текст", c_accent: "Акцент", c_bg: "Фон",
        reset: "Сбросить", close: "Закрыть", save: "Сохранить", team: "Команда",
        contact_us: "Связаться с нами:", send: "Отправить", cancel: "Отмена", yes: "Да"
    },
    en: {
        slogan: "Your thoughts. Organized.", login_google: "Sign in with Google", all_notes: "All Notes",
        favorites: "Important", archive: "Archive", folders: "FOLDERS", about: "About", rate: "Rate Us",
        settings: "Settings", switch_acc: "Switch", logout: "Logout", empty: "Nothing here yet",
        general: "General", language: "Language", appearance: "Appearance", presets: "Presets",
        manual: "Manual Config", c_text: "Text", c_accent: "Accent", c_bg: "Background",
        reset: "Reset", close: "Close", save: "Save", team: "Team",
        contact_us: "Contact us:", send: "Send", cancel: "Cancel", yes: "Yes"
    }
};
