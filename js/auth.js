const Auth = {
    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async loginGithub() {
        const provider = new firebase.auth.GithubAuthProvider();
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async loginEmail() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async registerEmail() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        if (pass.length < 6) return UI.showToast("Пароль от 6 символов");
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            UI.showToast("Успешная регистрация!");
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    handleAuthError(e) {
        console.error("Auth Error:", e.code, e.message);
        switch (e.code) {
            case 'auth/account-exists-with-different-credential':
                UI.showToast("Эта почта уже привязана к другому способу входа");
                break;
            case 'auth/email-already-in-use':
                UI.showToast("Пользователь с такой почтой уже существует");
                break;
            case 'auth/wrong-password':
                UI.showToast("Неверный пароль");
            case 'auth/user-not-found':
                UI.showToast("Пользователь не найден");
                break;
            case 'auth/popup-closed-by-user':
                UI.showToast("Окно входа было закрыто");
                break;
            default:
                UI.showToast("Ошибка авторизации: " + e.message);
        }
    },

    async logout() {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (e) {
            UI.showToast("Ошибка при выходе");
        }
    },

    async switchAccount() {
        const user = auth.currentUser;
        if (user && user.providerData.some(p => p.providerId === 'google.com')) {
            await auth.signOut();
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            try {
                await auth.signInWithPopup(provider);
            } catch (e) {
                window.location.reload();
            }
        } else {
            this.logout();
        }
    },

    switchGoogleAccount() {
        this.switchAccount();
    }
};

auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;
        if (userPhoto) userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`;
        if (userName) userName.textContent = user.displayName || user.email.split('@')[0];

        if (loginScreen) {
            loginScreen.style.display = 'none';
            loginScreen.classList.remove('active');
        }
        if (appScreen) {
            appScreen.style.display = 'flex';
            appScreen.classList.add('active');
            appScreen.style.opacity = '1';
        }
        if (typeof initApp === 'function') initApp(); 
    } else {
        state.user = null;
        if (appScreen) {
            appScreen.style.display = 'none';
            appScreen.classList.remove('active');
        }
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.add('active');
            loginScreen.style.opacity = '1';
        }
    }
});
