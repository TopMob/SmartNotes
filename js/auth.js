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
        console.warn("Auth Code:", e.code);
        switch (e.code) {
            case 'auth/account-exists-with-different-credential':
                UI.showToast("Войдите через Google (эта почта уже занята им)");
                break;
            case 'auth/email-already-in-use':
                UI.showToast("Почта занята. Попробуйте войти, а не регистрироваться");
                break;
            case 'auth/wrong-password':
                UI.showToast("Неверный пароль или вход через Google");
                break;
            case 'auth/user-not-found':
                UI.showToast("Пользователь не найден");
                break;
            case 'auth/popup-closed-by-user':
                UI.showToast("Окно закрыто");
                break;
            default:
                UI.showToast("Ошибка: " + e.code);
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
        await auth.signOut();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            window.location.reload();
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
        }
        if (appScreen) {
            appScreen.style.display = 'flex';
            appScreen.style.opacity = '1';
        }
        if (typeof initApp === 'function') initApp(); 
    } else {
        state.user = null;
        if (appScreen) appScreen.style.display = 'none';
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.style.opacity = '1';
        }
    }
});
