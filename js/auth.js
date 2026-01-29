const Auth = {
    init() {
        this.observer();
        this.bindEvents();
    },

    bindEvents() {
        const loginBtn = document.getElementById('google-login-btn');
        if (loginBtn) {
            loginBtn.onclick = () => this.signIn();
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.signOut();
        }
    },

    async signIn() {
        const provider = new firebase.auth.GoogleAuthProvider();
        const btn = document.getElementById('google-login-btn');
        
        try {
            this.toggleLoading(true);
            btn.style.transform = 'scale(0.95) translateY(5px)';
            
            await firebase.auth().signInWithPopup(provider);
            UI.showNotification('Access Granted', 'success');
        } catch (error) {
            console.error(error);
            UI.showNotification('Auth Failed', 'error');
            this.toggleLoading(false);
        }
    },

    async signOut() {
        try {
            document.body.style.filter = 'blur(20px) grayscale(1)';
            document.body.style.opacity = '0.5';
            
            await firebase.auth().signOut();
            location.reload();
        } catch (error) {
            UI.showNotification('Sign out error', 'error');
        }
    },

    observer() {
        firebase.auth().onAuthStateChanged((user) => {
            const loginScreen = document.getElementById('login-screen');
            const app = document.getElementById('app');

            if (user) {
                this.transitionToApp(loginScreen, app, user);
            } else {
                this.transitionToLogin(loginScreen, app);
            }
        });
    },

    transitionToApp(login, app, user) {
        if (login) {
            login.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
            login.style.opacity = '0';
            login.style.transform = 'scale(1.1) rotateX(10deg)';
            
            setTimeout(() => {
                login.style.display = 'none';
                app.style.display = 'flex';
                this.animateInterfaceEntry(app);
                this.updateUserData(user);
            }, 600);
        }
    },

    transitionToLogin(login, app) {
        if (app) app.style.display = 'none';
        if (login) {
            login.style.display = 'flex';
            requestAnimationFrame(() => {
                login.style.opacity = '1';
                login.style.transform = 'scale(1)';
            });
        }
    },

    animateInterfaceEntry(app) {
        app.style.opacity = '0';
        app.style.transform = 'translateY(20px)';
        
        requestAnimationFrame(() => {
            app.style.transition = 'all 1s var(--curve-main)';
            app.style.opacity = '1';
            app.style.transform = 'translateY(0)';
        });
    },

    updateUserData(user) {
        const photo = document.getElementById('user-photo');
        const name = document.getElementById('user-name');
        
        if (photo) {
            photo.src = user.photoURL;
            photo.style.animation = 'avatarPulse 2s infinite alternate';
        }
        if (name) name.innerText = user.displayName;
    },

    toggleLoading(active) {
        const loader = document.getElementById('auth-loader');
        if (loader) {
            loader.style.opacity = active ? '1' : '0';
            loader.style.width = active ? '100%' : '0%';
        }
    }
};



const style = document.createElement('style');
style.textContent = `
    @keyframes avatarPulse {
        from { box-shadow: 0 0 0px var(--accent-primary); }
        to { box-shadow: 0 0 20px var(--accent-primary); }
    }
    #auth-loader {
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        transition: width 0.4s ease, opacity 0.3s ease;
        z-index: 9999;
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => Auth.init());
