function toggleSidebar(show) {
    document.getElementById('sidebar').classList.toggle('active', show);
}

function toggleSettings(show) {
    document.getElementById('settings-modal').style.display = show ? 'flex' : 'none';
    if(show) toggleSidebar(false);
}

// Быстрое сохранение из нижней панели
async function quickSave() {
    const text = document.getElementById('noteInput').value.trim();
    if (!text || !auth.currentUser) return;
    
    await db.collection("notes").add({
        uid: auth.currentUser.uid,
        text: text,
        createdAt: Date.now(),
        tags: []
    });
    document.getElementById('noteInput').value = '';
}

// Чтобы закрывать меню кликом по экрану
document.querySelector('.main-wrapper').onclick = (e) => {
    if(!e.target.closest('.menu-toggle')) toggleSidebar(false);
}
