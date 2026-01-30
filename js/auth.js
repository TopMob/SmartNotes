const Auth = {
    // 1. Google
    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        try { await auth.signInWithPopup(provider); } 
        catch (e) { UI.showToast("Ошибка Google"); }
    },

    // 2. GitHub
    async loginGithub() {
        const provider = new firebase.auth.GithubAuthProvider();
        try { await auth.signInWithPopup(provider); }
        catch (e) { UI.showToast("Ошибка GitHub"); }
    },

    // 3. Почта: Вход
    async loginEmail() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        if (!email || !pass) return UI.showToast("Введите данные");

        try { await auth.signInWithEmailAndPassword(email, pass); }
        catch (e) { UI.showToast("Неверный логин или пароль"); }
    },

    // 3. Почта: Регистрация
    async registerEmail() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        if (pass.length < 6) return UI.showToast("Пароль от 6 символов");

        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            UI.showToast("Успешная регистрация!");
        } catch (e) { UI.showToast("Ошибка регистрации"); }
    },

    async logout() {
        await auth.signOut();
        window.location.reload();
    }
};

auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;
        if (userPhoto) userPhoto.src = user.photoURL || '';
        if (userName) userName.textContent = user.displayName || 'User';

        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => { loginScreen.style.display = 'none'; loginScreen.classList.remove('active'); }, 500);
        }
        if (appScreen) {
            appScreen.style.display = 'flex';
            setTimeout(() => { appScreen.style.opacity = '1'; appScreen.classList.add('active'); }, 100);
        }
        if (typeof initApp === 'function') initApp(); 
    } else {
        state.user = null;
        if (appScreen) {
            appScreen.style.opacity = '0';
            setTimeout(() => { appScreen.style.display = 'none'; appScreen.classList.remove('active'); }, 500);
        }
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            setTimeout(() => { loginScreen.style.opacity = '1'; loginScreen.classList.add('active'); }, 100);
        }
    }
});

