async function login() {
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error(error);
    }
}

async function logout() {
    try {
        await auth.signOut();
        window.location.reload();
    } catch (error) {
        console.error(error);
    }
}

auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    if (user) {
        state.user = user;

        if (userPhoto) userPhoto.src = user.photoURL || '';
        if (userName) userName.textContent = user.displayName || '';

        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => {
                loginScreen.style.display = 'none';
                loginScreen.classList.remove('active');
            }, 500);
        }

        if (appScreen) {
            appScreen.style.display = 'grid';
            setTimeout(() => {
                appScreen.style.opacity = '1';
                appScreen.classList.add('active');
            }, 100);
        }

        if (typeof initApp === 'function') {
            initApp(); 
        } else {
            if (typeof syncFolders === 'function') syncFolders();
            if (typeof syncNotes === 'function') syncNotes();
        }

    } else {
        state.user = null;

        if (appScreen) {
            appScreen.style.opacity = '0';
            appScreen.style.display = 'none';
            appScreen.classList.remove('active');
        }

        if (loginScreen) {
            loginScreen.style.display = 'flex';
            setTimeout(() => {
                loginScreen.style.opacity = '1';
                loginScreen.classList.add('active');
            }, 100);
        }
    }
});

async function switchAccount() {
    try {
        await auth.signOut();
        provider.setCustomParameters({ prompt: 'select_account' });
        await login();
    } catch (error) {
        console.error(error);
    }
}
