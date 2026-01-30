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
        const email = document.getElementById('auth-email')?.value.trim();
        const pass = document.getElementById('auth-pass')?.value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    async registerEmail() {
        const email = document.getElementById('auth-email')?.value.trim();
        const pass = document.getElementById('auth-pass')?.value;
        if (!email || !pass) return UI.showToast("Заполните все поля");
        if (pass.length < 6) return UI.showToast("Пароль от 6 символов");
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            UI.showToast("Регистрация успешна!");
        } catch (e) {
            this.handleAuthError(e);
        }
    },

    handleAuthError(e) {
        console.error("Auth System Error:", e.code);
        const errorMessages = {
            'auth/account-exists-with-different-credential': "Этот Email уже привязан к другому способу входа",
            'auth/email-already-in-use': "Эта почта уже занята, попробуйте войти",
            'auth/wrong-password': "Неверный пароль",
            'auth/user-not-found': "Пользователь не найден",
            'auth/popup-closed-by-user': "Окно входа было закрыто",
            'auth/invalid-email': "Некорректный формат почты",
            'auth/network-request-failed': "Проблема с интернетом"
        };
        UI.showToast(errorMessages[e.code] || `Ошибка: ${e.code}`);
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
        try {
            await auth.signOut();
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
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
        
        if (userPhoto) {
            userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random&color=fff`;
        }
        if (userName) {
            userName.textContent = user.displayName || user.email.split('@')[0];
        }

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
